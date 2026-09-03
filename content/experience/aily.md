---
title: "AILY LABS | Felipe Basurto"
description: "Data Scientist at AILY LABS from July 2023 to Nov 2025."
og_image: "/assets/companies/aily.png"
---

[← Back to CV](../../)

# AILY LABS

![AILY LABS](../../assets/companies/aily.png)

**Data Scientist, July 2023 to Nov 2025.** I worked in Madrid on production agents, retrieval, NLP, and time-series forecasting.

The agent work used LangChain for retrieval and tools, with Langfuse traces for the parts that fail quietly. We could inspect which documents the agent retrieved, which tool it called, and where a guardrail stopped the run.

I also owned Airflow and Docker pipelines on AWS. One internal ETL fell from about 90 minutes to 15 seconds after I removed repeated work from the data path.

## Graph RAG for shop-floor manuals

I built a Graph RAG service over factory equipment manuals. The ingest path ran OCR on scanned PDFs, then used unstructured.io to keep tables, figures, diagrams, page numbers, and section names.

Neo4j stored machines, components, faults, and procedures as a connected equipment model. LangChain retrieved from that model. The production API returned cited passages with an exact page and section so other agents and applications could use the result without hiding the source.

The practical test was simple. An operator enters a fault or alarm code and gets a likely procedure plus the manual location needed to verify it. A confident answer without a page reference did not pass.

{{AILY_GRAPH_RAG_DIAGRAM}}
