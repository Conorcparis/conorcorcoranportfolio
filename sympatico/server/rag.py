from __future__ import annotations
from typing import List, Dict, Tuple
import re, json, os, asyncio
from dotenv import load_dotenv

import faiss
import numpy as np
from openai import OpenAI, APIConnectionError, RateLimitError

from settings import settings

# Load environment variables
load_dotenv()

# Create client once with global configuration
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))

OPENAI_HTTP_TIMEOUT = 20          # sec (per HTTP request)
OPENAI_OVERALL_TIMEOUT = 25       # sec (safety net around the whole call)

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
            buf = p[:max_chars]
    if buf:
        chunks.append(buf)
    
    # Add overlap
    if overlap > 0 and len(chunks) > 1:
        for i in range(1, len(chunks)):
            prev_end = chunks[i-1][-overlap:] if len(chunks[i-1]) > overlap else chunks[i-1]
            chunks[i] = prev_end + "\n" + chunks[i]
    
    return chunks

# ---- Async helper ----
async def _run_in_thread(fn):
    """Run blocking SDK calls in a thread so we can await + timeout."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, fn)

# ---- Embeddings ----
async def embed_texts(texts: List[str]) -> np.ndarray:
    try:
        resp = await asyncio.wait_for(
            _run_in_thread(lambda: client.embeddings.create(
                model=settings.embed_model,
                input=texts,
                timeout=OPENAI_HTTP_TIMEOUT,   # SDK-level timeout
            )),
            timeout=OPENAI_OVERALL_TIMEOUT,     # coroutine safety net
        )
    except (APIConnectionError, RateLimitError) as e:
        raise RuntimeError(f"OpenAI embeddings error: {e}") from e
    except asyncio.TimeoutError:
        raise RuntimeError("OpenAI embeddings timed out")
    except Exception as e:
        raise RuntimeError(f"Embeddings failed: {e}") from e

    vecs = np.array([d.embedding for d in resp.data], dtype=np.float32)
    faiss.normalize_L2(vecs)
    return vecs

async def chat_with_openai(messages: List[dict]) -> dict:
    try:
        resp = await asyncio.wait_for(
            _run_in_thread(lambda: client.chat.completions.create(
                model=settings.chat_model,
                messages=messages,
                temperature=0.3,
                timeout=OPENAI_HTTP_TIMEOUT,   # SDK-level timeout
            )),
            timeout=OPENAI_OVERALL_TIMEOUT,     # coroutine safety net
        )
        return {"ok": True, "text": resp.choices[0].message.content}
    except (APIConnectionError, RateLimitError) as e:
        return {"ok": False, "error": f"OpenAI error: {e}"}
    except asyncio.TimeoutError:
        return {"ok": False, "error": "OpenAI timed out"}
    except Exception as e:
        return {"ok": False, "error": f"Server error: {e}"}

# ---- FAISS Vector Store ----
class VectorStore:
    def __init__(self, dim: int = 1536):
        self.index = faiss.IndexFlatIP(dim)
        self.docs = []

    def add(self, vecs: np.ndarray, docs: List[Dict]):
        self.index.add(vecs)
        self.docs.extend(docs)

    def search(self, query_vec: np.ndarray, k: int = 5) -> List[Dict]:
        if self.index.ntotal == 0:
            return []
        scores, indices = self.index.search(query_vec, min(k, self.index.ntotal))
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0 and idx < len(self.docs):
                doc = self.docs[idx].copy()
                doc["score"] = float(score)
                results.append(doc)
        return results

# ---- Corpus Loading ----
async def load_corpus(data_dir: str) -> Tuple[VectorStore, Dict]:
    vs = VectorStore()
    sitemap = {}
    
    if not os.path.exists(data_dir):
        print(f"Warning: {data_dir} not found")
        return vs, sitemap
    
    all_chunks, all_docs = [], []
    
    for fname in os.listdir(data_dir):
        if not fname.endswith(('.txt', '.md')):
            continue
        
        path = os.path.join(data_dir, fname)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read().strip()
            
            if not content:
                continue
            
            chunks = chunk(content)
            for i, chunk_text in enumerate(chunks):
                all_chunks.append(chunk_text)
                all_docs.append({
                    "text": chunk_text,
                    "meta": {"source": fname, "chunk": i}
                })
            
            sitemap[fname] = {"chunks": len(chunks), "preview": content[:200]}
        
        except Exception as e:
            print(f"Error loading {fname}: {e}")
    
    if all_chunks:
        try:
            vecs = await embed_texts(all_chunks)
            vs.add(vecs, all_docs)
        except Exception as e:
            print(f"Error embedding chunks: {e}")
    
    return vs, sitemap

# ---- RAG System Prompt ----
SITE_GUIDE_SYSTEM = """You are Sympatico, an AI assistant for Conor Corcoran's professional portfolio website. 
You help visitors learn about Conor's experience, skills, and projects.

Key guidelines:
- Be helpful, professional, and engaging
- Use the provided context when relevant
- If information isn't in the context, be clear about general knowledge vs. specific portfolio info
- Keep responses focused and concise
- Encourage exploration of the portfolio"""

def build_rag_context(query: str, hits: List[Dict], sitemap: Dict) -> str:
    if not hits:
        return "No specific portfolio information found for this query."
    
    ctx = f"Retrieved information relevant to: {query}\n\n"
    for hit in hits[:3]:  # Top 3 results
        source = hit["meta"]["source"]
        text = hit["text"][:500]  # Truncate for context
        ctx += f"From {source}:\n{text}\n\n"
    
    return ctx

async def answer_with_rag(vs: VectorStore, sitemap: Dict, query: str, session_history: List[Dict]) -> Dict:
    # Embed query
    try:
        q_vec = await embed_texts([query])
        hits = vs.search(q_vec, settings.top_k) if vs.index.ntotal > 0 else []
    except Exception as e:
        return {"answer": f"Sorry—Embeddings error: {e}. Please try again.", "citations": []}
    
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

    # Use the robust chat function
    resp = await chat_with_openai(messages)
    if not resp["ok"]:
        # propagate a clear error up to FastAPI so the widget can show it
        return {"answer": f"Sorry—{resp['error']}. Please try again.", "citations": []}

    text = resp["text"]
    
    # Build lightweight citations list
    citations = [{"source": h["meta"]["source"], "chunk": h["meta"]["chunk"]} for h in hits[:3]]
    return {"answer": text, "citations": citations}
