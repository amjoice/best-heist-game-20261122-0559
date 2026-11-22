// Screenshot scenes: each one plays the real rules forward from a fresh
// job, steered by a simple autopilot, so the frame is what a short game
// really looks like and the same seed always gives the same frame.
//   title  — the title screen
//   heist  — mid-heist: the thief closing on the Sapphire, cones sweeping
//   sneak  — the thief slipping past a patrol in the gallery
//   escape — the thief at the van, Sapphire in hand
import { RUN_SPEED, SNEAK_SPEED, STEP, TILE } from './config.js';
import { hasLineOfSight, moveCircle } from './map.js';
import { SCREEN_PLAY, SCREEN_TITLE, interactionTarget, stepGame } from './game.js';
import { watcherSees } from './vision.js';

const DIRS = [];
for (let i = 0; i < 16; i += 1) {
  const a = (i / 16) * Math.PI * 2;
  DIRS.push({ x: Math.cos(a), y: Math.sin(a) });
}

/** Danger of standing at (x, y), split into parts: cones and nearby guards
 * (which may pass as patrols move) and lasers (which never pass — crossing
 * one is a calculated cost, not a wait). */
export function dangerParts(game, x, y) {
  let cone = 0;
  let laser = 0;
  for (const guard of game.guards) {
    const watcher = { x: guard.x, y: guard.y, facing: guard.facing, range: guard.range, blinded: guard.blinded };
    if (watcherSees(game.grid, watcher, x, y, game.lockedOpen, TILE, game.smokes)) cone += 1000;
    const d = Math.hypot(guard.x - x, guard.y - y);
    if (d < 70) cone += 500 - d * 5;
    if (guard.mode === 'chase') cone += 300;
  }
  for (const camera of game.cameras) {
    if (camera.blinded > 0) continue;
    const watcher = { x: camera.x, y: camera.y, facing: camera.facing, range: camera.range, blinded: 0 };
    if (watcherSees(game.grid, watcher, x, y, game.lockedOpen, TILE, game.smokes)) cone += 1000;
  }
  for (const laserBeam of game.job.lasers) {
    const x1 = laserBeam.x1 * TILE;
    const y1 = laserBeam.y1 * TILE;
    const x2 = laserBeam.x2 * TILE;
    const y2 = laserBeam.y2 * TILE;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((x - x1) * dx + (y - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const dist = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
    if (dist < 18) laser += 800;
  }
  return { cone, laser };
}

/** Danger of standing at (x, y): cones, guards, lasers. 0 is safe. */
export function dangerAt(game, x, y) {
  const parts = dangerParts(game, x, y);
  return parts.cone + parts.laser;
}

/**
 * Per-game autopilot memory, keyed by the game object so one run never
 * leaks into another. It counts consecutive steps spent waiting for a cone
 * to pass: after 3 seconds of waiting the pilot pushes through anyway —
 * a brief sighting costs little suspicion, and waiting forever costs the job.
 */
const pilotState = new WeakMap();
function stateFor(game) {
  let state = pilotState.get(game);
  if (!state) {
    state = { waitSteps: 0 };
    pilotState.set(game, state);
  }
  return state;
}

/** True when any live camera sees the position (x, y). */
function cameraSeesPos(game, x, y) {
  for (const camera of game.cameras) {
    if (camera.blinded > 0) continue;
    const watcher = { x: camera.x, y: camera.y, facing: camera.facing, range: camera.range, blinded: 0 };
    if (watcherSees(game.grid, watcher, x, y, game.lockedOpen, TILE, game.smokes)) return true;
  }
  return false;
}

/** True when the thief's centre is within 18 px of a laser beam. */
function nearLaser(game, x, y) {
  for (const laser of game.job.lasers) {
    const x1 = laser.x1 * TILE;
    const y1 = laser.y1 * TILE;
    const x2 = laser.x2 * TILE;
    const y2 = laser.y2 * TILE;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((x - x1) * dx + (y - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    if (Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)) < 18) return true;
  }
  return false;
}

function nearestTarget(game) {
  const p = game.player;
  const sapphire = game.loot.find((item) => item.required);
  if (sapphire.taken) {
    const exit = game.job.exitTiles[0];
    return { tx: exit[0], ty: exit[1], x: (exit[0] + 0.5) * TILE, y: (exit[1] + 0.5) * TILE, kind: 'exit' };
  }
  // The vault door stands between the thief and the Sapphire: head for the
  // floor tile in front of it first when it is still shut.
  if (!game.lockedOpen) {
    return { tx: 25, ty: 5, x: 25.5 * TILE, y: 5.5 * TILE, kind: 'door' };
  }
  let best = null;
  let bestDist = Infinity;
  for (const item of game.loot) {
    if (item.taken) continue;
    const d = Math.hypot(item.x - p.x, item.y - p.y);
    const weight = item.required ? 0.4 : 1;
    if (d * weight < bestDist) {
      bestDist = d * weight;
      best = item;
    }
  }
  if (!best) return { tx: 1, ty: 22, x: 1.5 * TILE, y: 22.5 * TILE, kind: 'exit' };
  return { tx: Math.floor(best.x / TILE), ty: Math.floor(best.y / TILE), x: best.x, y: best.y, kind: 'loot', item: best };
}

/** Breadth-first path over floor tiles from (sx, sy) to (tx, ty). */
export function findPath(game, sx, sy, tx, ty) {
  const key = (x, y) => `${x},${y}`;
  const prev = new Map();
  const queue = [[sx, sy]];
  prev.set(key(sx, sy), null);
  const walkable = (x, y) => {
    const code = game.grid[y]?.[x];
    if (code === undefined) return false;
    if (code === '#' || code === 'C') return false;
    if (code === 'L' && !game.lockedOpen) return false;
    return true;
  };
  while (queue.length) {
    const [x, y] = queue.shift();
    if (x === tx && y === ty) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!walkable(nx, ny) || prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), [x, y]);
      queue.push([nx, ny]);
    }
  }
  if (!prev.has(key(tx, ty))) return null;
  const path = [];
  let cur = [tx, ty];
  while (cur) {
    path.unshift(cur);
    cur = prev.get(key(cur[0], cur[1]));
  }
  return path;
}

/**
 * Probe one direction: walk it in real steps (moveCircle decides each one)
 * until 48 px are covered or the thief wedges. Returns the end position,
 * how far the thief really got, and whether the path touched a laser.
 * A 48 px probe is long enough to get past a laser beam's whole danger
 * zone, so a necessary crossing is priced as one flat cost, not as a
 * reason to stand still forever.
 */
const PROBE_DISTANCE = 48;
function probeDirection(game, dir, stepLen) {
  let x = game.player.x;
  let y = game.player.y;
  let traveled = 0;
  let touchedLaser = false;
  let first = null;
  while (traveled < PROBE_DISTANCE) {
    const moved = moveCircle(game.grid, x, y, 12, dir.x * stepLen, dir.y * stepLen, game.lockedOpen, TILE);
    const d = Math.hypot(moved.x - x, moved.y - y);
    if (d < 0.05) break; // wedged against a wall or a corner
    if (first === null) first = { x: moved.x, y: moved.y };
    traveled += d;
    x = moved.x;
    y = moved.y;
    if (nearLaser(game, x, y)) touchedLaser = true;
  }
  return { x, y, traveled, touchedLaser, first: first ?? { x, y } };
}
export function autopilotInput(game) {
  const p = game.player;
  const pilot = stateFor(game);
  const target = nearestTarget(game);
  const input = { moveX: 0, moveY: 0, sneak: false, interact: false, smoke: false, jammer: false, pause: false };

  // Spend a jammer when a camera has the thief in its cone.
  for (const camera of game.cameras) {
    if (camera.blinded <= 0 && camera.seesThief && game.player.jammer > 0) {
      input.jammer = true;
    }
  }
  // Spend smoke when a guard is chasing and close.
  for (const guard of game.guards) {
    if (guard.mode === 'chase' && Math.hypot(guard.x - p.x, guard.y - p.y) < 130 && game.player.smoke > 0) {
      input.smoke = true;
    }
  }

  // Channel when an interaction is in reach and the spot is safe enough.
  const near = interactionTarget(game);
  if (near && dangerAt(game, p.x, p.y) < 1000) {
    input.interact = true;
    return input;
  }

  // Sneak when a watcher is near — but never while crossing a laser: the
  // crossing is paid per second, so it is crossed running.
  let nearestWatcher = Infinity;
  for (const guard of game.guards) {
    nearestWatcher = Math.min(nearestWatcher, Math.hypot(guard.x - p.x, guard.y - p.y));
  }
  for (const camera of game.cameras) {
    if (camera.blinded <= 0) nearestWatcher = Math.min(nearestWatcher, Math.hypot(camera.x - p.x, camera.y - p.y));
  }
  const sneakNearWatcher = nearestWatcher < 200 || dangerParts(game, p.x, p.y).cone > 0;
  input.sneak = sneakNearWatcher;

  // Follow the path: take the furthest waypoint on it that the thief can
  // see in a straight line, so the walk cuts corners instead of zig-zagging.
  const startTx = Math.floor(p.x / TILE);
  const startTy = Math.floor(p.y / TILE);
  const path = findPath(game, startTx, startTy, target.tx, target.ty);
  let waypoint = { x: target.x, y: target.y };
  if (path && path.length > 1) {
    let far = 1;
    for (let i = 2; i < path.length; i += 1) {
      const wx = (path[i][0] + 0.5) * TILE;
      const wy = (path[i][1] + 0.5) * TILE;
      if (hasLineOfSight(game.grid, p.x, p.y, wx, wy, game.lockedOpen, TILE)) far = i;
      else break;
    }
    waypoint = { x: (path[far][0] + 0.5) * TILE, y: (path[far][1] + 0.5) * TILE };
  }

  // Choose the direction that gets closest to the waypoint for the least
  // danger. Each candidate is probed 48 px — far enough to get past a
  // laser beam — and scored at the far end, so a direction that wedges the
  // thief against a corner scores as no progress at all and loses to one
  // that actually moves, and a necessary laser crossing is priced once,
  // not as a reason to stand still forever. Cone danger at the far end
  // weighs far more than a laser touched on the way: a cone that is coming
  // will pass if the thief waits, a laser is crossed, not waited out.
  const hereParts = dangerParts(game, p.x, p.y);
  const stepLen = (input.sneak ? SNEAK_SPEED : RUN_SPEED) * STEP;
  let bestDir = null;
  let bestScore = Infinity;
  let bestProbe = null;
  for (const dir of DIRS) {
    const probe = probeDirection(game, dir, stepLen);
    const dist = Math.hypot(waypoint.x - probe.x, waypoint.y - probe.y);
    const endParts = dangerParts(game, probe.x, probe.y);
    const stuckPenalty = probe.traveled < 2 ? 60 : 0;
    const score = dist + endParts.cone * 3 + (probe.touchedLaser ? 30 : 0) + stuckPenalty;
    if (score < bestScore) {
      bestScore = score;
      bestDir = dir;
      bestProbe = probe;
    }
  }
  // Wait where it is safe rather than step into a cone: standing still wins
  // when the very next step would enter a patrolling watcher's cone and
  // staying put is outside one. A laser never earns a wait, and a chase
  // never earns one either: a chasing guard comes to the thief. But the
  // wait has a budget — after 3 seconds of it the pilot pushes through:
  // a brief sighting costs little suspicion, and waiting forever costs
  // the job. And a camera's cone is jammed, not waited out: if the step
  // ahead is watched by a camera and a jammer is left, fire it and walk.
  const chasing = game.guards.some((guard) => guard.mode === 'chase');
  const firstParts = bestProbe ? dangerParts(game, bestProbe.first.x, bestProbe.first.y) : hereParts;
  let coneWait = !chasing && firstParts.cone > 0 && hereParts.cone === 0 && pilot.waitSteps <= 180;
  if (coneWait && game.player.jammer > 0 && bestProbe && cameraSeesPos(game, bestProbe.first.x, bestProbe.first.y)) {
    input.jammer = true;
    coneWait = false;
    pilot.waitSteps = 0;
  }
  if (coneWait) {
    pilot.waitSteps += 1;
  } else {
    pilot.waitSteps = 0;
  }
  if (bestDir && !coneWait && bestProbe && bestProbe.traveled >= 2) {
    input.moveX = bestDir.x;
    input.moveY = bestDir.y;
    // Cross a laser running: the alarm is paid per second on the beam.
    if (bestProbe.touchedLaser) input.sneak = false;
  }
  return input;
}

/** Play the autopilot forward until `stop(game)` is true or time runs out. */
export function simulate(game, maxSeconds, stop) {
  const maxSteps = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < maxSteps; i += 1) {
    if (game.screen !== SCREEN_PLAY) break;
    if (stop && stop(game)) break;
    stepGame(game, autopilotInput(game));
  }
  return game;
}

const NEAR_EXIT = (game) => {
  const sapphire = game.loot.find((item) => item.required);
  if (!sapphire || !sapphire.taken) return false;
  const p = game.player;
  const exit = game.job.exitTiles[0];
  return Math.hypot(p.x - (exit[0] + 0.5) * TILE, p.y - (exit[1] + 0.5) * TILE) < 40;
};

/**
 * Set `game` to the named scene and return the screen to draw over it.
 * The game must already be a fresh job-1 game on the play screen.
 */
export function stageShot(name, game) {
  game.screen = SCREEN_PLAY;
  if (name === 'title') {
    game.screen = SCREEN_TITLE;
    return { screen: SCREEN_TITLE };
  }
  if (name === 'heist') {
    simulate(game, 15, null);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'sneak') {
    simulate(game, 9, null);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'escape') {
    simulate(game, 180, NEAR_EXIT);
    return { screen: SCREEN_PLAY };
  }
  simulate(game, 20, null);
  return { screen: SCREEN_PLAY };
}
