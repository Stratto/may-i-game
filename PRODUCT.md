# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Family and friends at a casual card night, often across several regular groups (a family table, a weekly friends' game). One person keeps score on a phone at the table, usually with mixed ages and some players who are new to May I? rules. The scorekeeper is also playing, so entering scores competes with holding cards and talking.

## Product Purpose
A scorekeeper and companion for May I?, a seven-round contract rummy game. It tracks each round's contract, buys ("May I?" calls), who went out, round scores, the dealer and running standings, then celebrates the winner. Success means the table never stops the game to work out scores or rules, and everyone enjoys the scoring moments. It replaces pencil and paper, so it has to be faster than writing eight names on a sheet and ruling a score grid.

## Positioning
- **Built for May I? rules:** it already knows the seven contracts, the buy limits, the dealing order and the out rule, so there's nothing to set up.
- **Teaches the game:** round guides and in-app rules let newcomers join without a rulebook.
- **Makes the night fun:** celebrations, awards and insights turn scorekeeping into part of the game.
- **Free, no sign-up:** it opens instantly and works offline. Groups are shared across phones by a group code or link, with no accounts or passwords.
- **Groups that remember:** each group keeps its players, games and standings, so the rivalry carries on from night to night.

## Operating Context
- Played around a physical table, often in the evening and sometimes outdoors.
- One phone keeps score, while other members follow live on their own phones.
- Phone first. A tablet set on the table is a very close second, and may be the ideal way to play because everyone can see it. Desktop and TV are not priorities for now (owner, 2026-11-17).
- Rhythm of play: deal, a round of play with buys, someone goes out, everyone counts their cards, scores are entered, then the next round. There are seven rounds.

## Capabilities and Constraints
- Capabilities: player setup and dealer, the contract for each round, buys with a house-rule limit, one Out per round (the last player is marked Out automatically), score entry with a hand-counter for tapping cards, undo, standings and insights, house rules, results with a podium and awards, and saved game history.
- The existing codebase is a single `index.html` (vendored React 18, no build step), hosted on GitHub Pages as an offline-capable PWA (`sw.js`).
- Works offline-first in localStorage. Shared groups sync through Supabase (free tier, live updates), joined by a group code. Anyone holding a code can view and edit that group. Optional sign-in may come later.
- The scorekeeper needs: rules in the moment, live standings, and a game recap (shareable).
- **Must work in sunlight:** high contrast, and scores large enough to read across the table and outdoors.
- Undecided: how to make money. A tip link exists, but its `SUPPORT_URL` is still a placeholder. Optional paid looks packs have been floated but not decided.

## Evidence on Hand
No testimonials, user numbers or press exist. Don't invent any.

## Product Principles
1. Never slow the game down: each moment has one obvious next step.
2. Rules are built in, not looked up.
3. Scoring is part of the fun, not a chore.
4. Anyone can pick it up: no sign-up, no setup, plain words.
5. Readable from across the table: on a tablet, the scores work at a distance.

## Accessibility & Inclusion
Mixed ages at the table. Text must be readable at a glance in bright light, and every tap target must be large enough for a quick, imprecise tap. Respect reduced-motion preferences.
