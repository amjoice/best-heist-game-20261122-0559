// The thief: movement, noise, tools and interaction. The thief runs by
// default and sneaks while Shift is held. Running is loud — a guard within
// 190 px hears it and grows suspicious. Sneaking is slow and silent, the
// way to cross a cone's edge. Space interacts, 1 drops a smoke bomb,
// 2 fires a camera jammer.
import {
  RUN_SPEED,
  SNEAK_SPEED,
  TILE,
} from './config.js';
import { moveCircle, tileCenter } from './map.js';

export const PLAYER_RADIUS = 12;

/** Build the thief's runtime state from the job's start tile. */
export function makePlayer(start) {
  const pos = tileCenter(start.tx, start.ty, TILE);
  return {
    x: pos.x,
    y: pos.y,
    facing: -Math.PI / 2, // facing up the gallery on arrival
    sneaking: false,
    running: false,
    moving: false,
    // Tools
    smoke: 2,
    jammer: 2,
    // Interaction channels (0..1): loot, hack, pick.
    channel: null, // { kind: 'loot'|'hack'|'pick', target, progress }
  };
}

/**
 * Move the thief from an input vector {x, y} (each -1..1) for dt seconds.
 * Returns nothing; mutates the player.
 */
export function stepPlayer(player, input, dt, grid, lockedOpen) {
  const mag = Math.hypot(input.x, input.y);
  player.moving = mag > 0.01;
  player.sneaking = input.sneak && player.moving;
  player.running = player.moving && !player.sneaking;
  if (!player.moving) return;
  const speed = player.sneaking ? SNEAK_SPEED : RUN_SPEED;
  const nx = (input.x / (mag || 1)) * speed * dt;
  const ny = (input.y / (mag || 1)) * speed * dt;
  const moved = moveCircle(grid, player.x, player.y, PLAYER_RADIUS, nx, ny, lockedOpen, TILE);
  player.x = moved.x;
  player.y = moved.y;
  player.facing = Math.atan2(ny, nx);
}
