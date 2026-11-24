# Motion audit, 23 Nov 2026

**How it was checked:**
- **Played, not read.** The same game (opening, four names, seven rounds with a buy, an Out and typed scores, then each tab) was played in Safari's engine at 390 × 664 on three versions:
  - today's app;
  - the 18 Nov app, from before the move to Vite;
  - the code from before the 16 Nov rebuild.
- **Recorded.** Every animation that ran was logged on every screen.
- **Matched.** Each animation in the CSS was matched to the element that plays it, to see whether that element still appears anywhere.

## The short answer
Nothing was lost in the move to Vite or in this week's work: today's app plays exactly what the 18 Nov app played, screen for screen. The effects that went missing went earlier, on **17 Nov**, when the round was rebuilt for the table ("Rework the whole app for the table", a57416f). The new round (the faces in turn order with buy badges) replaced the old seat list. The old list's micro-interactions were never moved across. The old list is still in the code but nothing shows it.

## Lost on 17 Nov with the old round
| Effect | What it did | Where it is now |
|---|---|---|
| **May I? bump and card fly** | Tapping May I? bumped the button and flew a card back from the stock to the caller. | Code still there (`Seat`, `.flycard`, `.mayi.bump`), not shown. A buy now pops the badge only. |
| **Points float up** | A "+25" rose from a player's total as their score landed. | Code still there (`.seat-total .plus`), not shown. |
| **Totals count up** | Totals ticked up to their new value instead of jumping. | `useCount` exists, only the unused seat list calls it. Round totals now jump. |
| **The out player's card hops, with sparks** | Whoever went out got a hop and a ring of crystal sparks. | Sparks only on the Results card now. The score pad stamps Out. |

DESIGN.md's Motion section still promises all four.

## Changed on purpose
- **Background lights:** these used to drift and glow on every screen. Since the 18 Nov fixes they stand still. DESIGN.md still says they "orbit slowly", so the doc or the app needs to change to match. This needs your call.
- **The opening:** the old "intro card dealt in and flips" became the crest opening (the crest and the dealt fan) on 18 Nov.
- **Results:** the finale now shrinks into a header after about 1.7 s (23 Nov). Opening a past game from Play has never replayed the finale.

## Shown in the UI kit, never built in the app
The kit page (`docs/ui-kit.html`) demonstrates these, but the app never used them:
- a glint across buttons;
- name typing with a blinking cursor;
- the code letters hopping;
- pips lighting up;
- the house rules answers easing open;
- icon hover feels (swing, flash, hop);
- a steam curl;
- the look tile snapping in;
- a stamped "Out" and a wiggle on cards;
- a "won" chip pop.

The card scanner effects (sweep, pulse, shake, photo develop) wait for the scanner itself.

## Still working, all checked running
- **The opening:** the crest and the dealt fan.
- **Play and adding players:** face pop-ins, name roll, die roll, and the sheet rising.
- **The round:** the buy badge pop, the undo toast dropping in, the crown on the leader, and the round guide sliding in and out.
- **The score pad:** Out stamps, the hand boxes ease in.
- **Between rounds:** standings deal in, the crown lands, "nudge" plaques.
- **Results:** the card rises, the crown drops, sparks, ribbon pop, rays turning, fireworks and confetti (fresh finish or Replay), and the awards popping in.
- **Stats:** the cabinet medals and the spotlight.
- **Press feedback:** buttons press down (scale) on every screen.

**Calm** in Settings, or Reduce Motion on the phone, turns nearly all of this off, as intended.

## Recommended
1. **Done 23 Nov: brought back the four round effects in the new round.** They play once, as the next round opens after Between rounds; the card flies on every buy. The old seat list is deleted. Brought back:
   - the May I? bump and a card flying to the face that bought;
   - "+N" floating up from a face's total;
   - totals counting up after Save;
   - the out player's face hopping with sparks.

   These are the micro-interactions the round was known for, and they fit the pattern review: movement that explains a change. Then delete the unused seat list.
2. **Decide the background lights:** either drift again (slowly, never under Calm) or keep them still and fix DESIGN.md.
3. **Kit-only effects:** take only the ones that explain something (the house rules answers easing open, the look tile snapping in). Leave the decorative ones out.

## Microinteractions pass, 23 Nov 2026
Each interactive moment was checked against trigger, rules, feedback and loops. The rule for adding anything: it explains a change or marks a moment the table cares about. Frequent actions get small feedback, and rare moments get big feedback. Calm and the phone's Reduce Motion turn all of it off.

**Before: 7/10.** Every button, tile and tab already pressed down, sheets rose, and toasts dropped in. Results had a full finale. The gaps were the round (fixed in the step before this one) and a few moments with no answer at all.

**Added:**
| Moment | Trigger | Feedback | Why |
|---|---|---|---|
| A buy lands | A tap on a face | The jewel it fills lights up as the flying card arrives | It shows which buy was counted, right where the count lives |
| Last round | Round 7 opens | A gold "Last round" chip pops in beside "Round 7 of 7" | The table should feel the end coming |
| A new leader | The next round opens | The crown lands on the leader's face once Between rounds closes, so the table sees it | Before, it landed behind Between rounds, unseen |
| Every hand is in | The last score is typed | Save round gives a small "ready" bump | A system trigger: the pad is complete |
| Picking a look | A tap on a look tile | The tile snaps (uses the kit's snap) | Confirms the choice while the whole screen changes colour |
| The winner's card | A tap on it once the finale settles | It jumps, the crown bounces, the sparks fly again, with a chip sound and a haptic | A small signature moment: people tap the winner, so it should answer |

**Fixed on the way:** Calm used to apply only after the first screen drew. Opening the app straight into a round could start the count-up before Calm stopped it. Calm is now known before anything draws.

**Left out on purpose:**
- The pips sliding between rounds: they change while Between rounds covers the round, so nobody would see it.
- Sounds on every buy: a buy is the most frequent action of the night.
- The kit's decorative effects: the glint, the steam and the icon hover feels.

**Now: 9/10.** The one point short: closing a sheet still has no exit motion, and opening one does. That needs sheets to stay mounted while they slide away, which is a change across the app.
