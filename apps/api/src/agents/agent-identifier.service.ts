import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

const AGENT_IDENTIFIER_DOMAIN = 'agentpass.local';

@Injectable()
export class AgentIdentifierService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async generate(name: string): Promise<string> {
    const base = slugify(name);
    let candidate = `${base}@${AGENT_IDENTIFIER_DOMAIN}`;
    let suffix = 2;

    while (await this.exists(candidate)) {
      candidate = `${base}-${suffix}@${AGENT_IDENTIFIER_DOMAIN}`;
      suffix += 1;
    }

    return candidate;
  }

  isValid(identifier: string): boolean {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*@agentpass\.local$/.test(identifier);
  }

  private async exists(identifier: string): Promise<boolean> {
    const count = await this.database.client.agent.count({
      where: { identifier }
    });
    return count > 0;
  }
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'agent';
}
