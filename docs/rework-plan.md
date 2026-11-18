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
- ✅ Learn is a banner with the cards and the question mark, in view before any name is typed, on phones down to 375 × 667.
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

### Still open after this pass

- The main button's colour (cream on water, the look's colour on cream sheets) waits on the owner's yes.
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
