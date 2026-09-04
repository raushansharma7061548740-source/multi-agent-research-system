from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from graph import run_pipeline


app = FastAPI(
    title="Multi-Agent Research System",
    description="AI powered research pipeline with a self-correcting revision loop",
    version="2.0"
)


# Allow deployed + local frontends to communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

    result = run_pipeline(topic)

    query_type = result.get("query_type", "")
    report = result.get("writer", "")
    critic = result.get("critic", {"score": 0.0, "issue": ""})
    attempts = result.get("attempts", 0)

    return {
        "success": True,
        "topic": topic,
        "query_type": query_type,
        "report": report,
        # score/issue only meaningful on the research path — the simple
        # path never runs the critic node, so these stay at defaults.
        "score": critic.get("score"),
        "issue": critic.get("issue"),
        "attempts": attempts,
    }
