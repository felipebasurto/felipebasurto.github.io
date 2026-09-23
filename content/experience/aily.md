---
title: "AILY LABS | Felipe Basurto"
description: "Data Scientist at AILY LABS from July 2023 to Nov 2025."
og_image: "/assets/companies/aily.png"
---

[← Back to CV](../../)

# AILY LABS

![AILY LABS](../../assets/companies/aily.png)

**Data Scientist, July 2023 to Nov 2025.** I joined in Madrid straight after my master's and built production AI for a Fortune 500 pharmaceutical company: LLM agents, retrieval, NLP, and time-series forecasting. I started as Junior Data Scientist I and left as Mid Data Scientist.

The agents used LangChain for retrieval and tool calls, with a Langfuse trace for every run. When an answer looked wrong, we could see which documents the agent had retrieved, which tool it had called, and where a guardrail had stopped it.

I also owned Airflow and Docker pipelines on AWS. One internal ETL took about 90 minutes. After I restructured the logic and added the right indexes, it ran in 15 seconds.

I mentored interns through data preparation, modeling, evaluation, and deployment, and started a recurring knowledge-sharing session for the team.

## Graph RAG for shop-floor manuals

I built a Graph RAG service over factory equipment manuals. The ingest step ran OCR on scanned PDFs, then used unstructured.io to keep tables, figures, diagrams, page numbers, and section names.

Neo4j stored machines, components, faults, and procedures as a connected equipment model. LangChain retrieved from that model. The production API returned cited passages with the exact page and section, so other agents and applications could use the answer and still show where it came from.

The test for the service was simple. An operator enters a fault or alarm code and gets a likely procedure plus the manual location to check it against. A confident answer without a page reference counted as a failure.

{{AILY_GRAPH_RAG_DIAGRAM}}
