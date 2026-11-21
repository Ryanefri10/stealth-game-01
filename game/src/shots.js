// Ember Vault — staged scenes for the screenshots, each a frozen moment of
// the real game: the same level, guards and cones, set to fixed positions
// and rendered once. No randomness, no timers: the same query always draws
// the same pixels. The game plays normally without a ?shot= query.

import { GUARD_STATE } from './guard.js';

function placeGuard(guard, x, y, angle, state) {
  guard.x = x;
  guard.y = y;
  guard.angle = angle;
  guard.state = state;
  guard.suspicion = state === 'suspicious' ? 0.8 : 0;
  guard.investigate = null;
  guard.searchLeft = state === 'search' ? 2.5 : 0;
  guard.pauseLeft = 0;
}

// Stage one named scene on the game's first level and freeze it.
export function stageShot(name, game) {
  game.loadLevel(0);
  game.state = 'playing';
  const player = game.player;
  const [g1, g2] = game.guards;

  if (name === 'patrol') {
    // The thief crouched behind a crate while a guard's cone sweeps past.
    game.time = 61.0;
    player.x = 10.5;
    player.y = 6.5;
    player.angle = Math.PI;
    player.crouching = true;
    player.moving = false;
    game.detection = 35;
    placeGuard(g1, 5.5, 6.5, 0, GUARD_STATE.SUSPICIOUS);
    g1.investigate = { x: 9.5, y: 6.5 };
    placeGuard(g2, 13.5, 3.5, Math.PI / 2, GUARD_STATE.PATROL);
    game.banner = 'A guard heard something…';
    game.bannerUntil = 9999;
    return;
  }

  if (name === 'alarm') {
    // Fully spotted: the alarm is up and two guards close in on the thief.
    game.time = 118.0;
    player.x = 14.5;
    player.y = 9.5;
    player.angle = Math.PI;
    player.running = true;
    player.moving = true;
    player.stepPhase = 1.5;
    game.detection = 92;
    game.alarmUp = true;
    placeGuard(g1, 11.5, 9.5, 0, GUARD_STATE.ALERT);
    placeGuard(g2, 16.5, 6.5, Math.PI / 2, GUARD_STATE.ALERT);
    game.banner = 'SPOTTED! Break line of sight and hide!';
    game.bannerUntil = 9999;
    return;
  }

  if (name === 'exit') {
    // Every ember taken: the thief steps through the open green door.
    game.time = 203.0;
    for (const shard of game.level.shards) shard.taken = true;
    game.score = 450;
    player.x = 18.5;
    player.y = 10.5;
    player.angle = Math.PI / 2;
    game.detection = 0;
    placeGuard(g1, 3.5, 8.5, Math.PI, GUARD_STATE.SEARCH);
    placeGuard(g2, 11.5, 1.5, Math.PI / 2, GUARD_STATE.SEARCH);
    game.banner = 'ESCAPED! All embers stolen.';
    game.bannerUntil = 9999;
    return;
  }

  // Default: cover. The whole hall at a glance — cones, crates, lamps, embers.
  game.time = 24.0;
  player.x = 4.5;
  player.y = 9.5;
  player.angle = -Math.PI / 2;
  game.detection = 0;
  placeGuard(g1, 5.5, 8.5, 0, GUARD_STATE.PATROL);
  placeGuard(g2, 13.5, 3.5, Math.PI / 2, GUARD_STATE.PATROL);
  game.banner = 'The Quiet Gallery — stay out of the light';
  game.bannerUntil = 9999;
}
