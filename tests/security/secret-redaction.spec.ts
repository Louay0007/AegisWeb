import { describe, expect, it } from 'vitest';
import { assertValidMasterKey, decryptSecret, encryptSecret, redactSecretLikeValues } from '../../libs/vault/src/index.js';

const MASTER_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

describe('security: secret redaction and vault AAD', () => {
  it('recursively redacts nested secret-like keys including usernames and raw responses', () => {
    expect(
      redactSecretLikeValues({
        nested: {
          username: 'billing@example.dev',
          password: 'Password123!',
          responseText: 'raw token=abc',
          safe: 'visible'
        },
        list: [{ authorization: 'Bearer token' }]
      })
    ).toEqual({
      nested: {
        username: '[REDACTED]',
        password: '[REDACTED]',
        responseText: '[REDACTED]',
        safe: 'visible'
      },
      list: [{ authorization: '[REDACTED]' }]
    });
  });

  it('binds encrypted payloads to organization and credential context', () => {
    const payload = encryptSecret(
      { password: 'Password123!' },
      MASTER_KEY,
      { organizationId: 'org_a', credentialId: 'cred_a', keyVersion: 'v1' }
    );

    expect(
      decryptSecret(payload, MASTER_KEY, { organizationId: 'org_a', credentialId: 'cred_a', keyVersion: 'v1' })
    ).toEqual({ password: 'Password123!' });
    expect(() =>
      decryptSecret(payload, MASTER_KEY, { organizationId: 'org_b', credentialId: 'cred_a', keyVersion: 'v1' })
    ).toThrow(/AAD/);
  });

  it('rejects passphrase-style vault keys in production mode', () => {
    expect(() => assertValidMasterKey('production-vault-secret-that-is-long-enough', { production: true })).toThrow(
      /base64-encoded 32-byte key/
    );
    expect(() => assertValidMasterKey(MASTER_KEY, { production: true })).not.toThrow();
  });
});
