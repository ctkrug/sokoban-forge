# Shove — design direction

## Aesthetic direction

**Warm tactile toy.** Shove is a wooden puzzle box in an espresso-dark room under amber
lamplight: chunky crates, rounded corners, soft glows, playful rounded type. Nothing corporate,
nothing flat-gray. The board is the toy and the page is its box.

## Tokens

| Token | Value | Used for |
|---|---|---|
| `--bg` | `#221a13` | page background (espresso) |
| `--surface` | `#2d2318` | cards, board frame |
| `--surface-2` | `#3a2d1f` | raised controls, hover fills |
| `--text` | `#f4e9d8` | primary text (warm cream) |
| `--muted` | `#b39c7d` | secondary text, labels |
| `--accent` | `#ffb454` | amber lamplight: wordmark, player, primary CTA, focus rings |
| `--accent-2` | `#7ddb91` | success green: targets hit, solved states |
| `--line` | `#4a3a27` | hairline borders |

Board palette (canvas): floor checker `#2a2117`/`#2e2519`, walls as top-lit blocks
(`#4a3826` face, `#5c4832` highlight, `#31251a` shadow), targets = soft amber pads with a
pulsing ring, crates `#c98a4b` wood with `#8a5a2e` braces, crate-on-target glows `--accent-2`,
player = round amber keeper `#ffb454` with dark eyes.

**Type**: display **Fredoka** (600/700) for wordmark, headings, HUD numbers; UI **Nunito Sans**
(400/600/700) for everything else. Fallback `system-ui, sans-serif`.

**Spacing** 8px scale (4 for tight gaps). **Radius** 14px cards, 10px buttons, 8px inputs.
**Shadows** deep soft (`0 10px 30px rgb(0 0 0 / .35)`) + subtle inner top-light on raised
controls. **Motion** UI 160ms ease-out; game move tween 110ms cubic-out; bump 90ms; win
celebration ~1.8s. `prefers-reduced-motion` drops tweens/confetti, keeps function.

## Layout intent

- **Desktop (1440×900):** slim header (wordmark + tagline left, GitHub link right). Main is a
  two-column grid: the **board card is the hero** (fills remaining width, canvas sized to its
  container at devicePixelRatio, ≥60vh tall) with a HUD strip (moves · crates home · difficulty)
  above and one toolbar below; a 300px sidebar stacks **How to play**, **Auto-solver**, and
  **Shortcuts** cards. No dead background seas.
- **Phone (390×844):** single column — header, HUD, board (full width), toolbar wraps, then the
  sidebar cards. Swipe on the board moves the keeper; controls stay ≥44px.

## Signature detail

**The win moment**: crates click home with a green pop; on the final one the lamp flares,
confetti falls in the board's palette, and a "Solved!" card counts the moves with one amber
**Next puzzle** CTA. Secondary flourish: a lamplight vignette on the board card.

## Juice plan (game feel)

- Movement: player + pushed crate tween 110ms cubic-out; never teleport.
- Blocked move: 90ms head-shake nudge toward the wall + quiet thump.
- Crate lands on target: scale pop + green glow + two-note chime.
- Win: confetti burst + overlay card + rising arpeggio.
- **Synth SFX (WebAudio, zero assets):** `step` soft triangle blip · `push` low square thud ·
  `target` sine chime (660→880) · `bump` tiny noise tap · `win` A-major rising arpeggio.
  Master gain ~0.5, per-effect rate-throttle, mute toggle in the toolbar persisted to
  `localStorage("shove.muted")`, AudioContext created lazily on first gesture.
