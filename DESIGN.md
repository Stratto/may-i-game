# Design: May I? · "The Table"

Recorded from the built app (index.html, v6). Mode: Operate. A card table in your pocket: the game screen is a felt band with the contract dealt as real cards, with the players as seats in one clean card. Everything around it is plain iOS.

## Looks
Four looks, chosen in Settings and stored per device (`mayi:settings:v6`). `applyLook()` writes the tokens as CSS variables on `<html>` before the first paint and follows the system dark mode.

| Look | Band (felt) | Ground | Accent | Dark mode |
|---|---|---|---|---|
| Table | #17644A → #0B3D2B | #F1F2EE | #145A40 | yes (#0B0E0C, accent #46C08A) |
| Midnight | #1F3D6B → #0A1426 | #EEF0F5 | #15274A | yes (#080C15, accent #9DBDFF) |
| Parlour | #6E1F2B → #360B12 | #F4EFEA | #5E1A25 | yes (#100809, accent #F0A0AC) |
| Daylight | white with a 2px black frame | #FFFFFF | #000000 | no, built for sunlight |

## Colors
Tokens: `--bg`, `--surface`, `--fill`, `--line`, `--ink` / `--ink2` / `--ink3`, `--band` / `--band2` / `--band-ink`, `--accent` / `--accent-ink` / `--accent-soft`, `--gold` / `--gold-ring` / `--gold-soft` (leader only), `--out` / `--out-soft` (went out), `--red`, `--focus`. Text pairs meet 4.5:1 in every look. Peg colours (red, blue, green, amber, purple, teal, pink, orange) identify a player for life and never mean anything else.

## Typography
System SF (`-apple-system`) for everything you read or tap, with Dynamic Type through `font: -apple-system-body`. Numbers use `ui-rounded` with tabular figures. Fraunces 600–700 (opsz 96) only for display: large titles, the contract name, the round-intro card, the recap headline and sheet titles. No eyebrow labels.

## Shape and depth
Inset grouped lists: radius 14, 56px rows, hairline separators inset to the text. Seats card: radius 22. Buttons: 50/56px, radius 13/16, flat, pressed `scale(.97)`. Depth belongs only to playing cards (a hairline edge plus a short drop), the floating sheet and the toast.

## Components
- **Page:** a large Fraunces title that collapses into a blurred 48px nav bar after 44px of scroll. The nav holds back, title and up to two icons.
- **Felt band (game):** back with the group name; gear (game settings); screen icon (scoreboard, wide screens only); "Round n of 7", contract name, mini meld cards; pips (current one in gold), dealer tag, "Rules ›". Tapping the contract is the only way into the rules.
- **Seat:** 42px avatar (gold ring if leading, gold "D" if dealing), name with a crown, status line ("Leading", "12 behind"), this round's "+12" or "Out" chip (tap to edit), count-up total, "May I?" buy pill with one dot per allowed buy.
- **Dock:** a single primary button for the next step: Score round n, Keep scoring, Next round, or See who won.
- **Score pad:** player strip, big display, Type points / Tap cards, keypad, Went out (one per round), Save · next player.
- **Round intro:** the next contract on a giant 5:7 playing card with corner indices, dealer and tip; Undo round n and Let's play; closes itself after 4.6s.
- **Recap:** felt finale with a gold hairline frame, Fraunces winner, podium (2, 1, 3) with a gold first block and crown, then lists for the rest of the field, highlights and the round grid. Share (nav bar) makes a 1080×1350 image in the current look.
- **Round strip:** seven tiles under the band. The current round is filled with the accent, finished rounds show the colour of whoever went out, and tapping a finished round opens the score pad as "Fix round n". The dock is the only way to score the current round.
- **Undo toast:** ending, deleting a game and deleting a table act at once and show a toast with Undo for 6 seconds. Nothing asks twice.
- **Round guide (Rules sheet):** tabs Rounds, Basics, Q&A, House. A round shows the contract card with its goal and card maths, then Watch out (gold callout), After you go down, Tips, and Pro tips (open for seasoned players). Basics uses numbered step timelines. Every house rule shows a live hint and a "Why?" note.
- **Coaching level:** asked once after the first deal ("Have you played before?"). Learners get the round guide at the start of every round. It can be changed in Settings.
- **Card scanner:** in the score pad's Tap cards mode, "Scan the hand" takes a photo and fills the hand with suited cards. Cards the reader guessed get a gold outline so they get a second look. It uses the player's own Anthropic API key, set in Settings and stored on that device only.
- **Hand coach:** at the bottom of the current round's guide. A private photo of your hand returns what Claude sees, what you have, what to aim for, keep, discard and one tip.
- **Sheets:** bottom sheets on phones (swipe down, scrim, Escape), centred at 700px and up.

## Layout
Content max 720px. At 900px and up the game shows seats on the left and the round grid on the right. Scoreboard mode fills the screen with the band and large seats.

## Motion
`--out-e: cubic-bezier(.16,.84,.3,1)` and `--spring: cubic-bezier(.34,1.3,.64,1)`. Seats rise in a stagger, totals count up, the intro card is dealt in with a spring, and confetti plays on a fresh recap only. Everything collapses under `prefers-reduced-motion`.

## Don't
Two controls for one action. Deep or offset shadows on buttons. Gradient text. Emoji icons. Fonts beyond SF and Fraunces. Colour that isn't a look token, a player or a state.
