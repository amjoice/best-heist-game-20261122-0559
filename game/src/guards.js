// Guards: they walk a patrol loop, pause at each waypoint to look around,
// and grow suspicious when the thief crosses their vision cone. A guard
// whose suspicion fills gives chase; a chasing guard that touches the thief
// ends the job. A guard that loses the thief for a while gives up and walks
// back to its patrol.
import {
  CATCH_RADIUS,
  CHASE_GIVE_UP_SECONDS,
  GUARD_VIEW_RANGE,
  RUN_HEAR_RADIUS,
  SUSPICION_DECAY,
  SUSPICION_GAIN_FAR,
  SUSPICION_GAIN_NEAR,
  SUSPICION_GAIN_RUNNING,
  TILE,
} from './config.js';
import { moveCircle, tileCenter } from './map.js';
import { watcherSees } from './vision.js';

export const GUARD_RADIUS = 13;

// Seconds a guard waits at each waypoint, sweeping its gaze.
const WAYPOINT_PAUSE = 1.6;
// How fast a patrolling guard turns toward its next waypoint.
const TURN_RATE = 3.2;
// How fast a guard's gaze sweeps while it waits at a waypoint.
const SCAN_RATE = 1.1;

/** Build a guard's runtime state from its job definition. */
export function makeGuard(def) {
  const start = tileCenter(def.waypoints[0][0], def.waypoints[0][1], TILE);
  const next = tileCenter(def.waypoints[1][0], def.waypoints[1][1], TILE);
  return {
    name: def.name,
    x: start.x,
    y: start.y,
    facing: Math.atan2(next.y - start.y, next.x - start.x),
    speed: def.speed,
    chaseSpeed: def.chaseSpeed,
    waypoints: def.waypoints,
    waypointIndex: 1,
    suspicion: 0,
    mode: 'patrol', // patrol | chase | return
    pauseTimer: 0,
    scanDir: 1,
    lastSeenX: start.x,
    lastSeenY: start.y,
    lostTimer: 0,
    seesThief: false,
    range: GUARD_VIEW_RANGE,
    blinded: 0,
  };
}

function turnToward(guard, targetAngle, dt) {
  let diff = targetAngle - guard.facing;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const step = TURN_RATE * dt;
  guard.facing += Math.max(-step, Math.min(step, diff));
}

/**
 * Advance one guard by dt seconds. `world` carries the grid, the locked-door
 * state, the thief, the smoke clouds and the alarm level. Returns 'caught'
 * when this guard touches the thief, else null.
 */
export function stepGuard(guard, dt, world) {
  const { grid, lockedOpen, thief, smokes, alarm } = world;
  guard.blinded = Math.max(0, guard.blinded - dt);

  const sees = watcherSees(grid, guard, thief.x, thief.y, lockedOpen, TILE, smokes);
  guard.seesThief = sees;

  // Suspicion grows while the thief is visible (faster up close and while
  // the thief runs), and fades while hidden.
  if (sees) {
    const dist = Math.hypot(thief.x - guard.x, thief.y - guard.y);
    let gain = dist < 90 ? SUSPICION_GAIN_NEAR : SUSPICION_GAIN_FAR;
    if (thief.running) gain += SUSPICION_GAIN_RUNNING;
    guard.suspicion = Math.min(1, guard.suspicion + gain * dt);
    guard.lastSeenX = thief.x;
    guard.lastSeenY = thief.y;
    guard.lostTimer = 0;
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - SUSPICION_DECAY * dt);
  }

  // A guard that hears running feet nearby turns toward the sound.
  if (!sees && thief.running) {
    const dist = Math.hypot(thief.x - guard.x, thief.y - guard.y);
    if (dist < RUN_HEAR_RADIUS) {
      guard.suspicion = Math.min(1, guard.suspicion + 0.25 * dt);
      guard.lastSeenX = thief.x;
      guard.lastSeenY = thief.y;
    }
  }

  if (guard.mode === 'patrol') {
    if (guard.suspicion >= 1 || alarm >= 65) {
      guard.mode = 'chase';
      guard.lostTimer = 0;
    } else {
      patrolStep(guard, dt, world);
    }
  }

  if (guard.mode === 'chase') {
    if (!sees) {
      guard.lostTimer += dt;
      if (guard.lostTimer > CHASE_GIVE_UP_SECONDS) {
        guard.mode = 'return';
        guard.suspicion = 0.4;
      }
    }
    const target = sees
      ? { x: thief.x, y: thief.y }
      : { x: guard.lastSeenX, y: guard.lastSeenY };
    const dx = target.x - guard.x;
    const dy = target.y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      const step = Math.min(dist, guard.chaseSpeed * dt);
      const moved = moveCircle(grid, guard.x, guard.y, GUARD_RADIUS, (dx / dist) * step, (dy / dist) * step, lockedOpen, TILE);
      guard.x = moved.x;
      guard.y = moved.y;
      guard.facing = Math.atan2(dy, dx);
    }
    if (Math.hypot(thief.x - guard.x, thief.y - guard.y) < CATCH_RADIUS) return 'caught';
    // Reached the last seen spot without finding the thief: look around,
    // then give the chase a little more time before returning.
    if (!sees && dist < 8) guard.lostTimer += dt * 0.5;
  }

  if (guard.mode === 'return') {
    const home = tileCenter(guard.waypoints[0][0], guard.waypoints[0][1], TILE);
    const dx = home.x - guard.x;
    const dy = home.y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) {
      guard.mode = 'patrol';
      guard.waypointIndex = 1;
      guard.suspicion = 0;
    } else {
      const step = Math.min(dist, guard.speed * dt);
      const moved = moveCircle(grid, guard.x, guard.y, GUARD_RADIUS, (dx / dist) * step, (dy / dist) * step, lockedOpen, TILE);
      guard.x = moved.x;
      guard.y = moved.y;
      guard.facing = Math.atan2(dy, dx);
    }
    if (guard.suspicion >= 1) guard.mode = 'chase';
  }

  return null;
}

function patrolStep(guard, dt, world) {
  const { grid, lockedOpen } = world;
  if (guard.pauseTimer > 0) {
    guard.pauseTimer -= dt;
    // Sweep the gaze back and forth while waiting.
    guard.facing += guard.scanDir * SCAN_RATE * dt;
    if (guard.facing > Math.PI) guard.scanDir = -1;
    if (guard.facing < -Math.PI) guard.scanDir = 1;
    return;
  }
  const wp = guard.waypoints[guard.waypointIndex];
  const target = tileCenter(wp[0], wp[1], TILE);
  const dx = target.x - guard.x;
  const dy = target.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) {
    guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    guard.pauseTimer = WAYPOINT_PAUSE;
    return;
  }
  const step = Math.min(dist, guard.speed * dt);
  const moved = moveCircle(grid, guard.x, guard.y, GUARD_RADIUS, (dx / dist) * step, (dy / dist) * step, lockedOpen, TILE);
  guard.x = moved.x;
  guard.y = moved.y;
  turnToward(guard, Math.atan2(dy, dx), dt);
}
