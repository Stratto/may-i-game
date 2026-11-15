# Design: May I? · "Score Track"

Recorded from the built app (index.html, v5). Mode: Operate. The world is a printed board-game score track: every player row is a lane, and a coloured peg slides toward the finish as scores land.

## Colour
| Token | Value | Use |
|---|---|---|
| `--board` | #E9EFF6 | Page ground, quiet control fills |
| `--board-2` | #DCE5F0 | Lane track, pressed keys |
| `--surface` | #FFFFFF | Panels, sheets, inputs |
| `--ink` / `--navy` | #13233F | Text, primary button, contract bar |
| `--ink-2` | #44546F | Secondary text (8.0:1 on white) |
| `--ink-3` | #5A6880 | Tertiary text and meta (5.6:1 on white, 4.9:1 on board) |
| `--line` / `--line-2` | rgba(19,35,63,.12 / .2) | Hairlines, input borders |
| `--gold` / `--gold-soft` | #865A00 / #FFF2CC, ring #D49A12 | Leader only: ring, "Leading", lane wash |
| `--green` / `--green-soft` | #116B3B / #DFF3E7 | Went out, live status |
| `--red` / `--red-soft` | #C62F2F / #FBE4E4 | Destructive, red suits |
| `--focus` | #2563D9 | Focus ring, caret, links |

**Peg colours** stay with a player for life inside a group: red #D63B3B, blue #2563D9, green #178A4C, amber #F0A81C (navy initial), purple #7A4BD8, teal #0B8F9E, pink #D13F93, orange #E5631A. They never carry meaning beyond identity.

## Type
Manrope 500–800, one family. Tabular numerals on every score. Scale: page title 2rem/800/-0.03em; contract name 2rem/800/-0.035em; lane total 1.6rem (2rem wide, clamp up to 4rem on the scoreboard); body 1rem/500; meta 0.8–0.875rem/600. No eyebrow labels.

## Shape and depth
Flat. Panels: white, 1px `--line`, radius 14px. Controls: radius 12px, 44px minimum (48–56px for primary). Shadows only on floating layers: sheets (0 -8px 40px at 18%) and the toast. Pegs get a 2px inset bottom shade so they read as objects; the leader's peg gets a 3px white plus 2.5px gold ring.

## Components
- **Lane:** peg (38px, dealer badge "D"), name with status line underneath, large total, dotted track with a finish post. Peg position = (worst − total) / (worst − leader).
- **Contract bar:** navy, 7 round pips (amber = current), "Round n of 7 · contract", name, mini meld cards, tip, dealer line. Tapping it opens that round's rules.
- **Buy control:** "May I?" with one dot per allowed buy, gold when used, small minus to undo.
- **Score pad:** one sheet scores the whole round. A strip of player chips on top, a big number display, Type points / Tap cards toggle, a 3×4 keypad or card keys, then "Went out" (one per round) and "Save · next player". It jumps to the next unscored player and commits the round when the last one is saved. Each lane then shows a small "+18" or "Out" chip that reopens the pad.
- **Round intro:** the signature moment between rounds. A dimmed overlay shows who won the round, the 7 pips filling, the next contract name at display size, its cards dealt in, and who deals, with Undo and Let's play. It closes itself after 4.2s.
- **Home:** a navy "Playing now" card per live game with mini lanes, then one card per group with its all-time mini track (top 3 by wins).
- **Group header:** group name, champion line in gold, and the champion's 64px peg with a gold crown.
- **Dock:** primary action pinned at the bottom, one obvious next step.
- **Sheet:** bottom sheet on phones (drag to close), centred dialog at 700px and up.

## Layout
Phones: single column, max 760px. 900px and up: game splits into a 360px side column (contract and round grid) and the lanes. Scoreboard mode: full-screen navy, lanes fill the height, no controls.

## Motion
Ease `cubic-bezier(.16,1,.3,1)`. Pegs slide 450ms when a round commits; totals count up over 450ms; sheets rise in 320ms; presses scale to 0.97. Confetti on a fresh recap only. Everything collapses under `prefers-reduced-motion`.

## Don't
Deep or offset shadows, gradient text, emoji icons, extra fonts, decorative colour that isn't a player or a state.
