// Ember Vault — all sound is synthesised with WebAudio, no audio files.
// Footsteps, the coin clink, the shard chime, the alarm sting, and the win
// arpeggio are short oscillator envelopes, made on the fly.

let ctx = null;
let master = null;

function audio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.16;
  master.connect(ctx.destination);
  return ctx;
}

// Call from any user gesture: browsers keep audio locked until one happens.
export function unlockAudio() {
  const ac = audio();
  if (ac && ac.state === 'suspended') void ac.resume();
}

function blip(freq, dur, type, vol, when = 0, slideTo = null) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function footstep(running) {
  blip(running ? 150 : 110, 0.06, 'sine', running ? 0.5 : 0.3, 0, 70);
}

export function coinClink() {
  blip(1900, 0.12, 'triangle', 0.5);
  blip(2500, 0.18, 'triangle', 0.35, 0.05);
}

export function shardChime() {
  blip(660, 0.16, 'sine', 0.5);
  blip(990, 0.24, 'sine', 0.45, 0.09);
}

export function alarmSting() {
  blip(220, 0.5, 'sawtooth', 0.4, 0, 440);
  blip(233, 0.5, 'sawtooth', 0.3, 0, 466);
}

export function caughtSound() {
  blip(330, 0.7, 'sawtooth', 0.45, 0, 110);
}

export function winArpeggio() {
  [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.3, 'sine', 0.45, i * 0.11));
}
