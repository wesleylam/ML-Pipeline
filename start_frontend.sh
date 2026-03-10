#!/bin/bash
set -e
cd "$(dirname "$0")/frontend"

echo "📦 Installing Node dependencies..."
npm install

echo "🚀 Starting PipeLab frontend on http://localhost:5173"
npm run dev
