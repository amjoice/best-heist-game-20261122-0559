// Vision: what a guard or a camera can see. A watcher sees the thief when
// the thief is inside its cone, inside its range, and a line of sight runs
// between them without a wall, cover or shut locked door crossing it.
// Smoke clouds and a running jammer blind a watcher outright.
import { CONE_HALF_ANGLE } from './config.js';
import { hasLineOfSight } from './map.js';

/** Smallest absolute angle between two headings, in [0, PI]. */
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}

/** True when (px, py) lies inside the cone rooted at (wx, wy). */
export function inCone(wx, wy, facing, range, px, py) {
  const dx = px - wx;
  const dy = py - wy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 1) return true;
  const angle = Math.atan2(dy, dx);
  return angleDiff(angle, facing) <= CONE_HALF_ANGLE;
}

/**
 * Full sight test for one watcher (a guard or a camera) against the thief.
 * `smokes` is the list of active smoke clouds; a watcher whose own position
 * sits inside a cloud, or whose sight line crosses one, sees nothing.
 */
export function watcherSees(grid, watcher, px, py, lockedOpen, tileSize, smokes) {
  if (watcher.blinded > 0) return false;
  if (!inCone(watcher.x, watcher.y, watcher.facing, watcher.range, px, py)) return false;
  if (!hasLineOfSight(grid, watcher.x, watcher.y, px, py, lockedOpen, tileSize)) return false;
  for (const smoke of smokes) {
    const d = Math.hypot(px - smoke.x, py - smoke.y);
    const wd = Math.hypot(watcher.x - smoke.x, watcher.y - smoke.y);
    if (d < smoke.radius || wd < smoke.radius) return false;
    if (segmentHitsCircle(watcher.x, watcher.y, px, py, smoke.x, smoke.y, smoke.radius)) return false;
  }
  return true;
}

/** True when the segment (x1,y1)-(x2,y2) passes through the circle. */
export function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(cx - x1, cy - y1) < r;
  let t = ((cx - x1) * dx + (cy - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  return Math.hypot(cx - closestX, cy - closestY) < r;
}
