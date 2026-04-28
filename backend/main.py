from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import uvicorn
import os
import sys

# Add backend directory to path so we can import our modules
sys.path.insert(0, os.path.dirname(__file__))

from analyze import analyze_reddit_post

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

# Request model
class AnalysisRequest(BaseModel):
    reddit_url: str

# Test route - verify backend is running
@app.get("/test")
async def test():
    return {
        "status": "Backend is running!",
        "message": "Chrome extension can communicate with FastAPI",
        "config": {
            "api_base": OPENAI_API_BASE,
            "model": OPENAI_MODEL,
            "status": "API key loaded" if OPENAI_API_KEY else "API key not found in environment"
        }
    }

# Main analysis endpoint - called by Chrome extension
@app.post("/analyze")
async def analyze(request: AnalysisRequest):
    """
    Analyze a Reddit post.

    Args:
        request: Contains reddit_url

    Returns:
        Structured analysis result
    """
    try:
        print(f"\n📊 Analyzing: {request.reddit_url}")

        # Run the complete analysis pipeline
        result = analyze_reddit_post(request.reddit_url)

        if "error" in result:
            return {
                "success": False,
                "error": result["error"]
            }

        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=3001)
