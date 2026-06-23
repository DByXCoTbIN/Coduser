#!/bin/bash

# Brauser IDE Backend Setup Script

set -e

echo "=== Brauser IDE Backend Setup ==="

# Check Python version
echo "Checking Python version..."
python3 --version

# Create virtual environment
echo "Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Copy .env.example to .env if not exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "Please edit .env file with your configuration"
fi

# Create workspace directory
echo "Creating workspace directory..."
mkdir -p ~/brauser-workspace

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start the backend server:"
echo "  source venv/bin/activate"
echo "  uvicorn main:app --reload"
echo ""
echo "Or use npm script:"
echo "  npm run backend:dev"