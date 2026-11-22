# May I? rework plan

Started 2026-11-17. This is the working plan for the rework. Findings and their numbers come from the journey walkthrough (2026-11-16); day-to-day bugs stay in `backlog.md`.

## The brief (owner, 2026-11-17)

- **The job:** rework May I? into an intuitive, extremely well designed app with little to no bad friction, for people of all ages to use and play together.
- **The why:** the app replaces pencil and paper. It has to be faster than writing eight names on a sheet and ruling a grid for the scores.
- **The guardrails:** phone first. A tablet on the table is a very close second, and may be the ideal way to play because everyone can see it. Desktop and TV are not priorities for now. The app is hosted on GitHub Pages today; moving to iOS and Android later changes some things (see below).
- **Done means:** the logic, the words, the flow and the design are all made for what the player is doing at that moment. Every interaction, element, animation and moment of fun is there on purpose and polished.

## The test for every screen

1. What is the person doing at the table right now, and what is in their hands?
2. What is the one thing they need from the screen?
3. Is it faster than paper? If the paper version has no step here, the app needs a good reason to have one.
4. Is anything asked that could be defaulted, or asked later at a calm moment?
5. Does everything that looks tappable work, and is the fun in the right place (after the job, never in its way)?

## Phases

Status: ✅ done · ◻ to do. Numbers in brackets are walkthrough findings.

### Phase 1 · The start and the first game ✅ (2026-11-17)

- ✅ Start screen is names and nothing else. The "Playing at Monday table" line is gone.
- ✅ The table is given a name without being asked (now a dealt May I? name, see below). Results offers to rename it after the first game ("Same table next time?"). Renaming in Table settings also works.
- ✅ Learn is a banner with the cards and the question mark, in view before any name is typed, on phones down to 375 × 667. (Replaced later the same day by the Learn tab: see "One frame for every place".)
- ✅ Nothing pops up at deal time. The "Still learning / Knows the game" sheet is removed [5, 10].
- ✅ The round guide opens only when tapped. Tables that want it every round switch on "Guide every round" in Settings, or at the foot of the guide itself. This also removes the three screens between rounds for everyone else [4].
- ✅ The dealer is visible and changeable: a D tag on the dealer's row passes the deal one seat a tap, and Roll for dealer picks for the table [6, part].
- ✅ Any face can be changed from the start screen and from Add a player mid-game.
- ✅ The crest shrinks once the first name is in [23]. "Dealt 10" now reads "Deals 10 each" [11, part].

### Phase 2 · The round loop (the part played 7 times a night) ✅ (2026-11-17)

- ✅ A soft check on scores no hand could hold: "335 is more than a 10-card hand can hold" with Keep 335. The limit counts two extra cards for each buy recorded. Save waits until the score is fixed or kept [2].
- ✅ A buy is confirmed in place of the hint line above the faces, so no face is ever covered [3].
- ✅ Faces sit in balanced rows for any number of players: 2 × 2 for four, 3 + 2 for five, 4 + 3 for seven [11].
- ✅ The score pad's "0 → …" line is gone in round 1 [12].
- ✅ Between rounds names the dealer under the standings: "Dino deals 10 each · Ada goes first" [9].
- ✅ New game: the dealer line is a button that passes the deal, and a player just added can have their face changed on the spot [18].
- ✅ Kept as it is: app-wide messages stay at the top, between the back and menu buttons, where they cover no control [13].

### Phase 3 · The finish and looking back ✅ (2026-11-17)

- ✅ Scores by round on Results: players across, rounds down, a gold 0 for whoever went out, the lowest total marked [1].
- ✅ The same sheet mid-game: Game menu → Scores so far. A round's number opens that round to fix a score [14].
- ✅ Award lines are never cut off, and "only" is kept for hands of 25 or under [8].
- ✅ Every winner gets a real card: their initial or photo in the ace's ring when they have no court card [16].
- ✅ On Results, messages sit at the bottom, clear of the crown [17]. The finish confirm fits on one line each: Keep playing / Finish now [15].

### Phase 4 · Coming back ✅ (2026-11-17)

- ✅ Home has one main action: Resume while a game is going, New game otherwise. The Playing now card shows who leads [7].
- ✅ Nothing rests under the main button: the crest steps back while a game is going, last night's result steps aside, New table is a chip beside the heading, and Learn carries only the lesson [20, 24, 25].
- ✅ Stats says "First game under way" for a table mid-game [19].
- ✅ Settings order: game settings, Backup, Help, then the scanner and the tip [21]. The scanner says "It needs a one-time setup" and explains the key in plain words [22]. It still needs the owner's own key; see the store notes below.
- ✅ A new table seats players first. Its name can wait, and creating it opens New game so the first hand is one tap away.
- ✅ Fixed in passing: the House rules hints on the guide were dark on teal and unreadable.

### Phase 5 · A tablet on the table ✅ (2026-11-17), needs a look on a real iPad

- ✅ The round is a scoreboard from 700px wide: the goal in big cards, bigger faces, a running total under every name, the crown on the leader.
- ✅ Up to four players sit in one row; five to eight become a two-column list, so eight fit on a 768 × 1024 screen without scrolling.
- ✅ Landscape puts the goal on the left and the players on the right.
- ✅ Between rounds and Results use bigger standings; in landscape the standings split into two columns, and the winner's card stays beside the standings and the score sheet.
- ✅ Score rows are larger; in landscape the hand counter sits beside them.
- ✅ The phone's leader crown came from this work: the leader wears it on the round screen at every size.
- ✅ Home and the table page use a wider column and larger type on a tablet, and fit above the main button in both orientations.
- ✅ Stats, Learn, Settings and the start screen have tablet layouts too (see the second pass below). Scaling with CSS zoom was tried and dropped: it clipped the profile sheet and left a paint glitch on Learn in Safari's engine.
- ◻ Not yet seen on a real iPad: sizes were checked at 744 × 1133, 768 × 1024, 820 × 1180, 1024 × 768 and 1180 × 820 in a simulated browser.

### Added on the owner's notes, 2026-11-17

- ✅ Table names are dealt from the game's own words (The Cheeky Jokers, Three of a Kind, The May I? Society) instead of "[Day] table". Every name field has a die that deals another; anyone can type their own. Results says "It was dealt the name … Keep it, roll another, or type the table's own."
- ✅ The bottom tabs stay off the game screens, on purpose: the main button keeps the bottom to itself and nobody leaves the round by accident. The need behind them is met another way: the Learn book sits in the top bar of the round, the score pad and between rounds, opens the guide over whatever is on screen, and Back returns to it with nothing lost. Scores so far stays in the game menu.
- ✅ The score pad shows what each card is worth (2 to 9 face value; 10, J, Q, K 10 each; Ace; Joker), following the table's house rules.

### Built on 2026-11-17, second pass (the "ready to build" list)

- ✅ **Looks.** Game night, Lime and Cherry now reach every screen: the water, the buttons, the Playing now card, the tab bar, the score pad, between rounds and the guide all take the look's own colours. Each look uses its deep colours in light and dark alike, because the text on the water is cream. (Before this, a light-mode phone showed cream headings on a pale ground.) Daylight is still unmapped and shows Lagoon.
- ✅ **Rotating soft glows.** One blurred layer with two pools of the look's own colours (its light, and gold) turning once every 30 seconds, behind every screen including the score pad, between rounds and the guide. It stops with Reduce motion or Calm mode.
- ✅ **Tablet layouts** for the start screen (bigger rows and faces), Learn (all seven steps on the page in rows), Stats and Settings (wider column, larger type), as well as Home and the table page.
- ✅ **Seats on the start screen:** drag the dots, or use the arrow keys, to match the seats. The deal stays with the person who has it.
- ✅ **Long names** stay on one line under a face on the round screen.
- ✅ **UI kit:** the older frames (round, score pad, between rounds, results, Home, game menu, New game, New table, Learn) now match the app, and the two old tablet frames are replaced by the tablet screens as built.
- ✅ **Screens canvas:** the reworked boards are re-captured (Home, New game, New table, the round, game menu, score pad, between rounds, results, How to play, and both tablet boards), on top of the 15 sheet boards done earlier.

### How flows are tested from 2026-11-17

The owner found flow problems the checks had missed (names lost on the way to the lesson; three layouts to learn the game). The checks proved things worked, not that they should be there. From now on, each flow is handled in this order:

1. **Write the flow as plain steps first**, as the person at the table would do it, with a count of taps, decisions and layouts. Compare it with paper.
2. **Removal pass.** Every element on the screen states the job it does at that moment, or it is removed, defaulted or moved.
3. **Fresh eyes.** Someone who has not seen the screen is given a task and reports where they hesitate.
4. **Report** taps, decisions and layouts before and after, and what was removed.
5. **A real game on a real phone**, by the owner.

### Flow: "New to May I?" from the start screen (2026-11-17)

| | Before | After |
|---|---|---|
| Names typed before opening the lesson | Lost; typed again | Kept (also through a reload) |
| Layouts on the way to the seven rounds | 3 (start, lesson, guide) | 2 (start, guide) |
| Ways off the lesson screen | 6 (two buttons, three tabs, a gear) | 1 (Back to the names) plus the guide's four sections |
| Taps to read the basics and get back to the names | 3, plus retyping every name | 2 |

- There is now one guide. The seven-card lesson is its Basics section; the seven rounds, Q&A and house rules are the sections beside it. The book in a game, the Learn tab and "New to May I?" all open it.
- From the start screen and from a game it opens over what is on screen, with no tab bar and one button at the bottom that says where it returns to.
- Removed: "Start a game" and "See the 7 rounds" on Learn, the duplicate "Learn in 60 seconds" list, and the duplicate points table.

### The guide, cut to two sections (2026-11-17)

The owner asked whether House was needed (it had no real content) and said the Q&A belonged inside Basics and Rounds.

| | Before | After |
|---|---|---|
| Sections in the guide | 4 (Basics, Rounds, Q&A, House) | 2 (Basics, Rounds) |
| Questions in a separate list | 8 | 0 |
| Word list entries | 9 | 0 |
| Help rows in Settings | 3 | 1 |

- **Folded into the step they belong to:** melds longer than the goal and waiting to go down (the "Go down" step); "meld" defined where it is first used (the "Lay off" step); two people asking at once (a step under How "May I?" works); wild cards (a short section with a picture, written from the table's own rules).
- **Dropped as repeats:** laying down a second meld, going out after going down, laying off before going down (all in "A turn"), and what is different in round 7 (in round 7's own guide).
- **House rules** left the guide. The game menu now has a House rules row that shows this game's rules in its second line and opens them to change. The menu's Round guide row is gone, because the book sits beside the gear on every game screen; the menu still has five rows.
- Settings has one Help row, which opens the guide over Settings.

### One frame for every place (2026-11-17)

The owner asked whether the bottom tabs belong on the start screen and every screen, because the second visit opened on a different start from the first. Written out as steps, the app had three starts, not one.

**Before**

| Moment | What the person met |
|---|---|
| First open | The start screen: no top bar, no tabs, a "New to May I?" banner, one button |
| Second open | Home: Settings top right, one button, then Learn, Play and Stats |
| A second group ("New table") | A third layout: a round table of eight seats, a Seat button, a name field, "Create table", then the New game sheet, then "Deal" |
| A table's own page | One button, no tabs |
| Learn, from the start screen | A page over the names with a "Back to the names" button |
| Learn, from Home | The Learn tab, with the tab bar |

**After**

| Moment | What the person meets |
|---|---|
| First open | The Play tab with no tables yet: Settings top right, the names list, one button, then Learn, Play and Stats |
| Second open | The Play tab with tables: the same frame, the tables in place of the names |
| A second group | The start screen again with a way back. The same names list, and it deals straight into round one |
| A table's own page | The same frame: one button, then the tabs. Play goes back to the tables |
| Learn | Always the Learn tab |

| | Before | After |
|---|---|---|
| Frames a person meets before a game | 4 (start, Home, New table, table page) | 1 |
| Layouts for seating players | 2 (a list, a round table) | 1 |
| Ways to the guide from the start screen | 1 banner, different from Home's tab | 1 tab, the same everywhere |
| Screens and confirms to start a second group of 4 | 3 screens, 2 confirms (Create table, Deal) | 1 screen, 1 confirm |
| Ways to Settings before the first game | 0 | 1 |
| Tab bar position between Play, Learn and Stats | moved 2px on a phone; 276px wide on Play and 560px on Learn on a tablet | identical on every screen and size |

- **Removed:** the "New to May I?" banner (the Learn tab does its job), the round-table New table page and its Seat button, the table-name field before the first game, the "Create table" step, and the guide's "Back to the names" route.
- **A bug this fixed:** a brand-new phone could not reach Settings until a table existed, so a saved backup could not be loaded without dealing a throwaway game first.
- **Kept on purpose:** no tabs during a game (the round, the score pad, between rounds, Results). The round screen has no height to spare on a phone, a stray tap would walk the table out of the game, and the guide is already one tap away in the top bar. Sheets and Settings have no tabs either: they sit over whatever opened them and go back to it.
- Names typed on either names screen are kept through Learn, Stats, Settings and a reload.
- A new table starts with the standard house rules, as the first table does. They change from the game menu.

### Home, the main button, the tab bar and the crest (2026-11-18)

The owner's notes on the screens from the pass above.

| | Before | After |
|---|---|---|
| Ways to resume a game on Home | 2 (the Playing now card and a Resume button under it) | 1 (the card, with Resume on it) |
| Main button on a coloured screen | the look's colour on the same colour | cream, on every look |
| Second button on a coloured screen | cream, louder than the main one | dark glass with a gold edge |
| Tab bar height on a phone | 104px with 48px art | 72px with 34px art |
| Dock height on Home with a game going | about 200px | about 100px |
| Fan cards in view behind the crest | 2 of 4 | 4 of 4 |

- **Home.** While a game is going its card is the one way back in: the table, the round and its goal, who leads, the leader's own card on the corner, and Resume. The dock is only the tabs. With nothing in play the dock holds New game.
- **The main button never matches its ground.** Cream on the water; the look's colour on a cream sheet. The second button does the opposite and goes quiet. This closes the open question about the main button's colour, and it holds on all four looks.
- **The tab bar** sits between the platform sizes: iOS uses a 49pt bar with roughly 25pt glyphs, Android's Material 3 bar is 80dp with 24dp icons. Ours is about 72px with 34px art and 12px labels, so the art still reads as art. The big pictures belong to the page above it (the crest, the champion's card, the crown on Stats).
- **The crest's fan.** The inner two cards sit 40px higher, so the queen and the jack show over the crest's shoulders.

**Later the same day, on the owner's next notes**

| | Before | After |
|---|---|---|
| The crest's fan | inner pair lifted 40px, out of line with the outer pair | four cards on one arc from one pivot; inner pair show their top edge |
| Ways to Settings | a gear on four different screens | one tab, the fourth, in the same place everywhere |
| Gears at the top of Play, Learn and Stats | 4 | 0 |
| Where a new table's rules are set | nowhere before the first deal (only in the game menu, after dealing) | a House rules line on the names screen, before dealing |
| Help rows in Settings | 1 | 0 (Learn is the tab beside it) |

- **Settings is a tab.** Learn, Play, Stats, Settings. Opened from a game's menu it still sits over the game with a way back and no tabs.
- **Rules belong to the table.** House rules (buys a round, jokers and 2s wild, aces in runs, ace and joker points) are one line on the names screen once two names are in, with the usual rules already set. The same sheet opens from the New game sheet and from the game menu. Whatever a game is dealt with, or changed to mid-game, is saved on the table (`group.rules`) and is where its next game starts.
- The names typed, the dealer and the rules chosen are all kept through the other tabs and a reload.

### Play, thought through again (2026-11-18)

The owner asked for fresh thinking on the Play screen: what is the context, the intent, the need and the fun. And whether the crest should open the app instead of sitting on Play.

**Who is on this screen, and why**

| Moment | What they want | What Play must give them |
|---|---|---|
| A game is going and the phone was put down | Back into the game | One unmistakable way back: the Playing now card with Resume |
| Game night is starting with the usual people | A hand dealt | New game, one tap, at the table they last played |
| A different group has sat down | A table for them | New table, beside the heading |
| Nothing is happening; someone is curious | Who won, who holds the table, what they have earned | The last game as a moment, the tables with their champions, that night's awards |
| The very first time | To start | The names list |

**What changed**

| | Before | After |
|---|---|---|
| The crest | a 236px hero on Play, and nowhere else | opens the app, then lands as a 44px mark in Play's corner |
| Room on a phone before the first table | about 40% of the screen | about 80% |
| The last game on Play | a trophy and two lines that both named the winner and the table | the winner's card under the crown, each fact once, and the award that told the story; it opens the results |
| Awards on Play | none | the last game's awards on the shelf, tap to see who and how |
| The start screen | the same hero, shrinking as names were typed | the welcome sits a little way down and glides up when the first name is typed |

- **The opening** lasts about 1.3 seconds plus a short hand-off, plays once a visit (not again on a reload in the same visit), skips on a tap or a key, and does not play at all with reduced motion or Calm mode. It is the one place a wait was added on purpose; a table that finds it slow can skip it every time.
- **Last game is one piece** (from a comment on the kit the same evening). The winner and that game's awards had been split by the tables, with a large medal, a tiny name and no face. They are now one block under a "Last game" heading: the winner's line, then the awards in a row that scrolls sideways, each a 46px medal with the award's name and the face and name of who took it. Each table's page carries the same block for its own last game.
- **From the owner's comments on the kit, the same evening:**
  - House rules show on the names screen from the first moment, not only after two names.
  - The empty start screen has a teaching card again ("New to May I?"), until the first name is typed. It opens the Learn tab.
  - The opening has a loading line that fills as the lettering and the crest's art arrive, with three plain steps. It never waits more than four seconds.
  - The background lights sit in opposite corners in the look's own colour and breathe instead of circling. The gold light is gone; over teal it turned muddy.
  - Scores by round is turned: players down the side with faces and full names, rounds across, the total at the end of each row. It grows downwards with the table.
  - Rounds with three melds show their goal cards on two lines on phones 760px tall or more.
  - "New game" names the table it is for ("New game at Friday night"). New game is another game for a table that exists; New table is a different group of people.
- **Not done:** bigger table cards, a callout for what is close to being won, and anything on Play for a table's own look. The space is there for them.

### What the checks missed, and how they changed (2026-11-18, after the push)

The owner found on the live site: dead tabs on the start screen, broken toggles in House rules, and a start screen that no longer felt premium. All three had passed every check.

**Why the checks passed**

| What I did | Why it hid the fault |
|---|---|
| Pressed buttons by script | A script press works even when the button cannot receive a tap. The tab bar's buttons had taps switched off by an old page-level rule everywhere except Home and the Learn/Stats bar; I added the bar to three more screens and never tapped it for real. |
| Tested at 390 by 844 | That is the whole phone. Safari shows about 660px. At that height the round screen hid its second row of faces under the main button. |
| Looked at whole-screen pictures, shrunk | The switch knobs were 6px off-centre and too small for their pill. It is invisible at a quarter size and obvious at full size. |
| Tested in Chrome's engine only | The phone runs Safari's. |
| Trusted my own change | I reported the background lights as moved "on every screen". A later rule in the page still overrode it on most screens; only three had changed. |

**What changed in the checks**

- Every press in the regression suite is now a real, hit-tested tap: the control is scrolled into view, the browser is asked what is under its middle, and the click lands at that point. A covered control is reported as COVERED.
- A second walk (`qa/real/audit.py`) runs in Safari's engine at iPhone 13's Safari size, 390 by 664, with real taps only, through every screen. At each stop every control in the top layer is hit-tested, and the round must fit without scrolling.
- Components are looked at full size in that engine, not as thumbnails.
- These are still not a phone. A real iPhone remains the only place the feel can be judged.

**What was fixed**

- The tab bar takes taps on every screen it appears on.
- One switch size everywhere (84 by 44) with a knob that fits it.
- House rules is set as a list of decisions: each rule has room around it, its control close under its name, one quiet line for what the choice means, and "Why?" opens a short note.
- The start screen has the large crest again and no teaching card. The opening's crest settles onto it.
- The round fits Safari's height: four players sit in one row there, the goal cards are a little smaller and the "Round guide" link (a second way to the book in the top bar) is dropped at that height. Eight players fit with nothing under the button.
- The lights are two still pools of the look's colour in opposite corners, on every screen this time.

**Decisions waiting on the owner (raised 2026-11-18)**

- **Looks per table.** Recommended: yes. A look belongs to a table (its block on Home, its page, its games) and Play, Learn, Stats and Settings stay on the lagoon. No light mode: the art is drawn for a deep ground, and the need it would serve (reading in a bright room) is the Sunlight contrast switch that already exists. Not built.
- **Joining from another phone.** The owner wants a brand-new phone to be able to join a table by link or QR code and add a name and a character. This is option A below ("the table is the shared thing"). The join sheet, the invite sheet, table codes and `?join=` links exist in the app but are switched off, because no sync service is set up (`SUPABASE_URL` is empty). It needs a Supabase project, which the owner has to create. Then: the start screen gets "Join a table" beside the names, the invite shows a link and a QR code, and a joiner taps their face ("That's me") or adds a name and picks one. Not built.

### Still open after this pass

- The kit's Settings frames and the Screens canvas's Settings, Stats and Table page boards still show the earlier captures; the "look" rows on the canvas (Game night, Lime, Cherry, Daylight) are from before the rework.
- The Daylight look is not mapped.
- Real-device checks: VoiceOver, large text, sunlight contrast and offline play on an iPhone; all tablet sizes, and the background glows' smoothness and battery use, on a real iPhone and iPad.

### Phase 6 · Playing together on several phones (needs the owner's decision below)

### Phase 7 · Ready for the App Store and Google Play

## Playing together: how profiles could work

Today one phone keeps score and everything lives on that phone. The question is what happens when everyone opens the app.

| | A · The table is the shared thing (recommended) | B · Accounts |
|---|---|---|
| How people join | Scan the table's QR code or type its code. No sign-up. | Sign in with Apple or Google, then join. |
| "This is me" | Each person taps their own face once: "That's me". The phone remembers. | The account is the person. |
| What a player's own phone can do | Follow the scores live, record their own "May I?", count their own hand and send the score to the scorekeeper, change their own face, see their own awards. | The same. |
| Who is in charge | The scorekeeper's phone. It can correct anything. | The same. |
| A new phone | Join the table again and tap "That's me". Everything is there because it lives with the table. | Sign in; everything follows. |
| The same person at two tables | Two separate players, unless linked later. | One profile everywhere. |
| Cost | Fits "no sign-up". Children can play. Anyone with the code can pick any face, which is fine among family and friends. | Sign-up before the first hand, password resets, children without accounts, privacy duties, account deletion, and on iOS a required "Sign in with Apple". |

**Recommendation:** A now. Later, an optional "Keep my profile" (sign in once) for people who want their awards across tables and safe on a new phone. Never required to play.

**Decision needed from the owner** before Phase 6 is designed: A, B, or scorekeeper-only for now.

## If it goes to the App Store and Google Play

The web app can be wrapped (Capacitor) so the same code ships to both stores. What changes:

- **Saving:** games live in browser storage today, which a phone can clear. A store app should save to the device properly, and the backup file stays as the safety net.
- **Tips:** Apple and Google require their own in-app purchase for tips inside an app. The web tip link can stay on the website only.
- **The card scanner:** asking players for an "Anthropic key" will not pass review and is wrong for families. It needs our own small server in the middle, or on-device card reading, or it stays web-only.
- **Joining a table:** links and QR codes need to open the app directly (universal links / app links).
- **Vibration and sound:** iPhone browsers ignore web vibration; the wrapped app can use real haptics.
- **Store paperwork:** privacy labels, an age rating, screenshots, and, if accounts are ever added, account deletion and Sign in with Apple.
- **No build step today:** the app is one HTML file. Wrapping it adds a small build and a release process for two stores.
- **Android shortcut:** Google Play accepts the web app almost as it is (a Trusted Web Activity), so Android can come first if wanted.
