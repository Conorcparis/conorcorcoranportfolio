Set-Location "C:\Users\conor\Desktop\cvs\clean-portfolio\sympatico\server"
& ".\.venv\Scripts\Activate.ps1"
$env:OPENAI_API_KEY="your-openai-api-key-here"
Write-Host "Current directory: $(Get-Location)"
Write-Host "Starting server from: $(Get-Location)"
uvicorn app:app --reload --host 127.0.0.1 --port 8000
