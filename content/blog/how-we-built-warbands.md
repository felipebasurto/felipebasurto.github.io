---
title: "I shipped a Minecraft mod. Not one line of it is mine."
description: "I don't write Java and had never opened a mod's source. AI coding agents wrote the code, drew the textures and skins, designed the buildings and tested Warbands by playing it. The Age of Empires-style Minecraft mod was published fourteen days after my first message."
summary: "How AI agents took a vague idea to a published Minecraft mod: the code, the art, the buildings and the tests. I only played."
date: 2026-11-04
cover: /assets/blog/how-we-built-warbands/war.webp
og_image: /assets/blog/how-we-built-warbands/og.png
cover_alt: "Two armies face each other in Minecraft: knights on armored horses in front, rows of soldiers behind, fire arrows overhead."
tags: Minecraft, AI agents, Game development
draft: true
---

I don't write Java, and I had never opened the source of a Minecraft mod. On 24 September 2026 I typed four messages to a coding agent. Fourteen days later, Warbands was on [CurseForge](https://www.curseforge.com/minecraft/mc-mods/warbands): an Age of Empires-style mod for Minecraft Java 26.1.2. You place a town from blueprints, stock it with food, wood, stone and gold, train soldiers who follow you into battle, and march them on enemy camps.

Warbands is 100% agent-made: the Java, the textures, the soldier skins, the buildings, the in-game guide, the tests, the logo and the pictures on its page. My part was to say what I wanted, play it and complain. The agents also kept a journal of every session, with the commands they ran and what came back. This post comes from those journals.

![Six soldier skins side by side](/assets/blog/how-we-built-warbands/units.webp)

## "please understand how to make a minecraft mod"

My first four messages went to Claude Code at 09:27 UTC, and none of them asked for a mod:

> i want to create cool minecraft mods. i had this one with automatic farms but it doesnt convince me
>
> i would like to have this repo as a big collection of minecraft mods made with ai
>
> please understand how to make a minecraft mod
>
> if possible for the 26.1 minecraft java version

That was the right first request, because 26.1 is a trap for a language model. It's the first version Mojang ships without obfuscation, so the community names that Fabric mods used for years are gone: `World` is now `Level`, and `PlayerEntity` is `Player`. Most mod code a model has seen uses the old names.

So the agent didn't write from memory. It found that my Mac had no Java and downloaded JDK 25 into a folder inside the repo. It read Fabric's release post, noticed the versions in it were stale, and asked Fabric's own API for the current ones. Its first build failed, it updated Gradle, and the next build took 24 seconds. Six minutes after my message, a throwaway mod was booting on 26.1.2, headless, with no game window.

It also caught the official docs describing a newer version of the game. They use a class called `BlockItemId`, and a search for that name inside the real 26.1.2 jar returned `0`. From then on the docs were a hint and the game's own files were the truth: before using a class, the agent looked it up in the jar.

## "idk how"

At 10:01 I described the game in one breath: "you place a structure (idk how) and that structure has a menu, that menu will ask you for stuff like food, wood, stone and gold and based on that you can create warriors, those warriors will follow you and help you in battle". I ended with "ask me 10 more questions and lets define this first mod".

The questions came as multiple choice, most with a recommended answer. I answered in about two minutes and took the recommendation seven times out of eight. By 10:06 there was a design document with every decision in a table and a price for every unit: a Militia costs 30 food and 9 gold and takes 15 seconds to train. My whole review was "love it. lets do it".

![Green particles outlining a building site](/assets/blog/how-we-built-warbands/blueprint-outline.webp)

## Soldiers are wolves in armor

I had also suggested reusing "the ai of other mobs such as the iron golem". The agent decompiled the game into 6,882 Java files and read how vanilla does it before writing anything. A tamed wolf already follows its owner, teleports when it's left behind and attacks whatever hurts its owner. Those behaviors are reusable parts, so a soldier is mostly vanilla pieces in a new order:

```java
this.targetSelector.addGoal(1, new OwnerHurtByTargetGoal(this));
this.targetSelector.addGoal(2, new OwnerHurtTargetGoal(this));
```

The archer was the exception. Vanilla's bow behavior only accepts monsters, so the agent copied that one class and changed the type. The whole server side had one compile error on its first build.

![Two early soldiers, one red, one green](/assets/blog/how-we-built-warbands/militia-and-archer-v1.webp)

## It drew its own art

This is the part I didn't expect. A mod needs art: icons, block textures, a skin for every soldier. The agent wrote a Python script that paints them pixel by pixel and writes the PNG files byte by byte, with no image library:

```python
def chunk(t, d):
    return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xFFFFFFFF)
```

Then it checked its own work. It drew every texture enlarged on one sheet, opened the sheet as an image and looked at it. On the first sheet the blueprint icons read as the letter "A", so it redrew them.

![Enlarged texture sheet with icons and skins](/assets/blog/how-we-built-warbands/texture-sheet-v1.webp)

Skins went the same way. When enemies arrived, their skins were recolored copies of my soldiers', and getting them right took three tries. The first turned the knight's surcoat bright red. The second recolored blond hair, because the rule meant for the emblem matched it too.

![Skins, rough first pass above, final below](/assets/blog/how-we-built-warbands/skins-before-after.webp)

## It played the game itself

The agent also needed to know whether the mod worked, and it couldn't play. So it wrote a scripted player: a test that opens a real singleplayer world, places a Town Center, deposits resources, trains soldiers and takes screenshots. Then the agent opens the screenshots and looks at them.

The first run failed because the menu was out of the player's reach. The second passed every check and then never exited. The agent took a thread dump of the running game with `jstack`, found the server stuck in a time-skip command the test had started, and stopped it. At 10:47, 41 minutes after "love it. lets do it", the mod was built and tested.

![Town Center menu with two unit buttons](/assets/blog/how-we-built-warbands/town-center-menu-v1.webp)

From then on, that test was how the agents touched the game. When the mod got ages that take a minute to research, the test grew to 5 min 07 s. I asked why, and added "be sincere, if we cant its okay". The agent read the log timestamps: research meant to take 60 seconds was taking exactly 60 seconds. So the test stopped waiting and called each building's own tick in a loop, as many times as it needed.

{{FIG_WARBANDS_TEST}}

The next run took 49 seconds, with more checks in it. Two days later the test had 197 checks and ran in 1 min 40 s. It also photographed every menu and every page of the in-game guide, which is how the agent found captions drawn on top of each other.

![Six pages of the in-game guide](/assets/blog/how-we-built-warbands/guide-pages.webp)

The tests found bugs I never would have. A check written for a bigger battering ram failed on its first run: the ram was drawn larger, but its hitbox hadn't grown. A repair test found a lantern with nothing to hang from. After my biggest round of feedback, the test crashed on a bug the agent had just written, one that would have crashed any world with an archer in it.

## "the barracks building looks like shit"

Buildings are generated too. A Python script describes each one block by block and writes the structure file the game loads.

Two days in, I played and sent feedback the way players do: "the barracks building looks like shit", then "stable looks soo simple too. it should have horse mobs as well", and finally "implement all feedback dont miss a thing".

That is a visual judgement, and the agent couldn't see a building without launching the game. So it wrote a renderer: a script that takes the generator's output and draws each building in isometric view with the game's real block textures, in about a second.

![Four buildings in isometric view, in pairs](/assets/blog/how-we-built-warbands/iso-render.webp)

The first render explained my complaint: the Barracks was a three-block-high plank box under a pyramid roof. Four buildings were rebuilt in that session, each judged in the renderer first and in the game second. The Stable got its horses. They are scenery, not real mobs, so nobody can farm them.

![Barracks changing from plank box to hall](/assets/blog/how-we-built-warbands/barracks-morph.webp)

![A horse inside the Stable](/assets/blog/how-we-built-warbands/stable-horses.webp)

Enemy camps came from the same tools. Over one night the agents worked through all 30 camp layouts and wrote a fuzz test that builds them again and again on different terrain. Its first run reported 409 problems. Four rounds of fixes later it reported none, across 900 camps on 8 kinds of terrain. A second test, 3,948 builds on 35 sites in a normal world, found one more real bug in the foundations.

![Isometric views of enemy camps cycling](/assets/blog/how-we-built-warbands/camps-carousel.webp)

## My job was to play and complain

My first try at running the game failed: I had no Java either, because the agent had installed its own copy. Then the session hit its usage limit. That first session lasted 4 h 31 min, and 2 h 15 min of it was waiting. Once I got the game running, I played and kept typing notes into the blocked session. When the limit reset, one message restarted everything: "run all pending messages since i ran out of credits. implement them one by one".

Three days later I played for an hour while the agent watched the game's log. I came back with 13 screenshots and more than forty notes, typos included: "the blacksmith tshould have casttle age updgrades as well otherwise is very simple and shitty".

The agent didn't start coding. Three read-only agents traced the notes to their causes in parallel, and complaints that sounded like design problems turned out to be details of the game. My militia attacked without swinging because vanilla only advances the swing animation for monsters and players. A watch tower held 2 of its 4 archers because a distance check also matched the diagonal neighbours. Four design questions came back to me. Everything else was fixed in six commits.

## It was never one agent

"The agent" was several. On the first afternoon, a Cursor agent running Grok built the second phase as a stack of eight pull requests. It was cheaper than Claude, so I laid foundations with one and polished with the other. It finished five buildings in under two hours without once opening the game. The sixth never compiled, and Claude finished it the next day.

Claude then reviewed the stack the way a player would. The Blacksmith came with an anvil, and making it fall paid out nine times its iron cost. A bolt written as 5 damage hit for about 10, because vanilla multiplies arrow damage by speed.

Not everything worked, and the journals say so. A third tool, Devin, planned a phase without opening the repo's own cookbook. I pasted it in and asked "are you using this right?", and its answer was no. The review of that phase's pull request found a save-loss bug and a world crash. One overnight run lost all 11 of its parallel workers to the usage limit, and the lead agent salvaged nine unfinished diffs. Near the end, three agents worked in parallel branches. The lead read every line and caught a speed-up that would have made every building count as empty.

The early sessions ran on Claude Opus, later ones on Sonnet, and by the end the lead agent was Haiku, the cheapest of the three.

## Getting it published

Publishing had its own rules. As they read on 2 October 2026, Modrinth's content rules excluded projects made "primarily or entirely" by AI, so Warbands went to CurseForge and GitHub.

The logo is about 250 lines of Python: letters stored as small bitmaps, drawn over a red banner. I said they looked wide but short, and they went from 9 rows tall to 13.

![WARBANDS in gold letters over red banner](/assets/blog/how-we-built-warbands/logo.webp)

For the page's pictures, the test harness became a camera. A script switches to spectator mode, hides the HUD, stages a war at sunset and takes the photo. Video works the same way: freeze the game's clock, advance one tick, take a screenshot, repeat, and hand the frames to ffmpeg.

![Soldiers at a stone fort gate](/assets/blog/how-we-built-warbands/assault.webp)

![Town Center rising on bare grass](/assets/blog/how-we-built-warbands/town-center-rises.webp)

For unit portraits, the agent rebuilt the soldiers outside the game, in three.js, wearing the mod's own skins. It found the right way to hold a bow by rendering 48 orientations. It also synthesized music for a trailer in Python, with numpy and scipy.

![Soldiers and a mounted knight, posed](/assets/blog/how-we-built-warbands/squad.webp)

Version 0.1.0 went up on CurseForge on 8 October, and 0.2.0 followed as a GitHub prerelease on 16 October.

## What I actually did

I wrote messages, played, and chose between options. By the fourth day the mod was 13,984 lines of Java, and I had typed none of them.

What made that enough wasn't a clever prompt. The agents learned the exact version of the game before writing for it, and checked classes against the game's own files instead of trusting memory or docs. And they built themselves ways to look: a scripted player, a texture sheet, a building renderer, a camera. The buildings improved the day an agent could see them, and so did the textures, the menus and the camps.

| | |
|---|---|
| First message | 24 Sep 2026 |
| Design approved to first tested build | 41 minutes |
| Camp fuzz test | 409 problems → 0 |
| Java lines by day four | 13,984 |
| On CurseForge | 8 Oct 2026 |
| Lines written by me | 0 |

Warbands is a beta. Dedicated servers and co-op haven't been validated, and the [source](https://github.com/felipebasurto/warbands) is public if you want to find the bugs I haven't met.

I still don't write Java.
