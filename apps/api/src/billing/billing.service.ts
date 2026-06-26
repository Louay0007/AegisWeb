import {
  BadRequestException,
  Inject,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { z } from 'zod';
import { ConfigService } from '../config/config.service.js';
import { DatabaseService } from '../database/database.service.js';

const checkoutSchema = z.object({
  plan: z.enum(['starter', 'business'])
});

type BillingPlan = z.infer<typeof checkoutSchema>['plan'];

@Injectable()
export class BillingService {
  private readonly stripe?: Stripe;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(DatabaseService) private readonly database: DatabaseService
  ) {
    const key = this.config.config.stripeSecretKey;
    this.stripe = key
      ? new Stripe(key, {
          apiVersion: '2025-08-27.basil'
        })
      : undefined;
  }

  async getStatus(organizationId: string) {
    const organization = await this.database.client.organization.findUnique({
      where: { id: organizationId },
      select: {
        plan: true,
        billingEmail: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripeSubscriptionStatus: true,
        stripePriceId: true
      }
    });

    return {
      data: {
        provider: 'stripe',
        configured: this.isConfigured(),
        mode: this.mode(),
        plan: organization?.plan ?? 'unknown',
        billingEmail: organization?.billingEmail ?? null,
        customerId: organization?.stripeCustomerId ?? null,
        subscriptionId: organization?.stripeSubscriptionId ?? null,
        subscriptionStatus: organization?.stripeSubscriptionStatus ?? null,
        priceId: organization?.stripePriceId ?? null,
        plans: {
          starter: Boolean(this.config.config.stripeStarterPriceId),
          business: Boolean(this.config.config.stripeBusinessPriceId)
        },
        message: this.isConfigured()
          ? 'Stripe billing is configured.'
          : 'Stripe billing is not configured for this deployment.'
      }
    };
  }

  async createCheckout(organizationId: string, userId: string, body: unknown) {
    const stripe = this.requireStripe();
    const { plan } = checkoutSchema.parse(body);
    const priceId = this.priceIdFor(plan);

    const organization = await this.database.client.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        domain: true,
        billingEmail: true,
        stripeCustomerId: true
      }
    });

    if (!organization) {
      throw new BadRequestException('Organization was not found.');
    }

    const user = await this.database.client.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true }
    });

    const customerId = organization.stripeCustomerId ?? await this.createCustomer(stripe, {
      organizationId: organization.id,
      name: organization.name,
      email: organization.billingEmail ?? user?.email ?? undefined,
      domain: organization.domain,
      userName: user?.name
    });

    if (!organization.stripeCustomerId) {
      await this.database.client.organization.update({
        where: { id: organizationId },
        data: { stripeCustomerId: customerId }
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: this.config.config.stripeSuccessUrl,
      cancel_url: this.config.config.stripeCancelUrl,
      allow_promotion_codes: true,
      client_reference_id: organizationId,
      metadata: { organizationId, plan },
      subscription_data: {
        metadata: { organizationId, plan }
      }
    });

    return { data: { id: session.id, url: session.url } };
  }

  async createPortal(organizationId: string) {
    const stripe = this.requireStripe();
    const organization = await this.database.client.organization.findUnique({
      where: { id: organizationId },
      select: { stripeCustomerId: true }
    });

    if (!organization?.stripeCustomerId) {
      throw new BadRequestException('This organization does not have a Stripe customer yet.');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: organization.stripeCustomerId,
      return_url: this.config.config.stripeSuccessUrl
    });

    return { data: { id: session.id, url: session.url } };
  }

  async handleWebhook(
    rawBody: Buffer | undefined,
    headers: Record<string, string | string[] | undefined>,
    fallbackBody: unknown
  ) {
    const stripe = this.requireStripe();
    const secret = this.config.config.stripeWebhookSecret;
    if (!secret) {
      throw new NotImplementedException('Stripe webhook handling is not configured for this deployment.');
    }

    const signature = header(headers, 'stripe-signature');
    if (!signature) {
      throw new BadRequestException('Missing Stripe signature.');
    }

    const payload = rawBody ?? Buffer.from(JSON.stringify(fallbackBody));
    const event = stripe.webhooks.constructEvent(payload, signature, secret);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.handleSubscriptionChange(event.data.object);
        break;
      default:
        break;
    }

    return { data: { received: true, processed: true, eventType: event.type } };
  }

  private async createCustomer(
    stripe: Stripe,
    input: {
      organizationId: string;
      name: string;
      email?: string;
      domain: string;
      userName?: string;
    }
  ): Promise<string> {
    const customer = await stripe.customers.create({
      name: input.name,
      email: input.email,
      metadata: {
        organizationId: input.organizationId,
        domain: input.domain,
        ownerName: input.userName ?? ''
      }
    });
    return customer.id;
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const organizationId = session.metadata?.organizationId ?? session.client_reference_id;
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;

    if (!organizationId || !subscriptionId || !customerId) {
      return;
    }

    const subscription = await this.requireStripe().subscriptions.retrieve(subscriptionId);
    await this.updateOrganizationSubscription(organizationId, customerId, subscription);
  }

  private async handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
    const organizationId = subscription.metadata?.organizationId;
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

    if (organizationId) {
      await this.updateOrganizationSubscription(organizationId, customerId, subscription);
      return;
    }

    await this.database.client.organization.updateMany({
      where: { stripeCustomerId: customerId },
      data: this.subscriptionData(customerId, subscription)
    });
  }

  private async updateOrganizationSubscription(
    organizationId: string,
    customerId: string,
    subscription: Stripe.Subscription
  ): Promise<void> {
    await this.database.client.organization.update({
      where: { id: organizationId },
      data: this.subscriptionData(customerId, subscription)
    });
  }

  private subscriptionData(customerId: string, subscription: Stripe.Subscription) {
    const priceId = subscription.items.data[0]?.price.id ?? null;
    const plan = priceId === this.config.config.stripeBusinessPriceId ? 'business' :
      priceId === this.config.config.stripeStarterPriceId ? 'starter' : undefined;

    return {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: subscription.status,
      stripePriceId: priceId,
      ...(plan ? { plan } : {})
    };
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new NotImplementedException('Stripe billing is not configured for this deployment.');
    }
    return this.stripe;
  }

  private isConfigured(): boolean {
    return Boolean(
      this.stripe &&
      this.config.config.stripeStarterPriceId &&
      this.config.config.stripeBusinessPriceId
    );
  }

  private mode(): 'test' | 'live' | 'disabled' {
    const key = this.config.config.stripeSecretKey;
    if (!key) return 'disabled';
    return key.startsWith('sk_live_') ? 'live' : 'test';
  }

  private priceIdFor(plan: BillingPlan): string {
    const priceId = plan === 'starter'
      ? this.config.config.stripeStarterPriceId
      : this.config.config.stripeBusinessPriceId;

    if (!priceId) {
      throw new NotImplementedException(`Stripe price for ${plan} is not configured.`);
    }

    return priceId;
  }
}

function header(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}
