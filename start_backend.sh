#!/bin/bash
set -e
cd "$(dirname "$0")/backend"

echo "🚀 Starting PipeLab backend on http://localhost:8000"
echo "   API docs: http://localhost:8000/docs"
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
