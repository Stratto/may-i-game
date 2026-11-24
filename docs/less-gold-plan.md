# Plain icons, less gold: plan, 23 Nov 2026

**Not built.** The owner chose to keep the icons as they are (23 Nov) and to work on layouts and flows instead. Kept here in case it comes back.

From the 23 Nov critique: the clearest "AI-made" tell is one render style everywhere. Every icon is glossy gold with gems, and every surface has a gilt rim. The deck, the score sheet and the voice are clearly ours. This plan keeps those and takes the jewellery off everything else.

Before and after, table page (mocked in the browser, not built): `docs/shots/less-gold-table-before-after.jpg`.

## The rule
**Gold means one of two things: the thing to tap next, or who's winning.**
- The main button in the dock keeps its gilt rim and its gem studs.
- The leader's crown, the winner, award medals and podium plinths keep their gold.
- Everything else goes plain: hairlines, flat cream glyphs, no gems.

**3D art is a reward.** It stays only where something was won or where it is the brand:
- award medals (Results, Stats, the cabinet, "next award");
- the crest;
- the finale trophy;
- the crown on the leader;
- the faces;
- the deck itself.

## Icons
All new icons are flat line glyphs drawn in code, in the style of the line set the app already has (`IC` and the SVG sprite in `index.html`). They're cream on the water, ink on paper, and gold only when chosen. No new art and no Weave.

| Where | Today (3D) | Becomes |
|---|---|---|
| Tab bar: Learn, Play, Stats, Settings | book, gem play button, trophy, gem gear | open book, two fanned cards, plain cup, plain gear |
| Rules button in every game nav (`ib-guide`) | 3D book | open book |
| Game menu and Settings rows (`gm-row`) | friends, scores, dealer's choice, gear | two faces, score sheet, card with a pencil, gear |
| Tap cards (`count`) | 3D card hand | small fanned hand |
| Card scanner (`camera`) | camera with a sapphire lens | plain camera |
| Tip card (`goodsport`) | teacup with sapphires | plain cup |
| Results end rows (`furniture`, `fullcabinet`) | 3D props | flat glyphs, or none where the words say it |

**Removed outright,** because the words already say it and the icons reused meanings:
- the icon beside each standings line on Between rounds and the table page (`ldr-hl`);
- the icon on Results' winner line (`lb-whl`);
- the icon in "Ana went out" (`lb-won`);
- the icons on the table page's three record tiles (`lc-tile`): the number leads instead.

After this, the green tick means only "went out", and only in the Clean hands medal.

## Gold trim
- **Buttons:**
  - Secondary buttons (cream `.kb.tonal`, outline pills) lose the gilt rim and the gem studs, taking a hairline instead.
  - The pills come down to two shapes: the main button, and a quiet text button.
- **Round icon buttons** (back, •••, rules, share): dark glass discs with a hairline instead of the gilt rim. Results' ruby discs go plain too.
- **Tab bar:** a dark tray with a hairline instead of the gilt rim. Labels are sentence case at 12px, not 9.75px caps. The gold diamond pip under the chosen tab stays: that is "where you are".
- **Avatars:** keep the player's colour ring, which identifies them. Gold stays only on the leader.
- **Sheets and paper cards:** a thin gold edge, down from 3px, so paper reads as paper.
- **Zeros** in Scores by round: plain ink, not on gold discs, so they don't read as coins.

## Copy and type that go with it
- The caps section labels become sentence-case headings, or go:
  - Stats: TABLES, HALL OF FAME, "HELD BY ANA · WON TWICE";
  - game menu: LOOK;
  - Settings: NEVER SAVED;
  - score pad: TAP CARDS.
- Secondary lines on the table cards on Play pass 4.5:1 contrast. Today they are 2.9 to 4.3.
- No functional text under 12px. This covers the tab labels, "Total" on Results, "Deals 10" in the round, and the Stats labels.

## Not changing
- The water, the suit pattern, the paper, the enamel teal and the four looks.
- The deck in code, the faces, the crest, award medals, the finale (the score-sheet finale is a separate plan), and the motion.
- The layout and flows of every screen.

## Order of work
1. **Glyphs:** add about 10 flat glyphs to the sprite, then swap every 3D icon in the table above. Remove the icons that repeat the words.
2. **Trim:** buttons, icon buttons, tab bar, sheets, zeros.
3. **Labels and contrast:** sentence-case headings, 12px floor, table card contrast.
4. **DESIGN.md:** write the gold rule in, and update Buttons, Tab bar, Lists, Sheets and the Don't list. Fix the places where it has drifted from the build.
5. **Checks:**
   - `npm test`;
   - the tap walk in WebKit at 390×664;
   - before and after shots of Play, the table page, the round, the score pad, Between rounds, Results, Stats and Settings;
   - every look (Lagoon, Game night, Lime, Cherry) and Sunlight contrast;
   - a contrast check on every changed text pair.

Then commit, and ask before pushing.
