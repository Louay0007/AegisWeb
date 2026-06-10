import { Controller, Get, Header, Inject, Param, Res } from '@nestjs/common';
import { Permission } from '@agentpass/domain';
import { RequirePermission } from '../authorization/authorization-metadata.js';
import { CurrentOrganizationId } from '../request-context/current-organization-id.decorator.js';
import { FilesService } from './files.service.js';

type DownloadResponse = {
  setHeader(name: string, value: string | number): void;
  send(body: Buffer): void;
};

@RequirePermission(Permission.FileRead)
@Controller('files')
export class FilesController {
  constructor(@Inject(FilesService) private readonly filesService: FilesService) {}

  @Get(':id')
  async getFile(@CurrentOrganizationId() organizationId: string | undefined, @Param('id') id: string) {
    const file = await this.filesService.getFileForOrganization(organizationId, id);
    const signedReadUrl = await this.filesService.getSignedReadUrl(organizationId, id);

    return {
      data: {
        ...file,
        signedReadUrl
      }
    };
  }

  @Get(':id/download')
  @Header('cache-control', 'no-store')
  async download(
    @CurrentOrganizationId() organizationId: string | undefined,
    @Param('id') id: string,
    @Res() response: DownloadResponse
  ) {
    const download = await this.filesService.downloadForOrganization(organizationId, id);

    response.setHeader('content-type', download.file.mimeType);
    response.setHeader('content-length', download.bytes.length);
    response.setHeader('content-disposition', `attachment; filename="${download.file.id}"`);
    response.send(download.bytes);
  }
}
