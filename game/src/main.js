// Ember Vault — the game itself: loop, input, detection, scoring, and screens.
// One fixed timestep (1/60s) drives the simulation; the canvas draws it.
// Play with WASD or arrows, Shift to run, C to crouch, click to toss a coin.

import {
  ALARM_AT,
  CALM_BELOW,
  COLORS,
  COIN_START,
  DETECT_BASE_PER_SEC,
  DETECT_BUSH_MULT,
  DETECT_CLOSE_BONUS,
  DETECT_CROUCH_MULT,
  DETECT_DARK_MULT,
  DETECT_DECAY_PER_SEC,
  DETECT_LIT_MULT,
  DETECT_RUN_MULT,
  NOISE_COIN_RADIUS_TILES,
  SCORE_GHOST_BONUS,
  SCORE_LEVEL_CLEAR,
  SCORE_SHARD,
  TILE,
  VIEW_H,
  VIEW_W,
} from './config.js';
import { LEVELS, isBush, isLit, parseLevel } from './levels.js';
import { GUARD_STATE, Guard } from './guard.js';
import { Coin, Player } from './player.js';
import {
  computeView,
  drawCoins,
  drawExitAndShards,
  drawFloor,
  drawGuards,
  drawLamps,
  drawPlayer,
  drawVignette,
  drawWallsAndCover,
} from './render.js';
import {
  alarmSting,
  caughtSound,
  coinClink,
  footstep,
  shardChime,
  unlockAudio,
  winArpeggio,
} from './audio.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    this.input = { left: false, right: false, up: false, down: false, run: false, crouch: false };
    this.state = 'title'; // title | playing | caught | clear | win
    this.levelIndex = 0;
    this.score = 0;
    this.time = 0;
    this.detection = 0;
    this.alarmUp = false;
    this.seenThisLevel = false;
    this.banner = '';
    this.bannerUntil = 0;
    this.coins = [];
    this.lastStepCount = 0;
    this.loadLevel(0);
    this.bindInput();
  }

  loadLevel(index) {
    this.levelIndex = index;
    this.level = parseLevel(LEVELS[index]);
    this.view = computeView(this.level);
    this.player = new Player(this.level.playerStart);
    this.player.coins = COIN_START;
    this.guards = this.level.def.guards.map((g) => new Guard(g, this.level));
    this.coins = [];
    this.detection = 0;
    this.alarmUp = false;
    this.seenThisLevel = false;
    this.time = 0;
    this.lastStepCount = 0;
  }

  bindInput() {
    const keys = {
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up',
      ArrowDown: 'down', KeyS: 'down',
      ShiftLeft: 'run', ShiftRight: 'run',
      KeyC: 'crouch', ControlLeft: 'crouch',
    };
    window.addEventListener('keydown', (e) => {
      unlockAudio();
      if (keys[e.code] !== undefined) {
        this.input[keys[e.code]] = true;
        e.preventDefault();
      }
      if (e.code === 'KeyR' && this.state !== 'title') this.loadLevel(this.levelIndex);
      if (e.code === 'Enter' && this.state === 'title') this.begin();
    });
    window.addEventListener('keyup', (e) => {
      if (keys[e.code] !== undefined) this.input[keys[e.code]] = false;
    });
    this.canvas.addEventListener('click', (e) => {
      unlockAudio();
      if (this.state !== 'playing') return;
      if (this.player.coins <= 0) return;
      const rect = this.canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (VIEW_W / rect.width);
      const sy = (e.clientY - rect.top) * (VIEW_H / rect.height);
      const target = this.player.coinTarget(sx, sy, this.view);
      const dx = target.x - this.player.x;
      const dy = target.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 7) {
        target.x = this.player.x + (dx / dist) * 7;
        target.y = this.player.y + (dy / dist) * 7;
      }
      this.player.coins -= 1;
      this.coins.push(new Coin(this.player.x, this.player.y, target.x, target.y));
    });
    document.getElementById('overlay-button').addEventListener('click', () => {
      unlockAudio();
      if (this.state === 'title') this.begin();
      else if (this.state === 'caught') this.loadLevel(this.levelIndex);
      else if (this.state === 'clear') this.nextLevel();
      else if (this.state === 'win') this.restartAll();
    });
  }

  begin() {
    this.state = 'playing';
    this.showOverlay(false);
  }

  restartAll() {
    this.score = 0;
    this.loadLevel(0);
    this.state = 'playing';
    this.showOverlay(false);
  }

  nextLevel() {
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.state = 'win';
      winArpeggio();
      this.showOverlay(true, 'THE VAULT IS YOURS', `Every ember stolen, never caught. Final score: ${this.score}.`);
      return;
    }
    this.loadLevel(this.levelIndex + 1);
    this.state = 'playing';
    this.showOverlay(false);
    this.flashBanner(this.level.def.name);
  }

  shardsGot() {
    return this.level.shards.filter((s) => s.taken).length;
  }

  update(dt) {
    if (this.state !== 'playing') return;
    this.time += dt;
    this.player.update(dt, this.input, this.level);

    // Footsteps: a soft tick each stride, louder when running.
    const steps = Math.floor(this.player.stepPhase);
    if (steps !== this.lastStepCount) {
      this.lastStepCount = steps;
      if (this.player.moving) footstep(this.player.running);
    }

    // Coins fly, land with a clink, and pull nearby guards over.
    for (const coin of this.coins) {
      const wasLanded = coin.landed;
      coin.update(dt);
      if (!wasLanded && coin.landed) {
        coinClink();
        for (const guard of this.guards) {
          guard.hearNoise(coin.toX, coin.toY, NOISE_COIN_RADIUS_TILES);
        }
      }
    }
    this.coins = this.coins.filter((c) => c.ringLeft > 0);

    // Pick up embers.
    for (const shard of this.level.shards) {
      if (shard.taken) continue;
      if (Math.hypot(shard.x - this.player.x, shard.y - this.player.y) < 0.6) {
        shard.taken = true;
        this.score += SCORE_SHARD;
        shardChime();
        if (this.shardsGot() >= this.level.shards.length) {
          this.flashBanner('All embers taken — reach the green door!');
        }
      }
    }

    // Detection: the most-seeing guard sets the pace.
    let bestVis = 0;
    let bestGuard = null;
    for (const guard of this.guards) {
      const vis = guard.visibilityOf(this.player);
      if (vis > bestVis) {
        bestVis = vis;
        bestGuard = guard;
      }
    }
    const ptx = Math.floor(this.player.x);
    const pty = Math.floor(this.player.y);
    if (bestVis > 0) {
      let mult = 1;
      if (this.player.running) mult *= DETECT_RUN_MULT;
      if (this.player.crouching) mult *= DETECT_CROUCH_MULT;
      if (isLit(this.level, ptx, pty)) mult *= DETECT_LIT_MULT;
      else mult *= DETECT_DARK_MULT;
      if (isBush(this.level, ptx, pty)) mult *= DETECT_BUSH_MULT;
      const dist = Math.hypot(bestGuard.x - this.player.x, bestGuard.y - this.player.y);
      if (dist < 2) mult *= DETECT_CLOSE_BONUS;
      this.detection += bestVis * DETECT_BASE_PER_SEC * mult * dt;
      this.seenThisLevel = true;
      if (bestVis > 0.5 && bestGuard.state === GUARD_STATE.PATROL) {
        bestGuard.state = GUARD_STATE.SUSPICIOUS;
        bestGuard.investigate = { x: this.player.x, y: this.player.y };
        bestGuard.suspicion = 0.8;
      }
    } else {
      this.detection -= DETECT_DECAY_PER_SEC * dt;
    }
    this.detection = Math.max(0, Math.min(ALARM_AT, this.detection));

    if (!this.alarmUp && this.detection >= ALARM_AT) {
      this.alarmUp = true;
      alarmSting();
      this.flashBanner('SPOTTED! Break line of sight and hide!');
      for (const guard of this.guards) {
        guard.state = GUARD_STATE.ALERT;
        guard.investigate = { x: this.player.x, y: this.player.y };
      }
    } else if (this.alarmUp && this.detection < CALM_BELOW) {
      this.alarmUp = false;
      for (const guard of this.guards) {
        if (guard.state === GUARD_STATE.ALERT) {
          guard.state = GUARD_STATE.SEARCH;
          guard.searchLeft = 3.0;
        }
      }
    }

    for (const guard of this.guards) guard.update(dt, this.player, this.alarmUp);

    // Caught: a guard gets its hands on the thief.
    for (const guard of this.guards) {
      if (Math.hypot(guard.x - this.player.x, guard.y - this.player.y) < 0.55) {
        this.state = 'caught';
        caughtSound();
        this.showOverlay(true, 'CAUGHT!', 'A guard got you. The vault keeps its embers — this time.');
        return;
      }
    }

    // Exit: all embers in hand, step onto the green door.
    if (this.shardsGot() >= this.level.shards.length) {
      const exit = this.level.exit;
      if (Math.hypot(exit.x - this.player.x, exit.y - this.player.y) < 0.7) {
        this.score += SCORE_LEVEL_CLEAR;
        if (!this.seenThisLevel) {
          this.score += SCORE_GHOST_BONUS;
          this.flashBanner('GHOST! Never spotted. +300');
        }
        this.state = 'clear';
        winArpeggio();
        const last = this.levelIndex + 1 >= LEVELS.length;
        this.showOverlay(
          true,
          last ? 'THE VAULT IS YOURS' : `${this.level.def.name} — CLEAR`,
          last
            ? `Every ember stolen, never caught. Final score: ${this.score}.`
            : `Embers ${this.shardsGot()}/${this.level.shards.length} · Score ${this.score}. The next hall waits.`,
        );
      }
    }
  }

  flashBanner(text) {
    this.banner = text;
    this.bannerUntil = this.time + 3.2;
  }

  showOverlay(show, title = '', text = '') {
    const overlay = document.getElementById('overlay');
    overlay.style.display = show ? 'flex' : 'none';
    if (show) {
      document.getElementById('overlay-title').textContent = title;
      document.getElementById('overlay-text').textContent = text;
      document.getElementById('overlay-button').textContent =
        this.state === 'title' ? 'Begin the heist' :
        this.state === 'caught' ? 'Try again' :
        this.state === 'clear' ? 'Next level' : 'Play again';
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.fillStyle = '#0d0f14';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawFloor(ctx, this.level, this.view);
    drawLamps(ctx, this.level, this.view);
    drawExitAndShards(ctx, this.level, this.view, this.shardsGot(), this.level.shards.length, this.time);
    drawCoins(ctx, this.coins, this.view);
    drawWallsAndCover(ctx, this.level, this.view);
    drawGuards(ctx, this.guards, this.view, this.level);
    drawPlayer(ctx, this.player, this.view, this.time);
    drawVignette(ctx, this.detection);
    this.updateHud();
  }

  updateHud() {
    document.getElementById('hud-level').textContent =
      `Level ${this.levelIndex + 1} · ${this.level.def.name}`;
    document.getElementById('hud-shards').textContent =
      `Embers ${this.shardsGot()}/${this.level.shards.length}`;
    document.getElementById('hud-coins').textContent = `Coins ${this.player.coins}`;
    const mins = Math.floor(this.time / 60);
    const secs = Math.floor(this.time % 60);
    document.getElementById('hud-time').textContent =
      `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    document.getElementById('hud-score').textContent = `Score ${this.score}`;
    const eye = document.getElementById('hud-eye');
    const fill = document.getElementById('hud-detect-fill');
    fill.style.width = `${this.detection}%`;
    fill.style.background = this.detection >= ALARM_AT ? COLORS.danger
      : this.detection > 55 ? '#ff9a3c' : COLORS.gold;
    eye.textContent = this.detection >= ALARM_AT ? 'ALARM' : this.detection > 1 ? 'SEEN' : 'HIDDEN';
    const banner = document.getElementById('banner');
    if (this.banner && this.time < this.bannerUntil) {
      banner.style.display = 'block';
      banner.textContent = this.banner;
      banner.style.color = this.alarmUp ? COLORS.danger : COLORS.hudText;
    } else {
      banner.style.display = 'none';
    }
  }

  // One frame, for a screenshot: no loop, no timers, fully staged.
  renderOnce() {
    this.state = 'playing';
    this.showOverlay(false);
    this.render();
  }

  startLoop() {
    let last = performance.now();
    let acc = 0;
    const frame = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      while (acc >= STEP) {
        this.update(STEP);
        acc -= STEP;
      }
      this.render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

// Boot: a ?shot= name stages one frozen scene for the screenshots;
// without it the game plays normally from its title screen.
const game = new Game(document.getElementById('game'));
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  stageShot(shot, game);
  game.renderOnce();
} else {
  game.showOverlay(true, 'EMBER VAULT', 'You are the lantern thief. Three halls, three sets of embers, one way out each time. Stay out of the cones, mind the lamplight, and never let the eye fill. WASD move · Shift run · C crouch · Click toss a coin · R retry.');
  game.startLoop();
}
