// Shared constants for The Meridian Job: a top-down stealth heist game.
// One tile is 32 px; the floor is 40 x 25 tiles (1280 x 800 canvas).
export const TILE = 32;
export const COLS = 40;
export const ROWS = 25;
export const VIEW_W = COLS * TILE; // 1280
export const VIEW_H = ROWS * TILE; // 800

// Fixed simulation step: the world advances in 1/60 s slices so a run is
// deterministic for a given seed and input script.
export const STEP = 1 / 60;

// Player movement (px per second).
export const WALK_SPEED = 150;
export const SNEAK_SPEED = 82;
export const RUN_SPEED = 205;

// Vision: a guard or camera sees in a cone of this half-angle and range.
export const CONE_HALF_ANGLE = Math.PI / 4.6; // about 39 degrees each side
export const GUARD_VIEW_RANGE = 235;
export const CAMERA_VIEW_RANGE = 265;

// Suspicion (0..1 per guard) and the alarm meter (0..100).
export const SUSPICION_GAIN_NEAR = 1.15; // per second, target closer than 90 px
export const SUSPICION_GAIN_FAR = 0.55; // per second, target inside the cone
export const SUSPICION_GAIN_RUNNING = 0.35; // extra while the thief runs
export const SUSPICION_DECAY = 0.22; // per second, unseen
export const ALARM_GAIN_SEEN = 26; // per second while any watcher sees the thief
export const ALARM_GAIN_LASER = 55; // per second while the thief crosses a laser
export const ALARM_DECAY = 5.5; // per second while nobody sees the thief
export const ALARM_CHASE_AT = 65; // guards start hunting at this alarm level
export const ALARM_LOCKDOWN_AT = 100;

// Tools.
export const SMOKE_COUNT = 2; // smoke bombs per job
export const SMOKE_RADIUS = 95; // px, blocks every watcher's sight
export const SMOKE_SECONDS = 6;
export const JAMMER_COUNT = 2; // camera jammers per job
export const JAMMER_SECONDS = 10; // cameras blind while a jammer runs
export const HACK_SECONDS = 3; // channel time at the security terminal
export const HACK_DISABLE_SECONDS = 25; // cameras off after a successful hack
export const PICK_SECONDS = 2.2; // channel time to pick a locked door
export const LOOT_SECONDS = 0.7; // channel time to pocket a loot item

// Catching: a chasing guard that gets this close ends the job.
export const CATCH_RADIUS = 26;
// A guard that loses the thief for this long gives up and returns to patrol.
export const CHASE_GIVE_UP_SECONDS = 6;

// Noise: running is heard this far; sneaking is silent.
export const RUN_HEAR_RADIUS = 190;

// Scoring.
export const GHOST_BONUS = 250; // never spotted once, all the way to the van
export const TIME_BONUS_PER_SECOND = 4; // under the par time, per second left

// The palette: a night museum — deep blue-black floors, warm gold loot,
// cold cyan cones, red alarm. Cover (crates, plinths) reads as dark slate.
export const COLORS = {
  floorA: '#1b2138',
  floorB: '#171c30',
  floorTile: '#232a45',
  wall: '#3a4364',
  wallTop: '#4d5878',
  door: '#6b5a2e',
  doorLocked: '#8a6d2f',
  exit: '#1f7a4d',
  exitGlow: '#39d98a',
  loot: '#ffd34d',
  lootGem: '#7fe7ff',
  player: '#e8e6df',
  playerSneak: '#b9c4d6',
  guard: '#ff5d5d',
  cone: 'rgba(255, 214, 90, 0.20)',
  coneAlert: 'rgba(255, 70, 70, 0.30)',
  camera: '#9fb4ff',
  laser: '#ff3b6b',
  smoke: 'rgba(200, 205, 220, 0.55)',
  hud: '#e8ecf7',
  hudDim: '#8b94ad',
  alarm: '#ff4d5e',
  alarmBack: '#2a2430',
  gold: '#ffd34d',
};
