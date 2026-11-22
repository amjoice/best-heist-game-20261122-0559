// The Meridian Job: the game itself. A state machine over one job — title,
// play, paused, caught, escaped — that owns the world (grid, thief,
// guards, cameras, loot, alarm) and advances it in fixed 1/60 s steps.
//
// The rules, in one place:
//   - Steal the Star Sapphire, then reach the van at the entrance.
//     Other loot is optional score; the Sapphire is the job.
//   - Guards patrol with vision cones. Seen in a cone, a guard grows
//     suspicious; a full suspicion gives chase, and a touch ends the job.
//   - Cameras sweep and feed the alarm. Hack the security terminal or fire
//     a jammer to blind them. Smoke breaks every line of sight.
//   - The alarm rises while any watcher sees the thief and falls while
//     hidden. At 65 every guard hunts; at 100 the gallery locks down.
//   - Lasers (job 3) feed the alarm while the thief crosses them.
//   - The vault door is picked, not forced: hold Space beside it.
//   - Score is loot value, plus a ghost bonus for never being spotted,
//     plus a time bonus against the job's par time.
import {
  ALARM_DECAY,
  ALARM_GAIN_LASER,
  ALARM_GAIN_SEEN,
  ALARM_LOCKDOWN_AT,
  GHOST_BONUS,
  HACK_DISABLE_SECONDS,
  HACK_SECONDS,
  JAMMER_SECONDS,
  LOOT_SECONDS,
  PICK_SECONDS,
  SMOKE_RADIUS,
  SMOKE_SECONDS,
  STEP,
  TILE,
  TIME_BONUS_PER_SECOND,
} from './config.js';
import { COVER_TILES, MAP_ROWS, parseMap, tileCenter } from './map.js';
import { JOBS } from './jobs.js';
import { makeGuard, stepGuard } from './guards.js';
import { cameraSeesThief, makeCamera, stepCamera } from './cameras.js';
import { lootValue, makeLoot, requiredLootTaken } from './loot.js';
import { makePlayer, stepPlayer } from './player.js';
import { segmentHitsCircle } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_ESCAPED = 'escaped';

/** Build a fresh game for job `jobIndex` (0-based). */
export function makeGame(jobIndex, seed) {
  const job = JOBS[jobIndex];
  const grid = parseMap(MAP_ROWS, COVER_TILES);
  const game = {
    jobIndex,
    job,
    seed: seed ?? job.seed,
    grid,
    screen: SCREEN_TITLE,
    player: makePlayer(job.playerStart),
    guards: job.guards.map(makeGuard),
    cameras: job.cameras.map(makeCamera),
    loot: job.loot.map(makeLoot),
    smokes: [], // { x, y, radius, ttl }
    jammerTimer: 0,
    alarm: 0,
    lockdown: false,
    lockedOpen: false,
    time: 0,
    spotted: false,
    spotCount: 0,
    score: 0,
    scoreParts: null,
    message: null, // { text, ttl }
    channel: null, // { kind, target, progress }
    catchGuard: null,
    best: 0,
  };
  return game;
}

/** Reset the game to a fresh run of the same job (keeps the best score). */
export function resetGame(game) {
  const best = game.best;
  const fresh = makeGame(game.jobIndex, game.seed);
  fresh.best = best;
  fresh.screen = SCREEN_PLAY;
  return fresh;
}

function toast(game, text, seconds = 2.5) {
  game.message = { text, ttl: seconds };
}

/** The vault door's identity, stable across calls so a pick channel is not reset by a fresh object. */
const VAULT_DOOR = { kind: 'door', tx: 26, ty: 5 };

/** The nearest thing the thief can interact with right now, or null. */
export function interactionTarget(game) {
  const p = game.player;
  if (game.screen !== SCREEN_PLAY) return null;
  // Loot within reach.
  for (const item of game.loot) {
    if (item.taken) continue;
    if (Math.hypot(item.x - p.x, item.y - p.y) < 46) {
      return { kind: 'loot', target: item, label: `Pocket ${item.name}` };
    }
  }
  // The security terminal.
  const term = tileCenter(game.job.terminal.tx, game.job.terminal.ty, TILE);
  if (Math.hypot(term.x - p.x, term.y - p.y) < 52) {
    return { kind: 'hack', target: game.job.terminal, label: 'Hack cameras' };
  }
  // The locked vault door.
  if (!game.lockedOpen) {
    const door = tileCenter(VAULT_DOOR.tx, VAULT_DOOR.ty, TILE);
    if (Math.hypot(door.x - p.x, door.y - p.y) < 56) {
      return { kind: 'pick', target: VAULT_DOOR, label: 'Pick the vault door' };
    }
  }
  return null;
}

function channelSeconds(kind) {
  if (kind === 'loot') return LOOT_SECONDS;
  if (kind === 'hack') return HACK_SECONDS;
  return PICK_SECONDS;
}

function finishChannel(game, channel) {
  if (channel.kind === 'loot') {
    channel.target.taken = true;
    toast(game, `${channel.target.name} pocketed — $${channel.target.value}`);
  } else if (channel.kind === 'hack') {
    for (const camera of game.cameras) camera.blinded = HACK_DISABLE_SECONDS;
    toast(game, `Cameras dark for ${HACK_DISABLE_SECONDS}s`);
  } else if (channel.kind === 'pick') {
    game.lockedOpen = true;
    toast(game, 'Vault door picked — the Sapphire is open');
  }
}

/** True when the thief's centre crosses a laser beam. */
function onLaser(game) {
  const p = game.player;
  for (const laser of game.job.lasers) {
    const x1 = laser.x1 * TILE;
    const y1 = laser.y1 * TILE;
    const x2 = laser.x2 * TILE;
    const y2 = laser.y2 * TILE;
    if (segmentHitsCircle(x1, y1, x2, y2, p.x, p.y, 10)) return true;
  }
  return false;
}

/** True when the thief stands on one of the exit tiles. */
function onExit(game) {
  const tx = Math.floor(game.player.x / TILE);
  const ty = Math.floor(game.player.y / TILE);
  return game.job.exitTiles.some(([ex, ey]) => ex === tx && ey === ty);
}

function computeScore(game) {
  const loot = lootValue(game.loot);
  const ghost = game.spotted ? 0 : GHOST_BONUS;
  const timeBonus = Math.max(0, Math.floor(game.job.parSeconds - game.time)) * TIME_BONUS_PER_SECOND;
  const total = loot + ghost + timeBonus;
  return { loot, ghost, timeBonus, total };
}

/**
 * Advance the game by one fixed step. `input` is a plain snapshot:
 * { moveX, moveY, sneak, interact, smoke, jammer, pause } where smoke,
 * jammer and pause are edge-triggered (true only on the frame pressed).
 */
export function stepGame(game, input) {
  if (game.screen === SCREEN_PAUSED) {
    if (input.pause) game.screen = SCREEN_PLAY;
    return;
  }
  if (game.screen !== SCREEN_PLAY) return;
  if (input.pause) {
    game.screen = SCREEN_PAUSED;
    return;
  }

  const dt = STEP;
  game.time += dt;
  if (game.message) {
    game.message.ttl -= dt;
    if (game.message.ttl <= 0) game.message = null;
  }
  game.jammerTimer = Math.max(0, game.jammerTimer - dt);
  for (const smoke of game.smokes) smoke.ttl -= dt;
  game.smokes = game.smokes.filter((smoke) => smoke.ttl > 0);

  // Tools: edge-triggered, one press each.
  if (input.smoke && game.player.smoke > 0) {
    game.player.smoke -= 1;
    game.smokes.push({ x: game.player.x, y: game.player.y, radius: SMOKE_RADIUS, ttl: SMOKE_SECONDS });
    toast(game, 'Smoke out — they cannot see through it');
  }
  if (input.jammer && game.player.jammer > 0) {
    game.player.jammer -= 1;
    game.jammerTimer = JAMMER_SECONDS;
    for (const camera of game.cameras) camera.blinded = Math.max(camera.blinded, JAMMER_SECONDS);
    toast(game, `Cameras jammed for ${JAMMER_SECONDS}s`);
  }

  // Interaction channels: standing still and holding Space fills one;
  // moving or letting go drops it.
  const target = interactionTarget(game);
  if (target && input.interact && !game.player.moving) {
    if (!game.channel || game.channel.kind !== target.kind || game.channel.target !== target.target) {
      game.channel = { kind: target.kind, target: target.target, progress: 0 };
    }
    game.channel.progress += dt / channelSeconds(target.kind);
    if (game.channel.progress >= 1) {
      finishChannel(game, game.channel);
      game.channel = null;
    }
  } else {
    game.channel = null;
  }

  // Movement (channels hold the thief still).
  if (!game.channel) {
    stepPlayer(game.player, { x: input.moveX, y: input.moveY, sneak: input.sneak }, dt, game.grid, game.lockedOpen);
  } else {
    game.player.moving = false;
    game.player.running = false;
    game.player.sneaking = false;
  }

  // Cameras sweep; guards patrol, suspect and chase.
  const world = {
    grid: game.grid,
    lockedOpen: game.lockedOpen,
    thief: game.player,
    smokes: game.smokes,
    alarm: game.alarm,
  };
  let seenByAny = false;
  for (const camera of game.cameras) {
    stepCamera(camera, dt);
    if (cameraSeesThief(camera, world)) seenByAny = true;
  }
  for (const guard of game.guards) {
    const result = stepGuard(guard, dt, world);
    if (guard.seesThief) seenByAny = true;
    if (result === 'caught') {
      game.screen = SCREEN_CAUGHT;
      game.catchGuard = guard.name;
      game.scoreParts = computeScore(game);
      game.score = game.scoreParts.total;
      game.best = Math.max(game.best, game.score);
      return;
    }
  }

  // Spotted: the first time any watcher sees the thief, the ghost is gone.
  if (seenByAny && !game.spotted) {
    game.spotted = true;
    game.spotCount += 1;
  }

  // The alarm: rises while seen or crossing a laser, falls while hidden.
  const laser = onLaser(game);
  if (seenByAny || laser) {
    game.alarm += (seenByAny ? ALARM_GAIN_SEEN : 0) * dt + (laser ? ALARM_GAIN_LASER : 0) * dt;
  } else {
    game.alarm -= ALARM_DECAY * dt;
  }
  game.alarm = Math.max(0, Math.min(ALARM_LOCKDOWN_AT, game.alarm));
  if (game.alarm >= ALARM_LOCKDOWN_AT && !game.lockdown) {
    game.lockdown = true;
    toast(game, 'LOCKDOWN — every guard is hunting you', 3);
  }
  if (game.alarm < 50) game.lockdown = false;

  // Escape: the Sapphire in hand, standing on the van.
  if (requiredLootTaken(game.loot) && onExit(game)) {
    game.screen = SCREEN_ESCAPED;
    game.scoreParts = computeScore(game);
    game.score = game.scoreParts.total;
    game.best = Math.max(game.best, game.score);
  }
}

/** Buttons on the current screen, for mouse hit-testing in main.js. */
export function screenButtons(game) {
  const cx = 640;
  if (game.screen === SCREEN_TITLE) {
    return [
      { id: 'job-0', x: cx - 360, y: 430, w: 220, h: 120 },
      { id: 'job-1', x: cx - 110, y: 430, w: 220, h: 120 },
      { id: 'job-2', x: cx + 140, y: 430, w: 220, h: 120 },
    ];
  }
  if (game.screen === SCREEN_CAUGHT) {
    return [
      { id: 'retry', x: cx - 230, y: 480, w: 220, h: 64 },
      { id: 'title', x: cx + 10, y: 480, w: 220, h: 64 },
    ];
  }
  if (game.screen === SCREEN_ESCAPED) {
    return [
      { id: 'again', x: cx - 230, y: 560, w: 220, h: 64 },
      { id: 'title', x: cx + 10, y: 560, w: 220, h: 64 },
    ];
  }
  if (game.screen === SCREEN_PAUSED) {
    return [
      { id: 'resume', x: cx - 230, y: 440, w: 220, h: 64 },
      { id: 'title', x: cx + 10, y: 440, w: 220, h: 64 },
    ];
  }
  return [];
}

/** Act on a clicked button id; returns a fresh game when the job changes. */
export function pressButton(game, id) {
  if (id === 'job-0' || id === 'job-1' || id === 'job-2') {
    const index = Number(id.slice(4));
    const next = makeGame(index, JOBS[index].seed);
    next.screen = SCREEN_PLAY;
    next.best = game.best;
    return next;
  }
  if (id === 'retry' || id === 'again') return resetGame(game);
  if (id === 'resume') {
    game.screen = SCREEN_PLAY;
    return game;
  }
  if (id === 'title') {
    const next = makeGame(game.jobIndex, game.seed);
    next.best = game.best;
    return next;
  }
  return game;
}

/** Keyboard shortcuts that change screens (title select, restart, resume). */
export function pressKey(game, code) {
  if (game.screen === SCREEN_TITLE) {
    if (code === 'Digit1') return pressButton(game, 'job-0');
    if (code === 'Digit2') return pressButton(game, 'job-1');
    if (code === 'Digit3') return pressButton(game, 'job-2');
  }
  if (game.screen === SCREEN_CAUGHT || game.screen === SCREEN_ESCAPED) {
    if (code === 'KeyR' || code === 'Enter') return resetGame(game);
    if (code === 'Escape') return pressButton(game, 'title');
  }
  if (game.screen === SCREEN_PAUSED && code === 'Escape') {
    game.screen = SCREEN_PLAY;
  }
  return game;
}
