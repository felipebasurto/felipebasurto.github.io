---
title: "AI for pharma operations | Felipe Basurto"
description: "How I assess where AI helps around pharmaceutical operations, and where it should stay out."
og_image: "/assets/og.png"
---

[← Home](../)

# AI for pharmaceutical operations

At [AILY LABS](../experience/aily/) I built production AI for a Fortune 500 pharmaceutical company, including a Graph RAG service over factory equipment manuals. This page is how I decide where AI can help around pharmaceutical operations and where it should stay out. It is not medical or regulatory advice.

## Reasonable starting areas

Start with work that is slow, repetitive, and easy to check.

- Draft internal summaries from source documents that a person still signs.
- Route a question to the right SOP, with the page and section attached.
- Clean and classify operational records before a human reviews them.
- Help a team prepare a change request so the owner can decide faster.

In each of these the output is a draft or a pointer, and a person stays responsible for what happens next.

## What should stay deterministic or human-controlled

Keep models out of any step where a quiet error can hurt a patient, lose a batch, or put a license at risk.

- Batch release, deviation close, and any quality decision with a named owner.
- Manufacturing control, setpoints, and equipment interlocks.
- Label claims, safety language, and anything that becomes a regulatory record once issued.
- The final reading of a regulation. Software can retrieve the text, and a qualified person decides what it means.

If a step already has a written rule, code the rule. A model should not approximate it.

## Assessment sequence

I run this before anyone trains or buys a tool.

1. Name the workflow, the system of record, and the person who owns the outcome.
2. Mark each step as draft, retrieve, decide, or control. Only draft and retrieve steps are candidates for a model.
3. Require a citation or a replayable input for every model output that a person might trust.
4. Define what happens when the model is wrong, slow, or unavailable.
5. Stop if the remaining value depends on the model making a regulated decision or touching manufacturing control.

If the sequence rules the idea out, drop it. The expensive failure is an assistant that people slowly start treating as the decision-maker.

## Talk through one workflow

Read how I run [AI projects for teams](../ai-consulting/), or email [hello@felipebasurto.com](mailto:hello@felipebasurto.com) with the workflow and its constraints.
