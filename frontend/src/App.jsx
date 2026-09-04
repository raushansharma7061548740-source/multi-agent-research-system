import { useState } from "react";

const API_URL = "https://multi-agent-research-system-3wf6.onrender.com/research";

const LOADING_MESSAGES = [
  "Working out what kind of question this is…",
  "Agents are researching…",
  "Drafting the report…",
  "Scoring the draft…",
];

export default function App() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [msgIndex, setMsgIndex] = useState(0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!topic.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setMsgIndex(0);

    const cycle = setInterval(() => {
      setMsgIndex((i) => (i < LOADING_MESSAGES.length - 1 ? i + 1 : i));
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
          ? "Can't reach the API right now. It may be waking up from sleep — try again in a moment."
          : err.message
      );
    } finally {
      clearInterval(cycle);
      setLoading(false);
    }
  }

  // The backend only runs the critic on the RESEARCH path, not the
  // SIMPLE path — so a null score means this was a direct answer.
  const isResearch = result?.query_type === "RESEARCH";
  const hasScore = isResearch && typeof result?.score === "number";

  return (
    <div className="page">
      <div className="scanline" aria-hidden="true" />

      <header className="header">
        <span className="eyebrow">Multi-agent research pipeline</span>
        <h1 className="title">
          Ask it something.
          <br />
          Get a written, scored report.
        </h1>
        <p className="subtitle">
          Simple questions get a direct answer. Anything that needs real
          research goes through search, reading, writing, and a
          self-correcting critique loop.
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

      {loading && (
        <div className="loading">
          <span className="loading__dot" />
          {LOADING_MESSAGES[msgIndex]}
        </div>
      )}

      {error && <div className="error">⚠ {error}</div>}

      {result && (
        <div className="output">
          {isResearch && (
            <div className="type-badge">Researched · {result.attempts} attempt{result.attempts === 1 ? "" : "s"}</div>
          )}
          {!isResearch && result.query_type === "SIMPLE" && (
            <div className="type-badge type-badge--simple">Direct answer</div>
          )}

          {hasScore && (
            <div className="scorecard">
              <div className="scorecard__score">
                <span className="scorecard__num">{result.score}</span>
                <span className="scorecard__den">/10</span>
              </div>
              {result.issue && result.issue.toLowerCase() !== "none" && (
                <div className="scorecard__issue">
                  <h4>Flagged issue</h4>
                  <p>{result.issue}</p>
                </div>
              )}
            </div>
          )}

          <div className="report">
            <h2 className="report__heading">
              {isResearch ? "Report" : "Answer"}
            </h2>
            <div className="report__body">{result.report}</div>
          </div>
        </div>
      )}

      <footer className="footer">
        <span>FastAPI backend · LangGraph agents · Groq · Sarvam</span>
      </footer>
    </div>
  );
}
