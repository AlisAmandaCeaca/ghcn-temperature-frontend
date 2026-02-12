from fastapi import FastAPI

app = FastAPI(title="GHCN Temperature API")

@app.get("/api/health")
def health():
    return {"status": "ok"}