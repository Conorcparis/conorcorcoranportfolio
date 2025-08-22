#!/bin/bash

echo "🚀 Setting up Sympatico AI Assistant..."

# Create virtual environment
echo "📦 Creating virtual environment..."
cd sympatico/server
python -m venv .venv

# Activate virtual environment
echo "🔧 Activating virtual environment..."
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    source .venv/Scripts/activate
else
    source .venv/bin/activate
fi

# Install dependencies
echo "📚 Installing dependencies..."
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "⚙️ Creating .env file..."
    cat > .env << EOL
OPENAI_API_KEY=your_openai_api_key_here
EMBED_MODEL=text-embedding-3-small
CHAT_MODEL=gpt-4o-mini
TOP_K=5
EOL
    echo "📝 Please edit .env file with your OpenAI API key"
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your OpenAI API key"
echo "2. Run: uvicorn app:app --reload --port 8000"
echo "3. Open your portfolio in a browser"
echo ""
echo "The Sympatico assistant will appear as a green button in the bottom-right corner!"
