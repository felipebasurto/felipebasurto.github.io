---
title: "The travelling salesman problem, with prices"
description: "Two weeks free before a fixed date in Melbourne is the travelling salesman problem with prices instead of distances. This is viajante, the open-source tool I built so any AI assistant can search live flights and hotels: how it reads Google Flights and Google Hotels, how its undocumented protobuf was decoded, how it proves a filter was applied, and why it is fast."
summary: "How a trip with no plan became viajante, live flight and hotel search for AI assistants."
date: 2026-10-13
cover: /assets/blog/viajante/cover.svg
og_image: /assets/blog/viajante/og.png
cover_alt: "Three arcs between two points, each one a possible route from an origin to a destination. One arc is solid."
tags: AI agents, MCP
draft: true
---

After many months, the trip was finally here. I was going to visit a friend who lives in Melbourne, and I had to be there on 15 July. I had more days off than that, so I decided to spend the two weeks before travelling on my own.

## Too many options

Bali, Vietnam, China and Kuala Lumpur were all possible. With no fixed dates and no fixed destination, every option looked as good as the others, and I could not pick one.

First I tried flight APIs and paid subscriptions. Most of them charge per search. That is fine for one route, but I wanted to compare every combination of dates and cities, and each combination cost money.

Then I found a small open-source library on GitHub that got the same flight data with plain HTTP requests. Connected to a model, it let the model run the searches and reason about the results. I made a folder on my laptop and gave a coding agent this brief:

> - Leave Madrid on 1 July or later.
> - Be in Melbourne by 15 July.
> - Anything in between. Find the cheapest way there, through a place worth a stop.

For this post I asked viajante the same question again, with the dates moved to December. One call ran eight searches in 2.3 seconds:

| Stop | From Madrid, 1 Dec | To Melbourne, 14 Dec | Total |
| --- | --- | --- | ---: |
| Ho Chi Minh City | 284&nbsp;€, 22&nbsp;h | 202&nbsp;€, 23&nbsp;h | 486&nbsp;€ |
| Bangkok | 284&nbsp;€, 19&nbsp;h | 213&nbsp;€, 24&nbsp;h | 497&nbsp;€ |
| Kuala Lumpur | 315&nbsp;€, 16&nbsp;h | 236&nbsp;€, 11&nbsp;h | 551&nbsp;€ |
| Bali | 464&nbsp;€, 18&nbsp;h | 150&nbsp;€, 6&nbsp;h nonstop | 614&nbsp;€ |

The cheapest total is not the obvious choice. Ho Chi Minh City is the cheapest, but its second flight waits 13 hours in Singapore. Bali costs 128&nbsp;€ more and ends with a nonstop of under six hours. I wanted a model to make that kind of choice for me. In July it did, and I spent the two weeks in Thailand.

I kept working on the agent after the trip, and over time I rewrote most of the original library.

## The travelling salesman problem

In Spanish, the travelling salesman problem is *el problema del viajante*. Given a list of cities and the distance between each pair, find the shortest route that visits every city once and returns to the start. I studied it in my computer science degree. Delivery routes, drilling holes in circuit boards and DNA sequencing are all versions of it.

It is easy to state and hard to solve, because each new city multiplies the number of possible routes:

{{FIG_TSP}}

With a few dozen cities there are too many routes to check, so most solvers accept a good route instead of the best one.

My trip was a harder version. The distances were prices, the prices changed every day, and the route had to end in Melbourne instead of returning home. That is where the name comes from, and most of the idea. Viajante gives any AI assistant live flight and hotel prices, so the assistant can work on that problem for you.

{{FIG_VIDEO_TRAILER}}

## Flight search was built for clicking

Skyscanner, Kayak, Google Flights and Booking.com were designed for a person who searches one route and one set of dates at a time, then clicks through the results. An assistant can run dozens of searches in the time a person runs one, remember every result and read every review in any language. The tools still assume a person is reading.

Getting the data any other way is hard. Google closed its public flight API, QPX Express, in 2018. The others, such as Amadeus, need a contract or charge per search. That works for checking one route. It does not work for comparing every combination of dates and cities.

Google has all the data to build this properly, and I would be happy to talk to them about it. In a few years, a tool like viajante may not be needed. Today it is.

## A tool, not another assistant

Viajante is not an AI and not an app. It is a small tool that makes the assistant you already use much faster at searching flights and hotels. I did not build my own assistant for two reasons. The data is not mine, and I do not have the right to sell it. And there are already too many assistants. Another one would only add to the noise.

So viajante tries to work wherever an assistant runs. It is an MCP server, which most assistants and coding agents can use. It is also a Python library and a command-line tool, for agents that cannot install MCP servers or plugins but can write and run Python, such as Instinct. There, at least the hotel searches work.

It has 22 tools: search flights, check a month of dates, find destinations from an airport, search hotels, check room rates, validate an itinerary and a few more. The model does the reasoning. Viajante fetches the data and does not guess.

This is how I use it with an assistant:

{{FIG_VIDEO_HOWTO}}

## How viajante works

Viajante talks to two Google products, and they work in opposite ways:

{{FIG_COMPARE}}

### Flights

{{FIG_PIPELINE}}

The search goes to Google as a protobuf in the URL of the public results page. The next section is about that protobuf.

The answer is a full results page, about 2 MB of HTML. Google does not load the results with a second request. It puts them in the page, inside a script, as one large JSON array. Viajante finds that array by counting brackets, reads it as JSON and never runs Google's JavaScript. On one page, 1.9 MB of HTML held 90 KB of JSON.

The JSON has no names, only positions in nested arrays. This is one itinerary from that page, with names added to the positions viajante reads:

```json
{
  "airlines": ["American", "British Airways"],
  "flights": [
    {
      "flight": "AA100",
      "from": "JFK",
      "to": "LHR",
      "departs": "18:25",
      "arrives": "06:20",
      "minutes": 415,
      "aircraft": "Boeing 777"
    },
    {"flight": "...", "from": "LHR", "to": "LIS"}
  ],
  "price": 673
}
```

When Google moves a field, the search fails as `markup_drift` instead of returning a wrong price.

### Hotels

{{FIG_PIPELINE_HOTELS}}

For hotels, viajante does not load a page. It sends the same internal request that the Google Hotels page sends, a POST to the endpoint Google's web apps share. The search is a short JSON array, 413 bytes in total. With names added, it says this:

```json
{
  "query": "Lisbon hotels",
  "type": "hotels",
  "check_in": "2026-11-12",
  "check_out": "2026-11-19",
  "nights": 7,
  "free_cancellation": true,
  "sort": "price",
  "currency": "USD"
}
```

The answer is about 200 KB of JSON, stored as a string inside another JSON array. Each property is an array of 27 positions. This is the first of the 18 that search returned:

```json
{
  "name": "Lisboa Camping",
  "total_for_the_stay": "US$184",
  "per_night": "US$26",
  "rating": 3.5,
  "reviews": 6299,
  "location": [38.72477, -9.20723]
}
```

Viajante always reads the total for the stay and never uses the nightly price as a total. A few rules matter for hotels:

- **Free cancellation is on by default.** Many cards do not mention cancellation. Those come back as `unknown`, never as free to cancel.
- **The kind of place comes from Google's tags,** never from a word in the name. A hostel price may be one bed in a dormitory.
- **A minimum rating sends a second request,** in relevance order, because the cheapest page is mostly low-rated hotels.
- **Up to eight stays can go in one call,** and the result lists each property's total for every stay where it appeared.

Viajante can also read Booking.com, but only by driving a real browser, which is slow. Google Hotels is the default for assistants.

## Decoding a protobuf nobody documented

A protobuf is Google's binary format for structured data. Each value is stored as a field number, a type and the value. There are no names. Without Google's schema, `0x48 0x01` is just "field 9 is 1", and nothing tells you that field 9 is the cabin and 1 is economy.

Google publishes no schema for the `tfs` parameter, so viajante learned it one field at a time. The method is simple. Search on Google Flights in a browser, change one thing, such as the cabin or the latest departure time, and decode the URL before and after. The bytes that changed are the field. A search is only a few dozen bytes, so an AI model can decode and compare two of them in seconds. This used to mean an afternoon of reading hex. Now it takes minutes, and that is what made the new filters possible.

These are the bytes of a one-way search from JFK to London on 12 November, departing after 18:00 with at most 10 hours of travel:

{{FIG_TFS}}

This is the map viajante uses today:

| Field | What it holds | Example |
| --- | --- | --- |
| **In each flight** | | |
| 2 | date | `2026-11-12` |
| 5 | maximum stops | `1` |
| 6, 7 | airlines to include, to exclude | `BA` |
| 8, 9 | earliest, latest departure hour | `18` |
| 10, 11 | earliest, latest arrival hour | `22` |
| 12 | maximum travel time, in minutes | `600` |
| 13, 14 | origin, destination | `JFK`, `LHR` |
| 18 | maximum layover, in minutes | `120` |
| 19 | fewer emissions | `1` |
| **For the whole search** | | |
| 3 | one flight message per leg | |
| 8 | passengers | `1` = adult |
| 9 | cabin | `1` = economy, `3` = business |
| 12 | price cap | `400` |
| 13 | carry-on bags | `1` |
| 17 | hide separately booked tickets | `1` |
| 19 | trip type | `2` = one-way, `1` = round trip |

The departure and arrival hours, travel time, layover, emissions, price cap and separate-ticket fields are new in the latest version. Each field is pinned by a test that compares viajante's bytes with a URL decoded by hand, so if Google changes the format, the test fails before a user sees a wrong result.

## Proving a filter was applied

Sending a filter is not the same as Google applying it. Google accepts an airline exclusion in the URL, for example, and still shows that airline. A tool that trusts the URL will tell the model the results are filtered when they are not.

So viajante checks the page. Every filter it sends must come back as a selected filter chip on the results page, such as "Under 3 hr, Duration, Selected" or "up to €400, Price, Selected". If a chip is missing, the search fails as `markup_drift`. It does not return results that may not be filtered.

Google's filters are also coarser than the ones a model asks for. Departure and arrival times only take whole hours, so "after 18:30" cannot be sent exactly. Viajante sends a looser bound, 18:00, so Google never removes a flight the model would keep. Then it applies the exact filter itself on every row. Travel time and layovers round up to the minute for the same reason.

The checks have limits, and viajante says so. A time chip proves that a time filter is on, not which hours it covers. And when a filter cannot be proven at all, viajante refuses it before sending anything. Checked bags and "no basic economy" have no chip on the public page, so they are refused. Minimum layover, connecting airports and overnight rules never go to Google. Viajante applies them locally, and an unknown value never passes a filter.

## Why it is fast

Every speed-up in viajante came from sending fewer requests, or sending them at the same time.

**No browser.** For a normal search, viajante never starts Chromium. It sends plain HTTP requests with [curl_cffi](https://github.com/lexiforest/curl_cffi), a Python binding for curl that copies Chrome's TLS handshake and HTTP/2 settings, so Google answers it like a browser. One request returns the whole answer, and viajante reads it without running any JavaScript.

**One connection, eight requests at a time.** All requests share one session. HTTP/2 sends them as separate streams on a single connection, so viajante can have eight requests in flight without opening eight connections.

**Fewer requests.** Google shows a consent page to visitors from the EU, and declining it costs extra requests before the first result. Viajante saves the decline cookie for 30 days and skips that step on later searches. A one-way search is then a single request.

Round trips show all three at once. Google prices a round trip as a package and shows the return flights only after you pick an outbound flight, so viajante opens one return page for each of the eight cheapest outbound flights. Version 1.4.7 went through the consent page and opened the return pages one by one. Version 1.5.0 skips the consent page and opens all eight together:

{{FIG_WATERFALL}}

In two runs each, 1.4.7 took 9.7 and 10.0 seconds, and 1.5.0 took 3.5 and 4.1 seconds, while reading about 17 MB of HTML. The price is always Google's package price. Viajante never adds two one-way fares.

The parser got faster too. On the same 1.9 MB page, cutting out the JSON took 16.8 milliseconds in 1.4.7 and 2.7 in 1.5.0. That is six times faster, but it saves only a tenth of a second per search. The network is where the time goes.

The newest speed-up comes from the decoded protobuf. When the filters go to Google, Google sends less back. A search from JFK to London departing after 18:00, with at most 10 hours of travel, returned all 99 itineraries to version 1.5.0, which then dropped 80 of them itself. Version 1.5.1 puts both filters in the URL, so Google returns only the 19 that qualify. That is half the HTML, 2.5 MB instead of 5.2 MB, and 1.0 to 1.2 seconds instead of 1.4 to 1.6. Both versions end with the same 19 flights.

Hotels are faster still, because there is no page to download and no consent step. One search is a single POST. With a minimum rating, the price page and the relevance page go out together:

{{FIG_WATERFALL_HOTELS}}

One search took 1.1 seconds, and with a minimum rating both pages arrived in 1.2 seconds. A batch of stays is the slow case. Viajante searches the stays one after another, so three cities took 3.5 seconds. Sending them together, like the return pages of a round trip, is the next step.

## Designed for a model, not a person

A person wants one good answer. A model needs the data behind it, a way to tell what is known from what is not, and as few tokens as possible.

**The raw offers come first.** For the JFK to London search, the model got the top eight offers out of 91 compared, each with every field Google returned, and it can ask for more. On top of that, viajante adds a shortlist with three roles:

| Role | Flight | Fare | Time | Stops |
| --- | --- | ---: | ---: | --- |
| `lowest_price` | ITA via Rome | 319 USD | 12 h | 1, a 45-minute change in Rome |
| `top_score`, `shortest` | British Airways BA182 | 368 USD | 6 h 50 | nonstop |
| `alternative` | British Airways | 368 USD | 6 h 55 | nonstop |

A label says what the flight is, not whether it is the best one, and every trade-off names a missing field, such as "Checked bag fee unknown". The decision stays with the model. It can see that 49 dollars more saves five hours and a short connection in Rome, and decide whether that is worth it for you. Hotels have no shortlist. The model gets the stays in price order, with rating, reviews, distance and cancellation evidence.

**Empty has three meanings.** Every tool returns the same envelope, and its first fields say what kind of answer it is:

```json
{
  "status": "ok",
  "completeness": "complete",
  "empty_reason": null,
  "queries": ["...offers, each with evidence..."]
}
```

When there are no results, `empty_reason` says why. `provider_empty` means Google returned nothing. `filtered_out` means Google returned results and the filters removed them all. `not_loaded` means the search did not finish. The model may say "there are no flights" only in the first case.

**Every offer carries its evidence:** when it was fetched, the search URL, the booking URL and which fields are known. Before the model answers, `verify_answer` checks its draft against the searches and flags any price, airport code or link that no search returned.

**Tokens are a budget.** The tool catalog is in the model's context on every turn. It grew from 19 KB in the first release to 76 KB when every tool got the envelope, and I cut it back to 55 KB without removing a tool.

The model can also combine searches: the cheapest day in a month, a few days around a date, destinations from an airport, round trips and multi-city trips, and split tickets, which always say `connection_protected: false` because nobody rebooks you if you miss the connection.

## How it got here

The repository has been public for a while, but I did not want to write about viajante until it was good enough to show. These releases changed it the most:

- **1.3.0** removed the natural-language planner and a test battery graded by an LLM judge. Turning a prompt into searches is the model's job.
- **1.4.5** gave every tool the same envelope, with cancellation, deadlines and progress updates.
- **1.4.6** moved flights to the public results page. Older versions used an internal Google request, which Google refuses most of the time today.
- **1.5.0** made it fast, with the saved consent cookie, the batched return pages and the faster parser.
- **1.5.1** sends Google the new protobuf fields and checks every one of them.

I ran the same two searches with each release, from my laptop:

{{FIG_RELEASES}}

Four old versions fail today, because Google now refuses the internal request they used or, in 1.0.0, because it read the EU consent page as a block. Version 1.2.0 looks fast on round trips because it returned only the outbound flight. These are today's results, not each version's results on its release day.

## Limits

- **Google can change the page at any time.** Searches then fail as `markup_drift` until I update viajante.
- **Rate limits are a guess.** Google publishes no quota. After a 429 or a refused request, viajante pauses every Google search on the computer for 2 minutes, or for as long as Google asks, up to 30.
- **Some filters cannot be proven,** so viajante refuses them.
- **Round trips are capped.** Viajante checks the eight cheapest outbound flights, so a cheaper package behind the ninth one is not in the result.
- **Exploring destinations needs a browser,** which is slower.
- **It does not book.** Check the final price and the cancellation terms on the provider before you pay.

## Try it

Viajante needs [uv](https://docs.astral.sh/uv/getting-started/installation/) and Python 3.10 or newer. Add it to your assistant's MCP configuration:

```json
{
  "mcpServers": {
    "viajante": {
      "command": "npx",
      "args": ["-y", "@viajante/mcp"]
    }
  }
}
```

Without Node, use `"command": "uvx"` with `"args": ["--from", "viajante[mcp]", "viajante-mcp"]`. Then ask your assistant something like this:

> I am free from 1 to 15 December and I need to be in Melbourne on the 15th. I am leaving from London. Find me a route through Asia with a stop worth a few days.

It also works as a command-line tool and a Python library:

```bash
pip install viajante
viajante flights JFK-LHR:2026-12-01
```

The code is on [GitHub](https://github.com/felipebasurto/viajante) and the package is on [PyPI](https://pypi.org/project/viajante/). If something breaks, `viajante feedback` opens a GitHub issue with your version already filled in.

## Lessons

- **AI makes undocumented formats cheap to decode.** Changing one filter and comparing the bytes turned a protobuf with no schema into a map of fields in minutes.
- **Sending a filter proves nothing.** Check that the provider applied it, send a looser bound when you cannot send the exact one, and filter exactly yourself.
- **Empty has to say why.** "No flights", "the filters removed every flight" and "the search did not finish" are three different answers.
- **Refuse instead of guessing.** An error the model can explain is better than a quiet wrong answer.
- **The biggest speed-ups removed requests.** Skipping the consent page and sending the return pages together saved more time than a parser six times faster.
- **Measure your old versions.** Running every release against today's Google showed four broken versions, and one that was fast only because it did half the work.

## What it is for

Viajante does one narrow job. It gets an assistant the same flight and hotel data a person sees in a browser, quickly, and it says clearly when it could not. The route, the trade-offs and the opinion stay with the model.

That is what I wanted in July, with two weeks, a date in Melbourne and no plan.
