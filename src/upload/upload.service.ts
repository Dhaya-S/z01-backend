import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

import { R2Service } from './r2.service';

@Injectable()
export class UploadService {
  private readonly uploadPath = join(process.cwd(), 'uploads');

  constructor(private readonly r2Service: R2Service) {
    if (!existsSync(this.uploadPath)) {
      mkdirSync(this.uploadPath, { recursive: true });
    }
  }

  async saveFile(file: Express.Multer.File, isPublic: boolean = true) {
    try {
      // 1. Try Cloudflare R2 first
      if (process.env.CLOUDFLARE_ACCOUNT_ID) {
        const url = await this.r2Service.uploadFile(file, isPublic);
        return {
          url: url,
          filename: file.originalname
        };
      }

      // 2. Fallback to Local Storage
      const filename = `${Date.now()}-${file.originalname}`;
      const filePath = join(this.uploadPath, filename);
      writeFileSync(filePath, file.buffer);

      return {
        url: `http://localhost:3000/uploads/${filename}`,
        filename: filename
      };
    } catch (error) {
      console.error('Upload error:', error);
      throw new InternalServerErrorException('Failed to save file');
    }
  }
}
