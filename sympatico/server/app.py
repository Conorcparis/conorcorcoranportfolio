from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, io
from docx import Document
from dotenv import load_dotenv

from rag import load_corpus, answer_with_rag

# Load environment variables
load_dotenv()

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
app = FastAPI(title="Sympatico API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load corpus at startup
db = {"vs": None, "sitemap": None, "history": {}}  # per-session history

@app.on_event("startup")
async def _startup():
    vs, sitemap = await load_corpus(DATA_DIR)
    db["vs"], db["sitemap"] = vs, sitemap

class ChatReq(BaseModel):
    session_id: str
    query: str

@app.get("/health")
async def health():
    return {"status": "ok", "corpus_loaded": db["vs"] is not None}

@app.post("/chat")
async def chat(req: ChatReq):
    sid = req.session_id
    hist = db["history"].get(sid, [])
    result = await answer_with_rag(db["vs"], db["sitemap"], req.query, hist)
    # Save minimal history
    hist.append({"user": req.query, "assistant": result["answer"][:400]})
    db["history"][sid] = hist[-6:]
    return result

@app.post("/ingest/cv")
async def ingest_cv(file: UploadFile):
    """Upload a .docx or .md and replace data/cv.md"""
    target = os.path.join(DATA_DIR, "cv.md")
    content = ""
    if file.filename.endswith(".docx"):
        bytes_ = await file.read()
        doc = Document(io.BytesIO(bytes_))
        content = "\n".join([p.text for p in doc.paragraphs])
    else:
        content = (await file.read()).decode("utf-8", errors="ignore")
    with open(target, "w", encoding="utf-8") as f:
        f.write(content)
    # Rebuild index
    vs, sitemap = await load_corpus(DATA_DIR)
    db["vs"], db["sitemap"] = vs, sitemap
    return {"ok": True}

@app.post("/ingest/site")
async def ingest_site(text: str = Form(...)):
    """Replace data/site_faqs.md with provided text (paste your FAQs/pages here)."""
    target = os.path.join(DATA_DIR, "site_faqs.md")
    with open(target, "w", encoding="utf-8") as f:
        f.write(text)
    vs, sitemap = await load_corpus(DATA_DIR)
    db["vs"], db["sitemap"] = vs, sitemap
    return {"ok": True}

@app.get("/health")
async def health():
    return {"status": "ok"}
