#!/bin/bash

# Brauser IDE - Test Script

echo "=== Testing Brauser IDE Structure ==="

# Check if all directories exist
echo "Checking directories..."
dirs=("electron" "backend" "ide" "ide/styles" "servers" "docs" "tests" "assets")
for dir in "${dirs[@]}"; do
    if [ -d "$dir" ]; then
        echo "✓ $dir exists"
    else
        echo "✗ $dir missing"
        mkdir -p "$dir"
        echo "  Created $dir"
    fi
done

# Check if all files exist
echo ""
echo "Checking files..."
files=("package.json" "electron/main.js" "electron/preload.js" "backend/main.py" "backend/requirements.txt" "ide/index.html" "ide/styles/main.css" "ide/app.js" "README.md" "ARCHITECTURE.md" "TASKS.md" "DIARY.md" ".gitignore")
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file exists"
    else
        echo "✗ $file missing"
    fi
done

echo ""
echo "=== Project Structure ==="
tree -L 2 -I 'node_modules' 2>/dev/null || find . -maxdepth 2 -type f -o -type d | sort

echo ""
echo "=== Next Steps ==="
echo "1. Install dependencies: npm install"
echo "2. Install Python dependencies: cd backend && pip install -r requirements.txt"
echo "3. Start development: npm run dev"