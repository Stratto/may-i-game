---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# Surface: May I? app (index.html)

Scope: the whole app: groups, group page, live game, scoreboard, recap, plus the rules, hand-counter, avatar and settings sheets. Mode: Operate.
Audience: family and friends of mixed ages at a card night. One phone keeps score, others follow live, and a tablet or laptop can serve as the table's scoreboard.
Task: keep a 7-round May I? game moving, with rules in the moment, live standings and a shareable recap. Groups remember players and history.
Constraints: single-file PWA, offline-first, readable in sunlight, no deep or offset outer shadows on buttons (the user asked for this), one control per action.

## Direction contract

THESIS: game night, not a casino. The app should feel like the box of a well-loved family card game: bright colour fields, chunky rounded shapes, cheerful characters. It refuses the green-felt, gold-hairline, serif "card room" look that card apps default to.

OWN-WORLD: "Game Night". Four toy-box colours (royal blue, sunny yellow, candy red, leaf green) plus a grape purple. Colour fields are dotted like a game board, and chunky surfaces are lit inside their shape with a soft top light and a thick lower lip (no outer drop). Primary buttons are sunny yellow candy with navy ink. Big Smile characters by Ashley Seo, gold, silver and bronze crowns for 1st, 2nd and 3rd, and fat white-rimmed playing cards. Baloo 2 for display, system SF for UI, ui-rounded for numbers. Looks: Game night (blue), Lime, Lagoon, Cherry, plus Daylight for sunlight, with dark mode as deep navy.

STORY: Home lists tables and the game in progress. A table shows its podium of crowns, standings and history. In a game, tap the contract for rules, tap "May I?" for buys, and score the round in one sheet. A giant card deals each round in. The recap crowns the winner.

FIRST VIEWPORT (game, phone): a dotted blue band with round n of 7, the contract in Baloo 2, chunky mini cards, pips and the dealer; then the seats card with characters and crowns; then one yellow candy button in the dock.

FORM: pinned by the user, the 1st of 1. seed: none (pinned): "family friendly art style similar to UNO, monopoly and similar family games. The colours should be youthful, fun, not a serious casino cards app", with Pinterest references to casual-game UI (royal blue dotted field, glossy badges, 1-2-3 crowns), chunky yellow, blue and orange cards on lime, and a teal card loading screen.

Signature interaction: between rounds the next contract is dealt in as one big chunky card that flips face up, with Undo and Let's play.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
