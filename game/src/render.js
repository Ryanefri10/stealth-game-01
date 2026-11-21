// Ember Vault — everything the player sees: the level, the guards and their
// vision cones, the thief's lantern glow, and the lamps' warm pools.
// Drawing is deterministic: tile shading comes from a hash of the tile's
// position, never from Math.random, so a screenshot is the same every run.

import { COLORS, CONE_HALF_ANGLE, CONE_RANGE_TILES, TILE, VIEW_H, VIEW_W } from './config.js';
import { isSolid } from './levels.js';

// How far a ray from (x, y) travels in direction `angle` before a wall or
// a crate stops it, in tiles. The cone is clipped to the level this way,
// so cover genuinely blocks a guard's sight — and the screenshot shows it.
function raycast(level, x, y, angle, maxDist) {
  const step = 0.08;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let d = step; d <= maxDist; d += step) {
    if (isSolid(level, Math.floor(x + dx * d), Math.floor(y + dy * d))) return d;
  }
  return maxDist;
}

// A tiny deterministic hash so neighbouring tiles shade differently every run.
function tileHash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >> 16)) >>> 0;
  return h / 4294967295;
}

// Where the level sits on the 1280x720 canvas, and how big a tile is there.
export function computeView(level) {
  const scale = Math.min(VIEW_W / (level.width * TILE), (VIEW_H - 40) / (level.height * TILE));
  const w = level.width * TILE * scale;
  const h = level.height * TILE * scale;
  return { scale, ox: (VIEW_W - w) / 2, oy: 30 + (VIEW_H - 40 - h) / 2 };
}

function toScreen(view, tx, ty) {
  return { x: view.ox + tx * TILE * view.scale, y: view.oy + ty * TILE * view.scale };
}

export function drawFloor(ctx, level, view) {
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      const p = toScreen(view, x, y);
      const s = TILE * view.scale;
      const ch = level.grid[y][x];
      const shade = tileHash(x, y);
      ctx.fillStyle = shade > 0.5 ? COLORS.floorA : COLORS.floorB;
      ctx.fillRect(p.x, p.y, s + 0.5, s + 0.5);
      if (ch === ',') {
        // Tall grass: dark green tufts the thief can crouch in.
        ctx.fillStyle = COLORS.bush;
        ctx.fillRect(p.x, p.y, s + 0.5, s + 0.5);
        ctx.fillStyle = COLORS.bushLeaf;
        for (let i = 0; i < 5; i += 1) {
          const gx = p.x + ((i * 7 + x * 3) % 10) / 10 * s;
          const gy = p.y + ((i * 5 + y * 7) % 10) / 10 * s;
          ctx.beginPath();
          ctx.arc(gx, gy, s * 0.10, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.strokeStyle = COLORS.floorEdge;
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x + 0.5, p.y + 0.5, s, s);
    }
  }
}

export function drawWallsAndCover(ctx, level, view) {
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      const ch = level.grid[y][x];
      if (ch !== '#' && ch !== 'C') continue;
      const p = toScreen(view, x, y);
      const s = TILE * view.scale;
      if (ch === '#') {
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(p.x, p.y, s + 0.5, s + 0.5);
        ctx.fillStyle = COLORS.wallTop;
        ctx.fillRect(p.x, p.y, s + 0.5, Math.max(2, s * 0.08));
      } else {
        ctx.fillStyle = COLORS.crate;
        ctx.fillRect(p.x + s * 0.06, p.y + s * 0.06, s * 0.88, s * 0.88);
        ctx.strokeStyle = COLORS.crateEdge;
        ctx.lineWidth = Math.max(1.5, s * 0.05);
        ctx.strokeRect(p.x + s * 0.06, p.y + s * 0.06, s * 0.88, s * 0.88);
        ctx.beginPath();
        ctx.moveTo(p.x + s * 0.06, p.y + s * 0.06);
        ctx.lineTo(p.x + s * 0.94, p.y + s * 0.94);
        ctx.moveTo(p.x + s * 0.94, p.y + s * 0.06);
        ctx.lineTo(p.x + s * 0.06, p.y + s * 0.94);
        ctx.stroke();
      }
    }
  }
}

export function drawLamps(ctx, level, view) {
  for (const lamp of level.lamps) {
    const p = toScreen(view, lamp.x, lamp.y);
    const r = 2.6 * TILE * view.scale;
    const glow = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, r);
    glow.addColorStop(0, COLORS.lampGlow);
    glow.addColorStop(1, 'rgba(255, 190, 90, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    ctx.fillStyle = COLORS.lampCore;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(3, TILE * view.scale * 0.12), 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawExitAndShards(ctx, level, view, shardsGot, totalShards, time) {
  const exitOpen = shardsGot >= totalShards;
  const ep = toScreen(view, level.exit.x, level.exit.y);
  const s = TILE * view.scale;
  const pulse = 0.5 + 0.5 * Math.sin(time * 2.4);
  ctx.fillStyle = exitOpen ? COLORS.exitOpen : COLORS.exitClosed;
  ctx.globalAlpha = exitOpen ? 0.65 + pulse * 0.35 : 0.9;
  ctx.beginPath();
  ctx.arc(ep.x, ep.y, s * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#0d0f14';
  ctx.font = `bold ${Math.max(12, s * 0.34)}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(exitOpen ? 'OUT' : `${shardsGot}/${totalShards}`, ep.x, ep.y);
  for (const shard of level.shards) {
    if (shard.taken) continue;
    const sp = toScreen(view, shard.x, shard.y);
    const glowR = s * (0.5 + pulse * 0.18);
    const glow = ctx.createRadialGradient(sp.x, sp.y, 2, sp.x, sp.y, glowR);
    glow.addColorStop(0, 'rgba(255, 154, 60, 0.55)');
    glow.addColorStop(1, 'rgba(255, 154, 60, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sp.x - glowR, sp.y - glowR, glowR * 2, glowR * 2);
    ctx.fillStyle = COLORS.shard;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, s * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3d6';
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawCoins(ctx, coins, view) {
  for (const coin of coins) {
    const p = toScreen(view, coin.x, coin.y);
    const s = TILE * view.scale;
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath();
    ctx.arc(p.x, p.y, s * 0.10, 0, Math.PI * 2);
    ctx.fill();
    if (!coin.landed) {
      ctx.strokeStyle = 'rgba(255, 210, 122, 0.6)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, s * 0.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

export function drawGuards(ctx, guards, view, level) {
  for (const guard of guards) {
    const p = toScreen(view, guard.x, guard.y);
    const s = TILE * view.scale;
    const coneColor = guard.state === 'alert'
      ? COLORS.coneAlert
      : guard.state === 'suspicious' || guard.state === 'search'
        ? COLORS.coneSuspicious
        : COLORS.conePatrol;
    // Vision cone, clipped by walls and crates: 25 rays fan out from the
    // guard and stop at the first solid tile, so the cone hugs the cover.
    ctx.fillStyle = coneColor;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    const rays = 25;
    for (let i = 0; i <= rays; i += 1) {
      const a = guard.angle - CONE_HALF_ANGLE + (2 * CONE_HALF_ANGLE * i) / rays;
      const d = raycast(level, guard.x, guard.y, a, CONE_RANGE_TILES) * TILE * view.scale;
      ctx.lineTo(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
    }
    ctx.closePath();
    ctx.fill();
    // The guard: a watchman with a helmet and a lantern at his belt.
    ctx.fillStyle = COLORS.guard;
    ctx.beginPath();
    ctx.arc(p.x, p.y, s * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.guardHelmet;
    ctx.beginPath();
    ctx.arc(p.x, p.y, s * 0.34, guard.angle - 1.1, guard.angle + 1.1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0d0f14';
    ctx.lineWidth = Math.max(1.5, s * 0.06);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(guard.angle) * s * 0.5, p.y + Math.sin(guard.angle) * s * 0.5);
    ctx.stroke();
    if (guard.state === 'suspicious' || guard.state === 'search') {
      ctx.fillStyle = COLORS.gold;
      ctx.font = `bold ${Math.max(14, s * 0.5)}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillText('?', p.x, p.y - s * 0.55);
    }
    if (guard.state === 'alert') {
      ctx.fillStyle = COLORS.danger;
      ctx.font = `bold ${Math.max(14, s * 0.5)}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillText('!', p.x, p.y - s * 0.55);
    }
  }
}

export function drawPlayer(ctx, player, view, time) {
  const p = toScreen(view, player.x, player.y);
  const s = TILE * view.scale;
  // The thief's little lantern: a warm pool that follows them everywhere.
  const glowR = s * 1.1;
  const glow = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, glowR);
  glow.addColorStop(0, 'rgba(127, 231, 210, 0.16)');
  glow.addColorStop(1, 'rgba(127, 231, 210, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(p.x - glowR, p.y - glowR, glowR * 2, glowR * 2);
  const bob = Math.sin(player.stepPhase * 2) * (player.moving ? s * 0.03 : 0);
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob, s * 0.30, 0, Math.PI * 2);
  ctx.fill();
  // Hood point, turned where the thief walks.
  ctx.fillStyle = COLORS.playerHood;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(player.angle) * s * 0.52, p.y + Math.sin(player.angle) * s * 0.52 + bob);
  ctx.lineTo(
    p.x + Math.cos(player.angle + 2.4) * s * 0.30,
    p.y + Math.sin(player.angle + 2.4) * s * 0.30 + bob,
  );
  ctx.lineTo(
    p.x + Math.cos(player.angle - 2.4) * s * 0.30,
    p.y + Math.sin(player.angle - 2.4) * s * 0.30 + bob,
  );
  ctx.closePath();
  ctx.fill();
  if (player.crouching) {
    ctx.strokeStyle = 'rgba(232, 228, 216, 0.7)';
    ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob, s * 0.42, 0, Math.PI * 2);
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  void time;
}

// A dark vignette that deepens while the alarm is up.
export function drawVignette(ctx, detection) {
  const strength = 0.25 + (detection / 100) * 0.45;
  const g = ctx.createRadialGradient(
    VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42,
    VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95,
  );
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, `rgba(10, 0, 0, ${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}
