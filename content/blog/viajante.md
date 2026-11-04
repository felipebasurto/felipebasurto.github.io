---
title: "The travelling salesman problem, with prices"
description: "Viajante gives any AI assistant live flight and hotel prices. How I decoded Google Flights' undocumented protobuf, how it runs where there is no MCP, and where I think travel software is going."
summary: "Viajante: live flights and hotels for AI assistants, and the protobuf I decoded to build it."
date: 2026-10-29
cover: /assets/blog/viajante/cover.svg
og_image: /assets/blog/viajante/og.png
cover_alt: "Three arcs between two points, each one a possible route from an origin to a destination. One arc is solid."
tags: AI agents, MCP
---

After many months, the trip was finally here. I was going to visit a friend who lives in Melbourne, and I had to be there on 15 July. I had more days off than that, so I decided to spend the two weeks before travelling on my own.

## Too many options

Bali, Vietnam, China and Kuala Lumpur were all possible. With no fixed dates and no fixed destination, every option looked as good as the others, and I could not pick one.

Flight APIs and paid subscriptions mostly charge per search. That is fine for one route, but I wanted every combination of dates and cities, and each combination cost money. Then I found [fast-flights](https://pypi.org/project/fast-flights/), an open-source library that got Google Flights data with plain HTTP requests. Connected to a model, it let the model run the searches and reason about the results. I gave a coding agent this brief:

> - Leave Madrid on 1 July or later.
> - Be in Melbourne by 15 July.
> - Anything in between. Find the cheapest way there, through a place worth a stop.

For this post I asked viajante the same question again, with the dates moved to December. One call ran eight searches in 2.3 seconds:

| Stop | From Madrid, 1 Dec | To Melbourne, 14 Dec | Total |
| --- | --- | --- | ---: |
| Ho Chi Minh City | 284&nbsp;€, 22&nbsp;h | 202&nbsp;€, 23&nbsp;h | 486&nbsp;€ |
| Bangkok | 284&nbsp;€, 19&nbsp;h | 213&nbsp;€, 24&nbsp;h | 497&nbsp;€ |
| Kuala Lumpur | 315&nbsp;€, 16&nbsp;h | 236&nbsp;€, 11&nbsp;h | 551&nbsp;€ |
| Bali | 464&nbsp;€, 18&nbsp;h | 150&nbsp;€, 5&nbsp;h&nbsp;40 nonstop | 614&nbsp;€ |

The cheapest total is not the obvious choice. Ho Chi Minh City is the cheapest, but its second flight waits 13 hours in Singapore. Bali costs 128&nbsp;€ more and ends with a nonstop. I wanted a model to make that kind of choice for me. In July it did, and I spent the two weeks in Thailand.

I kept working on the agent after the trip, and replaced the library with my own code.

## The travelling salesman problem

In Spanish, the travelling salesman problem is *el problema del viajante*. Given a list of cities and the distance between each pair, find the shortest route that visits every city once. Each new city multiplies the number of routes, so with a few dozen cities solvers accept a good route instead of the best one:

{{FIG_TSP}}

My trip was a harder version. The distances were prices, the prices changed every day, and the route had to end in Melbourne instead of returning home. That is where the name comes from. Viajante gives any AI assistant live flight and hotel prices, so the assistant can work on that problem for you.

{{FIG_VIDEO_TRAILER}}

## Decoding a protobuf nobody documented

Viajante has no API to call. For flights it asks Google Flights for the same public results page a browser loads, and reads the answer. The hard part is writing the search. It lives in the URL, in a parameter called `tfs`, and `tfs` is a protobuf.

A protobuf is Google's binary format for structured data. A protobuf stores each value as a field number, a type and the value. There are no names, and Google publishes no schema for this one. Without it, `48 01` is just "field 9 is 1". Nothing says that field 9 is the cabin and 1 is economy.

fast-flights gave me a starting point. It encoded origin, destination, date, passengers and cabin. Every other filter on the page, such as departure time, duration, layover, price and airlines, had no known field.

### Change one thing, diff the bytes

The method is the one you would use on any binary format. Open Google Flights in a browser, change one control, copy the URL, decode the `tfs` before and after, and read what moved. A search is a few dozen bytes, so an AI model can decode two of them and tell you which bytes changed in seconds. Reading hex like this used to take an afternoon. With an agent it takes minutes, and that is what made every filter below possible.

{{FIG_TFS_DIFF}}

Two details make the diffs readable. A protobuf message starts with its length, so adding a filter inside the flight also changes the length byte in front of it. And a number above 127 takes two bytes, seven bits each, which is why 600 minutes is `d8 04`.

### The page tells you if you were right

A decoded URL is only a guess. The proof is whether Google applied it. After a search, the results page shows the active filters as chips, such as "Under 3 hr, Duration, Selected". So the work had two halves. When I did not know a field, I captured it from the browser. Then an agent swept variants, sending guesses as plain GET requests and reading the chips back. A guess that comes back as a chip is a field.

Some guesses never did, and those are part of the result:

- **Carry-on bags** came from a capture. I recorded the Bags panel and found a sub-message at field 13, with the count at field 2. Google echoes it as "1 carry-on bag, Bags, Selected".
- **Checked bags** share that sub-message, in field 3. No probe ever produced a chip for them, so viajante refuses the filter instead of sending something it cannot prove.
- **Airline exclusion** is a field Google accepts and then ignores. The airline stays in the results, so viajante drops those flights itself.
- **Departure and arrival times** only take whole hours, so "after 18:30" cannot be sent. Viajante sends 18:00, so Google never removes a flight you would keep, and then applies 18:30 exactly on every row.

If a chip is missing, the search fails as `markup_drift` instead of returning results that may not be filtered.

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

Tests pin the bytes of this map against URLs decoded by hand, so if Google changes the format, a test fails before a user sees a wrong result. Two gaps remain. Field 10 inside each flight, the earliest arrival hour, and the premium-economy and first-class cabins (`2` and `4`) are written but never byte-checked.

### What I have not decoded

Google's answer is a JSON array with no names, only positions. It sits in the page inside a script, about 90 KB in a 1.9 MB page. Viajante finds it by counting brackets and parses it as JSON, without running Google's JavaScript. Each flight has 25 positions and each leg has 33. Viajante reads about seven of the flight positions and eight of the leg positions. They cover price, times, stops, layovers, carriers and flight numbers. The array also holds the aircraft, the length of each segment, the operating carrier and the base, tax and fee breakdown, and viajante does not read them.

Did I decode all of it? No. I decoded what a model needs to choose a flight.

### Google sends less

Once the filters were in the URL, Google stopped sending what the model did not want. Take a one-way search from JFK to London, leaving after 18:00, with at most 10 hours of travel. Version 1.5.0 sent neither filter. Google returned all 116 itineraries and viajante dropped 98 of them itself. Version 1.5.2 puts both in the `tfs`, and Google returns only the 18 that qualify. That is less than half the HTML, 2.6 MB instead of 5.8, and a median of 1.1 seconds instead of 2.3. Both end with the same 18 flights.

{{FIG_TFS}}

Hotels work differently. Viajante sends a POST to the internal endpoint that Google's web apps share, with the search as a 413-byte JSON array, and gets about 200 KB of JSON back. It reads the total for the stay and never the nightly price.

## When the assistant has no MCP

Viajante is an MCP server, which most assistants and coding agents can use. Instinct is a personal assistant you message like a contact, and it has no way to plug in a custom MCP server. [One developer](https://dev.to/chilarai/no-mcp-no-problem-how-i-got-instinct-ai-to-call-a-flight-api-31g0) who wanted flights in it built a bridge. Instinct writes requests into a Google Sheet, and a script polls the sheet and calls an API.

I did not want anyone to need a bridge. Instinct can write a Python file and run it, so viajante is also a Python library. The setup message on the landing page tells Instinct that it has a Python sandbox, not an MCP config, and that viajante is on PyPI. Instinct then writes something like this and runs it:

```python
from datetime import date
from viajante import HotelQuery, search_hotels

hotels = search_hotels(
    [HotelQuery(location="Bangkok", check_in=date(2026, 12, 1), check_out=date(2026, 12, 8))],
    currency="EUR", source="google", top=3,
)
```

The same code sits behind the MCP server, the command line and the Python library, so an assistant that cannot load a tool can still call code.

{{FIG_COMPAT}}

## Why it is fast

Almost every speed-up in viajante came from sending fewer requests, or sending them at the same time.

**No browser.** For a normal search viajante never starts Chromium. It sends plain HTTP requests with [curl_cffi](https://github.com/lexiforest/curl_cffi), a Python binding for curl that copies Chrome's TLS handshake, so Google answers it like a browser.

**Fewer requests.** Google shows a consent page to visitors from the EU, and declining it costs extra requests before the first result. Viajante keeps the decline cookie for 30 days and skips that step. A round trip adds a second problem. Google prices it as a package and shows the return flights only after you pick an outbound flight. So viajante opens one return page for each of the eight cheapest outbound flights. Version 1.4.7 opened them one by one. Today all eight go out together:

{{FIG_WATERFALL}}

I ran the same round trip, JFK to Lisbon, three times on each version. The median was 9.9 seconds in 1.4.7 and 2.5 in 1.5.2, with the same cheapest package. The saved cookie only helps after a first search. On a machine that has never searched, a one-way search takes 3.7 to 3.9 seconds, as slow as the old versions. Most of the time goes to the network, not the parser.

## Designed for a model, not a person

A person wants one good answer. A model needs the data behind it, a way to tell what is known from what is not, and as few tokens as possible.

**The raw offers come first.** The model gets the top eight offers, each with every field Google returned. A shortlist labels flights by what they are, such as `lowest_price` or `shortest`, never by whether they are best, and each trade-off names a missing field, like "Checked bag fee unknown". The decision stays with the model.

**Empty has three meanings.** Every tool returns the same envelope, and `empty_reason` says why there are no results. `provider_empty` means Google returned nothing. `filtered_out` means Google returned results and the filters removed them all. `not_loaded` means the search did not finish. The model may say "there are no flights" only in the first case.

**Every offer carries its evidence.** Each one has the time it was fetched, the search URL, the booking URL and a list of which fields are known. Before the model answers, `verify_answer` checks its draft against the searches and flags any price, airport code or link that no search returned.

## Where travel software is going

Skyscanner, Kayak, Google Flights and Booking.com assume a person who searches one route and one set of dates at a time, then clicks through the results. An assistant can run dozens of searches in the time a person runs one, remember every result and read every review in any language. The interface is what slows it down.

I think many interfaces are going away. A lot of software exists so that a person can drive a database by clicking through filters, tabs, a calendar and a checkout form. An agent needs none of that. It needs something to talk to, an MCP server or a library, and I expect many services to end up as exactly that.

Viajante is my bet on what that looks like for travel. I do not think the booking site of the future is somewhere you click. I think it is an agent that does the searching, across every date and city, and comes back with two or three finalists and their photos. It tells you which one it would take and why, for example closer to the airport, one stop fewer, or 128&nbsp;€ more for a nonstop. You say yes, and it pays with the card you saved. You never open a filter.

{{FIG_FUTURE}}

Search, comparison and the recommendation work today. Photos and payment do not. In a few years a tool like viajante may not be needed, because the providers will offer an interface for agents themselves. Today they do not, so someone has to.

## Try it

With Node, add this to your assistant's MCP configuration:

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

Without Node, install [uv](https://docs.astral.sh/uv/getting-started/installation/) and use `"command": "uvx"` with `"args": ["--from", "viajante[mcp]", "viajante-mcp"]`. For an assistant with no MCP, run `pip install viajante` on Python 3.10 or newer. Then ask it for a trip with a date to hit and a few days to spare. This is how I use it:

{{FIG_VIDEO_HOWTO}}

The code is on [GitHub](https://github.com/felipebasurto/viajante) and the package is on [PyPI](https://pypi.org/project/viajante/). If something breaks, `viajante feedback` opens a GitHub issue with your version already filled in.

## Limits

- **Google can change the page at any time.** Searches then fail as `markup_drift` until I update viajante.
- **Rate limits are a guess.** After a 429 or a refused request, viajante pauses every Google search on the computer for 2 minutes, or for as long as Google asks, up to 30.
- **It does not book.** Check the final price and the cancellation terms on the provider before you pay.

## Lessons

- **Sending a filter proves nothing.** Check that the provider applied it, send a looser bound when you cannot send the exact one, and filter exactly yourself.
- **Empty has to say why, and a guess has to be refused.** An error the model can explain is better than a quiet wrong answer.

Viajante does one narrow job. It gets an assistant the same flight and hotel data a person sees in a browser, in a few seconds, and it says when it could not. The route, the trade-offs and the opinion stay with the model. That is what I wanted in July, with two weeks, a date in Melbourne and no plan.
