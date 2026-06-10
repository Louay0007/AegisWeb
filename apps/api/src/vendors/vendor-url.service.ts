import { Injectable } from '@nestjs/common';
import { DomainError, DomainErrorCode } from '@agentpass/domain';

@Injectable()
export class VendorUrlService {
  normalize(website: string): string {
    try {
      const url = new URL(website.trim());
      url.protocol = url.protocol.toLowerCase();
      url.hostname = url.hostname.toLowerCase();
      url.hash = '';
      url.search = '';

      const pathname = url.pathname.replace(/\/+$/g, '');
      url.pathname = pathname === '' ? '/' : pathname;

      if (url.pathname === '/') {
        return url.origin;
      }

      return `${url.origin}${url.pathname}`;
    } catch {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Vendor website must be a valid URL.');
    }
  }

  hostname(website: string): string {
    try {
      return new URL(website).hostname.toLowerCase();
    } catch {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Vendor website must be a valid URL.');
    }
  }
}
