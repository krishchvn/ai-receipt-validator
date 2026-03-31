from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import validate

app = FastAPI(title="Receipt Validator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(validate.router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}
