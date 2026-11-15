# Surface: May I? app (index.html)

Scope: the whole app: groups, group page, live game, scoreboard, recap, plus the rules, hand-counter and settings sheets. Mode: Operate.
Audience: family and friends at a card night. One phone keeps score, others follow live, and a tablet or laptop can serve as the table's scoreboard.
Task: keep a 7-round May I? game moving, with rules in the moment, live standings and a shareable recap. Groups remember players and history and are shared by a code.
Constraints: single-file PWA, offline-first, readable in sunlight, no deep or offset shadows (the user asked for this).

## Direction contract

THESIS: standings are a race you can see. Every player row is a lane with a coloured peg that slides toward the finish as scores land, so the gap to first reads from across the table. This replaces the category default: a ranked list of numbers.

OWN-WORLD: a printed board-game score track. Pale blue board ground (#E9EFF6), white work surfaces, deep navy ink (#13233F) for type and the primary action, and eight bright peg colours that identify each player everywhere (dot, peg, recap). Gold marks the leader. One sans (Manrope), with tabular numerals. Flat: 1px hairlines, round pegs, no heavy shadows.

STORY: open a group, see who's leading all-time, and start a game. Each round shows its contract and the one rule to watch. Tap buys, enter scores, and watch the pegs move. At the end comes a recap with the podium, round grid and awards, ready to share.

FIRST VIEWPORT (game, phone): a navy contract bar shows the round (n/7), the contract name, a mini meld example and a one-line tip. Below it are the player lanes, each with a colour peg, name, large total and its lane track. The primary action is pinned at the bottom in thumb reach. On wide screens: big lanes on the left and the round panel with controls on the right. A Scoreboard mode hides the controls and scales the type for the table.

FORM: Score Track, chosen by the user from a four-card hand (Score Track, Seven Frames, Departure Board, category standard).
seed: none (unavailable). The engine wasn't run, so there was no concept-seed roll and the hand was derived by hand.

Signature interaction: when a round is committed, each peg slides along its lane (400ms, exponential ease-out) and the leader's peg takes the gold ring.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
