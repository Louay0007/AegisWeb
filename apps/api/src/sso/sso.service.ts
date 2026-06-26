import { Injectable, NotImplementedException } from '@nestjs/common';

@Injectable()
export class SsoService {
  getConfig() {
    return {
      data: {
        enabled: false,
        saml: { configured: false },
        oidc: { configured: false },
        message: 'Enterprise SSO is disabled until an identity provider is configured.'
      }
    };
  }

  updateConfig(input: unknown) {
    void input;
    return this.getConfig();
  }

  startLogin() {
    throw new NotImplementedException('Enterprise SSO is not configured for this deployment.');
  }
}
