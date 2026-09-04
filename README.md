Multi-Agent Research System

# graph.py — how it works

This is the core file of the project. The FastAPI server and the frontend
are just thin wrappers around this — everything actually happens here.

## What it does

You ask a question, and the first thing it does is figure out whether
that's actually a research question or just something simple. If you ask
"what's the capital of France," there's no point running a whole search
pipeline for that — it just answers directly. But if you ask something
like "latest developments in AI regulation," it goes and does real work:
searches the web, reads an actual page, writes a report, and then checks
its own report and rewrites it if the first attempt wasn't good enough.

That last part is the piece I'm most happy with — the system grades its
own output and fixes it, up to 3 times, before giving up and returning
whatever it's got.

## The flow

First step is always classify — a model reads the question and decides:
SIMPLE or RESEARCH.

If it's simple, it just answers and stops there.

If it needs research, it goes through search → read → write → critique:

- Search hits Tavily and gets back a handful of links and snippets for
  the topic.
- Read grabs the top result and scrapes the actual page text (strips out
  scripts, nav bars, footers, all the junk).
- Write takes all of that and puts together an actual structured report
  — intro, findings, conclusion, sources.
- Critique has a different model read that report and score it out of
  10, plus point out one specific thing wrong with it.

If the score comes back under 7, it doesn't just accept it — it sends the
report back to the writer along with exactly what the critic didn't like,
and the writer fixes that specific issue instead of starting over. This
can happen up to 3 times before it just moves on with whatever it has, so
it can't loop forever.

## Two models, different jobs

Groq (gpt-oss-20b) does the writing — first drafts, revisions, and
simple answers.

Sarvam (sarvam-105b) does the judging — classifying questions and
critiquing reports.

Kept these separate on purpose. Didn't want the same model writing
something and then grading its own work.

## Search and scraping aren't AI calls

Tavily search and the page scraper are just plain code, no LLM involved.
There's nothing to "decide" there — you give it a topic, it searches; you
give it a URL, it scrapes. Wrapping that in an LLM call would've just
made it slower and more expensive for no real benefit. The AI only gets
involved where actual judgment or writing is needed — write and critique.

## My role

I built the whole thing — the routing logic, the revision loop, the
prompts, and the decision to split writing and judging across two models
instead of one doing both.

