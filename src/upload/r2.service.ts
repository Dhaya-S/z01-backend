import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class R2Service {
  private readonly s3Client: S3Client;

  constructor() {
    if (process.env.CLOUDFLARE_ACCOUNT_ID) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
        },
      });
    }
  }

  async uploadFile(file: Express.Multer.File, isPublic: boolean = true): Promise<string> {
    if (!this.s3Client) {
      throw new Error('Cloudflare R2 is not configured');
    }

    // Determine bucket based on public/private status
    const bucketName = isPublic 
      ? process.env.R2_LISTINGS_BUCKET 
      : process.env.R2_DOCS_BUCKET;

    const filename = `${Date.now()}-${file.originalname}`;
    
    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: filename,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);

      // Return public URL for listings, or the filename (key) for private docs
      if (isPublic) {
        const publicUrl = process.env.R2_PUBLIC_URL;
        return publicUrl ? `${publicUrl}/${filename}` : filename;
      }
      
      // For private files, we return the key. 
      // The frontend/admin will need a signed URL to view it.
      return filename; 
    } catch (error) {
      console.error('R2 Upload Error:', error);
      throw new InternalServerErrorException('Failed to upload file to Cloudflare R2');
    }
  }

  async getDownloadUrl(key: string): Promise<string> {
    if (!this.s3Client) throw new Error('R2 not configured');
    
    const command = new GetObjectCommand({
      Bucket: process.env.R2_DOCS_BUCKET,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  }
}
