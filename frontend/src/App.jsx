import { useState } from "react";

const API_URL = "https://multi-agent-research-system-3wf6.onrender.com/research";

const LOADING_MESSAGES = [
  "Agents are researching…",
  "Reading through sources…",
  "Drafting the report…",
  "Scoring the draft…",
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

  const critique = result ? parseCritique(result.feedback) : null;

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
          Four agents work behind the scenes — search, read, write, and
          critique — you just see the finished result.
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
          {critique && (
            <div className="scorecard">
              <div className="scorecard__score">
                <span className="scorecard__num">{critique.score}</span>
                <span className="scorecard__den">/10</span>
              </div>
              <div className="scorecard__details">
                {critique.strengths.length > 0 && (
                  <div className="scorecard__block">
                    <h4>Strengths</h4>
                    <ul>
                      {critique.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {critique.areas.length > 0 && (
                  <div className="scorecard__block">
                    <h4>Areas to improve</h4>
                    <ul>
                      {critique.areas.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {critique.verdict && (
                  <p className="scorecard__verdict">"{critique.verdict}"</p>
                )}
              </div>
            </div>
          )}

          <div className="report">
            <h2 className="report__heading">Report</h2>
            <div className="report__body">{result.report}</div>
          </div>
        </div>
      )}

      <footer className="footer">
        <span>FastAPI backend · LangGraph agents · Mistral</span>
      </footer>
    </div>
  );
}
