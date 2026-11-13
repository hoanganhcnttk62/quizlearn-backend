# MinIO Setup Guide

This guide explains how to set up MinIO to replace Cloudinary for file storage in the QuizLearn API.

## Environment Variables

Add the following MinIO configuration to your `.env` file:

```env
# MinIO Configuration (replaces Cloudinary)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=quizlearn
```

## Remove Old Cloudinary Variables

Remove these variables from your `.env` file:
```env
# Remove these lines
CLOUD_NAME=your_cloud_name
CLOUD_API_KEY=your_api_key
CLOUD_API_SECRET=your_api_secret
```

## Docker Setup

The MinIO service is already configured in `docker-compose.yml`. To start all services:

```bash
docker-compose up -d
```

This will start:
- PostgreSQL database
- Redis cache
- MinIO object storage
- Your API server

## MinIO Console

Access the MinIO web console at: http://localhost:9001
- Username: minioadmin
- Password: minioadmin

## API Changes

The following files have been updated to use MinIO:

1. **utils/minio.ts** - New MinIO utility functions
2. **services/image.service.ts** - Updated to use MinIO instead of Cloudinary
3. **controllers/user.controller.ts** - Updated profile picture upload
4. **app.ts** - Removed Cloudinary config, added MinIO initialization
5. **docker-compose.yml** - Added MinIO service
6. **package.json** - Replaced cloudinary with minio dependency

## File Storage Structure

Files are stored in MinIO with the following structure:
- Profile images: `profile_images/`
- Avatars: `avatars/`
- Other uploads: `uploads/`

## Benefits of MinIO over Cloudinary

1. **Self-hosted**: No external dependencies
2. **Cost-effective**: No per-request charges
3. **S3-compatible**: Can easily migrate to AWS S3 later
4. **Full control**: Complete control over data and access
5. **Scalable**: Can handle large amounts of data

## Troubleshooting

1. **MinIO not starting**: Check if ports 9000 and 9001 are available
2. **Upload failures**: Ensure MinIO service is running and accessible
3. **Permission errors**: Verify MinIO credentials in environment variables
4. **Bucket not found**: The bucket will be created automatically on first use

## Migration from Cloudinary

If you have existing files in Cloudinary, you'll need to:
1. Download files from Cloudinary
2. Upload them to MinIO using the new API
3. Update database records with new URLs 