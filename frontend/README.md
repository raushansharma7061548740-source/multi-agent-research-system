# Research Console (frontend)

A small React + Vite UI for the multi-agent research pipeline. It calls your
existing FastAPI backend (`main.py`) and walks through the four agents in
order: Search → Reader → Writer → Critic.

## Run it

**1. Start the backend** (from your project root, where `main.py` lives):

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**2. Start this frontend** (from this `frontend/` folder):

```bash
npm install
npm run dev
```

Open the URL Vite prints (defaults to `http://localhost:5173`). CORS on the
backend is already set to allow that origin.

## Notes

- Your `/research` endpoint runs the whole pipeline in one blocking call
  and returns all four results at once — it doesn't stream intermediate
  steps. The UI's stage-by-stage "running" indicator is a cosmetic
  progress cycle (~4s per stage) while it waits, then reveals all four
  results together once the response lands. If you want *real* live
  updates as each agent finishes, the backend would need to switch to
  Server-Sent Events or WebSockets — happy to build that next if useful.
- Each stage card is collapsed by default; click one to expand it.
- The critic agent's output is parsed for the `Score: X/10`, strengths,
  areas to improve, and verdict, so it renders as a small scorecard
  instead of a wall of text.
