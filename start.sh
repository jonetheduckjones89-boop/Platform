#!/bin/bash

# Check if .env exists
if [ ! -f .env ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

# Build
echo "Building..."
npm run build

# Run migrations (attempt)
echo "Running migrations..."
npm run migrate

# Start
echo "Starting Atlas AI Backend..."
if [ "$NODE_ENV" == "production" ]; then
  echo "Running in PRODUCTION mode"
  npm start
else
  echo "Running in DEVELOPMENT mode"
  npm run dev
fi
