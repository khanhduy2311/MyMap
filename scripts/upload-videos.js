#!/usr/bin/env node

/**
 * Upload videos to Cloudinary CDN
 * 
 * Usage:
 *   1. npm install cloudinary
 *   2. Set environment variables in .env:
 *      CLOUDINARY_CLOUD_NAME=your-cloud-name
 *      CLOUDINARY_API_KEY=your-api-key
 *      CLOUDINARY_API_SECRET=your-api-secret
 *   3. node scripts/upload-videos.js
 */

require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const videosDir = path.join(__dirname, '..', 'public', 'videos');
const videoFiles = [
  'forgot.mp4',
  'galaxy.mp4',
  'reset.mp4',
  'typing.mp4'
];

async function uploadVideo(filename) {
  const filePath = path.join(videosDir, filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${filename} not found, skipping...`);
    return;
  }

  try {
    console.log(`⏳ Uploading ${filename}...`);
    
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'video',
      public_id: filename.replace('.mp4', ''),
      folder: 'mindmap_videos', // Match folder name used in views
      overwrite: true,
      // Optimize for web
      eager: [
        { 
          format: 'mp4', 
          transformation: [
            { quality: 'auto', fetch_format: 'auto' }
          ]
        }
      ]
    });

    console.log(`✅ ${filename} uploaded successfully!`);
    console.log(`   URL: ${result.secure_url}`);
    console.log(`   Size: ${(result.bytes / 1024 / 1024).toFixed(2)} MB`);
    
    return result;
  } catch (error) {
    console.error(`❌ Failed to upload ${filename}:`, error.message);
  }
}

async function main() {
  console.log('🚀 Starting video upload to Cloudinary...\n');

  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    console.error('❌ Missing Cloudinary credentials in .env file!');
    console.log('Please add:');
    console.log('  CLOUDINARY_CLOUD_NAME=...');
    console.log('  CLOUDINARY_API_KEY=...');
    console.log('  CLOUDINARY_API_SECRET=...');
    process.exit(1);
  }

  for (const file of videoFiles) {
    await uploadVideo(file);
    console.log('');
  }

  console.log('✅ All videos uploaded!');
  console.log('\n📝 Next steps:');
  console.log('1. Update video URLs in Pug templates');
  console.log('2. Test video playback');
  console.log('3. Deploy to production');
}

main().catch(console.error);
