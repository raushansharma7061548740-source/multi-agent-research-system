import os
from langchain_groq import ChatGroq
from bs4 import BeautifulSoup
from langchain_sarvam import ChatSarvam
from langchain_tavily import TavilySearch
from dotenv import load_dotenv
load_dotenv()
from typing import TypedDict
from langgraph.graph import StateGraph, START, END
import requests
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import re


# llm initialization

writer_llm = ChatGroq(
    model="openai/gpt-oss-20b",
    temperature=0.4
)


critic_llm = ChatSarvam(
    model="sarvam-105b",
    temperature=0
)


# building class

class State(TypedDict):
    topic: str
    query_type: str
    search: str
    reader: str
    writer: str
    critic: dict
    attempts: int


classify_prompt = ChatPromptTemplate.from_messages([
    ("system", "You classify user input into exactly one word: SIMPLE or "
               "RESEARCH. Reply with SIMPLE if it's a basic factual "
               "question you can answer directly from general knowledge "
               "(e.g. 'what is the capital of France', 'define photosynthesis'). "
               "Reply with RESEARCH if it needs current information, deep "
               "investigation, or synthesis of multiple sources "
               "(e.g. 'latest developments in AI regulation', 'compare X and Y'). "
               "Respond with only the single word, nothing else."),
    ("human", "{topic}"),
])

classify_chain = classify_prompt | critic_llm | StrOutputParser()


def classify_node(state: State) -> dict:
    results = classify_chain.invoke({"topic": state["topic"]})
    query_type = results.strip().upper()
    return {"query_type": query_type if query_type in ("SIMPLE", "RESEARCH") else "RESEARCH"}


# direct answer

direct_answer_prompt = ChatPromptTemplate.from_messages([
    ("system", "Answer the question directly, clearly, and concisely."),
    ("human", "{topic}"),
])

direct_answer_chain = direct_answer_prompt | writer_llm | StrOutputParser()


def direct_answer_node(state: State) -> dict:
    results = direct_answer_chain.invoke({"topic": state["topic"]})
    return {"writer": results}


# tools

search_tool = TavilySearch(max_results=7)


def search_node(state: State) -> dict:
    """Search the web for recent and reliable information on the topic.
    Returns titles, URLs, and snippets."""

    topic = state["topic"]
    results = search_tool.invoke({"query": topic})

    return {
        "search": results
    }


def reader_node(state: State) -> dict:
    """Scrape and return clean text content from the top search result URL."""
    search_results = state["search"]

    try:
        url = search_results["results"][0]["url"]
    except (KeyError, IndexError, TypeError):
        return {"reader": "No URL found in search results to scrape."}

    try:
        resp = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()

        text = soup.get_text(separator=" ", strip=True)[:3000]

    except Exception as e:
        # FIX: this used to `return f"..."` (a plain string), which broke
        # LangGraph since every node must return a dict. Now consistent
        # with the success path above.
        return {"reader": f"Could not scrape URL: {str(e)}"}

    return {
        "reader": text
    }


# writer node

writer_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are an expert research writer. Your job is to turn raw "
               "search results and scraped web content into a clear, "
               "well-structured, factual research report — not a summary, "
               "a proper report someone could actually read and learn from. "
               "Write in a professional, neutral tone. Do not invent facts "
               "that aren't supported by the research provided."),
    ("human", """Write a detailed research report on the topic below.

Topic: {topic}

Research Gathered:
{research}

Structure the report as:
- Introduction
- Key Findings (minimum 3 well-explained points)
- Conclusion
- Sources (list all URLs found in the research)

Be detailed, factual, and professional."""),
])

writer_chain = writer_prompt | writer_llm | StrOutputParser()


# revision prompt

revision_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are revising a research report based on specific "
               "feedback. Fix the exact issue mentioned — don't rewrite "
               "everything from scratch, improve what's already there."),
    ("human", """Topic: {topic}

Research:
{research}

Previous Draft:
{previous_report}

Specific Issue To Fix:
{issue}

Write the complete, improved report below:"""),
])

revision_chain = revision_prompt | writer_llm | StrOutputParser()


def writer_node(state: State) -> dict:
    """Draft the research report from search results and scraped content,
    or revise a previous draft based on critic feedback."""

    research_combined = (
        f"SEARCH RESULTS:\n{state['search']}\n\n"
        f"SCRAPED CONTENT:\n{state['reader']}"
    )

    is_revision = state.get("attempts", 0) > 0

    if is_revision:
        report = revision_chain.invoke({
            "topic": state["topic"],
            "research": research_combined,
            "previous_report": state["writer"],
            "issue": state["critic"]["issue"]
        })
    else:
        report = writer_chain.invoke({
            "topic": state["topic"],
            "research": research_combined
        })

    return {
        "writer": report
    }


critic_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a strict research report evaluator. Respond in "
               "EXACTLY this format, nothing else:\n"
               "Score: <a number from 0 to 10>\n"
               "Issue: <one specific, actionable problem with this report, "
               "or 'None' if the score is 7 or above>"),
    ("human", "Report:\n{report}"),
])

critic_chain = critic_prompt | critic_llm | StrOutputParser()


def critic_node(state: State) -> dict:
    """Score the report's quality and note the main issue, if any."""

    report = state["writer"]
    attempts = state.get("attempts", 0) + 1

    response = critic_chain.invoke({"report": report})

    score_match = re.search(r"Score:\s*([\d.]+)", response)
    issue_match = re.search(r"Issue:\s*(.+)", response, re.DOTALL)

    score = float(score_match.group(1)) if score_match else 0.0
    issue = issue_match.group(1).strip() if issue_match else "Could not parse feedback."

    return {
        "critic": {"score": score, "issue": issue},
        "attempts": attempts
    }


# router functions

def route_by_type(state: State) -> str:
    return "simple" if state["query_type"] == "SIMPLE" else "research"


MAX_ATTEMPTS = 3


def route_after_critic(state: State) -> str:
    if state["critic"]["score"] < 7 and state["attempts"] < MAX_ATTEMPTS:
        return "revise"
    return "end"


# build the graph

graph = StateGraph(State)

graph.add_node("classify", classify_node)
graph.add_node("direct_answer", direct_answer_node)
graph.add_node("search", search_node)
graph.add_node("reader", reader_node)
graph.add_node("writer", writer_node)
graph.add_node("critic", critic_node)

graph.add_edge(START, "classify")
graph.add_conditional_edges("classify", route_by_type, {
    "simple": "direct_answer",
    "research": "search"
})

graph.add_edge("direct_answer", END)

graph.add_edge("search", "reader")
graph.add_edge("reader", "writer")
graph.add_edge("writer", "critic")

graph.add_conditional_edges("critic", route_after_critic, {
    "revise": "writer",
    "end": END
})

# Renamed from `app` to `compiled_graph` — a FastAPI app is also
# conventionally called `app`, so keeping both in the same name would
# clash once this is imported into main.py.
compiled_graph = graph.compile()


def run_pipeline(topic: str) -> dict:
    """Build a fresh initial state and run the graph for one topic."""
    initial_state: State = {
        "topic": topic,
        "query_type": "",
        "search": "",
        "reader": "",
        "writer": "",
        "critic": {"score": 0.0, "issue": ""},
        "attempts": 0,
    }
    return compiled_graph.invoke(initial_state)


if __name__ == "__main__":
    topic = input("\nEnter a research topic: ")
    result = run_pipeline(topic)
    print("\nFinal Output:\n", result["writer"])
