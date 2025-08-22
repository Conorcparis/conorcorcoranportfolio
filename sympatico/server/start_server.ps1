# Activate virtual environment
& "$PSScriptRoot\.venv\Scripts\Activate.ps1"

# Set your OpenAI API key
$env:OPENAI_API_KEY="your-openai-api-key-here"

# Navigate to the correct folder
Set-Location $PSScriptRoot

# Start the Sympatico server
uvicorn app:app --reload --host 127.0.0.1 --port 8000
