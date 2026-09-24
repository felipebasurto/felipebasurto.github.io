---
title: "Encore: Concert Diary | Felipe Basurto"
description: "Encore is an independent iPhone concert diary built with SwiftUI."
og_image: "/assets/companies/encore.png"
---

[← Home](../../)

# Encore: Concert Diary

![Encore](../../assets/companies/encore.png)

Encore is Letterboxd for concerts: a diary for the shows you were actually at. I have built and run it since May 2025. It is bootstrapped, with no paid ads.

The useful moment is the ride home after a show. You log the artist, venue, date, photos, and videos while the details are still fresh, and Encore turns them into a concert history instead of another camera roll folder.

## In numbers

- Over 2,700 accounts and over 15,000 concerts logged.
- About 590 people open the app in a typical month, and they log around 1,100 concerts.
- Available in English, Spanish, German, and French.
- About 420 marketing videos published, with close to 200,000 views.

## The product

- A feed for past concerts and the people who went with you.
- Personal stats, venue history, and a passport for places you have seen music.
- Upcoming dates and a year-end recap built from your entries.
- Friends, shared memories, photos, and video attached to each show.

It is written in Swift and SwiftUI, with Supabase for accounts and sync and RevenueCat for the Premium subscription. I handle crash triage, App Store reviews, and every release.

## Marketing run by an agent

All growth comes from short-form video on TikTok and YouTube. I use [Fastlane](https://usefastlane.ai) to generate and schedule the videos across a set of concert-themed accounts.

A Grok Bot agent is connected to Fastlane's MCP server. Every day it pulls each post's views, ranks what worked, schedules close variations of the winners, and rewrites the captions. Every weekday morning it sends me a recap. I still check any new kind of AI video before it goes out.

What the views taught me:

- The hooks that travel are about how people behave at concerts. "Phone up the whole set means you weren't really there" and "unspoken rules of concerts" each passed 3,500 views. The best single video reached 18,000.
- Slideshows and green-screen clips with a real person average about three times the views of AI talking heads, so I stopped making talking heads.
- A soft, casual caption beats a sales pitch. Links in captions cost views.

## Links

- [Product site in English](https://encorearchives.com)
- [Product site in Spanish](https://encorearchives.com/es)
- [Encore on the App Store](https://apps.apple.com/us/app/encore-concert-diary/id6748657647)

## App Store gallery

Screens from the live listing show the feed, stats, year-end recap, friends, passport, and upcoming shows.

![Encore: concerts](../../assets/experience/encore/encore-01.webp)

![Encore: gallery](../../assets/experience/encore/encore-02.webp)

![Encore: wrapped](../../assets/experience/encore/encore-03.webp)

![Encore: social](../../assets/experience/encore/encore-04.webp)

![Encore: passport](../../assets/experience/encore/encore-05.webp)

![Encore: upcoming](../../assets/experience/encore/encore-06.webp)
