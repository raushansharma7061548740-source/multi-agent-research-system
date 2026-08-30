import { useEffect, useRef, useState } from "react";

const API_URL = "https://multi-agent-research-system-3wf6.onrender.com/research";

const STAGES = [
  {
    key: "search_results",
    id: "01",
    name: "Search Agent",
    verb: "Scanning sources",
  },
  {
    key: "scraped_content",
    id: "02",
    name: "Reader Agent",
    verb: "Extracting content",
  },
  {
    key: "report",
    id: "03",
    name: "Writer Agent",
    verb: "Drafting the report",
  },
  {
    key: "feedback",
    id: "04",
    name: "Critic Agent",
    verb: "Scoring the draft",
  },
];

// Pulls "Score: X/10" plus the Strengths / Areas to Improve / verdict
// sections out of the critic agent's plain-text output so we can render
// it, instead of dumping raw text. Falls back gracefully if the shape
// doesn't match exactly.
function parseCritique(text) {
  if (!text) return null;
  const scoreMatch = text.match(/Score:\s*([\d.]+)\s*\/\s*10/i);
  const verdictMatch = text.match(/One line verdict:\s*([\s\S]*)$/i);
  const strengthsMatch = text.match(
    /Strengths:\s*([\s\S]*?)(?:Areas to Improve:|$)/i
  );
  const areasMatch = text.match(
    /Areas to Improve:\s*([\s\S]*?)(?:One line verdict:|$)/i
  );

  const toList = (block) =>
    block
      ? block
          .split("\n")
          .map((l) => l.replace(/^[-•]\s*/, "").trim())
          .filter(Boolean)
      : [];

  if (!scoreMatch) return null;

  return {
    score: scoreMatch[1],
    strengths: toList(strengthsMatch?.[1]),
    areas: toList(areasMatch?.[1]),
    verdict: verdictMatch?.[1]?.trim(),
  };
}

function StageDot({ state }) {
  return <span className={`dot dot--${state}`} aria-hidden="true" />;
}

function StageCard({ stage, state, content, isLast }) {
  const [open, setOpen] = useState(false);
  const critique = stage.key === "feedback" ? parseCritique(content) : null;

  return (
    <div className="stage">
      <div className="stage__rail">
        <StageDot state={state} />
        {!isLast && <span className={`rail-line rail-line--${state === "done" ? "done" : "idle"}`} />}
      </div>

      <div className="stage__body">
        <button
          className="stage__header"
          onClick={() => content && setOpen((o) => !o)}
          disabled={!content}
          aria-expanded={open}
        >
          <span className="stage__id">{stage.id}</span>
          <span className="stage__name">{stage.name}</span>
          <span className="stage__verb">
            {state === "running" ? stage.verb + "…" : stage.verb}
          </span>
          {content && (
            <span className="stage__toggle">{open ? "hide" : "view"}</span>
          )}
        </button>

        {open && content && (
          <div className="stage__content">
            {critique ? (
              <div className="critique">
                <div className="critique__score">
                  <span className="critique__score-num">{critique.score}</span>
                  <span className="critique__score-den">/10</span>
                </div>
                {critique.strengths.length > 0 && (
                  <div className="critique__block">
                    <h4>Strengths</h4>
                    <ul>
                      {critique.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {critique.areas.length > 0 && (
                  <div className="critique__block">
                    <h4>Areas to improve</h4>
                    <ul>
                      {critique.areas.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {critique.verdict && (
                  <p className="critique__verdict">"{critique.verdict}"</p>
                )}
              </div>
            ) : (
              <pre className="stage__text">{content}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!topic.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setActiveIndex(0);

    // Cosmetic progress cycle. The backend runs the full 4-agent
    // pipeline in one blocking call, so this approximates where the
    // pipeline likely is rather than reflecting a real event stream.
    intervalRef.current = setInterval(() => {
      setActiveIndex((i) => (i < STAGES.length - 1 ? i + 1 : i));
    }, 4000);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();

      if (!res.ok || data.success === false) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setResult(data);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Can't reach the API. Is main.py running on http://localhost:8000?"
          : err.message
      );
    } finally {
      clearInterval(intervalRef.current);
      setLoading(false);
    }
  }

  const isRunning = loading;
  const isDone = !!result;

  return (
    <div className="page">
      <div className="scanline" aria-hidden="true" />

      <header className="header">
        <span className="eyebrow">Multi-agent research pipeline</span>
        <h1 className="title">
          Ask it something.
          <br />
          Watch four agents work it out.
        </h1>
        <p className="subtitle">
          Search agent finds sources → reader agent reads them → writer
          agent drafts the report → critic agent scores it.
        </p>
      </header>

      <form className="console" onSubmit={handleSubmit}>
        <span className="console__prompt">topic&gt;</span>
        <input
          className="console__input"
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. the current state of solid-state batteries"
          disabled={loading}
          autoFocus
        />
        <button className="console__run" type="submit" disabled={loading || !topic.trim()}>
          {loading ? "Running" : "Run"}
        </button>
      </form>

      {error && <div className="error">⚠ {error}</div>}

      {(isRunning || isDone) && (
        <div className="stages">
          {STAGES.map((stage, i) => {
            let state = "idle";
            if (isDone) state = "done";
            else if (isRunning) {
              if (i < activeIndex) state = "done";
              else if (i === activeIndex) state = "running";
            }
            const content = result ? result[stage.key] : null;
            return (
              <StageCard
                key={stage.key}
                stage={stage}
                state={state}
                content={content}
                isLast={i === STAGES.length - 1}
              />
            );
          })}
        </div>
      )}

      <footer className="footer">
        <span>FastAPI backend · LangGraph agents · Mistral</span>
      </footer>
    </div>
  );
}
