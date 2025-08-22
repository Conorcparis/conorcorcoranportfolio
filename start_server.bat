@echo off
cd /d "C:\Users\conor\Desktop\cvs\clean-portfolio\sympatico\server"
call .venv\Scripts\activate.bat
set OPENAI_API_KEY=your-openai-api-key-here
uvicorn app:app --reload --host 127.0.0.1 --port 8000
pause
