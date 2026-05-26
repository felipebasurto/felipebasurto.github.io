---
title: "AILY LABS — Felipe Basurto"
description: "Data Scientist at AILY LABS — Graph RAG over factory manuals, LangChain agents, Langfuse, MLOps on AWS."
og_image: "/assets/companies/aily.png"
---

[← Back to CV](../../)

# AILY LABS

![AILY LABS](../../assets/companies/aily.png)

**Data Scientist** (Madrid). Shipped **LangChain** agents to production, with **Langfuse** for tracing—retrieval, tool calls, and guardrails.

NLP and time-series forecasting in SQL/Python. Owned **Airflow** and **Docker** pipelines on **AWS**; cut an internal ETL from ~1.5h to ~15s.

## Graph RAG for shop-floor manuals

Built **Graph RAG** over factory equipment manuals for manufacturing lines. Ingest ran **OCR** on scanned PDFs, then **unstructured.io** to keep structure—not flat text, but **tables**, **figures**, and **diagrams**, each tagged with **page and section** coordinates.

Indexed into **Neo4j** as an equipment graph (machines, components, faults, procedures). **LangChain** retrieves against the graph; a production **API** returns **cited passages** with exact page and section so other models and apps can call it with sources.

On the shop floor: when something fails, the operator sees **what broke** and **where to look in the manual**—the right page and section, not a vague summary. Same class of shop-floor intelligence Aily ships at enterprise scale; see their [Sanofi case study](https://www.ailylabs.com/case-study/sanofi) (manufacturing agents across hundreds of lines).

{{AILY_GRAPH_RAG_DIAGRAM}}
