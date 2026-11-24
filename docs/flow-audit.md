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

## Checked against known patterns, 23 Nov 2026

Mobbin's plugin needs a paid plan, so this check is from well-known patterns in popular apps, not screens pulled today. Apps change, so the app names are there for you to look up, not as proof. Each item says whether it backs the recommendation above, changes it, or adds something.

### 1. Results: backed, with one change
- **The pattern:** Duolingo's lesson complete, the NYT Games results (Wordle) and Strava's saved activity all keep the celebration short. Then the next action is in reach without scrolling: Duolingo pins one Continue button at the bottom, NYT puts a large Share button inside the result, and the score breakdown (Wordle's guess spread) sits right under the headline.
- **The change:** keep the big moment, but make it a moment. The winner's card fills the screen for about 1.5 s (a tap skips it), then shrinks into the compact header with the places below. This keeps the finale people enjoy and still puts Rematch and Share in reach.
- **Backs:** Rematch in the dock, Share at the top, scores by round straight after the places.

### 2. Dropping Between rounds: backed, with two changes
- **The pattern:** Gmail's "Sent · Undo" and Google Photos' "Deleted · Undo" do the action right away and offer Undo, instead of a screen or a "Done" step. Game companion apps tend to show the change in standings on the main screen rather than a separate step.
- **Change 1, show the change where people look:** after Save, the round screen's totals count up and anyone who moves place slides up or down, with "Ana went out · Ana leads by 12" across the top. That gives the table the moment Between rounds gave, without the extra tap.
- **Change 2, don't let Undo vanish:** a banner on a timer is hard for slow readers and screen readers (WCAG 2.2.1). Keep the banner until the next tap on the round, announce it to screen readers, and keep **Undo round N** in the game menu after it goes.

### 3. One way to start: backed
- **The pattern:** Spotify's "Jump back in", Duolingo's single Start on the next lesson and Strava's one Record button all give one main way to carry on. Lists open a detail page; they don't each carry their own start button.

### 4. The game menu icon: done 23 Nov
- **The pattern:** Apple's guidance uses an ellipsis for "more actions" and a gear only for Settings. The game screens now use the three dots and the table page uses a cog. No more change needed.

### 5. Stats awards: changed
- **The pattern:** Apple Fitness puts earned awards first and shows locked ones as dim outlines grouped by kind. Duolingo's achievements show progress ("7 of 10"). Steam and Xbox show how rare an award is.
- **The change:** rather than hide every award not yet won, show won awards first, then the ones in progress with a bar ("Dynasty · 2 of 3 wins in a row"), then fold the rest into "13 still to find". No empty grey "?" medals. This also covers backlog T3-12.

### 6. Share picture: adds one thing
- **The pattern:** Spotify Wrapped and Strava show you the picture before you share it, and offer a tall story size (9 : 16) beside the feed size.
- **The addition:** Share in the top bar opens a small sheet with the picture and one **Share** button. The picture is drawn before that tap, so Safari still opens the share sheet straight away. A story size can wait until someone asks for it.

### 7. Animation
- **The pattern:** Duolingo and Apple Fitness count numbers up, celebrate briefly and let a tap skip it. Movement explains a change (a total going up, a place changing), not decoration.
- **For May I?:** totals count up after Save, places slide when they change, the winner's card shrinks into the header, and awards pop in after the finale as they do now. Each one under about half a second except the finale, and all of them turned off by Reduce motion. Phones can't vibrate from Safari on iPhone, so there are no haptics.

### What this changes in the plan
1. Results: the finale plays for about 1.5 s, then becomes the compact header. Everything else as recommended. **Built 23 Nov** (the share preview sheet is not built yet).
2. Between rounds: totals count up and places move on the round screen. The banner stays until the next tap, and Undo round N stays in the menu.
3. Play: unchanged.
4. Game menu icon: done.
5. Stats: won awards, then in-progress awards with bars, then a count of the rest.
6. Share: a small sheet with the picture before sharing.

## Not changing
- The round screen itself: the goal, the turn order, buys on a tap. It tested well in P1.
- Two taps to start a known table.
- No tabs during a game.
