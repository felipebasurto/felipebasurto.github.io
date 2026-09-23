---
title: "AILY LABS | Felipe Basurto"
description: "Data Scientist at AILY LABS from July 2023 to Nov 2025."
og_image: "/assets/companies/aily.png"
---

[← Back to CV](../../)

# AILY LABS

![AILY LABS](../../assets/companies/aily.png)

**Data Scientist, July 2023 to Nov 2025, Madrid.** I joined straight after my master's and built production AI for a Fortune 500 pharmaceutical company: LLM agents, retrieval, NLP, and time-series forecasting. I started as Junior Data Scientist I and left as Mid Data Scientist.

## The company

AILY LABS builds a decision intelligence platform for large enterprises: AI agents that turn company data into recommendations for finance, supply chain, R&D, and commercial teams. It was founded in 2020 by Bianca Anghelina.

- **Aug 2023.** [€19M Series A](https://www.prnewswire.com/news-releases/aily-labs-raises-19m-in-series-a-round-led-by-insight-partners-301909352.html), about $20M, led by Insight Partners. It was the company's first outside funding, a month after I joined.
- **Nov 2025.** [$80M Series B](https://www.prnewswire.com/news-releases/aily-labs-raises-80-million-to-scale-ai-that-drives-performance-across-fortune-500-companies-302607864.html) led by FPV Ventures, with Insight Partners and J.P. Morgan. It was announced the month I left.

## Shop-floor agent

I built a Graph RAG agent over factory equipment manuals. An operator enters a fault or alarm code and gets a likely procedure, plus the page and section of the manual to check it against. A confident answer without a page reference counted as a failure.

The ingest step ran OCR on scanned PDFs and kept tables, figures, page numbers, and section names. A graph database linked equipment, faults, and procedures, and a retrieval layer on top returned cited passages, so other agents and applications could use the answer and still show where it came from.

{{AILY_GRAPH_RAG_DIAGRAM}}

## NLP before GenAI

Before generative AI was practical in production, I worked on text classification for quality assurance on factory machines. We compared CatBoost with XGBoost, LightGBM, and deep neural networks. CatBoost won: it trained on GPU, it was the fastest to train, and it gave the best results.

## Agents in production

The agents used LangChain for retrieval and tool calls, with a Langfuse trace for every run. When an answer looked wrong, we could see which documents the agent had retrieved, which tool it had called, and where a guardrail had stopped it.

## Data pipelines

I owned Airflow and Docker pipelines on AWS. One internal ETL took about 90 minutes. After I restructured the logic and added the right indexes, it ran in 15 seconds.

## Team

I mentored interns through data preparation, modeling, evaluation, and deployment, and started a recurring knowledge-sharing session for the team.
