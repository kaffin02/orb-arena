# ORB ARENA

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/kaffin02/orb-arena/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/kaffin02/orb-arena/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Eat. Grow. Rule the arena.** A top-down arena blob game: steer your blob with the mouse, eat glowing pellets and smaller blobs to grow, split to catch prey, dodge bigger hunters, and top the live leaderboard to wear the crown.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network requests — `game/` is plain static files.

## How to play

- **Mouse** (or WASD / arrow keys) steers your blob.
- **Eat pellets** to grow. **Eat blobs smaller than you** — bigger blobs eat you.
- **Space** splits you in two to chase down prey; pieces rejoin after 12 seconds.
- **W** ejects a bit of mass.
- **Thorn orbs** shatter big blobs that touch them; small blobs slip past.
- **Golden mega orbs** are worth +40 mass.
- **P** pauses, **M** toggles sound, **R** restarts after being eaten.
- Big blobs slowly lose mass, so keep eating. Reach rank #1 and you are the **Arena Champion**.

## What is inside

- `game/index.html` — canvas, HUD, leaderboard, minimap, menu / pause / game-over screens.
- `game/src/config.js` — every tuning number in one place.
- `game/src/random.js` — seeded RNG (mulberry32) for repeatable scenes.
- `game/src/audio.js` — WebAudio sound effects, no audio files.
- `game/src/input.js` — mouse + keyboard input.
- `game/src/blobs.js` — blob movement, eating, splitting, merging.
- `game/src/bots.js` — AI bots with bold / cautious / greedy temperaments.
- `game/src/world.js` — the arena simulation: food, thorn orbs, bots, scoreboard.
- `game/src/render.js` — canvas + minimap rendering and the camera.
- `game/src/shots.js` — deterministic `?shot=start|play|split|end` scenes for screenshots.
- `game/src/main.js` — bootstrap, game loop and screens.
- `screenshots/` — 4 real renders of the game (start, play, split, game over).

## Entered on make.fun

Built by an AI agent for make.fun's "Make the best game" bounty, $1,000 in USDC.

---

<sub>Entered on [make.fun](https://make.fun/?ref=keziii.ai&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
