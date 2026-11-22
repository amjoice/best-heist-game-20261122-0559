// Rendering: everything the player sees, drawn on one canvas. The floor,
// walls, cover, cones, loot, guards, thief and HUD are all drawn from the
// game state, so a screenshot is a render of the real game and nothing else.
//
// Vision cones are raycast: each cone is a polygon of short rays that stop
// at the first wall or cover tile, so a cone never bleeds through a wall.
import { COLORS, CONE_HALF_ANGLE, TILE, VIEW_H, VIEW_W } from './config.js';
import { blocksSight, tileAt } from './map.js';
import { lootValue } from './loot.js';
import { SCREEN_CAUGHT, SCREEN_ESCAPED, SCREEN_PAUSED, SCREEN_TITLE, interactionTarget, screenButtons } from './game.js';
import { JOBS } from './jobs.js';

const HUD_H = 46;

/** Deterministic shade variation for a floor tile, from its coordinates. */
function tileShade(tx, ty) {
  const h = (tx * 73 + ty * 149) % 5;
  return h;
}

/** Cast one ray from (x, y) along `angle`; stop at the first sight-blocking tile or at range. */
function castRay(grid, x, y, angle, range, lockedOpen) {
  const step = 6;
  const dx = Math.cos(angle) * step;
  const dy = Math.sin(angle) * step;
  let px = x;
  let py = y;
  for (let d = 0; d < range; d += step) {
    px += dx;
    py += dy;
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (blocksSight(grid, tx, ty, lockedOpen)) return { x: px - dx, y: py - dy };
  }
  return { x: x + Math.cos(angle) * range, y: y + Math.sin(angle) * range };
}

/** The cone polygon for a watcher: 25 rays fanning across its cone. */
export function conePolygon(grid, watcher, lockedOpen) {
  const rays = 25;
  const points = [{ x: watcher.x, y: watcher.y }];
  for (let i = 0; i <= rays; i += 1) {
    const angle = watcher.facing - CONE_HALF_ANGLE + (2 * CONE_HALF_ANGLE * i) / rays;
    points.push(castRay(grid, watcher.x, watcher.y, angle, watcher.range, lockedOpen));
  }
  return points;
}

function drawCone(ctx, grid, watcher, lockedOpen, alerted) {
  if (watcher.blinded > 0) return;
  const points = conePolygon(grid, watcher, lockedOpen);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fillStyle = alerted ? COLORS.coneAlert : COLORS.cone;
  ctx.fill();
  ctx.strokeStyle = alerted ? 'rgba(255, 90, 90, 0.5)' : 'rgba(255, 214, 90, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawFloor(ctx, game) {
  for (let ty = 0; ty < 25; ty += 1) {
    for (let tx = 0; tx < 40; tx += 1) {
      const code = tileAt(game.grid, tx, ty);
      if (code === '#') continue;
      const x = tx * TILE;
      const y = ty * TILE;
      ctx.fillStyle = tileShade(tx, ty) === 0 ? COLORS.floorA : COLORS.floorB;
      ctx.fillRect(x, y, TILE, TILE);
    }
  }
  // Room tints: each room reads as its own place at a glance — the warm
  // gallery, the cold vault, the green security room, the amber storage.
  const tints = [
    { x: 1, y: 1, w: 12, h: 9, color: 'rgba(255, 190, 90, 0.045)' }, // Grand Gallery
    { x: 27, y: 1, w: 12, h: 9, color: 'rgba(127, 231, 255, 0.05)' }, // Vault
    { x: 27, y: 11, w: 12, h: 7, color: 'rgba(57, 217, 138, 0.035)' }, // Security
    { x: 27, y: 19, w: 12, h: 5, color: 'rgba(255, 170, 80, 0.04)' }, // Storage
    { x: 1, y: 19, w: 12, h: 5, color: 'rgba(57, 217, 138, 0.04)' }, // Entrance
  ];
  for (const tint of tints) {
    ctx.fillStyle = tint.color;
    ctx.fillRect(tint.x * TILE, tint.y * TILE, tint.w * TILE, tint.h * TILE);
  }
  // Rugs: the gallery's red runner and the hall's long carpet.
  ctx.fillStyle = 'rgba(122, 32, 48, 0.5)';
  ctx.fillRect(3 * TILE, 4 * TILE, 6 * TILE, 2 * TILE);
  ctx.fillStyle = 'rgba(90, 24, 40, 0.55)';
  ctx.fillRect(16 * TILE, 12 * TILE, 8 * TILE, 3 * TILE);
  ctx.strokeStyle = 'rgba(255, 211, 77, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(3 * TILE + 2, 4 * TILE + 2, 6 * TILE - 4, 2 * TILE - 4);
  ctx.strokeRect(16 * TILE + 2, 12 * TILE + 2, 8 * TILE - 4, 3 * TILE - 4);
  // A faint tile seam, so the floor still reads as tiles without shouting.
  ctx.strokeStyle = 'rgba(35, 42, 69, 0.5)';
  ctx.lineWidth = 1;
  for (let ty = 0; ty < 25; ty += 1) {
    for (let tx = 0; tx < 40; tx += 1) {
      if (tileAt(game.grid, tx, ty) === '#') continue;
      ctx.strokeRect(tx * TILE + 0.5, ty * TILE + 0.5, TILE - 1, TILE - 1);
    }
  }
  // The exit: the van's zone, glowing green at the entrance.
  for (const [ex, ey] of game.job.exitTiles) {
    const pulse = 0.55 + 0.25 * Math.sin(game.time * 3);
    ctx.fillStyle = `rgba(57, 217, 138, ${pulse})`;
    ctx.fillRect(ex * TILE, ey * TILE, TILE, TILE);
  }
  ctx.fillStyle = COLORS.exitGlow;
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VAN', 2 * TILE, 23 * TILE + 20);
}

function drawWalls(ctx, game) {
  for (let ty = 0; ty < 25; ty += 1) {
    for (let tx = 0; tx < 40; tx += 1) {
      const code = tileAt(game.grid, tx, ty);
      const x = tx * TILE;
      const y = ty * TILE;
      if (code === '#') {
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = COLORS.wallTop;
        ctx.fillRect(x, y, TILE, 5);
        // A soft shadow on the wall's south edge gives the rooms depth.
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(x, y + TILE - 4, TILE, 4);
      } else if (code === 'C') {
        ctx.fillStyle = '#2c3350';
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.strokeStyle = '#454f74';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 2);
        ctx.lineTo(x + TILE - 2, y + TILE - 2);
        ctx.moveTo(x + TILE - 2, y + 2);
        ctx.lineTo(x + 2, y + TILE - 2);
        ctx.stroke();
      } else if (code === 'D') {
        ctx.fillStyle = COLORS.door;
        ctx.fillRect(x, y, TILE, 4);
        ctx.fillRect(x, y + TILE - 4, TILE, 4);
      } else if (code === 'L') {
        if (game.lockedOpen) {
          ctx.fillStyle = COLORS.door;
          ctx.fillRect(x, y, TILE, 4);
          ctx.fillRect(x, y + TILE - 4, TILE, 4);
        } else {
          ctx.fillStyle = COLORS.doorLocked;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#ffd34d';
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#1b2138';
          ctx.fillRect(x + TILE / 2 - 1.5, y + TILE / 2 - 1, 3, 6);
        }
      } else if (code === 'T') {
        // Security terminal: a console with a blinking screen and a keypad.
        ctx.fillStyle = '#232a45';
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.strokeStyle = '#4d5878';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = game.cameras.every((c) => c.blinded > 0) ? '#3a3f55' : '#39d98a';
        ctx.fillRect(x + 6, y + 6, TILE - 12, 12);
        ctx.fillStyle = '#8b94ad';
        for (let row = 0; row < 2; row += 1) {
          for (let col = 0; col < 3; col += 1) {
            ctx.fillRect(x + 7 + col * 6, y + 21 + row * 4, 4, 3);
          }
        }
        ctx.fillStyle = '#e8ecf7';
        ctx.font = 'bold 8px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SEC', x + TILE / 2, y + TILE - 3);
      }
    }
  }
}

function drawLasers(ctx, game) {
  for (const laser of game.job.lasers) {
    const x1 = laser.x1 * TILE;
    const y1 = laser.y1 * TILE;
    const x2 = laser.x2 * TILE;
    const y2 = laser.y2 * TILE;
    const dash = (game.time * 40) % 16;
    ctx.strokeStyle = COLORS.laser;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.lineDashOffset = -dash;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.laser;
    ctx.beginPath();
    ctx.arc(x1, y1, 4, 0, Math.PI * 2);
    ctx.arc(x2, y2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLoot(ctx, game) {
  for (const item of game.loot) {
    if (item.taken) continue;
    const bob = Math.sin(game.time * 2 + item.x) * 2;
    const y = item.y + bob;
    ctx.save();
    ctx.shadowColor = item.gem ? COLORS.lootGem : COLORS.loot;
    ctx.shadowBlur = 14;
    ctx.fillStyle = item.gem ? COLORS.lootGem : COLORS.loot;
    ctx.beginPath();
    ctx.moveTo(item.x, y - 10);
    ctx.lineTo(item.x + 8, y);
    ctx.lineTo(item.x, y + 10);
    ctx.lineTo(item.x - 8, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(232, 236, 247, 0.85)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(item.name, item.x, y + 24);
  }
}

function drawSmoke(ctx, game) {
  for (const smoke of game.smokes) {
    const alpha = Math.min(0.55, (smoke.ttl / SMOKE_SECONDS) * 0.55);
    ctx.fillStyle = `rgba(200, 205, 220, ${alpha})`;
    ctx.beginPath();
    ctx.arc(smoke.x, smoke.y, smoke.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(smoke.x - 30, smoke.y + 12, smoke.radius * 0.55, 0, Math.PI * 2);
    ctx.arc(smoke.x + 32, smoke.y - 10, smoke.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGuards(ctx, game) {
  for (const guard of game.guards) {
    const alerted = guard.mode === 'chase' || guard.suspicion > 0.55;
    drawCone(ctx, game.grid, guard, game.lockedOpen, alerted);
  }
  for (const guard of game.guards) {
    // Body: a red disc with a facing tick, ringed by suspicion.
    ctx.fillStyle = guard.mode === 'chase' ? '#ff2e3e' : '#ff5d5d';
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5c1016';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#ffd9d9';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.facing) * 13, guard.y + Math.sin(guard.facing) * 13);
    ctx.stroke();
    // Suspicion ring above the guard.
    if (guard.suspicion > 0.05) {
      ctx.strokeStyle = guard.suspicion >= 1 ? '#ff2e3e' : '#ffd34d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y - 20, 7, -Math.PI / 2, -Math.PI / 2 + guard.suspicion * Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#e8ecf7';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    if (guard.mode === 'chase') ctx.fillText('!', guard.x, guard.y - 26);
    else if (guard.suspicion > 0.35) ctx.fillText('?', guard.x, guard.y - 26);
  }
}

function drawCameras(ctx, game) {
  for (const camera of game.cameras) {
    if (camera.blinded <= 0) drawCone(ctx, game.grid, camera, game.lockedOpen, false);
  }
  for (const camera of game.cameras) {
    ctx.fillStyle = camera.blinded > 0 ? '#5a6278' : COLORS.camera;
    ctx.fillRect(camera.x - 8, camera.y - 8, 16, 16);
    ctx.fillStyle = camera.blinded > 0 ? '#2a2f42' : '#0c1220';
    ctx.beginPath();
    ctx.arc(camera.x + Math.cos(camera.facing) * 6, camera.y + Math.sin(camera.facing) * 6, 3, 0, Math.PI * 2);
    ctx.fill();
    if (camera.blinded > 0) {
      ctx.fillStyle = '#8b94ad';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('OFFLINE', camera.x, camera.y + 24);
    }
  }
}

function drawPlayer(ctx, game) {
  const p = game.player;
  // Channel ring while pocketing, hacking or picking.
  if (game.channel) {
    ctx.strokeStyle = COLORS.loot;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, -Math.PI / 2, -Math.PI / 2 + game.channel.progress * Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = p.sneaking ? COLORS.playerSneak : COLORS.player;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.sneaking ? 10 : 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#141824';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = '#141824';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(p.facing) * 12, p.y + Math.sin(p.facing) * 12);
  ctx.stroke();
  if (p.sneaking) {
    ctx.fillStyle = '#8b94ad';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SNEAK', p.x, p.y - 18);
  }
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function drawHud(ctx, game) {
  ctx.fillStyle = 'rgba(10, 13, 24, 0.88)';
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`JOB ${game.job.id} · ${game.job.name.toUpperCase()}`, 14, 19);
  const lootTaken = game.loot.filter((i) => i.taken).length;
  const lootTotal = game.loot.length;
  const sapphire = game.loot.find((i) => i.required);
  const objective = sapphire.taken
    ? 'Sapphire secured — reach the VAN!'
    : 'Steal the Star Sapphire, then reach the VAN';
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(objective, 14, 37);

  // Alarm meter, centre.
  const ax = 500;
  const aw = 280;
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ALARM', ax, 19);
  ctx.fillStyle = COLORS.alarmBack;
  ctx.fillRect(ax + 52, 8, aw, 16);
  const alarmFrac = game.alarm / 100;
  ctx.fillStyle = game.lockdown ? '#ff2e3e' : alarmFrac > 0.65 ? '#ff8a3d' : alarmFrac > 0.3 ? '#ffd34d' : '#39d98a';
  ctx.fillRect(ax + 52, 8, aw * alarmFrac, 16);
  ctx.strokeStyle = COLORS.hudDim;
  ctx.lineWidth = 1;
  ctx.strokeRect(ax + 52.5, 8.5, aw, 16);
  if (game.lockdown) {
    ctx.fillStyle = '#ff2e3e';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('LOCKDOWN', ax + 52, 40);
  } else if (game.alarm >= 65) {
    ctx.fillStyle = '#ff8a3d';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('HUNTED', ax + 52, 40);
  }

  // Right side: loot, time, tools.
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`LOOT $${lootValue(game.loot)}  ${lootTaken}/${lootTotal}`, VIEW_W - 14, 19);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(
    `${fmtTime(game.time)}  ·  SMOKE ${game.player.smoke}  ·  JAMMER ${game.player.jammer}${game.spotted ? '' : '  ·  GHOST'}`,
    VIEW_W - 14,
    37,
  );
}

function drawPrompt(ctx, game) {
  // While a channel runs, show what is happening; near a target, show the
  // prompt; otherwise nothing — the floor stays clean.
  let label = null;
  if (game.channel) {
    label =
      game.channel.kind === 'loot'
        ? `Pocketing ${game.channel.target.name}…`
        : game.channel.kind === 'hack'
          ? 'Hacking cameras…'
          : 'Picking the vault door…';
  } else {
    const target = interactionTarget(game);
    if (target) label = `Hold SPACE — ${target.label}`;
  }
  if (!label) return;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(10, 13, 24, 0.85)';
  const w = Math.max(320, ctx.measureText(label).width + 48);
  ctx.fillRect(VIEW_W / 2 - w / 2, VIEW_H - 64, w, 34);
  ctx.fillStyle = COLORS.loot;
  ctx.textAlign = 'center';
  ctx.fillText(label, VIEW_W / 2, VIEW_H - 42);
}

function drawToast(ctx, game) {
  if (!game.message) return;
  ctx.fillStyle = 'rgba(10, 13, 24, 0.85)';
  ctx.font = 'bold 14px system-ui, sans-serif';
  const w = ctx.measureText(game.message.text).width + 32;
  ctx.fillRect(VIEW_W / 2 - w / 2, 56, w, 32);
  ctx.fillStyle = COLORS.hud;
  ctx.textAlign = 'center';
  ctx.fillText(game.message.text, VIEW_W / 2, 77);
}

function drawButton(ctx, button, label, sub) {
  ctx.fillStyle = '#2a3352';
  ctx.fillRect(button.x, button.y, button.w, button.h);
  ctx.strokeStyle = '#6b7ba6';
  ctx.lineWidth = 2;
  ctx.strokeRect(button.x + 1, button.y + 1, button.w - 2, button.h - 2);
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, button.x + button.w / 2, button.y + button.h / 2 - (sub ? 6 : -5));
  if (sub) {
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(sub, button.x + button.w / 2, button.y + button.h / 2 + 16);
  }
}

function drawScoreLines(ctx, parts, y) {
  ctx.textAlign = 'center';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = COLORS.hud;
  ctx.fillText(`Loot  $${parts.loot}`, VIEW_W / 2, y);
  ctx.fillText(`Ghost bonus  $${parts.ghost}`, VIEW_W / 2, y + 26);
  ctx.fillText(`Time bonus  $${parts.timeBonus}`, VIEW_W / 2, y + 52);
  ctx.fillStyle = COLORS.loot;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`TOTAL  $${parts.total}`, VIEW_W / 2, y + 88);
}

function drawTitle(ctx, game) {
  ctx.fillStyle = '#0c0f1d';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // A faint gallery floor behind the title.
  for (let ty = 0; ty < 25; ty += 1) {
    for (let tx = 0; tx < 40; tx += 1) {
      if ((tx + ty) % 2 === 0) {
        ctx.fillStyle = '#11142a';
        ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.loot;
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('THE MERIDIAN JOB', VIEW_W / 2, 170);
  ctx.fillStyle = COLORS.hud;
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('A stealth heist in three jobs. Steal the Star Sapphire. Walk out.', VIEW_W / 2, 212);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Read the cones before you move. Sneak with Shift. Smoke (1) and jammers (2) cost you nothing but nerve.', VIEW_W / 2, 244);
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText('CHOOSE YOUR JOB', VIEW_W / 2, 400);

  const buttons = screenButtons(game);
  JOBS.forEach((job, i) => {
    const b = buttons[i];
    ctx.fillStyle = '#1b2138';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#6b7ba6';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    ctx.fillStyle = COLORS.loot;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(`JOB ${job.id}`, b.x + b.w / 2, b.y + 24);
    ctx.fillStyle = COLORS.hud;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(job.name, b.x + b.w / 2, b.y + 48);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`${job.guards.length} guards · ${job.cameras.length} cameras${job.lasers.length ? ' · lasers' : ''}`, b.x + b.w / 2, b.y + 70);
    ctx.fillText(`Par ${fmtTime(job.parSeconds)}  ·  press ${i + 1}`, b.x + b.w / 2, b.y + 90);
  });

  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('WASD / Arrows — move    Shift — sneak    Space — pocket / hack / pick    1 — smoke    2 — jammer    P / Esc — pause', VIEW_W / 2, 610);
  ctx.fillText('Get caught and the job is over. Never spotted, and the ghost bonus is yours.', VIEW_W / 2, 638);
  if (game.best > 0) {
    ctx.fillStyle = COLORS.loot;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`Best score so far: $${game.best}`, VIEW_W / 2, 680);
  }
}

function drawPaused(ctx, game) {
  ctx.fillStyle = 'rgba(10, 13, 24, 0.8)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW_W / 2, 340);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('The guards wait. So does the Sapphire.', VIEW_W / 2, 380);
  const buttons = screenButtons(game);
  drawButton(ctx, buttons[0], 'RESUME', 'P / Esc');
  drawButton(ctx, buttons[1], 'QUIT TO TITLE', 'Esc');
}

function drawCaught(ctx, game) {
  ctx.fillStyle = 'rgba(40, 6, 10, 0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5d5d';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('CAUGHT!', VIEW_W / 2, 300);
  ctx.fillStyle = COLORS.hud;
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(`${game.catchGuard ?? 'A guard'} grabbed you by the collar. The Sapphire stays in the vault.`, VIEW_W / 2, 340);
  if (game.scoreParts) drawScoreLines(ctx, game.scoreParts, 375);
  const buttons = screenButtons(game);
  drawButton(ctx, buttons[0], 'TRY AGAIN', 'R');
  drawButton(ctx, buttons[1], 'CHANGE JOB', 'Esc');
}

function drawEscaped(ctx, game) {
  ctx.fillStyle = 'rgba(6, 32, 18, 0.85)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.exitGlow;
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('CLEAN GETAWAY', VIEW_W / 2, 300);
  ctx.fillStyle = COLORS.hud;
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(
    game.spotted ? 'The van pulls away into the night — loud, but rich.' : 'Not a soul saw you. The van pulls away into the night.',
    VIEW_W / 2,
    340,
  );
  if (game.scoreParts) drawScoreLines(ctx, game.scoreParts, 390);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(`Time ${fmtTime(game.time)}  ·  Par ${fmtTime(game.job.parSeconds)}  ·  Best $${game.best}`, VIEW_W / 2, 530);
  const buttons = screenButtons(game);
  drawButton(ctx, buttons[0], 'RUN IT AGAIN', 'R');
  drawButton(ctx, buttons[1], 'CHANGE JOB', 'Esc');
}

/** Draw the whole game for the current screen. */
export function drawGame(ctx, game) {
  if (game.screen === SCREEN_TITLE) {
    drawTitle(ctx, game);
    return;
  }
  drawFloor(ctx, game);
  drawLasers(ctx, game);
  drawCameras(ctx, game);
  drawLoot(ctx, game);
  drawWalls(ctx, game);
  drawSmoke(ctx, game);
  drawGuards(ctx, game);
  drawPlayer(ctx, game);
  drawHud(ctx, game);
  drawPrompt(ctx, game);
  drawToast(ctx, game);
  if (game.screen === SCREEN_PAUSED) drawPaused(ctx, game);
  else if (game.screen === SCREEN_CAUGHT) drawCaught(ctx, game);
  else if (game.screen === SCREEN_ESCAPED) drawEscaped(ctx, game);
}
