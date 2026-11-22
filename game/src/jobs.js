// The three jobs of The Meridian Job. Same building, rising heat: more
// guards, more cameras, lasers on the last job, tighter par times.
// Tile coordinates are (tx, ty); waypoints are patrol loops in order.
//
// Guard speed is px/s while patrolling; chasing is faster. A camera sits on
// a wall tile and sweeps its cone around a base facing angle (radians,
// 0 = east, PI/2 = south). A laser is an axis-aligned beam in tile units:
// crossing it feeds the alarm fast.
export const JOBS = [
  {
    id: 1,
    name: 'The Meridian Gallery',
    brief:
      'Lift the Star Sapphire from the vault and walk out to the van. The gallery is quiet tonight: three guards, two cameras.',
    seed: 101,
    parSeconds: 240,
    playerStart: { tx: 3, ty: 21 },
    exitTiles: [
      [1, 22], [2, 22], [1, 23], [2, 23],
    ],
    terminal: { tx: 38, ty: 12 },
    loot: [
      { id: 'sapphire', name: 'Star Sapphire', value: 500, tx: 34, ty: 4, gem: true, required: true },
      { id: 'painting', name: 'Moonlit Canal', value: 150, tx: 3, ty: 2, gem: false, required: false },
      { id: 'vase', name: 'Jade Vase', value: 200, tx: 10, ty: 8, gem: false, required: false },
      { id: 'drive', name: 'Ledger Drive', value: 150, tx: 28, ty: 16, gem: false, required: false },
      { id: 'bust', name: 'Gold Bust', value: 300, tx: 33, ty: 21, gem: false, required: false },
    ],
    guards: [
      {
        name: 'Rook',
        speed: 62,
        chaseSpeed: 168,
        waypoints: [[15, 2], [24, 2], [24, 8], [15, 8]],
      },
      {
        name: 'Vera',
        speed: 58,
        chaseSpeed: 164,
        waypoints: [[15, 12], [24, 12], [24, 16], [15, 16]],
      },
      {
        name: 'Oskar',
        speed: 55,
        chaseSpeed: 160,
        waypoints: [[28, 2], [37, 2], [37, 8], [28, 8]],
      },
    ],
    cameras: [
      { tx: 19, ty: 10, facing: Math.PI / 2, sweep: 0.9, speed: 0.45 },
      { tx: 33, ty: 10, facing: Math.PI / 2, sweep: 0.9, speed: 0.55 },
    ],
    lasers: [],
  },
  {
    id: 2,
    name: 'The Ivory Bank',
    brief:
      'The bank vault holds the Sapphire now. Four guards, three cameras, and the security room is watched. Move like a ghost.',
    seed: 202,
    parSeconds: 210,
    playerStart: { tx: 3, ty: 21 },
    exitTiles: [
      [1, 22], [2, 22], [1, 23], [2, 23],
    ],
    terminal: { tx: 38, ty: 12 },
    loot: [
      { id: 'sapphire', name: 'Star Sapphire', value: 600, tx: 34, ty: 4, gem: true, required: true },
      { id: 'painting', name: 'Moonlit Canal', value: 150, tx: 3, ty: 2, gem: false, required: false },
      { id: 'vase', name: 'Jade Vase', value: 250, tx: 10, ty: 8, gem: false, required: false },
      { id: 'drive', name: 'Ledger Drive', value: 200, tx: 28, ty: 16, gem: false, required: false },
      { id: 'bust', name: 'Gold Bust', value: 350, tx: 33, ty: 21, gem: false, required: false },
    ],
    guards: [
      {
        name: 'Rook',
        speed: 68,
        chaseSpeed: 172,
        waypoints: [[15, 2], [24, 2], [24, 8], [15, 8]],
      },
      {
        name: 'Vera',
        speed: 64,
        chaseSpeed: 168,
        waypoints: [[15, 12], [24, 12], [24, 16], [15, 16]],
      },
      {
        name: 'Oskar',
        speed: 60,
        chaseSpeed: 164,
        waypoints: [[28, 2], [37, 2], [37, 8], [28, 8]],
      },
      {
        name: 'Mira',
        speed: 62,
        chaseSpeed: 166,
        waypoints: [[28, 12], [37, 12], [37, 16], [28, 16]],
      },
    ],
    cameras: [
      { tx: 19, ty: 10, facing: Math.PI / 2, sweep: 1.0, speed: 0.55 },
      { tx: 33, ty: 10, facing: Math.PI / 2, sweep: 1.0, speed: 0.65 },
      { tx: 20, ty: 18, facing: -Math.PI / 2, sweep: 0.9, speed: 0.5 },
    ],
    lasers: [],
  },
  {
    id: 3,
    name: 'The Obsidian Vault',
    brief:
      'Five guards, four cameras and laser grids across the vault approach. The Sapphire is the prize; the lasers are the price.',
    seed: 303,
    parSeconds: 180,
    playerStart: { tx: 3, ty: 21 },
    exitTiles: [
      [1, 22], [2, 22], [1, 23], [2, 23],
    ],
    terminal: { tx: 38, ty: 12 },
    loot: [
      { id: 'sapphire', name: 'Star Sapphire', value: 750, tx: 34, ty: 4, gem: true, required: true },
      { id: 'painting', name: 'Moonlit Canal', value: 200, tx: 3, ty: 2, gem: false, required: false },
      { id: 'vase', name: 'Jade Vase', value: 300, tx: 10, ty: 8, gem: false, required: false },
      { id: 'drive', name: 'Ledger Drive', value: 250, tx: 28, ty: 16, gem: false, required: false },
      { id: 'bust', name: 'Gold Bust', value: 400, tx: 33, ty: 21, gem: false, required: false },
    ],
    guards: [
      {
        name: 'Rook',
        speed: 74,
        chaseSpeed: 176,
        waypoints: [[15, 2], [24, 2], [24, 8], [15, 8]],
      },
      {
        name: 'Vera',
        speed: 70,
        chaseSpeed: 172,
        waypoints: [[15, 12], [24, 12], [24, 16], [15, 16]],
      },
      {
        name: 'Oskar',
        speed: 66,
        chaseSpeed: 168,
        waypoints: [[28, 2], [37, 2], [37, 8], [28, 8]],
      },
      {
        name: 'Mira',
        speed: 68,
        chaseSpeed: 170,
        waypoints: [[28, 12], [37, 12], [37, 16], [28, 16]],
      },
      {
        name: 'Dante',
        speed: 66,
        chaseSpeed: 168,
        waypoints: [[28, 20], [37, 20], [37, 22], [28, 22]],
      },
    ],
    cameras: [
      { tx: 19, ty: 10, facing: Math.PI / 2, sweep: 1.0, speed: 0.6 },
      { tx: 33, ty: 10, facing: Math.PI / 2, sweep: 1.0, speed: 0.7 },
      { tx: 20, ty: 18, facing: -Math.PI / 2, sweep: 1.0, speed: 0.55 },
      { tx: 34, ty: 1, facing: Math.PI / 2, sweep: 0.8, speed: 0.6 },
    ],
    // Laser grids in tile units: one across the vault approach, one in the hall.
    lasers: [
      { x1: 30, y1: 2, x2: 30, y2: 8 },
      { x1: 15, y1: 13, x2: 25, y2: 13 },
    ],
  },
];
