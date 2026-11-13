const { Client } = require('minio');
const fs = require('fs');
const path = require('path');

// Initialize MinIO client
const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
});

const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'quizlearn';

async function testMinIO() {
  try {
    console.log('Testing MinIO connection...');
    
    // Test bucket creation
    const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
    if (!bucketExists) {
      console.log(`Creating bucket: ${BUCKET_NAME}`);
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log(`Bucket '${BUCKET_NAME}' created successfully`);
    } else {
      console.log(`Bucket '${BUCKET_NAME}' already exists`);
    }
    
    // List buckets
    const buckets = await minioClient.listBuckets();
    console.log('Available buckets:', buckets.map(b => b.name));
    
    console.log('✅ MinIO test completed successfully!');
    console.log('MinIO Console URL: http://localhost:9001');
    console.log('Username: minioadmin');
    console.log('Password: minioadmin');
    
  } catch (error) {
    console.error('❌ MinIO test failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure Docker Desktop is running');
    console.log('2. Run: docker-compose up -d');
    console.log('3. Wait for MinIO service to start');
    console.log('4. Try again');
  }
}

testMinIO(); 