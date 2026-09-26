# Model context is not static

Canonical: https://felipebasurto.com/blog/model-context-is-not-static/
Author: Felipe Basurto (https://felipebasurto.com/)
Published: 2026-09-23
Tags: Coding agents, Context engineering

In 78% of 67,074 public coding-agent runs, the agent kept re-sending code that its own edit had made stale. I built a context engine, based on the CORVUS paper, that keeps that code current. It works byte for byte, but the model did not reliably do better, and requests did not get cheaper.

---

A coding agent reads a function:

```js
function total(quantity) {
  return quantity * 10;
}
```

Then something or someone edits the file: the agent itself, a formatter, another process or another agent. Now the multiplier is `20`. What does the model see on its next request?


The file on disk says `20`. The model still sees `10`, because the agent's earlier read is still in the model's context, and most agents re-send the whole conversation on every request. The tools work on one version of the file while the model reasons from another.

What usually happens is that the agent can read the file again, and it often does, but then it depends on the model deciding to. I built [FreshCtx](https://github.com/felipebasurto/freshctx) to take that job away from the model. It is a local context engine: a program that rebuilds a current view of the code the agent has read before every request is sent.

This post measures how often the problem shows up in public agent runs, explains the paper FreshCtx is based on and how the engine works, and then answers three questions:

- Is the code the model receives current?
- Does the model do better with it?
- What does it cost?

<details>
<summary>Words used in this article</summary>

- **Harness:** the program around the model that runs tools, records their results and builds each model request.
- **Request:** everything sent to the model in one call, usually the whole conversation so far.
- **File view:** a tool result that shows a file or some of its lines.
- **Stale:** the file has changed since the view, so at least one line it shows no longer matches the disk.
- **Marker:** a short placeholder that replaces an old file view in the request.
- **Projection:** the current code for what the agent has read, added once at the end of the request.
- **Prompt cache:** providers charge less for the start of a request when it is identical to the start of an earlier one.

</details>

## Every coding agent sees old code

Cursor, Claude Code, Codex, Devin, OpenCode, OpenHands, Hermes and Pi all run the same basic loop. The model reads the request and decides what to do next. The harness gives it tools, such as reading a file, editing one or running a command: the model asks for one, the harness runs it and adds its output, the tool result, to the conversation. The model never touches the disk. Everything it knows about the code comes from tool results in the request.

The simplest way to build the next request, and the usual one, is to re-send the whole conversation so far, with every tool result in it, until compaction trims it:


A file read does two jobs: it records what a tool returned at one moment, and it supplies source code for later reasoning. The two agree until the file changes. Keeping the old result is useful for debugging; reusing it as current source is the risk. The conversation is a cache that never refreshes.

## How often it happens

To count it, I used a public dataset, [nebius/SWE-rebench-openhands-trajectories](https://huggingface.co/datasets/nebius/SWE-rebench-openhands-trajectories). It holds 67,074 runs of OpenHands, an open-source coding agent, using the Qwen3-Coder-480B model to fix real GitHub issues, with every request recorded. Compaction was switched off, so every request carries the whole conversation.

The rule was strict: a view counts as stale only when the next thing to touch its file is the agent's own edit, changing a line the view showed. Reads through shell commands such as `cat` do not count.

Here is one interesting case I found. A task asked the agent to fix a bug in [canvasapi](https://github.com/ucfopen/canvasapi), a Python library for the Canvas learning platform. The agent read all 231 lines of `canvasapi/module.py`, then edited the function it had just read. The edit added two lines, so everything below line 126 moved down. From then on, every request carried the old read next to a file that no longer matched it:


That is just one run. Across all of them, **78% of runs sent the model at least one request with a stale view, and 22% still did in their very last request**. Counted by request instead of by run, about 1 in 7 requests carried one:


A stale view is not proof of a wrong answer; if it were, no agent would work. Models often re-read and recover. But it means the prompt holds two versions of the same code, and the model has to work out which is current.

## The idea comes from CORVUS

Everything here builds on [CORVUS](https://arxiv.org/abs/2607.22711), a paper published two months ago by [Mingwei Zheng](https://zmw12306.github.io/) of Purdue University, with [David O'Brien](https://davidmobrien.github.io/), [Siwei Cui](https://jncsw.github.io/), [Pardis Pashakhanloo](https://pardisp.github.io/), [Rajdeep Mukherjee](https://rajdeepmukherjee.com/), [Myeongsoo Kim](https://codingsoo.github.io/) and [Sachit Kuhar](https://sachitkuhar.github.io/) of AWS AI Labs. 

They described this problem before I did, and they named its cause: agents keep an append-only history, where a file read is a fixed snapshot that nothing ever updates. Agents then re-read files they already have, and edit from old snapshots, so edits fail and need recovering.

Their fix adds one phase to the agent loop. A new `sync_file` tool puts a file on a list and leaves a short marker in the history. Before every step, a context sync reads each listed file from disk and adds its current contents at the end of the prompt. The prompt holds at most one copy of each file, and that copy is current. Simplified from their first two figures:


Across 573 tasks and four models, they report 9% to 50% fewer input tokens, up to about half the cost, and pass rates within about 1.4 points of the baseline. 

They also found that current files work better at the end of the prompt than near the start. Their future work names two open problems: refreshing selected functions instead of whole files, and prompt caching, which gets harder when part of the prompt changes on every step.

That gives three broad ways to handle an old file view:


**FreshCtx is my attempt at the first item of their future work: refreshing only the functions the agent read, instead of whole files.**

## How FreshCtx works

FreshCtx follows the CORVUS idea with four differences:

- **No new tool.** The agent reads files the way it always has, and any successful read counts.
- **Only the outgoing copy changes.** The saved conversation, what the tools really returned, stays as it was for debugging and replay.
- **Functions, not files.** It refreshes the function, or the range of lines, that the agent read. On five traces from Express, Flask, Go tools and ripgrep, that made the refreshed code 1.7 to 8.6 times smaller than whole files.
- **An adapter, not an agent.** It runs as a small local process next to the harness, and a thin adapter inside the harness, the bridge, talks to it.

Before each request, the bridge gets back a rewritten copy: each old view becomes a short marker, and the current code for everything the agent read, the projection, is added once at the end. For the `total` example:


The model gets one current version instead of two that disagree, while the saved conversation keeps `* 10` as the record.

### How does it find the function again?

The agent reads some lines at some position. After an edit, those lines may have moved, and they may have changed. Line numbers are useless for finding them again, since a lot can happen to a file during a coding session, and asking a model would be slow, expensive and unreliable.

So FreshCtx reads the file the way a compiler does. It uses [Tree-sitter](https://tree-sitter.github.io/tree-sitter/), an open-source parser used by editors such as Neovim and Zed, which turns each file into a tree: the file is the trunk, each function or declaration is a branch, and each line hangs off the branch it belongs to.

When the agent reads a line, FreshCtx notes which branch it hangs from. Before the next request, it parses the file again and looks for that branch by name. Lines can move and change, but the branch called `total` is still the branch called `total`.


One line read inside a function brings back the whole function because, even though sending less would be cheaper, half a function is very hard to reason about. A top-level line such as `RATE` belongs to no function, so FreshCtx finds it again by the text around it: a best guess.

If a file cannot be parsed, FreshCtx falls back to the whole file, and if the same code appears twice and it cannot tell which one was read, it leaves the code out rather than guess. There is room for improvement here, but it will never be an exact science.

Parsing is local and fast enough to run before every request, and Tree-sitter still builds a tree when the code has a syntax error, which happens often while an agent is mid-edit.

### What is the projection, and why does it have a size limit?

The projection is the block of current code that FreshCtx adds at the end of each request: one copy of every function the agent has read, as it is on disk right now. It is re-sent in full on every request, and it sits in the part of the prompt that is billed at full price, as the cost section shows.

Without a limit, every function the agent ever read would come back on every request, so a long session would grow more expensive with each step, and the current code would crowd out the conversation in the model's context window.

So the projection has a budget, 128 KiB by default. It fills with the most recently read functions first, on the assumption that what the agent read last is what it is working on, and a function is never cut in half. One that does not fit is left out, and its marker says so, so the model knows to read it again if it needs it.

Just before sending, FreshCtx re-reads the chosen files and checks the hash of every piece of code it inserts. If a formatter changed the file after the plan, or a tool call was left without its result, the request is not sent. A half-rewritten request is worse than none.

## Is the code in the request up to date?

Yes. I replayed every 56th run of the OpenHands dataset, 1,198 in total. For each one, I rebuilt the repository at its starting commit and ran its views, edits and requests through the engine, without calling a model:


Zero stale views.

The more telling result is the code in their place: **every piece of it matched the rebuilt file byte for byte at the moment of its request**.

One gap remains, however: after an edit, OpenHands prints a snippet of the edited file, which FreshCtx does not track yet, so 1,237 requests still carried stale code that way.

A separate check covered an edit from outside the agent: a session in [Pi](https://github.com/earendil-works/pi), an open-source coding agent, read a file, another process changed a constant from `10` to `12`, and the next request held `12` with FreshCtx and `10` without it.

## Does the model actually do better?

This is the question that matters most, and it cannot be checked byte for byte. I ran two small live experiments with [Pi](https://pi.dev/) and the `deepseek-v4-flash` model, each with and without FreshCtx:

- **When the model could re-read, it did worse.** Five tasks gave a session two reads, changed both files while it was closed, then resumed it and checked the answer. Without FreshCtx, the model saw old code, re-read both files and answered correctly every time. With FreshCtx, it had current code from the start, but failed two tasks.
- **When it could not re-read, it did better.** In one ten-turn session, I changed a file between turns and asked about it with the instruction "Do not use tools. Do not read." On the turns where the code had changed, plain Pi gave the old value 8 times out of 8. FreshCtx gave the current value 7 times out of 8.

In the first experiment, each dot is one request after the session resumed, and a run stopped after eight:


Both failures came from how the code was presented. In the tax-base task, the reads came back as markers, and nothing linked them to the current code at the end, so the model kept re-reading. It only stopped because each run was capped at eight requests, a limit I set so that a stuck model could not loop forever.

In the moved-symbol task, it took the `46` in `fees.js:region:46`, a size in bytes, for a line number, and kept asking for a line that did not exist. The header now says `46bytes`; the marker fix is still open.

In the second experiment, the model read the file only on turns 1, 5 and 8:


This setup clearly favors FreshCtx by design. Together, the two experiments say that FreshCtx helps when the model would otherwise trust the conversation, and that a marker must say where its current code went.

Until that is fixed and tested again, I have no evidence that FreshCtx gives better answers in normal use, where the agent can re-read.

## Is it cheaper?

The answer is no. Most of each request is an exact copy of the previous one, so providers serve it from the prompt cache at a fraction of the price, about 1/30 in the DeepSeek price table I used. Only the end is billed in full.

FreshCtx keeps the cached start stable, because markers do not change, but it puts the current code in the full-price end:


The old views that FreshCtx removes would have been cheap, and the code that replaces them is not. Requests also came out 1.93% larger in the replay, because reading a few lines inside a large function brings the whole function back.

CORVUS reports up to half the cost, and the two results do not contradict each other. Its savings come from the agent's behavior: fewer duplicate reads, fewer failed edits and fewer steps, and the CORVUS authors flag caching as an open problem, as I do. 

My replay cannot show behavioral savings, because the agent's actions were fixed in the recording, and my live runs were too small to measure them. In the one resumed task where I compared tokens, FreshCtx used more, 6,489 prompt tokens against 2,410, because the model needed five requests instead of two.

## Lessons for anyone building something like this

- **Measure staleness in your own transcripts.** The rule above is a short script, and it needs nothing but the transcripts.
- **Rewrite the copy, not the record.** Keep what the tools returned for debugging and replay; change only what you send.
- **Label every number you show a model.** A bare `46` was read as a line number. The header now says `46bytes`.
- **Leave a pointer when you move content.** The tax-base loop happened because nothing linked the markers to the code at the end.
- **Put changing content at the end, and budget for it.** The end works best and keeps the cached start stable, but it is paid in full on every request.
- **Judge by outcomes.** Current code and a finished task are different things.

## What I take from this

Keeping the code in a request current is solvable, and it can be checked byte for byte. Whether it helps is less clear. 

The model did not do better where it could re-read, and it is not cheaper. The harder problem is making sure the model understands what it was given.

This is one agent and one model on one public dataset, plus a handful of live runs. Next, I will make each marker say where its current code went and re-run the resumed tasks with repeated runs. 

If that still brings no gain, FreshCtx is mainly useful where re-reading does not happen: long sessions, compacted histories and edits from outside the agent. If it does, the next question is whether the gain survives the cache cost.

## Try it

This [short demo on YouTube](https://www.youtube.com/watch?v=DIVOnXUCZkg) shows FreshCtx running:


From a clone of the [FreshCtx repository](https://github.com/felipebasurto/freshctx), with Node.js 22 or newer:

```bash
npm run demo
```

It runs the real engine on the `total` example, without calling a model, and prints the rewritten request with its checks. There are bridges for [Pi](https://github.com/felipebasurto/freshctx/tree/main/bridges/pi), tested against the real agent, and [OpenHands](https://github.com/felipebasurto/freshctx/tree/main/bridges/openhands), tested with recorded requests. To connect another harness, see the [protocol reference](https://github.com/felipebasurto/freshctx/blob/main/docs/protocol.md) and the [contributor guide](https://github.com/felipebasurto/freshctx/blob/main/CONTRIBUTING.md); pull requests are welcome.

The measurements, replays and live runs are all in [freshctx-research](https://github.com/felipebasurto/freshctx-research).

Thanks for reading, and thanks to the CORVUS authors, whose paper this work rests on.
