// Ember Vault — the guards: patrol routes, vision cones, and alert states.
// A guard patrols its waypoints, grows suspicious when it glimpses the thief
// or hears a noise, and chases when the alarm is up. It never sees through
// walls or crates, and tall grass hides the thief unless it is very close.

import {
  CONE_RANGE_TILES,
  CONE_HALF_ANGLE,
  GUARD_PATROL,
  GUARD_CHASE,
  NOISE_RUN_RADIUS_TILES,
} from './config.js';
import { hasLineOfSight, isBush, isLit, isSolid } from './levels.js';

export const GUARD_STATE = {
  PATROL: 'patrol',
  SUSPICIOUS: 'suspicious',
  ALERT: 'alert',
  SEARCH: 'search',
};

export class Guard {
  constructor(def, level) {
    this.level = level;
    this.path = def.path;
    this.pauseTime = def.pause ?? 1.0;
    this.wp = 0;
    this.x = def.path[0][0] + 0.5;
    this.y = def.path[0][1] + 0.5;
    this.angle = 0;
    this.state = GUARD_STATE.PATROL;
    this.pauseLeft = 0;
    this.suspicion = 0; // 0..1, grows while the thief is glimpsed
    this.investigate = null; // {x, y} tile point to walk to and look at
    this.searchLeft = 0;
    this.stuckFor = 0;
    this.lastX = this.x;
    this.lastY = this.y;
  }

  // Can this guard see the thief right now? Cone + line of sight + light.
  // Returns a 0..1 visibility factor (0 = unseen).
  visibilityOf(player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > CONE_RANGE_TILES) return 0;
    let diff = Math.atan2(dy, dx) - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > CONE_HALF_ANGLE) return 0;
    if (!hasLineOfSight(this.level, this.x, this.y, player.x, player.y)) return 0;
    let factor = 1 - dist / (CONE_RANGE_TILES * 1.6);
    if (factor <= 0) return 0;
    // A thief in tall grass is nearly invisible unless the guard is on top of it.
    if (isBush(this.level, Math.floor(player.x), Math.floor(player.y)) && dist > 1.6) {
      factor *= 0.2;
    }
    // Lamplight betrays; darkness protects.
    if (isLit(this.level, Math.floor(player.x), Math.floor(player.y))) factor *= 1.4;
    return Math.min(1, factor);
  }

  // A noise at (x, y): turn and walk over to look, if it is close enough.
  hearNoise(x, y, radius) {
    if (this.state === GUARD_STATE.ALERT) return;
    const dist = Math.hypot(x - this.x, y - this.y);
    if (dist > radius) return;
    this.investigate = { x, y };
    this.state = GUARD_STATE.SUSPICIOUS;
    this.suspicion = Math.max(this.suspicion, 0.55);
  }

  // Step the guard one frame. Returns nothing; reads the player and the
  // shared alarm flag, and writes its own state.
  update(dt, player, alarmUp) {
    const speed = this.state === GUARD_STATE.ALERT ? GUARD_CHASE : GUARD_PATROL;
    let target = null;
    let arriveRadius = 0.15;

    if (this.state === GUARD_STATE.ALERT) {
      target = alarmUp ? { x: player.x, y: player.y } : this.investigate;
      if (!target) {
        this.state = GUARD_STATE.SEARCH;
        this.searchLeft = 3.0;
        this.investigate = { x: this.x, y: this.y };
      }
    } else if (this.state === GUARD_STATE.SUSPICIOUS && this.investigate) {
      target = this.investigate;
      arriveRadius = 0.3;
    } else if (this.state === GUARD_STATE.SEARCH) {
      this.searchLeft -= dt;
      this.angle += dt * 1.6; // look around while searching
      if (this.searchLeft <= 0) {
        this.state = GUARD_STATE.PATROL;
        this.investigate = null;
        this.suspicion = 0;
      }
      return;
    } else {
      // Patrol: walk to the next waypoint, pause at each corner.
      if (this.pauseLeft > 0) {
        this.pauseLeft -= dt;
        return;
      }
      target = { x: this.path[this.wp][0] + 0.5, y: this.path[this.wp][1] + 0.5 };
    }

    if (!target) return;
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= arriveRadius) {
      if (this.state === GUARD_STATE.PATROL) {
        this.wp = (this.wp + 1) % this.path.length;
        this.pauseLeft = this.pauseTime;
      } else if (this.state === GUARD_STATE.SUSPICIOUS) {
        this.state = GUARD_STATE.SEARCH;
        this.searchLeft = 2.5;
      }
      return;
    }
    const step = Math.min(dist, speed * dt);
    const nx = this.x + (dx / dist) * step;
    const ny = this.y + (dy / dist) * step;
    // Axis-separated movement so the guard slides along walls instead of sticking.
    if (!isSolid(this.level, Math.floor(nx), Math.floor(this.y))) this.x = nx;
    if (!isSolid(this.level, Math.floor(this.x), Math.floor(ny))) this.y = ny;
    this.angle = Math.atan2(dy, dx);
    // Stuck against a wall for too long: skip to the next waypoint.
    if (Math.hypot(this.x - this.lastX, this.y - this.lastY) < 0.001) {
      this.stuckFor += dt;
      if (this.stuckFor > 2.0) {
        this.stuckFor = 0;
        if (this.state === GUARD_STATE.PATROL) this.wp = (this.wp + 1) % this.path.length;
        else this.state = GUARD_STATE.SEARCH;
      }
    } else {
      this.stuckFor = 0;
    }
    this.lastX = this.x;
    this.lastY = this.y;

    // Running feet are loud: a running thief nearby draws the guard over.
    if (player.running && player.moving) {
      const heard = Math.hypot(player.x - this.x, player.y - this.y);
      if (heard < NOISE_RUN_RADIUS_TILES) this.hearNoise(player.x, player.y, NOISE_RUN_RADIUS_TILES);
    }
  }
}
