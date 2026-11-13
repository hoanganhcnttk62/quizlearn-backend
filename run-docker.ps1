# Configuration
$IMAGE_NAME = "quizlearn-api"
$TAG = "latest"
$DOCKER_USERNAME = "your-dockerhub-username"  # Replace with your DockerHub username

Write-Host "🐳 Running QuizLearn API container..." -ForegroundColor Green

# Run the container
docker run -d `
  --name quizlearn-api `
  -p 8080:8080 `
  -e NODE_ENV=production `
  -e DB_HOST=host.docker.internal `
  -e DB_PORT=5432 `
  -e DB_NAME=quizlearn `
  -e DB_USER=admin `
  -e DB_PASSWORD=HoiP@SShoai321 `
  -e DB_DIALECT=postgres `
  -e REDIS_HOST=host.docker.internal `
  -e REDIS_PORT=6379 `
  -e MINIO_ENDPOINT=host.docker.internal `
  -e MINIO_PORT=9000 `
  -e MINIO_USE_SSL=false `
  -e MINIO_ACCESS_KEY=minioadmin `
  -e MINIO_SECRET_KEY=minioadmin `
  -e MINIO_BUCKET_NAME=quizlearn `
  -e JWT_SECRET=your_super_secure_jwt_secret_key_for_production_2024 `
  -e JWT_EXPIRES_IN=7d `
  --restart unless-stopped `
  $DOCKER_USERNAME/$IMAGE_NAME`:$TAG

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Container started successfully!" -ForegroundColor Green
    Write-Host "🌐 API available at: http://localhost:8080" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To view logs:" -ForegroundColor White
    Write-Host "docker logs -f quizlearn-api" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To stop the container:" -ForegroundColor White
    Write-Host "docker stop quizlearn-api" -ForegroundColor Gray
} else {
    Write-Host "❌ Failed to start container" -ForegroundColor Red
    exit 1
} 