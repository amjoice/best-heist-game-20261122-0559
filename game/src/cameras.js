// Cameras: wall-mounted, sweeping their cone back and forth. A camera that
// sees the thief feeds the alarm. A jammer blinds every camera for a while;
// hacking the security terminal switches them off for longer.
import { CAMERA_VIEW_RANGE, TILE } from './config.js';
import { tileCenter } from './map.js';
import { watcherSees } from './vision.js';

/** Build a camera's runtime state from its job definition. */
export function makeCamera(def) {
  const pos = tileCenter(def.tx, def.ty, TILE);
  return {
    x: pos.x,
    y: pos.y,
    facing: def.facing,
    baseFacing: def.facing,
    sweep: def.sweep, // radians each side of the base facing
    speed: def.speed, // radians per second
    phase: 0,
    range: CAMERA_VIEW_RANGE,
    blinded: 0,
    seesThief: false,
  };
}

/** Advance one camera's sweep by dt seconds. */
export function stepCamera(camera, dt) {
  camera.blinded = Math.max(0, camera.blinded - dt);
  if (camera.blinded > 0) return;
  camera.phase += camera.speed * dt;
  // Ping-pong sweep: sin gives a smooth back-and-forth.
  camera.facing = camera.baseFacing + Math.sin(camera.phase) * camera.sweep;
}

/** True when this camera currently sees the thief. */
export function cameraSeesThief(camera, world) {
  if (camera.blinded > 0) return false;
  const seen = watcherSees(world.grid, camera, world.thief.x, world.thief.y, world.lockedOpen, TILE, world.smokes);
  camera.seesThief = seen;
  return seen;
}
