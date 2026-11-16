---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["docs/ui-kit.html"]
---

# Surface: May I? app (index.html)

Scope: the whole app: tables, table page, live game, score pad, between rounds, results, Learn, Stats, profile, cabinet, Settings, dressing room, TV scoreboard, plus the kit (`docs/ui-kit.html`) that specifies them. Mode: Operate, with game-like delight at the moments that matter.
Audience: family and friends of mixed ages at a card night; one phone keeps score while its owner holds cards, others glance from across the table; a tablet or TV can be the table's scoreboard. 2 to 8 players.
Task: keep a 7-round May I? game moving, with rules in the moment, standings readable from across the table and a shareable recap. Tables remember players and history.
Constraints: single-file PWA, offline-first, readable in sunlight, no outer/offset button shadows, one control per action, every accessibility option a Settings toggle, nothing off-limits in this rework (2026-11-16).

## Direction contract

THESIS: the score is a board you read from across the table. Every player is their court card riding a gilt peg lane toward a chequered finish, fewest points furthest along. It refuses the app-default stack of caps labels over glass list rows.

OWN-WORLD: Lagoon, unchanged: teal water, gilt rims, teal enamel, cream paper, the illustrated deck. New: the pegboard, a deep teal well in a 3px gilt rim holding one lane per player (sunken rail, seven round holes, chequered finish), court cards as pegs, totals at the lane end. Art scale ladder: hero (whole card 100-180px), peg (card 46-64px), token (40px medallion).

STORY: the board is the spine. Home shows the game in progress as a live mini board; a table shows its season board by wins; in a game the board is the scoreboard; scoring moves pegs; between rounds the pegs slide, then the next contract flips; the finale runs the winner's card over the finish line onto the podium.

FIRST VIEWPORT (game, phone 390x844): nav (back + table name, •••); compact paper contract card (mini suit card, "Round 4 of 7 · Ben deals 12", contract name); the pegboard filling the middle, one lane per player with court-card peg, name, gap, buy pips, total; one Score round button in the dock.

FORM: the pegboard, 6th of 7 on the ordered list (dealt lead). seed: 1b840731828ac8c5

Signature interaction: when a round is saved, every peg slides along its lane to its new place with a soft click per hole, the leader's crown hops to the new leader, then the next contract deals in and flips.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
