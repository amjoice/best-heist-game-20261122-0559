// Loot: the pieces the thief is after. The Star Sapphire is the job — the
// thief cannot leave without it. Everything else is score. Pocketing a
// piece takes a short channel, so the thief must choose a safe moment.
import { LOOT_SECONDS, TILE } from './config.js';
import { tileCenter } from './map.js';

export const LOOT_RADIUS = 15;

/** Build a loot item's runtime state from its job definition. */
export function makeLoot(def) {
  const pos = tileCenter(def.tx, def.ty, TILE);
  return {
    id: def.id,
    name: def.name,
    value: def.value,
    gem: def.gem,
    required: def.required,
    x: pos.x,
    y: pos.y,
    taken: false,
    channel: 0, // 0..1 progress of the current pocketing channel
  };
}

/** True when every required piece has been taken. */
export function requiredLootTaken(loot) {
  return loot.filter((item) => item.required).every((item) => item.taken);
}

/** Total value of the loot taken so far. */
export function lootValue(loot) {
  return loot.filter((item) => item.taken).reduce((sum, item) => sum + item.value, 0);
}
