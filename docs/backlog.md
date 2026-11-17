# May I? · playtest findings and backlog

The play-test panel on 2026-11-16 had four agents, each driving the app headless in a fresh browser:
- **T1** family host, first night
- **T2** recovery paths
- **T3** collector and customiser
- **T4** accessibility, layout and design rules

Every finding is listed below with what happened to it. The open items say when they should be done:
- **Before launch** means before the app is shared beyond the family.
- **Next release** means the first update after launch.
- **Later** means when there's room.
- **Owner decision** means it needs a call from the owner before anyone builds it.

Replay scripts live in the session scratchpad under `qa/`. They are `mayi.py` (the helper), `tour.py`, `regress.py` and `c320.py`.

## Fixed in this pass

| ID | Severity | What | Fix |
|---|---|---|---|
| T3-01 | blocker | Sunlight contrast broke every screen | The root class `hc` clashed with the hand-card `.hc` rules. Renamed it to `hicon`. |
| T2-01 | major | Fix an earlier round lost a player who had since sat out, and could save two zeros | Fixing a round now lists everyone who played that round. |
| T2-02 | major | A player who sat out vanished from Results | A new "Left early" list shows them with "Sat out from round N" and their total. They can't win. |
| T2-03 | major | Finishing a reopened game again rewrote its date | Reopening keeps a copy of the game, and finishing again keeps the original end date. |
| T2-04 | major | "End without saving" on a reopened game deleted the finished game | On a reopened game it becomes "Discard changes" and restores the game exactly as it was. |
| T2-05 | major | Delete table was one tap away from losing every game | A table with games now asks "Delete Friday night? N games and every award won here go with it." |
| T3-02, T2-16 | major | The same name could be added twice at one table | Blocked in First run, New table, Players and Add a player, with the hint "There's already a Rachel. Add an initial, like Rachel B." |
| T3-03 | major | The tip jar accepted £0, junk and huge amounts, and still marked the user as tipped | Only £1 to £200 in money format is accepted. Anything else shows "£1 to £200" and the tip can't be sent. |
| T4-01 | major | A zoom left over from the kit's phone frame shrank the whole app (33–37px buttons, 9–12px text) | Removed it. Buttons are 44px again. |
| T4-02 | major | Round guide and Cabinet clipped on the right at 320 wide | Segmented controls and round chips now shrink to fit. Checked at 320, standard and Largest text. |
| T4-03, T3-04 | major | Largest text at 320: the table hero overlapped the leaderboard, buttons were cut off, tabs truncated | The hero grows in height, dock buttons size to the screen, and tabs size to their labels. |
| T4-04 | major | Sheets didn't take keyboard focus or keep it | Focus moves into each sheet, the page behind is `inert`, and focus returns to the button that opened it. With a keyboard, the score pad focuses the first empty hand. |
| T4-11, T3-07, T1-03 | major | About 90 lines of copy said "you", "your", "I" or "me" | Rewritten in the third person everywhere players can see. The AI scanner prompts keep "you" on purpose. |
| T1-01 | minor | Fix showed "current total minus the round" as the "before" figure | Before now means the total through the previous round. |
| T1-02 | minor | The table page said "No champion yet. Deal the first game" during the first game | Now it reads "First game under way · Round N of 7. The winner becomes the table's first champion." |
| T1-04 | minor | Next-round cards showed only two melds | Every meld shows, at a smaller size when there are three. |
| T1-05 | minor | The Between-rounds header had no background when scrolled | Sticky header with a blurred teal backing. |
| T1-06, T2-07 | minor | A typed 0 vanished, and a second Out blocked Save without saying why | The pad now explains: "0 means Rachel went out. Tap Out for Rachel." or "Only one player goes out each round." |
| T1-09, T2-14 | polish | Toasts covered the header buttons | Toasts now sit below the header. |
| T1-11 | polish | "96 behind with 1 round left, about 96 a round" | The final round has its own wording. |
| T1-12 | polish | "Nobody went out" used the success tick | It uses the steady-hand art now. |
| T2-06 | minor | "Sits out from round 3" when it starts straight away | The copy now gives the current round. |
| T2-08 | minor | A chosen start score of 0 or blank silently became 1 | The field explains "Lowest is N, one point for each round missed", and Add stays off until the score is valid. |
| T3-05 | minor | The dressing room opened on Cards for a player whose face is initials | It opens on the player's own kind of face. |
| T3-08 | minor | Backup counts stayed stale after loading a backup | Settings now reads the live data. |
| T3-09 | polish | Toast title and body ran together ("Backup savedKeep…") | They show on two lines. |
| T3-10 | minor | "Use it free" next to "costs a few cents" | Now reads "Got an Anthropic key? Add the key". |
| T3-15 | polish | The photo zoom slider was announced as "range" | It's labelled "Photo zoom". |
| T3-16 | polish | "Keep this phone's" | Now "Keep what's here". |
| T4-07 | minor | Learn and Stats had no h1 or main landmark | Added both. |
| T4-08 | minor | Small text on the lit water and paper was 3.3–4.4:1 | Lighter secondary text (#E9F9F4), a lighter header gold, and a deeper paper gold (#74500F). |
| T4-10 | minor | Tap targets under 44px (round chips, switches, Nobody went out) | All 44px now. Round chips go down to 36px only at 320 wide. |
| T4-13 | polish | Divider lines on First run and in the dressing room | Removed. |
| T4-14 | minor | Desktop showed the same control twice next to the rail | When the rail is on, Home hides its New table block and the settings gear. |

Other work in the same pass:
- A desktop rail from 1100px: logo, tables, Play, Learn, Stats, Settings.
- "The chase" on Between rounds groups each player's awards into one line.
- Settings, `List` and `TIP_AMOUNTS` had been dropped by mistake in an earlier cleanup and are restored.

## Confirmation re-test (same day)

A fresh tester played the fixed build end to end:
- a whole 7-round game with "Nobody went out", a late joiner, a player sitting out and a fix to round 1, then a rematch;
- every recovery path, Settings and keyboard use.

There were no console errors anywhere. It found two new majors, now fixed and verified:

| ID | Severity | What | Fix |
|---|---|---|---|
| R-01 | major | The "Finish now and count" confirm ran about 80px off the screen at 320 wide (9px at 390) | The confirm buttons wrap, and the menu list can shrink. |
| R-02 | major | The score pad didn't take focus, Tab reached the buttons behind it, and Escape didn't close it | It's a real modal now: focus moves in and stays there, the page behind is inert, and Escape closes it and returns focus. |
| R-03 | minor | The Players sheet said "deals round 1" during round 1, one round off | The rows now name the next round, and there's no label in round 7. |
| R-04 | minor | Closing a sheet opened from the Game menu left focus on the page body | Focus goes back to the Game menu button. |
| R-05 | minor | Round guide tabs were 40px, backup buttons 42px and "Add the key" 36px | All 44px. |
| R-06 | minor | Five Q&A questions and "Photograph my hand" were in the first person | Rewritten in the third person. |

After the fixes:
- `npm test` passes 56/56.
- `regress.py` passes on every check.
- The tours at 320, 390 and 1280 show no errors.

The service worker cache is mayi-v54.

Still open from the re-test:

| ID | Severity | What | When |
|---|---|---|---|
| R-07 | polish | At 320 wide with Largest text, leaderboard names and badges are cut off ("Di…", "Caugh") | Next release. It needs a two-line row layout at that size only. |
| R-08 | polish | Results badge lines end in "…" at 390 | Next release. It needs a "show more" link, or allowing 3 lines. |
| R-09 | question | A rematch leaves out the player who sat out | **Owner decision.** That's arguably right, since they left, but they could be offered back in with a single tap. |
| R-10 | polish | At 320 the table page header buttons are 41px wide | Later. |

## Found on a real iPhone (after release)

The owner found two problems on an iPhone that the headless checks missed. The checks ran in a desktop browser at phone size, which never auto-zooms and wasn't checking the cursor.

| ID | Severity | What | Fix |
|---|---|---|---|
| P-01 | major | Tapping a name field zoomed the screen in, and players had to zoom back out | Safari zooms into fields under 16px. The app follows the phone's text size, so fields can be smaller than that. On iPhone and iPad the viewport now sets `maximum-scale=1`, which stops the auto-zoom; pinch zoom still works. |
| P-02 | major | No visible cursor in the first-run name field (teal on teal) | The cursor is deep teal on paper fields and pale gold on the teal first-run screen. |

Added to QA:
- `regress.py` now checks the iPhone viewport in WebKit with iPhone emulation, and the first-run cursor colour.
- `caret.py` checks every reachable field's cursor against its background.

| P-03 | major | The UI kit page (docs/ui-kit.html) opened on phones with a 680px wall of 22 links, mostly 34px tall, and no way back to the menu after scrolling | Below 1100px the menu is a bottom sheet opened from a floating button that names the section in view. Links are 46px; the sheet closes with Escape, a swipe down or a tap outside, and focus returns to the button. The section in view is worked out from the scroll position, so jumps and flicks get the right name. Desktop keeps the sticky side menu. |

`kitnav.py` checks the kit menu in Chromium and WebKit at 320, 390, 768 and 1280. It tests opening, focus, link sizes, jumping, closing, the section name and sideways scroll.

**Gap:** this Mac has no Xcode, so real iOS Safari isn't tested. Before each release, try these on a real iPhone (or install Xcode for the Simulator):
- focus each text field;
- add the app to the Home Screen;
- type with the keyboard open over a sheet;
- turn the phone sideways.

## Open: before launch

| ID | Severity | What | Assessment |
|---|---|---|---|
| T2-11 | minor | The phone's Back button leaves the app mid-flow, because the app adds no history entries | It's the most common accidental exit on Android. Push a history entry for each view and sheet and close the top one on `popstate`. About half a day; touches navigation everywhere, so test it fully. |
| T3-11 | minor | Invite and Join show a code that can't be used yet | It needs the sync server. Until then, decide whether to hide Invite or keep the honest "next release" note. **Owner decision.** |
| SUPPORT_URL | blocker for launch | The tip jar points at a placeholder Ko-fi link | Swap in the real payment link. |
| T4-06 | minor | Saved rounds aren't announced to screen readers | Add a polite live line on Between rounds ("Round 3 saved. Rachel leads on 45"). Small. |
| T4-05 | minor | After "End without saving", focus lands on the page body | Move focus to the toast's Undo button. Small. |

## Open: next release

| ID | Severity | What | Assessment |
|---|---|---|---|
| T2-12, T2-08 | minor | A late joiner's catch-up points are stored as real round scores, so they feed per-round stats and show in Fix | Store a separate `carry` total per player instead. This touches totals, stats and tests, so it belongs in a planned release with tests. |
| T2-10 | minor | Changing ace or joker values mid-game leaves a counted hand at the old value while the counter offers the new one | Either recount saved hands when the rule changes, or show the value each hand was counted at. |
| T2-09 | minor | The score field quietly rewrites "12.5" as 125 and cuts "99999" to 999 | On phones the numeric keypad mostly prevents this. Reject anything that isn't whole digits, with a hint. |
| T1-07 | polish | No sanity check on very large hands | Ask for confirmation above roughly 200. |
| T1-08 | polish | After "Use 56 for Ada", focus goes to the top row, not the next empty hand | Small. |
| T1-I2 | idea | A round-by-round scorecard on Results and past games | High value for settling arguments. Build it as an expandable grid. |
| T1-I1 | idea | Running totals on the round screen | The kit keeps standings off the round screen on purpose ("never during a round"). **Owner decision.** |
| T4-15 | minor | Tablet and desktop: the round screen leaves the bottom half empty, and the game screens have no rail | The kit's tablet round layout is built at 900px and wider. Extend the two-column layout to 768px, and decide whether game screens get the rail. |
| T3-13 | polish | Stats says "No games yet" while a game is live; "4 games across 1 table" sits above 2 tables | Small copy and logic fixes in Stats. |
| T3-12 | polish | Beginner's luck shows "Not yet" when it can no longer be earned; Dynasty and Untouchable could show progress | Show "Missed it" or hide; add `near` progress for those two. |
| T1-14, T3-13 | polish | Ties on the table leaderboard (players with 0 wins are "Joint 4th") | Break ties by average finish. |

## Open: later

| ID | Severity | What | Assessment |
|---|---|---|---|
| T1-10 | polish | Four players sit as 3 + 1 on the round table | Use a 2 × 2 layout or seats around the oval. |
| T2-13 | polish | The "1st" badge (plays first) reads as a ranking | Swap it for a small arrow or "Starts". |
| T2-17 | polish | The add-player preview face doesn't match the face that gets saved | Seed the preview with the same face. |
| T2-15, T3-06 | polish | Table names are cut at 30 characters without a word | Show a counter near the limit, and make sure Home cards handle long names. |
| T2-18 | idea | End without saving and Delete this game rely on a 6-second Undo | Consider a confirm once rounds are scored, the same pattern as Delete table. |
| T3-14 | polish | "Out of the gate" shares its medal art with "Clean hands" | Needs new art (Weave spend, so ask first). |
| T4-09 | polish | One focusable scroll container on Home has no visible focus ring | Give it `tabindex=-1`. |
| T4-16 | polish | The gear opens app Settings on some screens and Table settings on the table page | Use a different icon for Table settings. |
| T4-18 | polish | Screen readers hear standings rows as "Joint 2 nd Dino Averages 67 1 win" | Add an explicit aria-label in a natural order. |
| T1-I3 | idea | A "Dino deals · same 4 · Change" line before a rematch deals | A small reassurance. |
| T1-I4 | idea | Rename "Undo round N" to "Edit round N" | It reopens the round with its scores kept. Copy only. |
| TV and big night | feature | In the kit, not built in the app | **Owner decision** on whether and when. |

## Owner decisions (answered 2026-11-16)

1. **T4-12, eyebrow on goal cards:** keep it. It carries the round number. Allowed on goal cards only.
2. **T4-17, card shadows:** cards follow the no-offset rule. Use a soft, even glow instead of a downward shadow. Do this before launch; it's small.
3. **T3-11, Invite and Join:** hide them until sync ships. Do this before launch.
4. **T1-I1, totals during a round:** keep the round screen calm. Tapping a player's face peeks at their running total. Next release.
5. **TV and big night:** park until after launch, then see whether families ask for it.
6. **R-09, rematch:** offer the player who sat out back in. The rematch line shows "Hayley sat out · Add back"; they stay off unless someone taps it. Next release.
