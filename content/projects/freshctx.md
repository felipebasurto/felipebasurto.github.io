---
title: "FreshCtx | Felipe Basurto"
description: "FreshCtx is a local context engine that keeps the code in a coding agent's requests current after edits, refreshing functions instead of whole files."
og_image: "/assets/blog/model-context-is-not-static/og.png"
---

[← Home](../../)

# FreshCtx

![FreshCtx icon](../../assets/projects/freshctx.jpg)

FreshCtx is a local context engine for coding agents. Before each model request, it replaces old file reads in the conversation with short markers and adds the current version of the code the agent has read, once, at the end of the request.

Coding agents re-send the whole conversation on every request. When a file changes after the agent read it, the model sees the old version next to tools that work on the new one. In a public dataset of 67,074 OpenHands runs, **78% of runs sent the model at least one stale view of the code**, and about 1 in 7 requests carried one.

{{FRESHCTX_PREVALENCE}}

## How it works

FreshCtx builds on [CORVUS](https://arxiv.org/abs/2607.22711), a paper by researchers at Purdue University and AWS AI Labs, and takes on the first item of its future work: refreshing the functions the agent read instead of whole files.

- **No new tool.** The agent reads files the way it always has, and any successful read counts.
- **Only the outgoing copy changes.** The saved conversation stays exactly as the tools returned it, for debugging and replay.
- **Functions, not files.** Tree-sitter parsers for Python, JavaScript, TypeScript, Go, and Rust find each function again by name after edits move or change it. On five real traces, the refreshed code was 1.7 to 8.6 times smaller than whole files.
- **A budget.** The current code fills a 128 KiB budget, most recently read first, and a function is never cut in half.
- **Checked before sending.** Every inserted piece of code is hashed against the file on disk. If anything changed after the plan, the request is not sent.

{{FRESHCTX_REQUEST_COPY}}

It runs as a small Node.js process next to the agent, and a thin bridge inside the agent talks to it. There are bridges for Pi, tested against the real agent, and OpenHands, tested with recorded requests.

## Results

I replayed 1,198 runs from the dataset through the engine. **Every piece of code it inserted matched the file byte for byte at the moment of its request**, with zero stale views.

Whether the model does better is a separate question. In small live experiments, FreshCtx helped when the model could not re-read, giving the current value 7 times out of 8 against 0 out of 8, but did worse when it could re-read, because the markers did not say where the current code went. It is also not cheaper: the old reads it removes are served from the prompt cache, and the current code is billed at full price.

The full write-up covers the method, the failures, and what comes next. The measurements, replays, and live runs are public in the research repository.

## Links

- [Write-up: Model context is not static](../../blog/model-context-is-not-static/)
- [Video walkthrough on YouTube](https://www.youtube.com/watch?v=DIVOnXUCZkg)
- [Source on GitHub](https://github.com/felipebasurto/freshctx)
- [Research repository with measurements and live runs](https://github.com/felipebasurto/freshctx-research)
