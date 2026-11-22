# May I?

A score keeper, rulebook and card counter for May I?, the rummy game played over seven rounds. It runs in the browser and works offline, so a table can use it in place of pencil and paper.

Live at https://stratto.github.io/may-i-game/

## Work on it

```bash
npm install
npm run dev       # http://localhost:8743
npm test          # rules, scoring and stats, against the real app code
npm run e2e       # real taps in Safari's engine at iPhone size (needs the dev server)
npm run build     # writes dist/
```

Pushing to `main` tests, builds and publishes to GitHub Pages (`.github/workflows/pages.yml`).

## Where things are

- `DESIGN.md`: the design as built. `docs/ui-kit.html`: the UI kit and screens.
- `docs/rework-plan.md`: decisions and history. `docs/refine-plan.md`: what's next.
- `index.html`: styles and sprite. `src/ClaudeApp.jsx`: the app. `art/`: all images. `public/`: icons, manifest, service worker.
