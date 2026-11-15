# Surface: May I? app (index.html)

Scope: the whole app: groups, group page, live game, scoreboard, recap, plus the rules, hand-counter and settings sheets. Mode: Operate.
Audience: family and friends at a card night. One phone keeps score, others follow live, and a tablet or laptop can serve as the table's scoreboard.
Task: keep a 7-round May I? game moving, with rules in the moment, live standings and a shareable recap. Groups remember players and history and are shared by a code.
Constraints: single-file PWA, offline-first, readable in sunlight, no deep or offset shadows (the user asked for this).

## Direction contract

THESIS: a card table in your pocket. The game screen is a felt band with the round's contract dealt as real cards, and the players sit around it as seats in one clean card. Everything around the table is plain iOS: large titles, inset grouped lists, sheets.

OWN-WORLD: "The Table". Felt band (radial, per look), ivory playing cards with real corners, gold only for the leader, the dealer badge and the current round pip. System SF type for UI, ui-rounded tabular numbers, Fraunces for display names (titles, contract, intro, recap). Four looks: Table (green), Midnight (navy), Parlour (burgundy), with dark mode, plus Daylight (max contrast, for sunlight).

STORY: Home lists tables and any game in progress. A table shows its champion, standings and history, with one button: deal or resume. In a game, tap the contract for rules, tap "May I?" for buys, and score the round in one sheet. A giant card announces each new round. The recap crowns the winner on a podium and shares a results image.

FIRST VIEWPORT (game, phone): the felt band (back, gear, round n of 7, contract in Fraunces, mini cards, pips, dealer, Rules), then the seats card, then one primary action in the dock.

RULE: one control per action. Rules open only from the contract. Share lives only in the nav bar. The dock holds the single next step.

Signature interaction: between rounds the next contract is dealt in as one big playing card, with Undo and Let's play.

FINISH: reviewed in the browser at 375px and 1280px, in light, dark and Daylight; detector clean; DESIGN.md rewritten.
