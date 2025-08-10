#!/bin/bash

# Kill any existing processes on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null

# Clear previous builds
rm -rf dist/

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Build the main process
echo "Building main process..."
npm run build:main

# Start the application
echo "Starting MythalTerminal..."
npm run dev