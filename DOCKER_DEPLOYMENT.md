# Docker Deployment Guide

This guide explains how to build, run, and push the QuizLearn API to DockerHub.

## Prerequisites

- Docker installed and running
- DockerHub account
- PostgreSQL and Redis running locally
- MinIO (will be started automatically)

## Quick Start

### 1. Update DockerHub Username

Edit the PowerShell scripts and replace `your-dockerhub-username` with your actual DockerHub username:

- `build-push.ps1`
- `run-docker.ps1`

### 2. Build and Push to DockerHub

```powershell
.\build-push.ps1
```

This will:
- Build the production Docker image using `Dockerfile.prod`
- Tag the image for DockerHub
- Push the image to DockerHub

### 3. Run the Container

```powershell
.\run-docker.ps1
```

This will:
- Pull the image from DockerHub (if not locally available)
- Start the container with proper environment variables
- Connect to your local PostgreSQL and Redis instances

## Manual Commands

### Build Image
```powershell
docker build -f Dockerfile.prod -t quizlearn-api:latest .
```

### Tag for DockerHub
```powershell
docker tag quizlearn-api:latest your-username/quizlearn-api:latest
```

### Push to DockerHub
```powershell
docker push your-username/quizlearn-api:latest
```

### Run Container
```powershell
docker run -d --name quizlearn-api -p 8080:8080 -e DB_HOST=host.docker.internal -e REDIS_HOST=host.docker.internal your-username/quizlearn-api:latest
```

## Environment Variables

The container uses these environment variables:

- `NODE_ENV=production`
- `DB_HOST=host.docker.internal` (connects to local PostgreSQL)
- `DB_PORT=5432`
- `DB_NAME=quizlearn`
- `DB_USER=admin`
- `DB_PASSWORD=HoiP@SShoai321`
- `REDIS_HOST=host.docker.internal` (connects to local Redis)
- `REDIS_PORT=6379`
- `MINIO_ENDPOINT=host.docker.internal`
- `MINIO_PORT=9000`
- `MINIO_ACCESS_KEY=minioadmin`
- `MINIO_SECRET_KEY=minioadmin`
- `MINIO_BUCKET_NAME=quizlearn`
- `JWT_SECRET=your_super_secure_jwt_secret_key_for_production_2024`

## Container Management

### View Logs
```powershell
docker logs -f quizlearn-api
```

### Stop Container
```powershell
docker stop quizlearn-api
```

### Remove Container
```powershell
docker rm quizlearn-api
```

### Restart Container
```powershell
docker restart quizlearn-api
```

## Production Considerations

1. **Security**: Change default passwords and JWT secret
2. **Database**: Use production database credentials
3. **SSL**: Enable SSL for MinIO in production
4. **Monitoring**: Add health checks and monitoring
5. **Backup**: Set up database and MinIO backups

## Troubleshooting

### Container won't start
- Check if PostgreSQL and Redis are running
- Verify ports 5432 and 6379 are accessible
- Check Docker logs: `docker logs quizlearn-api`

### Database connection issues
- Ensure PostgreSQL is running on port 5432
- Verify database credentials
- Check if database `quizlearn` exists

### MinIO connection issues
- MinIO will be started automatically by the container
- Access MinIO console at http://localhost:9001
- Default credentials: minioadmin/minioadmin 