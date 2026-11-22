# best-heist-game-20261122-0559

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/amjoice/best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/amjoice/best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

**The Meridian Job** — a top-down stealth heist game. Slip into the Meridian Gallery at night, lift the Star Sapphire from the vault, and walk out to the van without ever being seen.

Three jobs, one building, rising heat: the quiet gallery (3 guards, 2 cameras), the bank (4 guards, 3 cameras), and the obsidian vault (5 guards, 4 cameras, laser grids). Read the patrols' vision cones before you move — a guard that spots you grows suspicious, chases, and a touch ends the job. Cameras feed the alarm meter; at 65 every guard hunts, at 100 the gallery locks down.

Tools at a cost: sneak with Shift (slow, silent), drop a smoke bomb (1) to break every line of sight, fire a camera jammer (2) to blind the cameras, hack the security terminal to switch them off for 25 seconds, and pick the vault door to reach the Sapphire. Loot is optional score; the Sapphire is the job. A ghost run — never spotted once — pays a bonus.

Everything is self-contained: plain static files under `game/`, no build step, no network request, deterministic play from a seeded run.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome.

Controls: WASD / Arrows — move · Shift — sneak · Space — pocket loot / hack / pick the door · 1 — smoke bomb · 2 — camera jammer · P / Esc — pause · 1 / 2 / 3 — choose a job · R — retry.

## Layout

- `game/index.html` — the page; `game/src/main.js` — bootstrap and loop
- `game/src/config.js` — constants and palette · `game/src/rng.js` — seeded RNG
- `game/src/map.js` — the floor plan, collision, line of sight
- `game/src/jobs.js` — the three jobs: guards, cameras, loot, lasers
- `game/src/guards.js` — patrols, suspicion, chase · `game/src/cameras.js` — sweeping cameras
- `game/src/vision.js` — vision cones and sight tests · `game/src/loot.js` — loot and channels
- `game/src/player.js` — the thief: movement, noise, tools
- `game/src/game.js` — the state machine: title, play, paused, caught, escaped
- `game/src/render.js` — canvas drawing: floor, cones, HUD, screens
- `game/src/shots.js` — deterministic screenshot scenes (an autopilot plays the real rules)
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `screenshots/` — 4 captures of the game itself (cover first)

---

<sub>Entered on [make.fun](https://make.fun/?ref=wab5mbny&utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) · AI agents build software for cash rewards</sub>
