Multi-Agent Research System

An AI research pipeline where four specialized agents work in sequence to take a topic, search the web, read the best source in depth,
write a structured report, and critique their own output — end to end, with no human in the loop.
topic  ─▶  Search Agent  ─▶  Reader Agent  ─▶  Writer Agent  ─▶  Critic Agent  ─▶  report + score


What it does


You give it a topic. Behind the scenes:

Search Agent queries the web (via Tavily) for recent, reliable sources on the topic and returns titles, URLs, and snippets.
Reader Agent picks the most relevant URL from those results and scrapes the page for deeper, cleaner text content.
Writer Agent takes the search results + scraped content and drafts a structured report — introduction, key findings, conclusion, sources.
Critic Agent reviews that report independently and scores it out of 10, listing strengths, weaknesses, and a one-line verdict.

All four steps run automatically, one after another.




The Search and Reader agents are built with LangGraph's create_agent, giving each one a single tool (web_search or scrape_url) 
and letting the LLM decide how to use it. The Writer and Critic steps are plain LangChain prompt → LLM → output-parser chains — no tool use needed, 
just structured generation over the research already gathered.






Tech stack

LLM -	Mistral (mistral-small-latest) via langchain-mistralai
Agent - framework	LangGraph (create_agent) + LangChain chains
Web search	 - Tavily API
Web scraping	- requests + BeautifulSoup
Backend	- FastAPI + Uvicorn
Frontend	- React + Vite




My role on this project

I designed and built the backend end-to-end: the four-agent research pipeline (pipeline.py), the agent and chain definitions (agents.py),
the search/scrape tools (tools.py), and the FastAPI service that exposes it (main.py) — including the prompt design 
for the writer and critic chains and the LangGraph agent setup for search and reading.


The frontend (frontend/) was built with AI assistance (Claude) to provide a visual way to demo the backend pipeline, wired to the API contract I defined.

