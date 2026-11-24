# Refine plan, 22 Nov 2026

A review of the outside contributor's work (made with Google's tools), and a plan to refine May I? in small, cheap steps.

## What the contributor changed

| Area | What they did | Verdict |
|---|---|---|
| Build | Moved the app to Vite + React modules: `index.html` is now a shell (CSS only), the app runs from `src/main.jsx`. | **Keep, with a deploy step.** Splitting the code makes every future edit cheaper. But GitHub Pages serves the repo root, and the root `index.html` now points at `/src/main.jsx`, which only works after a build. Pushing as it stands would break the live site. |
| Shipping app | `src/ClaudeApp.jsx` is our Lagoon app moved into a module. `main.jsx` runs this one. | **Keep.** It is our design. |
| Second app | `src/App.jsx` + `src/screens/*` + `src/components/*` is their own rebuild ("Pegboard spine", "Patio Daylight" theme). It is not wired in. | **Do not ship it.** Take a few ideas from it (see below), then delete it. |
| Engine | Rules, scoring, stats and avatars moved into `src/engine/*`; tests now import them directly. 56 of 56 tests pass. | **Keep.** This is the most useful part of their work. |
| DESIGN.md | Rewritten to describe their unshipped rebuild, plus a Figma file. | **Restore ours** from the last commit and add the ideas we keep. |
| Lost work | **Our uncommitted fixes from 18 Nov are gone from the app:** tab bar taps, switch size, House rules layout, the large crest with no teaching card, the round fitting Safari's height, and the still corner lights. The move to modules started from the last commit. | **Recover them first.** The edits are in the session transcript, so they can be applied again to `ClaudeApp.jsx` and the `kit-app` styles. |

## Ideas worth taking from their rebuild

These are about how it works, not how it looks.

1. **A typing keyboard on the score pad.** Number keys, Enter and Backspace work on a tablet with a keyboard. It is small and helps tablets.
2. **Jump to the next unscored player** after each save. We already have "Save · next player"; make it skip people who are already scored.
3. **Sheets that are fully opaque.** They are easier to read in a bright room and cost nothing.
4. **Contrast checked on every token** (at least 4.5:1). Take the method, not their colours.
5. **A "read it from across the table" view.** Their peg race is a second picture of the score, so it adds load. The need behind it is real, though: a large, simple standings view. Use our transposed score sheet as the tablet's table view instead.
6. **Daylight / sunlight.** This confirms the open question about a light mode. We recommended the existing Sunlight contrast switch over a full light theme, and that still holds.

**Leave out:** the peg-lane home screen, the second theme system (`data-theme`), and their tokens file. They would split the design in two.

## How to work without burning tokens

- **One thread per phase.** Each thread starts from a 10-line brief: the goal, the files, the done check. Compact or close the thread when the phase ends.
- **Edit modules, not the whole app.** After the split, open only the screen being changed. Do not read `ClaudeApp.jsx` whole (430 KB). Use grep to find a function, then read about 80 lines around it.
- **Checks sized to the change.**
  - Every change: `npm test` (engine) and `qa/regress.py` (taps).
  - Before reporting done: `qa/real/audit.py` (Safari's engine, 390 by 664, real taps), on the touched screens only.
  - At the end of a phase: one look on a real iPhone.
- **Kit screenshots** are rebuilt once per phase, not after every tweak.
- **No subagents** except one fresh review at the end of a big phase.
- **Art (Weave) only with your approval**, and only where a screen is still missing art.

## Phases

Each phase is its own thread, in this order.

**P0. Make it safe — done 22 Nov**
- Pages: `.github/workflows/pages.yml` tests, builds and publishes `dist/`. The build copies `art/` and stamps a new service-worker cache name. **One setting is left for you:** repo Settings → Pages → Source: GitHub Actions. Do it before the next push.
- The 18 Nov fixes are back in. Found and fixed on the way:
  - The contributor had swapped our round screen for the old seat list, which ran 809px past Safari's height. Our round is restored.
  - They had brought back a look picker in Settings and made Daylight a light theme. The committed behaviour is restored.
  - A second, empty `<div id="root">` doubled the page height. Removed.
- Kept from their edits: typing to count cards on the score pad, the "Goes first" badge, the count icon on Tap cards, and "Last game at <table>" when that table is playing.
- The tests now check the real app (`src/ClaudeApp.jsx`), not a copy. The copy in `src/engine` had drifted from the app in 43 places. Their rebuild and engine are saved on the branch `archive/contributor-rebuild`, and removed from main.
- The tap checks now live in the repo: `npm run e2e` (`tests/e2e/tap.py`). The old scratch scripts were lost when the scratchpad was cleared.
- DESIGN.md is restored, with Files and build and Testing sections added. A README has been added. The UI kit is published (version 68).

**P1. The round — done 22 Nov**
- Already in the app: Enter in a score box jumps to the next empty box, marking someone Out moves the keyboard to the first empty hand, and you can type to count cards. Sheets were already opaque.
- `npm run e2e` now plays a round with real taps, for 2, 4 and 8 players: buy, undo the buy from the toast, mark Out, type the scores, save, start round 2. It checks that each round screen fits at 390 by 664.
- New: phones show each player's running total under their face once a round is scored, with the leader's in gold. On a short screen with eight players, the "Deals 10 each" and "Goes first" words give way to the totals (the D and 1st badges stay).

**P2. Play / Home — done 22 Nov (owner chose: lead with the table)**
- Tables come first, and the last game moves under them. Each table card shows who holds it, who won last, its faces, and a one-tap New game pill (except the table the dock button already names).
- The pill acts as the quick start, so there is no separate quick-start card.
- `npm run e2e` seeds a returning player with two tables (`tests/e2e/seed.js`). It checks the order, the pill, that "New game at Friday night" appears only once, and that tapping a card opens the table.

**P3. Between rounds and results — done 22 Nov**
- Lines no longer repeat the total beside them. Round 1 speaks in words, and a line appears only once down the standings.
- The heading reads "Ana went out" (not "went out first"). The leader's line drops its second crown.
- Results: the awards now have their own section under the standings. Every award the game gave out is shown, rarest first, as a gold-ringed medal with who won it. The four rarest are big and say how they were won. The rest sit in a smaller row (four across on a phone, six on a tablet). On a first view they pop in one by one after the finale. If reduce motion is on, they appear without the pop.
- To avoid saying the same thing twice, the award line under the winner is gone, and the standings rows show a plain fact from the scores (such as "Went out 2 times"). `npm run e2e` opens a results screen and checks that no award name also appears in the standings.

**P4. Your decisions, then build**
- Looks per table — done 22 Nov (owner chose: yes as recommended; dealt to each new table, changed later).
  - A new table is dealt one of the four looks (Lagoon, Game night, Lime, Cherry), one that no other table is wearing yet while there is one. Tables made before this show Lagoon.
  - The table's page, its round, score pad, between rounds and results wear its look. Its card on Play takes the look's colour, replacing the colours that used to go by position. Play, Learn, Stats and Settings stay on Lagoon.
  - To change it: Table settings (the gear on the table's page) has a row of four look tiles. A tap changes it at once, and the page behind the sheet shows it.
  - `npm run e2e` checks that Friday night wears Cherry, that a tap on Lime changes it, that Play stays Lagoon and Friday night's card turns green, and that its results wear Lime.
- Joining from another phone by link or QR — **parked 22 Nov (owner's call).** One phone or tablet on the table already replaces the paper sheet. Sharing a table across phones soon leads to "my stats", one name on every phone and moving phones, which means accounts and a much bigger job. Watch the test game nights: build it only if players ask to follow along or score from their own phone, and then ask which they want.
  - If it comes back: players never sign in. The table is the shared thing (QR code or link, then "That's me" or add a name and face). It would run on a small Cloudflare Worker on the owner's account, in place of the Supabase code that is in the app but switched off. Peer-to-peer was the no-account fallback, but it can fail on mobile data.

**Next, in order**
1. **Put P0–P4 live.** Set repo Settings → Pages → Source: GitHub Actions, push, then check each phase once on a real iPhone.
2. **Card scanner on the owner's account.** A small Cloudflare Worker holds the owner's Anthropic key as a secret; the app sends the photo with a scanner code the owner gives family (daily cap per code, plus a monthly limit in the Anthropic account). This replaces each player pasting their own key. The owner's part: `npx wrangler login` once, then `npx wrangler secret put ANTHROPIC_API_KEY` typed by the owner, so the key is never seen in a session.

## Open backlog

Carried over on 22 Nov from the 16 Nov play-test backlog and the rework plan, which are now deleted (both are in git history). Items that later work finished or made moot were dropped: totals on the round screen (P1), the oval seating (the round now lists players in turn order), and the Invite and Join screens (removed with the switched-off Supabase code).

**Before launch**
- **Tip jar:** `SUPPORT_URL` is a placeholder Ko-fi link. Swap in the real one.
- **Phone Back button** leaves the app mid-flow (T2-11). Add a history entry per view and sheet, and close the top one on Back.
- **Screen readers:** announce a saved round on Between rounds (T4-06). After "End without saving", move focus to Undo (T4-05).
- **Real-device checks:** VoiceOver, large text, sunlight contrast and offline play on an iPhone; tablet sizes and the background glows' battery use on an iPad.

**Next release**
- **Late joiners:** their catch-up points are stored as real round scores, so they feed stats (T2-12, T2-08). Keep a separate carry total.
- **Rules changed mid-game:** a counted hand keeps the old ace or joker value (T2-10).
- **Score field:** reject anything that isn't whole digits (T2-09); confirm hands above about 200 (T1-07); after "Use 56 for Ada", focus the next empty hand (T1-08).
- **Round-by-round scorecard** on Results and past games (T1-I2).
- **Rematch:** offer the player who sat out back in with one tap, "Hayley sat out · Add back" (R-09, owner said yes).
- **Tablet round:** extend the two-column layout down to 768px (T4-15).
- **Stats:** "No games yet" while a game is live, and table counts (T3-13). Beginner's luck says "Not yet" when it can't be earned; Dynasty and Untouchable could show progress (T3-12). Break leaderboard ties by average finish (T1-14).
- **Small screens:** at 320 with Largest text, leaderboard names are cut off (R-07). Results badge lines end in "…" at 390 (R-08).

**Later**
- The "1st" badge reads as a ranking (T2-13). The add-player preview face differs from the saved one (T2-17). Long table names need a counter (T2-15).
- A confirm for End without saving and Delete game once rounds are scored (T2-18).
- "Out of the gate" shares medal art with "Clean hands" (T3-14, needs Weave, ask first).
- Focus ring on Home's scroll area (T4-09). A different icon for Table settings (T4-16). Natural screen-reader order for standings rows (T4-18). Table page header buttons are 41px at 320 (R-10).
- Ideas: a "Dino deals · same 4 · Change" line before a rematch (T1-I3); "Undo round N" becomes "Edit round N" (T1-I4).
- TV and big night: parked until families ask (owner, 16 Nov).

## Done means

- The live site works offline after the build step.
- Every tab and control takes a real tap at 390 by 664.
- A first-time player can start a game in under 30 seconds.
- Each phase is checked once on a real phone.

## Owner's calls, 24 Nov 2026
Live first: 16be34d (layout pass, round banner, Standings, share preview). Then, item by item:

**Build, in this order**
1. **Phone Back button:** closes the top sheet, then goes back one screen; never leaves a game.
2. **Score pad:** whole numbers only, "Sure?" over 200, jump to the next empty hand after "Use 56".
3. **Rematch:** "Hayley sat out · Add back" when someone from the table sat out.
4. **Past games:** open the same Results view with scores by round, no finale.
5. **Stats:** awards in progress with a bar ("Dynasty · 2 of 3"), between won awards and "N still to find".
6. **Sheets slide down on close** (about 0.25 s, never under Calm).
7. **Background lights drift slowly again** (owner chose drift; off under Calm and Reduce Motion).
8. **Tip card:** the cup shows empty and its steam is gone. Fix the art and the steam. The link stays a placeholder for now.
9. **Black square** top-left of Results and Learn in WebKit.
10. **VoiceOver:** focus to Undo after "End without saving"; sensible reading order on the round banner and Standings.
11. **Tablet round:** two columns down to 768px.

**Built 24 Nov:** 1 Back button; 2 the score pad already took whole numbers and caught hands bigger than the round allows (stricter than "over 200"), so only the jump to the next empty hand after "Use N" was added; 3 the Rematch line; 4 was already done (past games open Results with scores by round); 5 Nearly there on Stats, plus bars on achievements in progress in the cabinet (game awards are won in one game, so they have no progress); 6 sheets slide down; 7 lights drift; 8 tea and steam in the tip cup (the steam had only ever been in the UI kit); 10 focus moves to Undo after an undo toast; 11 was already fine (the round on a 768px iPad uses the width with two columns of faces; the old two-column CSS is unused). **Not fixed:** 9, the black square, appears in headless WebKit only when many drop-shadow filters are on screen at once; no single element causes it. Check it on a real iPhone.

**Mock up first:** the score-sheet finale (winner's total circled in ink, card pinned on, zeros as an Out stamp), side by side with today's finale, before anything is built. **Mocked 24 Nov** (`docs/shots/finale-mock-24nov.jpg`). **Owner's call: keep today's finale**, and leave Scores by round as it is. Not built.

**After the batch:** a short real-iPhone checklist for the owner (VoiceOver, large text, Sunlight, offline, Back button, swipe back, the black square on Results and Learn, the drifting lights' battery use).
