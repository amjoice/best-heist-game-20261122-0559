// The floor plan of the Meridian Gallery, drawn as text. One character per
// tile, 40 columns by 25 rows. The same building hosts all three jobs;
// what changes per job is the guards, cameras, loot values and lasers.
//
// Legend:
//   #  wall (blocks movement and sight)
//   .  open floor
//   D  doorway (open floor, drawn as a door frame)
//   L  locked door (floor once picked; blocks until then)
//   C  cover — a crate or plinth (blocks movement and sight, hides the thief)
//   E  the getaway: the van waiting outside the entrance
//   T  the security terminal (floor; stand on it and hold Space to hack)
export const MAP_ROWS = [
  '########################################',
  '#............#............#............#',
  '#............#............#............#',
  '#............#............#............#',
  '#............#............#............#',
  '#............D............L............#',  '#............#............#............#',
  '#............#............#............#',
  '#............#............#............#',
  '#............#............#............#',
  '######..############..##########..######',
  '#............#............#............#',
  '#............#............#...........T#',
  '#............#............#............#',
  '#............D............D............#',
  '#............#............#............#',
  '#............#............#............#',
  '#............#............#............#',
  '######..############..##########..######',
  '#............#............#............#',
  '#............#............#............#',
  '#............D............D............#',
  '#EE..........#............#............#',
  '#EE..........#............#............#',
  '########################################',
];

// Cover pieces (crates, plinths, server racks) placed by tile, per room.
// They block movement and sight, so the thief can break a cone behind one.
export const COVER_TILES = [
  // Grand Gallery plinths
  [6, 4], [6, 5],
  // Central hall crates
  [16, 3], [17, 3], [22, 7], [23, 7], [16, 15], [24, 15], [19, 12],
  // Vault pedestals around the Star Sapphire
  [32, 4], [36, 4],
  // Security room server racks
  [30, 12], [31, 12],
  // Storage crates
  [30, 20], [35, 22],
];

export const TILE_WALL = '#';
export const TILE_FLOOR = '.';
export const TILE_DOOR = 'D';
export const TILE_LOCKED = 'L';
export const TILE_COVER = 'C';
export const TILE_EXIT = 'E';
export const TILE_TERMINAL = 'T';

/** Parse the text map into a grid of tile codes plus the cover tiles. */
export function parseMap(rows, coverTiles) {
  const grid = rows.map((row) => row.split(''));
  for (const [x, y] of coverTiles) grid[y][x] = TILE_COVER;
  return grid;
}

/** Tile code at (tx, ty); outside the map counts as wall. */
export function tileAt(grid, tx, ty) {
  if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) return TILE_WALL;
  return grid[ty][tx];
}

export function isWallTile(code) {
  return code === TILE_WALL;
}

export function blocksMovement(grid, tx, ty, lockedOpen) {
  const code = tileAt(grid, tx, ty);
  if (code === TILE_WALL || code === TILE_COVER) return true;
  if (code === TILE_LOCKED && !lockedOpen) return true;
  return false;
}

export function blocksSight(grid, tx, ty, lockedOpen) {
  const code = tileAt(grid, tx, ty);
  if (code === TILE_WALL || code === TILE_COVER) return true;
  if (code === TILE_LOCKED && !lockedOpen) return true;
  return false;
}

/**
 * Line of sight between two pixel points, sampled along the segment.
 * Walls, cover and shut locked doors block it; open doors do not.
 */
export function hasLineOfSight(grid, ax, ay, bx, by, lockedOpen, tileSize) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / (tileSize / 4)));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const tx = Math.floor((ax + dx * t) / tileSize);
    const ty = Math.floor((ay + dy * t) / tileSize);
    if (blocksSight(grid, tx, ty, lockedOpen)) return false;
  }
  return true;
}

/**
 * Move a circle (the thief or a guard) by (dx, dy) pixels, sliding along
 * walls: try the full step, then each axis alone. Returns the new position.
 */
export function moveCircle(grid, x, y, radius, dx, dy, lockedOpen, tileSize) {
  const fits = (px, py) => {
    const minTx = Math.floor((px - radius) / tileSize);
    const maxTx = Math.floor((px + radius) / tileSize);
    const minTy = Math.floor((py - radius) / tileSize);
    const maxTy = Math.floor((py + radius) / tileSize);
    for (let ty = minTy; ty <= maxTy; ty += 1) {
      for (let tx = minTx; tx <= maxTx; tx += 1) {
        if (blocksMovement(grid, tx, ty, lockedOpen)) {
          // Circle-vs-tile test: the tile blocks only if the circle's
          // closest point on the tile is inside the radius.
          const closestX = Math.max(tx * tileSize, Math.min(px, (tx + 1) * tileSize));
          const closestY = Math.max(ty * tileSize, Math.min(py, (ty + 1) * tileSize));
          const ddx = px - closestX;
          const ddy = py - closestY;
          if (ddx * ddx + ddy * ddy < radius * radius) return false;
        }
      }
    }
    return true;
  };
  let nx = x;
  let ny = y;
  if (fits(x + dx, y + dy)) {
    nx = x + dx;
    ny = y + dy;
  } else if (fits(x + dx, y)) {
    nx = x + dx;
  } else if (fits(x, y + dy)) {
    ny = y + dy;
  }
  return { x: nx, y: ny };
}

/** Centre of a tile in pixels. */
export function tileCenter(tx, ty, tileSize) {
  return { x: (tx + 0.5) * tileSize, y: (ty + 0.5) * tileSize };
}
