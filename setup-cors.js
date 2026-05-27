const { S3Client, PutBucketCorsCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function setupCors() {
  const bucketName = process.env.R2_LISTINGS_BUCKET;
  
  const corsRule = {
    CORSRules: [
      {
        AllowedHeaders: ['*'],
        AllowedMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'],
        AllowedOrigins: ['*'],
        ExposeHeaders: [],
        MaxAgeSeconds: 3000,
      }
    ]
  };

  try {
    console.log(`Setting CORS for bucket: ${bucketName}...`);
    const command = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: corsRule,
    });
    
    await s3Client.send(command);
    console.log('✅ Successfully updated CORS configuration!');
    console.log('The web browser will now be able to display your images.');
  } catch (err) {
    console.error('❌ Error setting CORS:', err);
  }
}

setupCors();
