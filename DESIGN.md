# Design: May I? · "Game Night"

Recorded from the built app (index.html, v7). Mode: Operate. A family board-game box in your pocket: bright, chunky and friendly, closer to a toy shelf than a casino. The game screen is a dotted colour band with the contract dealt as real cards, and the players sit in one clean card. Everything around it stays plain iOS, so the colour only lands where the game is.

## Looks
Five looks, chosen in Settings and stored per device (`mayi:settings:v6`; the old ids are kept so saved choices still work). `applyLook()` writes the tokens as CSS variables on `<html>` before the first paint and follows the system dark mode.

| Look (id) | Band | Ground (light) | Accent | Dark mode |
|---|---|---|---|---|
| Game night (`table`) | #2A5BEA → #1A3BC0 | #EAF0FF | #2152E0 | navy ground #0C1230 |
| Lime (`lime`) | #8ED245, dark ink #123015 | pale green | deep green | dark green ground |
| Lagoon (`midnight`) | #08808A teal | pale aqua | teal, coral | dark teal ground |
| Cherry (`parlour`) | #D42445 | pale pink | cherry | dark wine ground |
| Daylight (`daylight`) | white with a 2px black frame | #FFFFFF | #000000 | no, built for sunlight |

Every colour look shares the same candy CTA: sunny yellow #FFC83D with a lighter top (#FFE07E), an amber lower edge (#E09A00) and navy text (#1B2150). Daylight uses a black CTA. Band surfaces (the game band, the heroes, the finale and the TV scoreboard) are dotted fields: two offset layers of soft white dots over a vertical gradient, with a soft lip along the bottom. Each look's card back (`--back`) is its band colour with white dots and a white rim. Behind every screen drifts a loose confetti of coloured suits and dots at 9% opacity. Daylight drops the dots for plain white with black frames. "Surprise me" rolls through the looks, and "New look each time" opens the app on a different one every launch.

## Colors
Tokens: `--bg`, `--surface`, `--fill`, `--line`, `--ink` / `--ink2` / `--ink3`, `--band` / `--band2` / `--band-ink`, `--accent` / `--accent-ink` / `--accent-soft`, `--cta` / `--cta-hi` / `--cta-edge` / `--cta-ink`, `--gold` / `--gold-ring` / `--gold-soft` (leader only), `--out` / `--out-soft` (went out), `--red`, `--focus`. Text pairs meet 4.5:1 in every look. Peg colours (red, blue, green, amber, purple, teal, pink, orange) identify a player for life and never mean anything else. Gold, silver and bronze appear only on crowns and podium blocks.

## Typography
System SF (`-apple-system`) for everything you read or tap, with Dynamic Type through `font: -apple-system-body`. Numbers use `ui-rounded` with tabular figures. Baloo 2 (600–800, Google Fonts) only for display: large titles (800), the contract name, the round-intro card, the recap headline, sheet titles and the share image. Its round, chunky letters carry the family-game voice. No eyebrow labels.

## Shape and depth
Inset grouped lists: radius 14, 56px rows, hairline separators inset to the text. Seats card: radius 22. Heroes: radius 26. Buttons: 50/56px, radius 13/16. Primary buttons are candy: a yellow gradient with an inset white highlight on top and an inset amber lip below (`inset 0 2px 0 rgba(255,255,255,.55), inset 0 -4px 0 var(--cta-edge)`). They press down a few pixels and never cast an outer shadow. Tonal buttons have the same inset lip in their own tint. Avatars on colour get a 3px white rim and a short soft shadow. Depth otherwise belongs only to playing cards, the floating sheet and the toast.

## Components
- **Tab bar:** Play, Learn and Stats on the three top-level screens. Learn holds the whole guide (rounds, basics, Q&A, house rules). Stats is the trophy room: who has won each award most often across all games, and every table's leader. Pushed screens (a table, a game, results) have a back button and no tab bar.
- **Page:** a large Baloo 2 title that collapses into a blurred 48px nav bar after 44px of scroll. The nav holds back, title and up to two icons.
- **Band (game):** a dotted field in the look's colour. Back with the group name; gear (game settings); screen icon (scoreboard, wide screens only); "Round n of 7", contract name, mini meld cards; pips, dealer tag, "Rules ›". Tapping the contract is the only way into the rules.
- **Seat:** 42px avatar (gold ring if leading, gold "D" if dealing, and a tilted crown numbered 1, 2 or 3 in gold, silver or bronze once a round is scored; ties share a medal), name, status line ("Leading", "12 behind"), this round's "+12" or "Out" chip (tap to edit), count-up total, "May I?" buy pill with one dot per allowed buy.
- **Dock:** a single primary button for the next step: Score round n, Keep scoring, Next round, or See who won.
- **Score pad:** player strip, big display, Type points / Tap cards / Photo, keypad, Went out (one per round), Save · next player. Photo is its own tab: it takes or chooses a photo, and the first time it asks for the API key right there.
- **Players in this game:** "Add or remove" in the seats header. Add someone from the table or a new name; missed rounds count as each round's highest score (or zero). Removing someone acts at once with Undo. Whoever is dealing keeps the deal.
- **Round intro:** the next contract on a giant 5:7 playing card (white face, an inner rim in the look's colour, corner indices), dealer and tip; Undo round n and Let's play; closes itself after 4.6s.
- **Recap:** a dotted finale with the date in a white pill, the Baloo winner, a podium (2, 1, 3) with gold, silver and bronze blocks and a crown over each place, then lists for the rest of the field, highlights and the round grid. Share (nav bar) makes a 1080×1350 image in the current look.
- **Round strip:** seven tiles under the band. The current round is filled with the accent, finished rounds show the colour of whoever went out, and tapping a finished round opens the score pad as "Fix round n". The dock is the only way to score the current round.
- **Undo toast:** ending, deleting a game and deleting a table act at once and show a toast with Undo for 6 seconds. Nothing asks twice.
- **Round guide (Rules sheet):** tabs Rounds, Basics, Q&A, House. A round shows the contract card with its goal and card maths, then Watch out (gold callout), After you go down, Tips, and Pro tips (open for seasoned players). Basics uses numbered step timelines. Every house rule shows a live hint and a "Why?" note.
- **Coaching level:** asked once after the first deal ("Have you played before?"). Learners get the round guide at the start of every round. It can be changed in Settings.
- **Card scanner:** the score pad's Photo tab takes a photo and fills the hand with suited cards. Cards the reader guessed get a gold outline so they get a second look. It uses the player's own Anthropic API key, set in Settings and stored on that device only.
- **Hand coach:** at the bottom of the current round's guide. A private photo of your hand returns what Claude sees, what you have, what to aim for, keep, discard and one tip.
- **Still in it:** under the seats between rounds, one row per trailing player with the gap, the rounds left and the margin needed each round. Seats show "▲ up 2" or "▼ down 1" after each round.
- **Award race:** under the seats once two rounds are done, a row of chips showing who would win each award if the game ended now.
- **Table podium:** the table page hero shows the top three by wins on a podium (2, 1, 3), each tappable for their profile.
- **Race track:** racing pegs on lanes filled with a pastel of each player's colour, with the lowest total nearest the chequered finish. It appears on the results screen, and fills the TV scoreboard on wide screens.
- **Awards (six):** Clean hands, Bargain hunter, Comeback kid, Steady hand, Heavy pockets and Joker juggler. Nobody gets one on a tie. Gold tiles, or green for the positive ones.
- **What got people caught:** points by card type as bars, plus the most caught card, the toughest round and a heavy-buying warning. It needs counted cards.
- **Profiles:** tap a player in the standings to see eight stat tiles, the awards they've won and head-to-head records. The table page also shows records.
- **Heroes:** Home and the table page open on a dotted hero with a soft lip along its bottom edge. Home shows the title, a one-line status and a fanned hand with one card face down. The table page shows the champion with a crown, or the players and a prompt before the first game.
- **Round intro flip:** the card is dealt face down in the look's card back, then turns over to reveal the contract.
- **Roll for dealer:** a link in the New game sheet's header. The dealer chip hops between players and slows to a stop.
- **Sounds:** short WebAudio tones (tap, chip, save, deal, out and a winner's fanfare), on by default with a switch in Settings. Haptics stay on regardless.
- **Avatars:** every player is initials, a photo or a drawn character, always on their own colour, with a white rim on coloured surfaces. Characters are Avataaars (Pablo Stanley's free illustration set, drawn with DiceBear, MIT): real human faces with 12 eyes, 11 brows and 11 mouths, so a player can be grinning, winking, heart-eyed or dizzy. In Edit players, each circle carries a small pencil badge; tapping it opens the avatar maker. It works like a character editor and never scrolls on a phone. Initials / Photo / Character sit at the top, and a large live preview stays pinned below them. In Character mode a row of category tabs (Hair, Hats, Hair colour, Skin, Eyes, Brows, Mouth, Beard, Glasses, Clothes, Clothes colour, Colour) opens a single grid where every option is drawn on the player's own character. A die button in the preview shuffles a random character, always with a happy face. Old drawn characters are converted on load. Photo offers Take, Choose and Paste: copy a Memoji sticker on iPhone and paste it in. A transparent background shows the player's colour. Drag and zoom to frame it; it's saved as a 192px JPEG, about 5–10 KB. Avatars show everywhere a player does, including the share image.
- **Sheets:** bottom sheets on phones (swipe down, scrim, Escape), centred at 700px and up. Every overlay (sheets, the round intro, toasts, confetti) renders on `<body>`, so a sheet opened from a sheet always lands on top. The page behind is locked while a sheet is open, and sheets follow the visual viewport so the keyboard never covers a field.
- **Card points:** ace and joker points are their own house rules (default 15 and 15), separate from where aces sit in runs. Games from before this keep their old scoring.
- **Playing now:** sunny yellow with navy text on every colour look, the same yellow as the main buttons, because it is the thing to tap. Play again (after a game) is a plain card.
- **Credits:** the end of Settings credits Avataaars, DiceBear and Baloo 2.
- **Sharing (paused):** Share and Join show a "Next release" badge and explain what's coming. Live sharing needs the sync server.

## Layout
Content max 720px. At 900px and up the game shows seats on the left and the round grid on the right, the Rules sheet lists the rounds by name beside the guide, and Home and the table page widen to 1040px in two columns: the hero spans both, then Playing now beside Tables, and Standings beside Records. Scoreboard mode fills the screen with the band and large seats.

## Motion
`--out-e: cubic-bezier(.16,.84,.3,1)` and `--spring: cubic-bezier(.34,1.3,.64,1)`. Seats rise in a stagger, totals count up, the intro card is dealt in with a spring and flips face up, the May I? pill pops on each buy, buttons press down, and confetti, with suits mixed in, plays on a fresh recap only. The background confetti drifts very slowly. Everything collapses under `prefers-reduced-motion`.

## Testing
`npm test` runs unit tests against the real script in index.html (rules, scoring, stats, coaching content). `tests/lab.html` plays scripted scenarios at small phone, phone, tablet portrait, tablet landscape and TV sizes, and checks for sideways scrolling, clipped text and tap targets under 44px.

## Don't
Two controls for one action. Deep or offset shadows on buttons. Felt, gold hairlines or anything else that reads as a casino. Gradient text. Emoji icons. Fonts beyond SF and Baloo 2. Copying another game's branding or characters. Colour that isn't a look token, a player or a state.
