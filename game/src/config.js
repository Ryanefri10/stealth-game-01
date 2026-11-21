// Ember Vault — shared tuning numbers for the whole game.
// One clear job: every magic number the other modules use lives here.

export const TILE = 48;
export const VIEW_W = 1280;
export const VIEW_H = 720;

// Movement, in tiles per second.
export const PLAYER_WALK = 3.4;
export const PLAYER_RUN = 5.2;
export const PLAYER_CROUCH = 1.9;
export const GUARD_PATROL = 1.7;
export const GUARD_CHASE = 3.9;

// Vision cone.
export const CONE_RANGE_TILES = 5.6;
export const CONE_HALF_ANGLE = 0.62; // ~35 degrees each side

// Detection meter 0..100. Fills while a guard sees the player.
export const DETECT_BASE_PER_SEC = 55;
export const DETECT_CLOSE_BONUS = 1.8; // under 2 tiles away
export const DETECT_LIT_MULT = 1.5; // standing in lamplight
export const DETECT_DARK_MULT = 0.65; // standing in darkness
export const DETECT_CROUCH_MULT = 0.55;
export const DETECT_RUN_MULT = 1.4;
export const DETECT_BUSH_MULT = 0.22; // hidden in tall grass
export const DETECT_DECAY_PER_SEC = 26;
export const ALARM_AT = 100; // meter full: every guard chases
export const CALM_BELOW = 30; // meter under this: guards give up the chase

// Noise: running feet and tossed coins pull guards to investigate.
export const NOISE_RUN_RADIUS_TILES = 3.2;
export const NOISE_COIN_RADIUS_TILES = 6.0;
export const COIN_START = 3;

// Scoring.
export const SCORE_SHARD = 100;
export const SCORE_GHOST_BONUS = 300; // finish a level never fully spotted
export const SCORE_LEVEL_CLEAR = 150;

export const COLORS = {
  floorA: '#20242e',
  floorB: '#1b1f28',
  floorEdge: '#2a2f3c',
  wall: '#0d0f14',
  wallTop: '#3a4152',
  crate: '#6b4a26',
  crateEdge: '#8a6234',
  bush: '#1d3320',
  bushLeaf: '#2c4a2a',
  lampGlow: 'rgba(255, 190, 90, 0.20)',
  lampCore: '#ffd27a',
  shard: '#ff9a3c',
  exitClosed: '#274b33',
  exitOpen: '#39d98a',
  player: '#7fe7d2',
  playerHood: '#0e2a26',
  guard: '#8fa3c8',
  guardHelmet: '#5a6c8f',
  conePatrol: 'rgba(255, 214, 90, 0.20)',
  coneSuspicious: 'rgba(255, 150, 60, 0.30)',
  coneAlert: 'rgba(255, 70, 60, 0.35)',
  hudText: '#e8e4d8',
  hudDim: '#9a958a',
  danger: '#ff5a4e',
  gold: '#ffd27a',
};
