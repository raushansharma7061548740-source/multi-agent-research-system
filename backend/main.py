from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from pipeline import run_research_pipeline


app = FastAPI(
    title="Multi-Agent Research System",
    description="AI powered research pipeline",
    version="1.0"
)


# Allow React frontend to communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://multi-agent-research-system-dusky.vercel.app",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "Multi-Agent Research API is running"
    }


@app.post("/research")
def research(data: dict):

    topic = data.get("topic")

    if not topic:
        return {
            "success": False,
            "error": "Research topic is required"
        }

    result = run_research_pipeline(topic)

    return {
        "success": True,
        "topic": topic,
        "search_results": result.get("search_results", ""),
        "scraped_content": result.get("scraped_content", ""),
        "report": result.get("report", ""),
        "feedback": result.get("feedback", "")
    }
