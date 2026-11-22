# Tests

**Unit tests** load the real app module, `src/ClaudeApp.jsx` (with React and the
browser stubbed), and check the game rules, the scoring maths, the stats and the
coaching content. No install needed, just Node 20 or later:

```bash
npm test
```

**Play-test lab** (`tests/lab.html`) plays scripted scenarios against the real
app in an iframe at five sizes: small phone, phone, tablet portrait, tablet
landscape and TV. It seeds a known table, scores a round, buys, opens the rules,
the scoreboard, a profile and a recap, and checks for sideways scrolling,
clipped text and small tap targets. Your own saved tables and settings are put
back when it finishes.

Run `npm run dev` and open `/tests/lab.html` (add `?auto` to start the
run straight away).

**Real-tap walk** (`tests/e2e/tap.py`) drives the app in Safari's engine at
390 by 664, the height Safari leaves on an iPhone. Every press is a mouse tap at
the point the browser reports as on top, so a covered control or one with taps
switched off fails. It checks every visible control on the start screen and each
tab, a House rules switch, and that a round for four fits without scrolling.
Needs Python with Playwright (`pip install playwright && playwright install webkit`).

```bash
npm run dev          # one terminal
npm run e2e          # another; or: python3 tests/e2e/tap.py http://localhost:4173/
```
