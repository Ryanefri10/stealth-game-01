// Ember Vault — the thief: movement, crouching, running, and tossed coins.
// The thief moves with WASD or arrows, Shift to run (fast, loud), C to crouch
// (slow, quiet, hard to spot), and a mouse click to toss a coin that clinks
// and pulls the nearest guard over to look.

import { PLAYER_CROUCH, PLAYER_RUN, PLAYER_WALK, TILE } from './config.js';
import { isSolid } from './levels.js';

export class Player {
  constructor(start) {
    this.x = start.x;
    this.y = start.y;
    this.angle = -Math.PI / 2; // facing up the gallery
    this.moving = false;
    this.running = false;
    this.crouching = false;
    this.coins = 3;
    this.stepPhase = 0; // drives the footstep sound
  }

  // Move one frame from the held keys. dx/dy are -1..1 from input.
  update(dt, input, level) {
    let dx = 0;
    let dy = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    this.moving = dx !== 0 || dy !== 0;
    this.running = Boolean(input.run) && this.moving && !input.crouch;
    this.crouching = Boolean(input.crouch) && this.moving;
    if (!this.moving) {
      this.running = false;
      this.crouching = false;
      return;
    }
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    const speed = this.running ? PLAYER_RUN : this.crouching ? PLAYER_CROUCH : PLAYER_WALK;
    const step = speed * dt;
    const radius = 0.28; // body radius in tiles, for wall sliding
    const nx = this.x + dx * step;
    const ny = this.y + dy * step;
    if (!this.hitsWall(level, nx, this.y, radius)) this.x = nx;
    if (!this.hitsWall(level, this.x, ny, radius)) this.y = ny;
    this.angle = Math.atan2(dy, dx);
    this.stepPhase += step * (this.running ? 2.2 : 1.4);
  }

  hitsWall(level, cx, cy, r) {
    for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
      if (isSolid(level, Math.floor(cx + ox), Math.floor(cy + oy))) return true;
    }
    return false;
  }

  // Where a tossed coin lands, in tile units, from a screen click.
  coinTarget(screenX, screenY, view) {
    const px = (screenX - view.ox) / view.scale / TILE;
    const py = (screenY - view.oy) / view.scale / TILE;
    return { x: px, y: py };
  }
}

// A coin in flight, then lying on the floor clinking until guards lose interest.
export class Coin {
  constructor(fromX, fromY, toX, toY) {
    this.fromX = fromX;
    this.fromY = fromY;
    this.toX = toX;
    this.toY = toY;
    this.t = 0;
    this.landed = false;
    this.ringLeft = 1.6; // seconds the clink still draws guards
    this.x = fromX;
    this.y = fromY;
  }

  update(dt) {
    if (this.landed) {
      this.ringLeft -= dt;
      return;
    }
    this.t += dt / 0.45;
    if (this.t >= 1) {
      this.t = 1;
      this.landed = true;
    }
    // A little arc: straight line plus a hop in the middle.
    this.x = this.fromX + (this.toX - this.fromX) * this.t;
    this.y = this.fromY + (this.toY - this.fromY) * this.t - Math.sin(this.t * Math.PI) * 0.5;
  }
}
