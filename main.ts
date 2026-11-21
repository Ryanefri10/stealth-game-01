// Ember Vault — the make.fun entrypoint (Node 22, standard library only).
// The game is plain static files under game/ and its screenshots under
// screenshots/. This program hands them in: it copies both folders into the
// output directory and writes dossier.json, the summary the judge reads,
// with the kit's vendored library. It writes the same bytes every run:
// no clocks, no randomness, files copied in directory order.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps, as the kit's gate states them: at most 4 screenshots
// of 256 KiB, at most 993 files and 48 MiB under game/, paths under 1,000
// bytes, and the dossier text capped at 160 KiB.
const DOSSIER_OPTIONS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function countFiles(dir) {
  let total = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    total += statSync(path).isDirectory() ? countFiles(path) : 1;
  }
  return total;
}

mkdirSync(out, { recursive: true });
mkdirSync(join(out, 'game'), { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });

mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Refuse a hand-in the gate would refuse: the screenshots must be there,
// 3 or 4 of them, each a whole file inside the 256 KiB cap. Failing here,
// before the dossier is written, beats a rejected entry later.
const shots = readdirSync(join(out, 'screenshots')).filter((n) => !n.startsWith('.'));
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`ember-vault: expected 3 or 4 screenshots, found ${shots.length}`);
}
for (const name of shots) {
  const size = statSync(join(out, 'screenshots', name)).size;
  if (size > DOSSIER_OPTIONS.screenshots.max_bytes) {
    throw new Error(`ember-vault: screenshot ${name} is ${size} bytes, over the 256 KiB cap`);
  }
}

writeFileSync(join(out, 'dossier.json'), buildDossier(out, DOSSIER_OPTIONS));

// A one-line receipt on stdout so a run's result is visible in the log;
// it names only counts, never anything time-dependent.
console.log(
  `ember-vault: game files=${countFiles(join(out, 'game'))} ` +
    `screenshots=${shots.length} (${shots.join(', ')}) dossier=written`,
);
