from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import datasets, clean, train, results

app = FastAPI(title="PipeLab API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(datasets.router, prefix="/api/datasets", tags=["datasets"])
app.include_router(clean.router,    prefix="/api/datasets", tags=["clean"])
app.include_router(train.router,    prefix="/api/train",    tags=["train"])
app.include_router(results.router,  prefix="/api/results",  tags=["results"])

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
