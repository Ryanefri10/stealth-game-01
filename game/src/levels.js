// Ember Vault — the three levels: tile maps, guard patrols, and map parsing.
// Legend: # wall, . floor, C crate (solid cover), , tall grass (hide in it),
// L lamp (lit ground), P player start, S ember shard, E exit.
// Guards walk the waypoint list in order, pausing at each corner.

export const LEVELS = [
  {
    name: 'The Quiet Gallery',
    intro: 'Three embers sleep in the gallery. Take them all, then slip out the green door — unseen.',
    map: [
      '####################',
      '#P....C....L.......#',
      '#.##.....##....##..#',
      '#..#..S..#.....#..##',
      '#..#.....#..C..#..##',
      '#..C.....#.....#..##',
      '#.......C..S..C...##',
      '#.###.......##....##',
      '#.....L....#...#..##',
      '#.##.....,,....#..##',
      '#..S.....,,...C..E##',
      '####################',
    ],
    guards: [
      { path: [[2, 8], [6, 8], [9, 8]], pause: 1.4 },
      { path: [[11, 1], [17, 1]], pause: 1.0 },
    ],
  },
  {
    name: 'The Ember Hall',
    intro: 'More guards, longer halls. The coins in your pocket can pull a guard away — spend them well.',
    map: [
      '########################',
      '#P......C......L.......#',
      '#.####......####....##.#',
      '#....#..S........#..#.##',
      '#.C..#......C....#..#.##',
      '#....#.....,,....#....##',
      '#....####......###..#.##',
      '#..L.....C.....#....#.##',
      '#.##.....,,....#..S...##',
      '#....#......#.....##..##',
      '#.C..#..S...#..C......##',
      '#....#......#....#..#.##',
      '#......,.....,....#..E##',
      '########################',
    ],
    guards: [
      { path: [[3, 3], [3, 5], [1, 5], [1, 3]], pause: 1.2 },
      { path: [[14, 1], [19, 1], [19, 3]], pause: 1.0 },
      { path: [[6, 11], [11, 11], [11, 12], [6, 12]], pause: 1.6 },
    ],
  },
  {
    name: 'The Vault',
    intro: 'Four guards, four embers, one way out. Run and they hear you; crawl and they never see you.',
    map: [
      '##########################',
      '#P...C......L......C.....#',
      '#.##....####....####...#.#',
      '#..#..S....#..S....#..#.##',
      '#..#.......#.......#....##',
      '#.C..##....#...C...#..#.##',
      '#....##.....,,.....#....##',
      '#..L.....C......##.....###',
      '#.....,,....#......#..#.##',
      '#.##......,,....#..S...###',
      '#....#......#....#.....###',
      '#.C..#..S...#..C...##..###',
      '#....#......#......#..#.##',
      '#......,....L.....,.....E#',
      '##########################',
    ],
    guards: [
      { path: [[7, 6], [12, 6]], pause: 1.2 },
      { path: [[13, 1], [18, 1]], pause: 1.0 },
      { path: [[2, 13], [6, 13]], pause: 1.4 },
      { path: [[13, 10], [20, 10]], pause: 1.0 },
    ],
  },
];

// Turn one level's strings into the grid the game plays on.
export function parseLevel(def) {
  const height = def.map.length;
  const width = def.map[0].length;
  const grid = [];
  let playerStart = null;
  let exit = null;
  const shards = [];
  const lamps = [];
  for (let y = 0; y < height; y += 1) {
    const row = [];
    for (let x = 0; x < width; x += 1) {
      const ch = def.map[y][x];
      if (ch === 'P') playerStart = { x: x + 0.5, y: y + 0.5 };
      if (ch === 'E') exit = { x: x + 0.5, y: y + 0.5 };
      if (ch === 'S') shards.push({ x: x + 0.5, y: y + 0.5, taken: false });
      if (ch === 'L') lamps.push({ x: x + 0.5, y: y + 0.5 });
      row.push(ch === 'P' || ch === 'S' || ch === 'E' || ch === 'L' ? '.' : ch);
    }
    grid.push(row);
  }
  return { def, width, height, grid, playerStart, exit, shards, lamps };
}

// Solid tiles block movement and sight: walls and crates.
export function isSolid(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= level.width || ty >= level.height) return true;
  const ch = level.grid[ty][tx];
  return ch === '#' || ch === 'C';
}

export function isBush(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= level.width || ty >= level.height) return false;
  return level.grid[ty][tx] === ',';
}

// Is this tile inside any lamp's warm pool?
export function isLit(level, tx, ty) {
  for (const lamp of level.lamps) {
    const dx = tx + 0.5 - lamp.x;
    const dy = ty + 0.5 - lamp.y;
    if (dx * dx + dy * dy <= 2.6 * 2.6) return true;
  }
  return false;
}

// Straight-line sight between two tile points, blocked by walls and crates.
export function hasLineOfSight(level, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist * 8));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const tx = Math.floor(ax + dx * t);
    const ty = Math.floor(ay + dy * t);
    if (isSolid(level, tx, ty)) return false;
  }
  return true;
}
