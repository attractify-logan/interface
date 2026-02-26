#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "🔧 Setting up OpenClaw Chat Backend..."

# Check Python version
if command -v python3.13 &> /dev/null; then
    PYTHON=python3.13
elif command -v python3 &> /dev/null; then
    PYTHON=python3
    VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1-2)
    if [[ "$VERSION" == "3.14" ]]; then
        echo "⚠️  Python 3.14 detected - pydantic may have issues. Recommend using Python 3.13."
        if command -v python3.13 &> /dev/null; then
            echo "✅ Python 3.13 found, using that instead."
            PYTHON=python3.13
        fi
    fi
else
    echo "❌ Python 3 not found. Please install Python 3.11 or higher."
    exit 1
fi

echo "✅ Using $PYTHON ($($PYTHON --version))"

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    $PYTHON -m venv venv
else
    echo "✅ Virtual environment already exists"
fi

# Activate and install dependencies
echo "📥 Installing dependencies..."
source venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the server:"
echo "  ./run.sh"
echo ""
echo "Or manually:"
echo "  source venv/bin/activate"
echo "  uvicorn main:app --reload --port 8000"
echo ""
