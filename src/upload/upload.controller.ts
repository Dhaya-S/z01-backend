import { Controller, Post, UseInterceptors, UploadedFile, UploadedFiles, BadRequestException, UseGuards } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No image provided');
    return await this.uploadService.saveFile(file, true); // true = Public (Listings)
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    return await this.uploadService.saveFile(file, false); // false = Private (Docs)
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('multiple')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadMultiple(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) throw new BadRequestException('No files provided');
    
    const uploadResults = await Promise.all(
      files.map(file => this.uploadService.saveFile(file, true)) // Defaulting multiple to public images
    );

    return {
      urls: uploadResults.map(res => res.url)
    };
  }
}
