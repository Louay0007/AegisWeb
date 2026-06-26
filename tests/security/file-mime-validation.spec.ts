import { describe, expect, it, vi } from 'vitest';
import { FileKind } from '@prisma/client';
import { FilesService } from '../../apps/api/src/files/files.service.js';

describe('security: file MIME magic validation', () => {
  it('rejects files whose bytes do not match the declared MIME type before storage', async () => {
    const database = {
      client: {
        workflowRun: { findFirst: vi.fn() },
        file: { create: vi.fn() }
      }
    };
    const storage = {
      bucket: 'test-bucket',
      putObject: vi.fn(),
      objectExists: vi.fn()
    };
    const service = new FilesService(database as never, storage as never);

    await expect(
      service.uploadBuffer({
        organizationId: crypto.randomUUID(),
        kind: FileKind.SCREENSHOT,
        filename: 'screenshot.png',
        mimeType: 'image/png',
        buffer: Buffer.from('not a png')
      })
    ).rejects.toThrow(/MIME type/);
    expect(storage.putObject).not.toHaveBeenCalled();
  });
});
