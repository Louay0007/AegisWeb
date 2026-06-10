import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export type VaultStatus = {
  ready: true;
  encryption: 'aes-256-gcm';
};

export type PlainSecret = Record<string, unknown>;

export type EncryptedPayload = {
  alg: 'aes-256-gcm';
  key_version: string;
  iv: string;
  auth_tag: string;
  ciphertext: string;
  aad?: string;
};

export type VaultEncryptionContext = {
  organizationId?: string;
  credentialId?: string;
  keyVersion?: string;
};

const REDACTED = '[REDACTED]';
const SECRET_KEY_PATTERN = /password|token|secret|authorization|cookie|credential|encrypted|ciphertext|auth_tag|username|responseText/i;

export function getVaultStatus(): VaultStatus {
  return {
    ready: true,
    encryption: 'aes-256-gcm'
  };
}

export function encryptSecret(
  plaintext: PlainSecret,
  masterKey: string,
  context: VaultEncryptionContext = {}
): EncryptedPayload {
  const key = keyFromMasterKey(masterKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const aad = aadFromContext(context);
  if (aad) {
    cipher.setAAD(Buffer.from(aad, 'utf8'));
  }
  const encoded = Buffer.from(JSON.stringify(plaintext), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(encoded), cipher.final()]);

  return {
    alg: 'aes-256-gcm',
    key_version: context.keyVersion ?? 'local-v1',
    iv: iv.toString('base64'),
    auth_tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    aad: aad ? Buffer.from(aad, 'utf8').toString('base64') : undefined
  };
}

export function decryptSecret(
  payload: EncryptedPayload,
  masterKey: string,
  context: VaultEncryptionContext = {}
): PlainSecret {
  const key = keyFromMasterKey(masterKey);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
  const expectedAad = payload.aad ? Buffer.from(payload.aad, 'base64').toString('utf8') : undefined;
  const providedAad = aadFromContext({ ...context, keyVersion: context.keyVersion ?? payload.key_version });
  if (expectedAad && expectedAad !== providedAad) {
    throw new Error('Vault payload context does not match expected AAD.');
  }
  if (expectedAad) {
    decipher.setAAD(Buffer.from(expectedAad, 'utf8'));
  }
  decipher.setAuthTag(Buffer.from(payload.auth_tag, 'base64'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8');
  const parsed = JSON.parse(plaintext) as unknown;

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Vault payload must decrypt to an object.');
  }

  return parsed as PlainSecret;
}

export function redactSecretLikeValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecretLikeValues(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SECRET_KEY_PATTERN.test(key) ? REDACTED : redactSecretLikeValues(entry)
      ])
    );
  }

  return value;
}

export function assertValidMasterKey(key: string): void {
  if (typeof key !== 'string' || key.length < 32) {
    throw new Error('Vault master key must be at least 32 characters or a base64-encoded 32-byte key.');
  }

  const decoded = Buffer.from(key, 'base64');
  if (decoded.length === 32) {
    const encodedAgain = decoded.toString('base64').replace(/=+$/, '');
    const normalized = key.replace(/=+$/, '');
    if (safeEqual(encodedAgain, normalized)) {
      return;
    }
  }
}

function keyFromMasterKey(masterKey: string): Buffer {
  assertValidMasterKey(masterKey);

  const decoded = Buffer.from(masterKey, 'base64');
  if (decoded.length === 32 && safeEqual(decoded.toString('base64').replace(/=+$/, ''), masterKey.replace(/=+$/, ''))) {
    return decoded;
  }

  return createHash('sha256').update(masterKey).digest();
}

function aadFromContext(context: VaultEncryptionContext): string | undefined {
  if (!context.organizationId && !context.credentialId) {
    return undefined;
  }

  return JSON.stringify({
    organizationId: context.organizationId ?? null,
    credentialId: context.credentialId ?? null,
    keyVersion: context.keyVersion ?? 'local-v1'
  });
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
