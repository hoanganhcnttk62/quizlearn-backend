#!/bin/bash

# Configuration
IMAGE_NAME="quizlearn-api"
TAG="latest"
DOCKER_USERNAME="your-dockerhub-username"  # Replace with your DockerHub username

echo "🐳 Running QuizLearn API container..."

# Run the container
docker run -d \
  --name quizlearn-api \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e DB_HOST=host.docker.internal \
  -e DB_PORT=5432 \
  -e DB_NAME=quizlearn \
  -e DB_USER=admin \
  -e DB_PASSWORD=HoiP@SShoai321 \
  -e DB_DIALECT=postgres \
  -e REDIS_HOST=host.docker.internal \
  -e REDIS_PORT=6379 \
  -e MINIO_ENDPOINT=host.docker.internal \
  -e MINIO_PORT=9000 \
  -e MINIO_USE_SSL=false \
  -e MINIO_ACCESS_KEY=minioadmin \
  -e MINIO_SECRET_KEY=minioadmin \
  -e MINIO_BUCKET_NAME=quizlearn \
  -e JWT_SECRET=your_super_secure_jwt_secret_key_for_production_2024 \
  -e JWT_EXPIRES_IN=7d \
  --restart unless-stopped \
  $DOCKER_USERNAME/$IMAGE_NAME:$TAG

if [ $? -eq 0 ]; then
    echo "✅ Container started successfully!"
    echo "🌐 API available at: http://localhost:8080"
    echo ""
    echo "To view logs:"
    echo "docker logs -f quizlearn-api"
    echo ""
    echo "To stop the container:"
    echo "docker stop quizlearn-api"
else
    echo "❌ Failed to start container"
    exit 1
fi 