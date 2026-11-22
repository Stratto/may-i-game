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

**P1. The round (the moment used most)**
- Add 2- and 8-player fits to `tests/e2e/tap.py`.
- The score pad: keyboard support, skipping to the next unscored player, opaque sheets.
- Check that the round fits at 664 px with 2, 4 and 8 players.
- Buying ("May I?") and undo: tested with real taps.

**P2. Play / Home.** This needs your call on two questions:
- Should the screen lead with the table or with the night?
- Do you want a quick-start card?

**P3. Between rounds and results.** Cut repeated text and give the awards their moment.

**P4. Your decisions, then build**
- Looks per table.
- Joining from another phone by link or QR. This needs a Supabase project that you create.

## Done means

- The live site works offline after the build step.
- Every tab and control takes a real tap at 390 by 664.
- A first-time player can start a game in under 30 seconds.
- Each phase is checked once on a real phone.
