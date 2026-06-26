import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

const DUMMY_PASSWORD = 'aegisweb-missing-user-password-equalizer';

@Injectable()
export class PasswordService {
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1
    });
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  async verifyPasswordForMissingUser(password: string): Promise<boolean> {
    const hash = await this.hashPassword(DUMMY_PASSWORD);
    return this.verifyPassword(hash, password);
  }
}
