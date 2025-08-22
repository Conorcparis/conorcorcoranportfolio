from __future__ import annotations
from typing import List, Dict, Tuple
import re, json, os
from dotenv import load_dotenv

import faiss
import numpy as np
from openai import OpenAI

from settings import settings

# Load environment variables
load_dotenv()

# ---- Text utils ----
SPLIT_RE = re.compile(r"\n\s*\n|\n{2,}|。")

def chunk(text: str, max_chars: int = 1200, overlap: int = 120) -> List[str]:
    text = text.strip()
    if not text:
        return []
    # naive paragraph split then merge into chunks
    paras = [p.strip() for p in re.split(SPLIT_RE, text) if p.strip()]
    chunks, buf = [], ""
    for p in paras:
        if len(buf) + len(p) + 1 <= max_chars:
            buf += ("\n" if buf else "") + p
        else:
            if buf:
                chunks.append(buf)
            # if single paragraph is huge, hard-split
            while len(p) > max_chars:
                chunks.append(p[:max_chars])
                p = p[max_chars-overlap:]
            buf = p
    if buf:
        chunks.append(buf)
    return chunks

# ---- Store ----
class VectorStore:
    def __init__(self, dim: int = 1536):
        self.dim = dim
        self.index = faiss.IndexFlatIP(dim)
        self.docs: List[Dict] = []  # {text, meta}
        self.embs = None

    def add(self, embs: np.ndarray, payloads: List[Dict]):
        if embs.dtype != np.float32:
            embs = embs.astype(np.float32)
        self.index.add(embs)
        self.docs.extend(payloads)
        self.embs = embs if self.embs is None else np.vstack([self.embs, embs])

    def search(self, q_emb: np.ndarray, k: int) -> List[Dict]:
        if q_emb.dtype != np.float32:
            q_emb = q_emb.astype(np.float32)
        D, I = self.index.search(q_emb, k)
        results = []
        for idx in I[0]:
            if idx == -1: continue
            results.append(self.docs[idx])
        return results

# ---- Embeddings ----
def get_openai_client():
    api_key = settings.openai_api_key
    if not api_key or api_key.strip() == "":
        raise ValueError("OpenAI API key is empty or not set")
    return OpenAI(api_key=api_key)

async def embed_texts(texts: List[str]) -> np.ndarray:
    # OpenAI batch embedding
    client = get_openai_client()
    resp = client.embeddings.create(model=settings.embed_model, input=texts)
    vecs = np.array([d.embedding for d in resp.data], dtype=np.float32)
    # Normalize for IP = cosine
    faiss.normalize_L2(vecs)
    return vecs

# ---- Corpus Loader ----
async def load_corpus(data_dir: str) -> Tuple[VectorStore, Dict]:
    vs = VectorStore(dim=1536)

    def load_file(path: str) -> str:
        if not os.path.exists(path):
            return ""
        with open(path, "r", encoding="utf-8") as f:
            return f.read()

    cv_txt = load_file(os.path.join(data_dir, "cv.md"))
    faq_txt = load_file(os.path.join(data_dir, "site_faqs.md"))
    sitemap_json = load_file(os.path.join(data_dir, "sitemap.json"))
    try:
        sitemap = json.loads(sitemap_json) if sitemap_json else {"routes": [], "ctas": []}
    except Exception:
        sitemap = {"routes": [], "ctas": []}

    docs = []
    for src_name, txt in [("cv", cv_txt), ("faq", faq_txt)]:
        for i, ch in enumerate(chunk(txt)):
            docs.append({"text": ch, "meta": {"source": src_name, "chunk": i}})

    if docs:
        embs = await embed_texts([d["text"] for d in docs])
        vs.add(embs, docs)

    return vs, sitemap

# ---- Prompting ----
SITE_GUIDE_SYSTEM = (
    "You are Sympatico, Conor Corcoran's AI assistant and site guide. "
    "You help visitors navigate his portfolio, answer questions about his professional background, "
    "and guide them to relevant sections or actions. You have access to his CV, site content, and navigation map. "
    "Be conversational, helpful, and concise. When you don't know something from the provided context, "
    "say so clearly and suggest relevant next steps or contacts. Include up to 3 relevant links when helpful."
)

def build_rag_context(query: str, hits: List[Dict], sitemap: Dict) -> str:
    """Compose a compact RAG context + route/CTA map."""
    top = []
    for h in hits[:5]:
        src = h["meta"].get("source")
        top.append(f"[source: {src}]\n{h['text']}")
    routes = "\n".join([f"- {r.get('title')}: {r.get('url')}" for r in sitemap.get("routes", [])[:6]])
    ctas = "\n".join([f"- {c.get('label')}: {c.get('url')}" for c in sitemap.get("ctas", [])[:4]])
    ctx = (
        f"# Retrieved Context (cite briefly):\n\n" + "\n\n".join(top) +
        f"\n\n# Site Routes:\n{routes}\n\n# CTAs:\n{ctas}"
    )
    return ctx

async def answer_with_rag(vs: VectorStore, sitemap: Dict, query: str, session_history: List[Dict]) -> Dict:
    # Embed query
    q_vec = await embed_texts([query])
    hits = vs.search(q_vec, settings.top_k) if vs.index.ntotal > 0 else []
    context = build_rag_context(query, hits, sitemap)

    # Include tiny history for continuity (last 3 turns)
    hist_txt = "\n".join([f"User: {m['user']}\nAssistant: {m['assistant']}" for m in session_history[-3:]])

    messages = [
        {"role": "system", "content": SITE_GUIDE_SYSTEM},
        {"role": "user", "content": (
            f"User question: {query}\n\n" +
            (f"Conversation so far:\n{hist_txt}\n\n" if hist_txt else "") +
            f"Use this retrieved context strictly if relevant, otherwise answer from general knowledge but be clear when you are.\n\n{context}"
        )}
    ]

    client = get_openai_client()
    resp = client.chat.completions.create(model=settings.chat_model, messages=messages, temperature=0.3)
    text = resp.choices[0].message.content

    # Build lightweight citations list
    citations = [{"source": h["meta"]["source"], "chunk": h["meta"]["chunk"]} for h in hits[:3]]
    return {"answer": text, "citations": citations}
