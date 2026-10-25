# May I? Ground-up rebuild: design

## Intent
A scorekeeper you run from one phone at the table during a family game of May I?
(contract rummy). It should feel like one coherent, premium product. It should be
fun but calm, readable in sunlight, and almost free of reading.

## Decisions
| Area | Decision |
|---|---|
| Core job | Scorekeeper first. Rules appear in context, never as walls of text. |
| Structure | One **Table** screen. Everything else opens as a sheet from it. |
| Identity | Signature look **Tactile Card Table**: light warm base, felt-green round band, player cards styled as real cards, springy calm motion, celebration only on big moments. |
| Looks | The signature look (auto light/dark) plus packs: **Salon**, **Candy**, **Lagoon**, and **Surprise me**. Packs swap tokens and art only; the layout is fixed. Packs may later be paid extensions. |
| Kept | Hand counter, insights and awards, celebration results, undo, swipe-to-close sheets, house rules, tip jar. |
| Cut (v1) | AI card scan, hand helper, the experience-level setting, the long Rules tab. |
| Data | Same storage keys and shape (`mayi:game:v4`, `mayi:history:v1`), so games in progress survive. Old theme names map to the new looks. |

## Screens
- **Setup**: wordmark, players (add; tap a player to make them first dealer),
  a one-line house-rules summary, a look picker and a sticky Deal In button.
  A "How to play" link opens the Rules sheet.
- **Table**
  - Felt band: "Round N of 7", the round name, example melds as mini cards,
    progress pips and a dealer chip. Tapping the band opens the round's rules.
    Buttons for Standings and Settings.
  - Player cards grid:
    - In the **Play** phase each card shows the name, total, dealer mark and buys
      (pips and a "May I?" button).
    - In the **Score** phase each card shows a large score field, an Out toggle
      and a hand-counter button.
  - Bottom dock: "Score round", then "Next round" once every player is scored.
- **Round intro**: a card that animates in at the start of each round (round,
  contract melds, dealer, one tip). Tap to dismiss, or it dismisses itself.
- **Standings sheet**: ranking, awards strip, "still in it" lines, card stats,
  and a round-by-round grid.
- **Rules sheet**: This round / How to play / House rules. One line per idea.
- **Settings sheet**: looks gallery, house rules, new game, tip jar.
- **Counter sheet**: card keypad, hand as mini cards, total, Give / Went out.
- **Results**: fireworks, podium, awards, Share, Play again.

## Rules carried over
- Only one player can be Out per round. When everyone else has a score, the last
  player is marked Out automatically.
- Starting the next round can be undone from the toast.
- Dealer for each round is computed as (first dealer + round).

## Quality bar
44pt touch targets, Dynamic Type through rem units, reduced-motion support, and
WCAG AA text contrast. Tablet layout uses 3–4 card columns.
