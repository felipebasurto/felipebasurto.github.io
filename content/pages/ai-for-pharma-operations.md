---
title: "AI for pharma operations | Felipe Basurto"
description: "How I would assess AI around pharmaceutical operations."
og_image: "/assets/profile.png"
---

[← Back to CV](../)

# AI for pharmaceutical operations

This is a practical guide to where AI can help around pharmaceutical operations, and where it should stay out. It is an assessment framework, not a pharma case study. It is not medical or regulatory advice. I do not work on manufacturing control or make regulated decisions.

## Reasonable starting areas

Start with work that is slow, repetitive, and easy to check.

- Draft internal summaries from source documents a person still signs.
- Route a question to the right SOP, with the page and section attached.
- Clean and classify operational records before a human reviews them.
- Help a team prepare a change request so the owner can decide faster.

These are assistance jobs. The output is a draft or a pointer. A person remains responsible.

## What should stay deterministic or human-controlled

Keep models out when a quiet error costs a patient, a batch, or a license.

- Batch release, deviation close, and any quality decision with a named owner.
- Manufacturing control, setpoints, and equipment interlocks.
- Label claims, safety language, and anything that becomes a regulatory record once issued.
- Final reading of a regulation. Software can retrieve the text. A qualified person decides.

If a step already has a written rule, code the rule. Do not ask a model to approximate it.

## Assessment sequence

I would run this before anyone trains or buys a tool.

1. Name the workflow, the system of record, and the person who owns the outcome.
2. Mark each step as draft, retrieve, decide, or control. Only draft and retrieve are candidates for a model.
3. Require a citation or a replayable input for every model output that a person might trust.
4. Define the fallback. What happens when the model is wrong, slow, or unavailable.
5. Stop if the remaining value depends on the model making a regulated decision or touching manufacturing control.

If that sequence kills the idea, the idea should die. The expensive failure is an assistant that quietly becomes the decision.

## Talk through one workflow

Read how I approach [enterprise AI consulting](../ai-consulting/), or email [hello@felipebasurto.com](mailto:hello@felipebasurto.com) with the workflow and its constraints.
