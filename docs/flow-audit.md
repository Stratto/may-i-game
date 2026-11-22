# Flow audit, 22 Nov 2026

Each flow is written as the taps it takes today, measured at 390 × 664 in Safari's engine with the real app (`npm run e2e` takes the same taps). Then what to change, and why. Nothing here is built yet; each change needs the owner's yes.

## What the app is for

One phone or tablet on the table replaces the paper score sheet for a seven-round game night. The jobs, in order of how often they happen:
1. **Score a round** (7 times a game).
2. **Start a game** at a table you've played at before (once a night).
3. **See who won and play again** (once a night).
4. **Settle an argument**: what did I score in round 3, what are the rules (now and then).
5. **Look back**: who holds the table, awards, records (now and then).
6. **First night**: add names and learn the game (once).

The screens should follow that order of weight. Today they mostly follow the order they were built in.

## The flows today

### 1. Score a round: 4 taps + typing, ×7
| # | Screen | Tap |
|---|---|---|
| 1 | Round | **Someone went out** |
| 2 | Score pad, step 1 | **Out** beside the player who went out |
| 3 | Score pad, step 2 | Type each other hand (Enter jumps on) |
| 4 | Score pad | **Save round N** |
| 5 | Between rounds (standings + a line each) | **Let's play** |

Over a game that's 28 taps and 7 visits to Between rounds. Since P1, the round screen already shows everyone's running total, so Between rounds now repeats what the next screen shows anyway.

### 2. Start a game at a known table: 2 taps (good)
Play → **New game at Friday night** (dock) → New game sheet with last night's players ticked → **Deal round 1**.
But Play offers the same thing three ways: the dock button, a **New game** pill on each table card, and **New game at this table** on the table page. Plus **+ New table** at the top.

### 3. See who won and play again: 2+ screens of scrolling, then 1 tap
Results today, top to bottom (1,741px tall, the phone shows 664):
1. The winner's card, filling the whole first screen.
2. Everyone else's place and total.
3. Awards (11 in a typical game).
4. "The night in one card", then **Share** and **Rematch**, at about 1,420px down.
5. Scores by round.

The two actions people take next are two and a half screens down. The scores by round, which settle arguments, are last.

### 4. Settle an argument
- **Rules:** the book icon in the round (1 tap). Good.
- **A past round's score:** the gear → Scores so far → the round (3 taps). The gear looks like Settings, and the menu it opens also has a Settings row (backlog T4-16).

### 5. Look back
- **Stats tab:** a line of totals, the tables (each opens the table page under Play), then Hall of fame and 24 award shelves, most of them empty grey "?" medals for a new family.
- **Table page:** who holds the table, standings, last game, records, past games.
The tables appear in both places. "My stats" for one person is only reachable by tapping a face.

### 6. First night: names, then deal (good)
The start screen and the empty Play tab are the same screen, so first and second visits match. Learn is a tab and also a book icon in every game.

## Recommended changes, in order

1. **Results: actions first, proof second.** Make the winner a compact header (card and name, about a third of the screen) with the places right under it. **Rematch** goes in the dock where the main button always is, and **Share** becomes a button in the top bar. Next comes **Scores by round** (it settles arguments), then the awards, shown as the four rarest with "All 11 awards" to open the rest. "The night in one card" goes, because Share already makes that card. *Cuts about 2 screens of scrolling to 0 for the next game.*
2. **Round loop: drop the Between rounds screen.** **Save round** goes straight to the next round. A banner across the top says "Ana went out · Ana leads by 12" for a few seconds, with **Undo** in it. The fun lines move to the standings sheet (one tap from the round) and to Results. *7 fewer taps and screens a game.* This undoes part of P3, so it's the owner's call.
3. **Play: one way to start.** The dock button starts at the last table. Table cards open the table, with no pill. The table page keeps its own button. *Removes a button from every table card.*
4. **The game's gear becomes a "Game" menu** with its own icon and no Settings row inside (Text size lives in Settings anyway). *Fixes the icon that means two things.*
5. **Stats: people and awards, not tables again.** Tables go (they're on Play). Stats shows each person's line across all tables, then the award cabinet showing only won and nearly-won awards, with "13 still to find" closing it. *Removes the duplicate and the wall of grey.*
6. **Later, if the above lands:** whether Learn and Settings still need tabs, or whether they belong under the crest and a gear on Play, leaving the tab bar to Play and Stats.

## Not changing
- The round screen itself: the goal, the turn order, buys on a tap. It tested well in P1.
- Two taps to start a known table.
- No tabs during a game.
