@echo off
echo 🚀 Setting up Sympatico AI Assistant...

echo 📦 Creating virtual environment...
cd sympatico\server
python -m venv .venv

echo 🔧 Activating virtual environment...
call .venv\Scripts\activate.bat

echo 📚 Installing dependencies...
pip install -r requirements.txt

if not exist .env (
    echo ⚙️ Creating .env file...
    (
    echo OPENAI_API_KEY=your_openai_api_key_here
    echo EMBED_MODEL=text-embedding-3-small
    echo CHAT_MODEL=gpt-4o-mini
    echo TOP_K=5
    ) > .env
    echo 📝 Please edit .env file with your OpenAI API key
)

echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Edit .env file with your OpenAI API key
echo 2. Run: uvicorn app:app --reload --port 8000
echo 3. Open your portfolio in a browser
echo.
echo The Sympatico assistant will appear as a green button in the bottom-right corner!
pause
