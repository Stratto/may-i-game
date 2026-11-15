# Tests

**Unit tests** load the real app script out of `index.html` (with React and the
browser stubbed) and check the game rules, the scoring maths, the stats and the
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

Serve the project folder and open `/tests/lab.html` (add `?auto` to start the
run straight away).
