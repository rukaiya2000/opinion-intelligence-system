from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import uvicorn
import os

# Load environment variables from .env
load_dotenv()

# Get config from environment
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_API_BASE = os.getenv("OPENAI_API_BASE")
OPENAI_MODEL = os.getenv("OPENAI_MODEL")

app = FastAPI(title="Reddit Opinion Analysis API")

# Allow Chrome extension to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Test route - verify backend is running
@app.get("/test")
async def test():
    return {
        "status": "Backend is running!",
        "message": "Chrome extension can communicate with FastAPI",
        "config": {
            "api_base": OPENAI_API_BASE,
            "model": OPENAI_MODEL
        }
    }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=3001)
