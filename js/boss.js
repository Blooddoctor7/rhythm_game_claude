'use strict';
/* ==========================================================
 * boss.js — 보스곡 "Crimson Throne" (180 BPM, D단조)
 *
 *  음악과 채보를 같은 악보 위에서 함께 작성합니다.
 *  노트마다 그 순간 연주되는 소리(키음)가 연결되어 있어서,
 *  키음 모드에서는 노트를 쳐야 멜로디·코드가 연주됩니다.
 *  (드럼·베이스·패드는 항상 배경으로 재생)
 *
 *  구성
 *   인트로 8 → 테마A 8 → 테마B 8 → 브레이크 4 → 클라이맥스 8 → 클라이맥스2 8 → 엔딩 4  (48마디, 약 64초)
 * ========================================================== */

const BOSS = { id: 'crimson_throne', title: 'Crimson Throne', bpm: 180 };
const BS = 60 / BOSS.bpm / 4; // 16분음표 길이(초)

/* ----------------------------------------------------------
 * 보스곡 전용 악기
 * ---------------------------------------------------------- */
const DIST_CURVE = (() => {
  const n = 2048, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(2.5 * x); }
  return c;
})();

function voice(ctx) {
  return {
    osc(type, freq, det = 0) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = det; return o; },
    gain(v = 0) { const g = ctx.createGain(); g.gain.value = v; return g; },
    filter(type, f, q = 1) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; },
    noise() { const s = ctx.createBufferSource(); s.buffer = Sound.noise; s.loop = true; return s; },
    shaper() { const w = ctx.createWaveShaper(); w.curve = DIST_CURVE; return w; },
  };
}

// 묵직하게 찌그러뜨린 킥
INSTRUMENTS.bkick = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1;
  const o = V.osc('sine', 230), drive = V.gain(1.6), sh = V.shaper(), amp = V.gain();
  o.frequency.setValueAtTime(230, t);
  o.frequency.exponentialRampToValueAtTime(52, t + 0.07);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.3);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(0.5 * vel, t + 0.002);
  amp.gain.setTargetAtTime(0, t + 0.07, 0.07);
  o.connect(drive).connect(sh).connect(amp).connect(bus.out);
  o.start(t);
  o.stop(t + 0.5);
  const n = V.noise(), hp = V.filter('highpass', 2500), click = V.gain();
  click.gain.setValueAtTime(0.3 * vel, t);
  click.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
  n.connect(hp).connect(click).connect(bus.out);
  n.start(t, Math.random());
  n.stop(t + 0.03);
};

INSTRUMENTS.bsnare = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1;
  const n = V.noise(), bp = V.filter('bandpass', 1900, 0.7), amp = V.gain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(0.5 * vel, t + 0.002);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  n.connect(bp).connect(amp).connect(bus.out);
  n.start(t, Math.random());
  n.stop(t + 0.25);
  const o = V.osc('triangle', 240), body = V.gain();
  o.frequency.setValueAtTime(240, t);
  o.frequency.exponentialRampToValueAtTime(160, t + 0.06);
  body.gain.setValueAtTime(0.35 * vel, t);
  body.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(body).connect(bus.out);
  o.start(t);
  o.stop(t + 0.14);
};

// 두 개의 톱니파를 어긋나게 겹친 리스 베이스
INSTRUMENTS.reese = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1, f = mtof(ev.midi), d = ev.dur;
  const pre = V.gain(0.6), sh = V.shaper(), lp = V.filter('lowpass', 500, 4), amp = V.gain();
  lp.frequency.setValueAtTime(1600, t);
  lp.frequency.exponentialRampToValueAtTime(380, t + Math.min(d, 0.2));
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(0.2 * vel, t + 0.005);
  amp.gain.setTargetAtTime(0, t + d * 0.92, 0.025);
  pre.connect(sh).connect(lp).connect(amp).connect(bus.out);
  for (const det of [-14, 14]) {
    const o = V.osc('sawtooth', f, det);
    o.connect(pre);
    o.start(t);
    o.stop(t + d + 0.2);
  }
  const sub = V.osc('sine', f), sg = V.gain(0.5);
  sub.connect(sg).connect(amp);
  sub.start(t);
  sub.stop(t + d + 0.2);
};

// 슈퍼소우 리드 (톱니파 5개)
INSTRUMENTS.slead = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1, f = mtof(ev.midi), d = ev.dur;
  const lp = V.filter('lowpass', 5200, 0.9), amp = V.gain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(0.07 * vel, t + 0.006);
  amp.gain.setTargetAtTime(0.05 * vel, t + 0.02, 0.08);
  amp.gain.setTargetAtTime(0, t + Math.max(0.03, d - 0.02), 0.035);
  lp.connect(amp);
  amp.connect(bus.out);
  amp.connect(bus.send);
  const lfo = V.osc('sine', 6), depth = V.gain(0);
  if (d > 0.3) {
    depth.gain.setValueAtTime(0, t + 0.15);
    depth.gain.linearRampToValueAtTime(14, t + 0.4);
  }
  lfo.connect(depth);
  for (const det of [-18, -8, 0, 8, 18]) {
    const o = V.osc('sawtooth', f, det);
    depth.connect(o.detune);
    o.connect(lp);
    o.start(t);
    o.stop(t + d + 0.25);
  }
  lfo.start(t);
  lfo.stop(t + d + 0.25);
};

// 코드 스탭 (동시치기용, hit=true 면 타격 노이즈 추가)
INSTRUMENTS.stab = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1;
  const lp = V.filter('lowpass', 7000, 1.5), amp = V.gain();
  lp.frequency.setValueAtTime(7000, t);
  lp.frequency.exponentialRampToValueAtTime(900, t + 0.25);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(0.065 * vel, t + 0.003);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  lp.connect(amp);
  amp.connect(bus.out);
  amp.connect(bus.send);
  for (const m of ev.notes) {
    for (const det of [-10, 10]) {
      const o = V.osc('sawtooth', mtof(m), det);
      o.connect(lp);
      o.start(t);
      o.stop(t + 0.45);
    }
  }
  if (ev.hit) {
    const n = V.noise(), bp = V.filter('bandpass', 1200, 0.8), ng = V.gain();
    ng.gain.setValueAtTime(0.3 * vel, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    n.connect(bp).connect(ng).connect(bus.out);
    n.start(t, Math.random());
    n.stop(t + 0.1);
  }
};

// 아르페지오용 플럭
INSTRUMENTS.pluck = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1, f = mtof(ev.midi);
  const lp = V.filter('lowpass', 3000, 5), amp = V.gain();
  lp.frequency.setValueAtTime(5000, t);
  lp.frequency.exponentialRampToValueAtTime(400, t + 0.14);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(0.09 * vel, t + 0.002);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  lp.connect(amp);
  amp.connect(bus.out);
  amp.connect(bus.send);
  for (const [type, det] of [['sawtooth', -6], ['square', 6]]) {
    const o = V.osc(type, f, det);
    o.connect(lp);
    o.start(t);
    o.stop(t + 0.22);
  }
};

// FM 벨
INSTRUMENTS.bell = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1, f = mtof(ev.midi);
  const car = V.osc('sine', f), mod = V.osc('sine', f * 3.5), mg = V.gain(), amp = V.gain();
  mg.gain.setValueAtTime(f * 2.5, t);
  mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 1.2);
  mod.connect(mg).connect(car.frequency);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(0.13 * vel, t + 0.003);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
  car.connect(amp);
  amp.connect(bus.out);
  amp.connect(bus.send);
  car.start(t);
  mod.start(t);
  car.stop(t + 1.9);
  mod.stop(t + 1.9);
};

// 어두운 패드
INSTRUMENTS.dpad = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1;
  const lp = V.filter('lowpass', ev.cutoff || 900, 0.7), amp = V.gain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(0.03 * vel, t + 0.4);
  amp.gain.setTargetAtTime(0, t + ev.dur - 0.1, 0.25);
  lp.connect(amp).connect(bus.out);
  for (const m of ev.notes) {
    for (const det of [-12, 12]) {
      const o = V.osc('sawtooth', mtof(m), det);
      o.connect(lp);
      o.start(t);
      o.stop(t + ev.dur + 1.2);
    }
  }
};

// 구간 시작의 묵직한 임팩트
INSTRUMENTS.boom = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1;
  const o = V.osc('sine', 90), amp = V.gain();
  o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(32, t + 1.0);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(0.7 * vel, t + 0.005);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
  o.connect(amp).connect(bus.out);
  o.start(t);
  o.stop(t + 1.35);
  const n = V.noise(), hp = V.filter('highpass', 3000), ng = V.gain();
  ng.gain.setValueAtTime(0.28 * vel, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
  n.connect(hp).connect(ng).connect(bus.out);
  n.start(t);
  n.stop(t + 1.85);
};

/* ----------------------------------------------------------
 * 화성 / 리프 / 패턴
 * ---------------------------------------------------------- */
// arp, bell 은 라인 0~3 에 그대로 대응 (높은 음일수록 오른쪽)
const BCH = {
  Dm: { root: 38, pad: [50, 57, 62, 65], stab: [62, 65, 69], arp: [69, 74, 77, 81], bell: [74, 77, 81, 86] },
  Bb: { root: 34, pad: [46, 53, 62, 65], stab: [62, 65, 70], arp: [70, 74, 77, 82], bell: [74, 77, 82, 86] },
  C: { root: 36, pad: [48, 55, 64, 67], stab: [64, 67, 72], arp: [67, 72, 76, 79], bell: [72, 76, 79, 84] },
  Gm: { root: 31, pad: [43, 50, 62, 67], stab: [62, 67, 70], arp: [67, 70, 74, 79], bell: [74, 79, 82, 86] },
  A: { root: 33, pad: [45, 52, 61, 64], stab: [61, 64, 69], arp: [69, 73, 76, 81], bell: [73, 76, 81, 85] },
};
const PROG_INTRO = ['Dm', 'Bb', 'Gm', 'A'];
const PROG_A = ['Dm', 'Bb', 'C', 'A'];
const PROG_B = ['Gm', 'Dm', 'Bb', 'A'];

// 메인 리프 [16분 위치, 음, 길이(16분), 라인(지정 시)] — 3+3+2 당김 리듬
const RIFF = {
  a: [[0, 74, 3], [3, 77, 3], [6, 81, 2], [8, 79, 3], [11, 77, 3], [14, 76, 2]],
  b: [[0, 74, 3], [3, 77, 3], [6, 82, 2], [8, 81, 3], [11, 79, 3], [14, 77, 2]],
  c: [[0, 76, 3], [3, 79, 3], [6, 84, 2], [8, 82, 3], [11, 81, 3], [14, 79, 2]],
  // 롱노트 → 16분 오름 계단
  d: [[0, 81, 6], [8, 69, 1, 0], [9, 73, 1, 1], [10, 76, 1, 2], [11, 81, 1, 3], [12, 76, 2], [14, 73, 2]],
  // 내림 계단으로 해결
  d2: [[0, 81, 3], [3, 79, 3], [6, 76, 2], [8, 77, 1, 3], [9, 76, 1, 2], [10, 74, 1, 1], [11, 73, 1, 0], [12, 74, 4]],
  // 클라이맥스: 끝에 짧은 폭타
  bF: [[0, 74, 3], [3, 77, 3], [6, 82, 2], [8, 81, 4], [12, 82, 1, 3], [13, 81, 1, 2], [14, 79, 1, 1], [15, 77, 1, 0]],
  dF: [[0, 81, 6], [8, 69, 1, 0], [9, 73, 1, 1], [10, 76, 1, 2], [11, 81, 1, 3], [12, 76, 1, 1], [13, 81, 1, 3], [14, 76, 1, 2], [15, 73, 1, 0]],
};

// 아르페지오 마디 패턴: idx = 16분마다 화음 음(=라인), E/N/H = 난이도별로 노트가 되는 위치
const PAT = {
  B_EVEN: { idx: [0, 1, 2, 3, 2, 1, 1, 2, 2, 3, 0, 1, 3, 2, 1, 0], H: [0, 1, 2, 3, 6, 8, 10, 12, 14], N: [0, 2, 6, 8, 12], E: [0, 8] },     // 오름 계단
  B_ODD: { idx: [3, 2, 1, 2, 2, 1, 0, 1, 3, 2, 1, 0, 1, 2, 2, 3], H: [0, 2, 4, 6, 8, 9, 10, 11, 14], N: [0, 4, 8, 11, 14], E: [0, 8] },   // 내림 계단
  C_EVEN: { idx: [0, 2, 1, 3, 1, 2, 0, 3, 1, 3, 0, 2, 3, 2, 1, 0], H: [0, 1, 2, 3, 6, 8, 9, 10, 11, 14], N: [0, 2, 6, 8, 12], E: [0, 8] }, // 꺾인 계단
  C_ODD: { idx: [3, 2, 1, 0, 2, 0, 3, 1, 2, 1, 2, 3, 0, 1, 3, 2], H: [0, 2, 4, 5, 6, 7, 10, 12, 14], N: [0, 4, 6, 10, 12], E: [0, 10] },  // 양손 번갈아 폭타
  X_LAST: { idx: [3, 2, 1, 0, 2, 1, 3, 2, 0, 1, 2, 3, 1, 2, 3, 0], H: [0, 2, 4, 6, 8, 9, 10, 11, 12, 13, 14, 15], N: [0, 4, 8, 10, 12, 14], E: [0, 8] },
};

// 테마B 후반: 롱노트 멜로디
const HOLDS = [
  [[0, 79, 8], [8, 82, 8]],
  [[0, 81, 8], [8, 77, 8]],
  [[0, 77, 8], [8, 82, 8]],
  [[0, 81, 12]],
];

/* ----------------------------------------------------------
 * 작곡 + 채보
 * ---------------------------------------------------------- */
function composeBoss() {
  const T = s => SONG.leadIn + s * BS;
  const music = [], cands = [];
  const ev = (s, type, o) => { const e = Object.assign({ t: T(s), type }, o); music.push(e); return e; };
  // 노트: diffs 에 'E','N','H' 중 포함된 난이도에 등장. lane=null 이면 음높이 따라 자동 배치
  const note = (s, diffs, ks, o) => {
    const n = Object.assign({ s, diffs, ks: [].concat(ks || []), lane: null, len: 0, pitch: null, partner: null }, o);
    cands.push(n);
    return n;
  };
  const riffMask = (st, len) => (st % 8 === 0 ? 'ENH' : st % 2 === 0 || len >= 3 ? 'NH' : 'H');
  const playRiff = (s0, riff, double) => {
    let first = null;
    for (const [st, m, len, lane] of riff) {
      const ks = [ev(s0 + st, 'slead', { midi: m, dur: len * BS })];
      if (double) ks.push(ev(s0 + st, 'slead', { midi: m - 12, dur: len * BS, vel: 0.45 }));
      const n = note(s0 + st, riffMask(st, len), ks, { pitch: m, lane: lane ?? null, len: len >= 6 ? len - 2 : 0 });
      if (st === 0) first = n;
    }
    return first;
  };
  const stabPair = (s, ch, vel = 1) => [
    ev(s, 'stab', { notes: [ch.stab[0] - 12, ch.stab[2]], hit: true, vel }),
    ev(s, 'stab', { notes: [ch.stab[1], ch.stab[0] + 12], vel }),
  ];
  const chordWith = (main, diffs, ks) => note(main.s, diffs, ks, { partner: main });
  const arpBar = (s0, ch, P) => {
    const out = {};
    for (let k = 0; k < 16; k++) {
      const lane = P.idx[k];
      const e = ev(s0 + k, 'pluck', { midi: ch.arp[lane], vel: P.H.includes(k) ? 1 : 0.6 });
      const mask = (P.E.includes(k) ? 'E' : '') + (P.N.includes(k) ? 'N' : '') + (P.H.includes(k) ? 'H' : '');
      if (mask) out[k] = note(s0 + k, mask, e, { lane, pitch: ch.arp[lane] });
    }
    return out;
  };
  const pairNotes = (s, pair, diffs, ks) => { note(s, diffs, ks[0], { lane: pair[0] }); note(s, diffs, ks[1], { lane: pair[1] }); };
  const maskOf = (k, E, N, H) => (E.includes(k) ? 'E' : '') + (N.includes(k) ? 'N' : '') + (H.includes(k) ? 'H' : '');

  // 드럼 / 베이스
  const drumsDnB = (s0, ghost) => {
    const d = { snare: {} };
    ev(s0, 'bkick');
    ev(s0 + 10, 'bkick', { vel: 0.85 });
    if (ghost) ev(s0 + 7, 'bkick', { vel: 0.55 });
    d.snare[4] = ev(s0 + 4, 'bsnare');
    d.snare[12] = ev(s0 + 12, 'bsnare');
    for (let k = 0; k < 16; k++) ev(s0 + k, 'hat', { vel: k % 4 === 2 ? 0.75 : k % 2 ? 0.22 : 0.4, open: k === 14 });
    return d;
  };
  const drumsFour = s0 => {
    const d = { snare: {} };
    for (const k of [0, 4, 8, 12]) ev(s0 + k, 'bkick');
    d.snare[4] = ev(s0 + 4, 'bsnare', { vel: 0.85 });
    d.snare[12] = ev(s0 + 12, 'bsnare', { vel: 0.85 });
    for (let k = 0; k < 16; k++) ev(s0 + k, 'hat', { vel: k % 4 === 2 ? 0.8 : k % 2 ? 0.2 : 0.3, open: k % 4 === 2 });
    return d;
  };
  const bassDnB = (s0, r) => {
    ev(s0, 'reese', { midi: r, dur: 6 * BS });
    ev(s0 + 10, 'reese', { midi: r, dur: 4 * BS });
    ev(s0 + 14, 'reese', { midi: r + 12, dur: 2 * BS });
  };
  const bassOff = (s0, r) => { for (const k of [2, 6, 10, 14]) ev(s0 + k, 'reese', { midi: r + (k === 14 ? 12 : 0), dur: 1.7 * BS, vel: 0.9 }); };
  const snareRoll = (s0, from, lanes, E, N) => {
    for (let k = from; k < 16; k++) {
      const e = ev(s0 + k, 'bsnare', { vel: 0.45 + ((k - from) / (16 - from)) * 0.45 });
      note(s0 + k, maskOf(k, E, N, [8, 9, 10, 11, 12, 13, 14, 15]), e, { lane: lanes[k - from] });
    }
  };

  const SECTIONS = [['intro', 8], ['themeA', 8], ['themeB', 8], ['break', 4], ['climax', 8], ['climax2', 8], ['outro', 4]];
  let bar = 0;
  for (const [name, count] of SECTIONS) {
    for (let i = 0; i < count; i++, bar++) {
      const s0 = bar * 16;

      if (name === 'intro') {
        // 불길한 벨 + 패드, 느린 계단 → 하프타임 드럼 → 스네어 롤
        const ch = BCH[PROG_INTRO[i % 4]];
        if (i === 0) ev(s0, 'boom');
        if (i === 4) ev(s0, 'crash');
        ev(s0, 'dpad', { notes: ch.pad, dur: 16 * BS, vel: i < 4 ? 0.8 : 1 });
        if (i < 4) {
          const lanes = [[0, 1, 2, 3], [3, 2, 1, 0], [0, 2, 1, 3], [3, 1, 2, 0]][i];
          for (let q = 0; q < 4; q++) {
            const e = ev(s0 + q * 4, 'bell', { midi: ch.bell[lanes[q]] });
            note(s0 + q * 4, q % 2 === 0 ? 'ENH' : 'NH', e, { lane: lanes[q] });
          }
          ev(s0, 'bkick', { vel: 0.45 });
          if (i === 3) ev(s0 + 8, 'bkick', { vel: 0.45 });
        } else {
          ev(s0, 'bkick');
          ev(s0 + 10, 'bkick', { vel: 0.8 });
          if (i < 7) ev(s0 + 8, 'bsnare');
          for (let k = 0; k < 16; k += 2) ev(s0 + k, 'hat', { vel: k % 4 ? 0.5 : 0.25 });
          ev(s0, 'reese', { midi: ch.root, dur: 15 * BS, vel: 0.8 });
          const seq = i % 2 ? [3, 2, 1, 0, 2, 1, 0, 3] : [0, 1, 2, 3, 1, 2, 3, 0];
          const upto = i === 7 ? 4 : 8;
          for (let q = 0; q < upto; q++) {
            const e = ev(s0 + q * 2, 'bell', { midi: ch.bell[seq[q]], vel: 0.8 });
            note(s0 + q * 2, q % 4 === 0 ? 'ENH' : q % 2 === 0 ? 'NH' : 'H', e, { lane: seq[q] });
          }
          if (i === 6) ev(s0, 'riser', { dur: 32 * BS });
          if (i === 7) snareRoll(s0, 8, [1, 2, 3, 2, 0, 1, 2, 3], [8, 12], [8, 10, 12, 14]);
        }
      }

      else if (name === 'themeA') {
        // 드럼앤베이스 + 3-3-2 리프, 마디 첫 박 동시치기
        const pi = i % 4, ch = BCH[PROG_A[pi]];
        if (pi === 0) ev(s0, 'crash');
        const dr = drumsDnB(s0, i >= 4);
        bassDnB(s0, ch.root);
        ev(s0, 'dpad', { notes: ch.pad, dur: 16 * BS, vel: 0.6, cutoff: 1400 });
        const stab = stabPair(s0, ch);
        const first = playRiff(s0, [RIFF.a, RIFF.b, RIFF.c, i < 4 ? RIFF.d : RIFF.d2][pi], false);
        chordWith(first, pi % 2 === 0 ? 'ENH' : 'NH', stab);
        if (i >= 4) for (const k of [4, 12]) if (!cands.some(n => n.s === s0 + k)) note(s0 + k, 'H', dr.snare[k]);
      }

      else if (name === 'themeB') {
        // 포온더플로어 + 아르페지오 계단 → 후반은 롱노트 멜로디 + 반대손 아르페지오
        const pi = i % 4, ch = BCH[PROG_B[pi]];
        if (pi === 0) ev(s0, 'crash');
        drumsFour(s0);
        bassOff(s0, ch.root);
        ev(s0, 'dpad', { notes: ch.pad, dur: 16 * BS, vel: 0.7, cutoff: 1200 });
        if (i < 4) {
          const notes = arpBar(s0, ch, i % 2 ? PAT.B_ODD : PAT.B_EVEN);
          if (i % 2 === 0) chordWith(notes[0], i === 0 ? 'ENH' : 'NH', stabPair(s0, ch));
        } else {
          const hold = i % 2 === 0 ? 3 : 0;
          const other = hold === 3 ? [0, 1] : [3, 2];
          for (const [st, m, len] of HOLDS[pi]) {
            const e = ev(s0 + st, 'slead', { midi: m, dur: len * BS });
            note(s0 + st, 'ENH', e, { lane: hold, pitch: m, len: len - 2 });
          }
          const steps = pi === 3 ? [2, 4, 6] : [2, 4, 6, 10, 12, 14];
          for (let k = 0; k < 16; k++) {
            const j = steps.indexOf(k);
            const lane = j >= 0 ? other[j % 2] : [0, 1, 2, 3, 2, 1, 0, 1][k % 8];
            const e = ev(s0 + k, 'pluck', { midi: ch.arp[lane], vel: j >= 0 ? 0.9 : 0.5 });
            if (j >= 0) note(s0 + k, k === 4 || k === 12 ? 'NH' : 'H', e, { lane });
          }
          if (pi === 3) {
            // 마지막 마디: 16분 내림 계단
            [[12, 79, 3], [13, 77, 2], [14, 76, 1], [15, 73, 0]].forEach(([k, m, lane]) => {
              const e = ev(s0 + k, 'slead', { midi: m, dur: BS });
              note(s0 + k, maskOf(k, [12], [12], [12, 13, 14, 15]), e, { lane, pitch: m });
            });
            ev(s0, 'riser', { dur: 16 * BS });
          }
        }
      }

      else if (name === 'break') {
        // 하프타임, 안쪽/바깥쪽을 번갈아 치는 찰진 동시치기
        const ch = BCH[PROG_A[i]];
        if (i === 0) ev(s0, 'boom');
        ev(s0, 'dpad', { notes: ch.pad, dur: 16 * BS, vel: 1, cutoff: 700 });
        const hits = i < 3 ? [0, 3, 6, 10, 12] : [0, 3, 6];
        const pairs = [
          [[1, 2], [0, 3], [1, 2], [0, 3], [1, 2]],
          [[0, 3], [1, 2], [0, 3], [1, 2], [0, 3]],
          [[0, 2], [1, 3], [0, 2], [1, 3], [0, 2]],
          [[1, 3], [0, 2], [1, 3]],
        ][i];
        hits.forEach((k, j) => {
          ev(s0 + k, 'bkick', { vel: 0.9 });
          ev(s0 + k, 'reese', { midi: ch.root, dur: 2 * BS });
          pairNotes(s0 + k, pairs[j], maskOf(k, [0, 6], [0, 3, 6, 10], [0, 3, 6, 10, 12]), stabPair(s0 + k, ch, 1.1));
        });
        if (i < 3) ev(s0 + 8, 'bsnare');
        if (i === 2) ev(s0, 'riser', { dur: 32 * BS });
        if (i === 3) snareRoll(s0, 8, [2, 1, 0, 3, 1, 2, 3, 0], [12], [8, 10, 12, 14]);
      }

      else if (name === 'climax') {
        // 테마 재현 (리드 옥타브 더블) + 프레이즈 끝 폭타
        const pi = i % 4, ch = BCH[PROG_A[pi]];
        if (pi === 0) { ev(s0, 'crash'); ev(s0, 'boom', { vel: 0.5 }); }
        const dr = drumsFour(s0);
        bassOff(s0, ch.root);
        ev(s0, 'dpad', { notes: ch.pad, dur: 16 * BS, vel: 0.7, cutoff: 1600 });
        for (let k = 0; k < 16; k++) ev(s0 + k, 'pluck', { midi: ch.arp[[0, 1, 2, 3][k % 4]] + 12, vel: 0.3 });
        const stab = stabPair(s0, ch);
        const riff = [RIFF.a, RIFF.bF, RIFF.c, i < 4 ? RIFF.dF : RIFF.d2][pi];
        const first = playRiff(s0, riff, true);
        chordWith(first, pi % 2 === 0 ? 'ENH' : 'NH', stab);
        for (const k of [4, 12]) if (!riff.some(r => r[0] === k)) note(s0 + k, 'H', dr.snare[k]);
      }

      else if (name === 'climax2') {
        // 계단 강화: 오름/내림 → 꺾인 계단 → 양손 폭타 → 마지막 16분 8연타
        const pi = i % 4, ch = BCH[PROG_B[pi]];
        if (pi === 0) { ev(s0, 'crash'); ev(s0, 'boom', { vel: 0.5 }); }
        drumsFour(s0);
        bassOff(s0, ch.root);
        ev(s0, 'dpad', { notes: ch.pad, dur: 16 * BS, vel: 0.7, cutoff: 1600 });
        for (const [st, m, len] of HOLDS[pi]) {
          ev(s0 + st, 'slead', { midi: m, dur: len * BS, vel: 0.7 });
          ev(s0 + st, 'slead', { midi: m - 12, dur: len * BS, vel: 0.35 });
        }
        const P = i === 7 ? PAT.X_LAST : i < 4 ? (i % 2 ? PAT.B_ODD : PAT.B_EVEN) : i % 2 ? PAT.C_ODD : PAT.C_EVEN;
        const notes = arpBar(s0, ch, P);
        chordWith(notes[0], pi === 0 ? 'ENH' : 'NH', stabPair(s0, ch));
        if (i === 6) ev(s0, 'riser', { dur: 32 * BS });
      }

      else if (name === 'outro') {
        if (i === 0) {
          // 점음표 리듬 동시치기 + 리프
          const ch = BCH.Dm;
          ev(s0, 'crash');
          ev(s0, 'dpad', { notes: ch.pad, dur: 16 * BS, vel: 0.8, cutoff: 1600 });
          for (const [st, m, len] of RIFF.a) {
            ev(s0 + st, 'slead', { midi: m, dur: len * BS, vel: 0.8 });
            ev(s0 + st, 'slead', { midi: m - 12, dur: len * BS, vel: 0.35 });
          }
          const hits = [0, 3, 6, 8, 11];
          const pairs = [[1, 2], [0, 3], [1, 2], [0, 3], [1, 2]];
          hits.forEach((k, j) => {
            ev(s0 + k, 'bkick');
            ev(s0 + k, 'reese', { midi: ch.root, dur: 2 * BS });
            pairNotes(s0 + k, pairs[j], maskOf(k, [0, 8], [0, 6, 8], hits), stabPair(s0 + k, ch, 1.1));
          });
        } else if (i === 1) {
          // 16분 내림 계단 → A 코드 동시치기
          const ch = BCH.A;
          ev(s0, 'dpad', { notes: BCH.Bb.pad, dur: 8 * BS, vel: 0.8, cutoff: 1600 });
          ev(s0 + 8, 'dpad', { notes: ch.pad, dur: 8 * BS, vel: 0.8, cutoff: 1600 });
          [86, 84, 82, 81, 79, 77, 76, 74].forEach((m, k) => {
            const e = ev(s0 + k, 'slead', { midi: m, dur: BS });
            note(s0 + k, maskOf(k, [0, 4], [0, 2, 4], [0, 1, 2, 3, 4, 5, 6, 7]), e, { lane: [3, 2, 1, 0][k % 4], pitch: m });
          });
          for (const k of [0, 4]) ev(s0 + k, 'bkick');
          [[8, [1, 2]], [11, [0, 3]], [14, [1, 2]]].forEach(([k, pair]) => {
            ev(s0 + k, 'bkick');
            ev(s0 + k, 'reese', { midi: ch.root, dur: 2 * BS });
            pairNotes(s0 + k, pair, maskOf(k, [8], [8, 11, 14], [8, 11, 14]), stabPair(s0 + k, ch, 1.1));
          });
        } else if (i === 2) {
          // 마지막 화음: 양손 롱노트
          const ch = BCH.Dm;
          ev(s0, 'boom');
          ev(s0, 'bkick');
          ev(s0, 'dpad', { notes: ch.pad, dur: 32 * BS, vel: 1, cutoff: 1200 });
          ev(s0, 'reese', { midi: ch.root, dur: 12 * BS });
          const [lo, hi] = stabPair(s0, ch, 1.2);
          note(s0, 'ENH', [lo, ev(s0, 'slead', { midi: 74, dur: 14 * BS }), ev(s0, 'slead', { midi: 62, dur: 14 * BS, vel: 0.5 })], { lane: 0, len: 12 });
          note(s0, 'ENH', [hi, ev(s0, 'bell', { midi: 86 })], { lane: 3, len: 12 });
        } else {
          ev(s0, 'bell', { midi: 74, vel: 0.5 });
        }
      }
    }
  }

  const notes = layoutLanes(cands);
  // 1 4 (23) · 2 4 (13) · 2 (14) 3 · 2 (13) 4 같은 배치는 바꾸고, (14) 2 3 유형은 8마디 이상 떨어지게 (고치다 새로 생기면 다시)
  for (let r = 0; r < 4; r++) if (!(fixOuterInner(notes) + fixInnerSandwich(notes) + spaceOuterChord(notes))) break;
  music.sort((a, b) => a.t - b.t);
  const charts = ['E', 'N', 'H'].map(d => notes
    .filter(n => n.diffs.includes(d))
    .sort((a, b) => a.s - b.s || a.lane - b.lane)
    .map(n => ({ t: T(n.s), lane: n.lane, end: n.len ? T(n.s + n.len) : 0, ks: n.ks, s: n.s, len: n.len })));
  const playTime = bar * 16 * BS;
  // 레벨: 밀도 + 빠른 BPM 보정
  const levels = charts.map(c => Math.max(1, Math.min(15, Math.round(1.5 + (c.length / playTime) * 1.5 + (BOSS.bpm - 150) / 30))));
  return {
    music, charts, levels,
    duration: T(bar * 16),
    beats: Array.from({ length: bar * 4 + 1 }, (_, i) => T(i * 4)),
  };
}

/* ----------------------------------------------------------
 * 라인 자동 배치 (라인이 지정되지 않은 노트)
 *  - 음이 올라가면 오른쪽, 내려가면 왼쪽
 *  - 같은 라인은 16분 2칸(약 0.17초) 이내 금지, 롱노트 누르는 중인 라인 금지
 *  - 동시치기 짝은 반대 손 우선 (안쪽/바깥쪽 대칭)
 * ---------------------------------------------------------- */
function layoutLanes(cands) {   // 다른 합성곡(gugak.js)도 같이 사용
  const hand = l => (l < 2 ? 0 : 1);
  const absLane = p => Math.max(0, Math.min(3, Math.round((p - 69) / 4)));
  const placed = cands.filter(n => n.lane !== null);
  const conflicts = (n, l) => placed.some(p => p !== n && p.lane === l && (
    Math.abs(p.s - n.s) <= 2 ||
    (p.len && n.s >= p.s && n.s <= p.s + p.len + 1) ||
    (n.len && p.s >= n.s && p.s <= n.s + n.len + 1)));

  for (const n of cands.filter(c => c.lane === null && !c.partner).sort((a, b) => a.s - b.s)) {
    const prev = placed.filter(p => p.s < n.s && !p.partner).sort((a, b) => b.s - a.s)[0];
    let best = null, bestCost = Infinity;
    for (let l = 0; l < 4; l++) {
      if (conflicts(n, l)) continue;
      let c = l * 0.01;
      if (n.pitch !== null) {
        c += 0.6 * Math.abs(l - absLane(n.pitch));
        if (prev && prev.pitch !== null) {
          if (n.pitch > prev.pitch && l <= prev.lane) c += 3;
          if (n.pitch < prev.pitch && l >= prev.lane) c += 3;
        }
      }
      if (prev && n.s - prev.s <= 2 && hand(l) === hand(prev.lane)) c += 1.5;
      if (c < bestCost) { bestCost = c; best = l; }
    }
    if (best === null) { n.drop = true; continue; }
    n.lane = best;
    placed.push(n);
  }

  for (const n of cands.filter(c => c.partner)) {
    const m = n.partner;
    if (n.lane !== null) continue; // 라인을 직접 정한 동시치기 짝은 그대로
    const fingers = placed.filter(p => p.s === n.s || (p.len && p.s < n.s && n.s <= p.s + p.len)).length;
    if (m.drop || fingers >= 2) { n.drop = true; continue; }
    const order = [3 - m.lane, ...[0, 1, 2, 3].filter(l => hand(l) !== hand(m.lane)), ...[0, 1, 2, 3].filter(l => hand(l) === hand(m.lane))];
    const lane = order.find(l => l !== m.lane && !conflicts(n, l));
    if (lane === undefined) { n.drop = true; continue; }
    n.lane = lane;
    placed.push(n);
  }
  return cands.filter(n => !n.drop);
}

/* ----------------------------------------------------------
 * 패턴 변형: 반복되는 구간이 똑같은 라인 배치로 이어지지 않게
 *  1) 마디 단위: 앞에 나온 마디와 (어느 난이도에서든) 배치가 완전히 같으면 마디 전체를 바꿈
 *  2) 박 단위(16분 4칸): 난이도별로, 같은 리듬에서 같은 배치가 세 번 연속
 *     (또는 최근 2마디 안에 세 번) 나오면 바꿈
 *  바꾸는 방법: 라인 순서 바꾸기 (좌우 반전, 손 바꾸기, 꺾인 계단 …)
 *  hands(n) 가 true 인 노트(장구 쿵=왼손, 덕=오른손)는 같은 손 안에서만 바꿈
 *  반환: 바꾼 묶음 수
 * ---------------------------------------------------------- */
function varyPatterns(notes, hands = () => false) {
  const PERMS = [
    [3, 2, 1, 0], [2, 3, 0, 1], [1, 0, 3, 2], [0, 2, 1, 3], [3, 1, 2, 0], [1, 3, 0, 2], [2, 0, 3, 1],
    [1, 2, 3, 0], [3, 0, 1, 2], [0, 1, 3, 2], [1, 0, 2, 3], [0, 3, 2, 1], [2, 1, 0, 3],
  ];
  const DS = ['E', 'N', 'H'];
  const keepsHands = P => P.every((l, i) => (l < 2) === (i < 2));
  const sub = (g, d) => g.filter(n => n.diffs.includes(d));
  // check-charts.js 와 같은 기준: 마디는 롱노트 여부까지, 박은 위치·라인만 비교
  const sigOf = (g, base, laneOf, long) => g.map(n => `${n.s - base}:${laneOf(n)}${long && n.len ? 'L' : ''}`).join(' ');
  const groupBy = size => {
    const m = new Map();
    for (const n of notes) {
      const k = Math.floor(n.s / size);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(n);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([k, g]) => [k, g.sort((a, b) => a.s - b.s || a.lane - b.lane)]);
  };
  // 묶음 밖 노트와 같은 라인이 너무 가깝거나 롱노트와 겹치면 불가
  const conflict = (g, laneOf) => g.some(n => notes.some(o => !g.includes(o) && o.lane === laneOf(n) && (
    Math.abs(o.s - n.s) <= 2 ||
    (o.len && n.s >= o.s && n.s <= o.s + o.len + 1) ||
    (n.len && o.s >= n.s && o.s <= n.s + n.len + 1))));
  const tryPerms = (g, accept) => {
    const handed = g.some(hands);
    for (const P of PERMS) {
      if (handed && !keepsHands(P)) continue;
      const laneOf = n => P[n.lane];
      if (!accept(laneOf) || conflict(g, laneOf)) continue;
      const lanes = g.map(laneOf), before = g.map(n => n.lane);
      const near = () => awkwardCount(notes, g[0].s - OUTER_CHORD_SPACING, g[g.length - 1].s + OUTER_CHORD_SPACING);
      const had = near();
      g.forEach((n, i) => (n.lane = lanes[i]));
      if (near() > had) { g.forEach((n, i) => (n.lane = before[i])); continue; } // 금지 패턴(1 4 (23) 등)을 만들면 다른 순서로
      return true;
    }
    return false;
  };
  let changed = 0;

  // 1) 마디 단위
  const seenBars = { E: new Set(), N: new Set(), H: new Set() };
  for (const [b, g] of groupBy(16)) {
    const base = b * 16;
    const sigs = laneOf => DS.map(d => { const s = sub(g, d); return s.length >= 3 ? sigOf(s, base, laneOf, true) : null; });
    const dup = laneOf => sigs(laneOf).some((x, i) => x && seenBars[DS[i]].has(x));
    if (dup(n => n.lane) && tryPerms(g, laneOf => !dup(laneOf))) changed++;
    sigs(n => n.lane).forEach((x, i) => x && seenBars[DS[i]].add(x));
  }

  // 2) 박 단위
  const hist = new Map(); // `난이도|리듬` → [{ gi, sig }]
  for (const [gi, g] of groupBy(4)) {
    const base = gi * 4;
    const info = laneOf => DS.map(d => {
      const s = sub(g, d);
      return s.length ? { key: d + '|' + s.map(n => n.s - base).join(','), sig: sigOf(s, base, laneOf, false) } : null;
    });
    const bad = x => {
      if (!x) return false;
      const r = (hist.get(x.key) || []).filter(o => gi - o.gi <= 8).map(o => o.sig), l2 = r.slice(-2);
      return (l2.length === 2 && l2[0] === x.sig && l2[1] === x.sig) || r.filter(y => y === x.sig).length >= 3;
    };
    if (info(n => n.lane).some(bad) && tryPerms(g, laneOf => !info(laneOf).some(bad))) changed++;
    for (const x of info(n => n.lane)) {
      if (!x) continue;
      const h = hist.get(x.key) || [];
      h.push({ gi, sig: x.sig });
      hist.set(x.key, h);
    }
  }
  return changed;
}

/* ----------------------------------------------------------
 * 금지 패턴: 단타 두 개를 친 바로 앞·뒤에 나머지 두 라인 동시치기 (라인은 사용자 기준 1~4)
 *  1 4 (23) · 4 1 (23) · (23) 1 4 · (23) 4 1
 *  2 4 (13) · 4 2 (13) · (13) 2 4 · (13) 4 2  과 좌우 반전 1 3 (24) · 3 1 (24) · (24) 1 3 · (24) 3 1
 *  세 묶음이 4분 간격 이내로 이어질 때만 해당. 2 3 (14) · (14) 2 3 은 여기 아님 (아래 (14) 유형 간격 규칙)
 * ---------------------------------------------------------- */
const OUTER_INNER_GAP = 4;
function groupBySlot(notes) {
  const m = new Map();
  for (const n of notes) {
    if (!m.has(n.s)) m.set(n.s, []);
    m.get(n.s).push(n);
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([s, g]) => ({ s, g }));
}
const BANNED_SINGLE_PAIRS = ['0,3', '1,3', '0,2']; // 코드 라인 0~3 기준 단타 짝 (1·4, 2·4, 1·3)
// x, y 단타(서로 다른 라인) + c 가 나머지 두 라인 동시치기인지
function crossChord(x, y, c) {
  if (x.g.length !== 1 || y.g.length !== 1 || c.g.length !== 2) return false;
  const a = x.g[0].lane, b = y.g[0].lane;
  if (a === b || !BANNED_SINGLE_PAIRS.includes([a, b].sort().join(','))) return false;
  return c.g.every(n => n.lane !== a && n.lane !== b);
}
// 반환: 패턴이 시작하는 묶음 번호 목록 (diff 가 있으면 그 난이도 노트만 봄)
function findOuterInner(notes, diff) {
  const ev = groupBySlot(diff ? notes.filter(n => n.diffs.includes(diff)) : notes);
  const hits = [];
  for (let i = 0; i + 2 < ev.length; i++) {
    const [a, b, c] = [ev[i], ev[i + 1], ev[i + 2]];
    if (b.s - a.s > OUTER_INNER_GAP || c.s - b.s > OUTER_INNER_GAP) continue;
    if (crossChord(a, b, c) || crossChord(b, c, a)) hits.push({ i, s: a.s, ev: [a, b, c] });
  }
  return hits;
}
// 제한 패턴: 바깥 동시치기 (14) 바로 뒤(4분 간격 이내)에 안쪽 단타 — (14) 2 3 · (14) 3 2 · (14) 2 · (14) 3
//  써도 되지만, 앞에 나온 같은 유형과 8마디(128칸) 이상 떨어져야 함
const OUTER_CHORD_SPACING = 128;
const isOuterChord = e => e.g.length === 2 && e.g.every(n => n.lane === 0 || n.lane === 3);
const isInnerSingle = e => e.g.length === 1 && (e.g[0].lane === 1 || e.g[0].lane === 2);
function findOuterChordInner(notes, diff) {
  const ev = groupBySlot(diff ? notes.filter(n => n.diffs.includes(diff)) : notes);
  const hits = [];
  for (let i = 0; i + 1 < ev.length; i++) {
    if (isOuterChord(ev[i]) && isInnerSingle(ev[i + 1]) && ev[i + 1].s - ev[i].s <= OUTER_INNER_GAP) hits.push({ i, s: ev[i].s, ev: [ev[i], ev[i + 1]] });
  }
  return hits;
}
// 너무 가까운 것 (바로 앞에 나온 같은 유형과 8마디 안)
function excessOuterChordInner(notes, diff) {
  const hits = findOuterChordInner(notes, diff);
  return hits.filter((h, i) => i > 0 && h.s - hits[i - 1].s < OUTER_CHORD_SPACING);
}
// 금지 패턴: 단타 사이에 동시치기가 끼는 배치 (세 묶음이 4분 간격 이내, 라인은 사용자 기준 1~4)
//  2 (14) 3 · 3 (14) 2 · 2 (14) 2 · 3 (14) 3  /  2 (13) 4 · 4 (13) 2 · 1 (24) 3 · 3 (24) 1
//  1 (23) 4 · 4 (23) 1 계단은 괜찮음
function sandwiched(a, b, c) {
  if (a.g.length !== 1 || b.g.length !== 2 || c.g.length !== 1) return false;
  if (isOuterChord(b)) return isInnerSingle(a) && isInnerSingle(c);
  const x = a.g[0].lane, y = c.g[0].lane;
  if (x === y || b.g.some(n => n.lane === x || n.lane === y)) return false;
  const k = [x, y].sort().join(',');
  return k === '1,3' || k === '0,2'; // 단타 2·4 + (13), 단타 1·3 + (24)
}
function findInnerSandwich(notes, diff) {
  const ev = groupBySlot(diff ? notes.filter(n => n.diffs.includes(diff)) : notes);
  const hits = [];
  for (let i = 0; i + 2 < ev.length; i++) {
    const [a, b, c] = [ev[i], ev[i + 1], ev[i + 2]];
    if (b.s - a.s > OUTER_INNER_GAP || c.s - b.s > OUTER_INNER_GAP) continue;
    if (sandwiched(a, b, c)) hits.push({ i, s: a.s, ev: [a, b, c] });
  }
  return hits;
}
// 손가락 감각이 불편한 배치 개수 (금지 패턴 + 허용 범위를 넘는 (14) 유형)
function awkwardCount(notes, lo = -Infinity, hi = Infinity) {
  // 세 묶음 패턴은 시작부터 8칸 안에서 끝나므로 범위 근처 노트만 봐도 같음 (빠르게)
  //  (14) 유형 간격은 바로 앞 8마디까지만 보면 됨
  const all = lo === -Infinity && hi === Infinity;
  const near = all ? notes : notes.filter(n => n.s >= lo - 8 && n.s <= hi + 8);
  const wide = all ? notes : notes.filter(n => n.s >= lo - OUTER_CHORD_SPACING - 8 && n.s <= hi + 8);
  let c = 0;
  for (const d of ['E', 'N', 'H']) {
    c += findOuterInner(near, d).filter(x => x.s >= lo && x.s <= hi).length;
    c += findInnerSandwich(near, d).filter(x => x.s >= lo && x.s <= hi).length;
    c += excessOuterChordInner(wide, d).filter(x => x.s >= lo && x.s <= hi).length;
  }
  return c;
}

// 반복 자리 (check-charts.js 와 같은 기준): 같은 리듬·같은 배치가 박 단위로 3연속 + 앞 마디와 똑같은 마디(노트 3개 이상)
//  반환: [{ d, lo, hi }] — 고칠 때 바꿔 볼 슬롯 범위 (박 또는 마디)
function repeatHits(notes) {
  const hits = [];
  for (const d of ['E', 'N', 'H']) {
    const sub = notes.filter(n => n.diffs.includes(d));
    const beats = new Map(), bars = new Map();
    for (const n of sub) {
      const g = Math.floor(n.s / 4), b = Math.floor(n.s / 16);
      if (!beats.has(g)) beats.set(g, []);
      beats.get(g).push(n);
      if (!bars.has(b)) bars.set(b, []);
      bars.get(b).push(`${n.s % 16}:${n.lane}${n.len ? 'L' : ''}`);
    }
    const hist = new Map();
    for (const gi of [...beats.keys()].sort((a, b) => a - b)) {
      const g = beats.get(gi).sort((a, b) => a.s - b.s || a.lane - b.lane);
      const rhythm = g.map(n => n.s - gi * 4).join(','), sig = g.map(n => `${n.s - gi * 4}:${n.lane}`).join(' ');
      const h = (hist.get(rhythm) || []).filter(o => gi - o.gi <= 8);
      if (h.length >= 2 && h[h.length - 1].sig === sig && h[h.length - 2].sig === sig) hits.push({ d, lo: gi * 4, hi: gi * 4 + 3, prev: h[h.length - 1].gi * 4 });
      h.push({ gi, sig });
      hist.set(rhythm, h);
    }
    const seen = new Set();
    for (const b of [...bars.keys()].sort((x, y) => x - y)) {
      const arr = bars.get(b);
      if (arr.length < 3) continue;
      const k = arr.sort().join(' ');
      if (seen.has(k)) hits.push({ d, lo: b * 16, hi: b * 16 + 15 });
      else seen.add(k);
    }
  }
  return hits;
}
const repeatCount = notes => repeatHits(notes).length;
// 슬롯 [lo, hi] 의 라인만 바꿀 때 쓰는 빠른 반복 개수: 근처 박의 3연속 + 그 마디가 다른 마디와 같은 수
function repeatProbe(notes, lo, hi) {
  const DS = ['E', 'N', 'H'], blo = Math.floor(lo / 16), bhi = Math.floor(hi / 16);
  const inRange = n => Math.floor(n.s / 16) >= blo && Math.floor(n.s / 16) <= bhi;
  const near = notes.filter(n => n.s >= lo - 40 && n.s <= hi + 40), inBars = notes.filter(inRange);
  const barSigs = (list, d) => {
    const m = new Map();
    for (const n of list) {
      if (!n.diffs.includes(d)) continue;
      const b = Math.floor(n.s / 16);
      if (!m.has(b)) m.set(b, []);
      m.get(b).push(`${n.s % 16}:${n.lane}${n.len ? 'L' : ''}`);
    }
    return [...m.values()].filter(a => a.length >= 3).map(a => a.sort().join(' '));
  };
  const other = Object.fromEntries(DS.map(d => [d, new Set(barSigs(notes.filter(n => !inRange(n)), d))]));
  return () => {
    let c = repeatHits(near).filter(h => h.prev !== undefined && h.lo >= lo - 4 && h.lo <= hi + 36).length;
    for (const d of DS) {
      const seen = new Set();
      for (const k of barSigs(inBars, d)) {
        if (other[d].has(k) || seen.has(k)) c++;
        seen.add(k);
      }
    }
    return c;
  };
}

// 불편한 배치 고치기 (공용): finder(d) 가 찾은 자리마다
//  1) 그 묶음 → 2) 앞뒤 묶음까지 넓혀 라인 순서를 모두 시도 — 금지 패턴·너무 가까운 (14) 유형·연타가 늘지 않고
//     반복(같은 배치 3연속·같은 마디)이 가장 적은 배치를 고름 → 3) 그래도 안 되면 dropOf(h) 노트를 그 난이도에서만 지움
//  어느 난이도에도 안 남은 노트는 notes 배열에서 빠지고 drop = true 표시가 남음. hands(n) 가 true 인 노트는 같은 손 안에서만 바꿈
function fixAwkward(notes, hands, finder, dropOf) {
  const DS = ['E', 'N', 'H'];
  const PERMS = [];
  (function perm(a, rest) {
    if (!rest.length) { if (a.some((v, i) => v !== i)) PERMS.push(a); return; }
    rest.forEach((v, i) => perm(a.concat(v), rest.filter((_, j) => j !== i)));
  })([], [0, 1, 2, 3]);
  const clash = (n, lane, others) => others.some(o => o.lane === lane && (
    Math.abs(o.s - n.s) <= 2 || (o.len && n.s >= o.s && n.s <= o.s + o.len + 1) || (n.len && o.s >= n.s && o.s <= n.s + n.len + 1)));
  const tryWindow = slots => {
    const moving = notes.filter(n => slots.has(n.s));
    const others = notes.filter(n => !slots.has(n.s));
    const handed = moving.some(hands);
    const before = moving.map(n => n.lane);
    const lo = Math.min(...slots) - OUTER_CHORD_SPACING, hi = Math.max(...slots) + OUTER_CHORD_SPACING;
    const awk0 = awkwardCount(notes, lo, hi), probe = repeatProbe(notes, Math.min(...slots), Math.max(...slots));
    let best = null;
    for (const P of PERMS) {
      if (handed && !P.every((l, i) => (l < 2) === (i < 2))) continue;
      if (moving.some(n => clash(n, P[n.lane], others))) continue;
      moving.forEach((n, i) => (n.lane = P[before[i]]));
      const awk = awkwardCount(notes, lo, hi);
      const rep = awk < awk0 ? probe() : Infinity;
      moving.forEach((n, i) => (n.lane = before[i]));
      if (rep < Infinity && (!best || awk < best.awk || (awk === best.awk && rep < best.rep))) best = { P, awk, rep };
    }
    if (!best) return false;
    moving.forEach((n, i) => (n.lane = best.P[before[i]]));
    return true;
  };
  let fixed = 0;
  for (let guard = 0; guard < 300; guard++) {
    let h = null, d = null;
    for (const dd of DS) { const f = finder(dd); if (f.length) { h = f[0]; d = dd; break; } }
    if (!h) break;
    const evAll = groupBySlot(notes.filter(n => n.diffs.includes(d)));
    const i = evAll.findIndex(e => e.s === h.s), k = h.ev.length - 1;
    const windows = [[i, i + k], [i, i + k + 1], [i - 1, i + k], [i - 1, i + k + 1], [i - 2, i + k + 1], [i - 1, i + k + 2]];
    let done = false;
    for (const [a, b] of windows) {
      if (a < 0 || b >= evAll.length) continue;
      if (tryWindow(new Set(evAll.slice(a, b + 1).map(e => e.s)))) { done = true; break; }
    }
    if (!done) {
      const drop = dropOf(h);
      drop.diffs = drop.diffs.replace(d, '');
      if (!drop.diffs) {
        drop.drop = true;
        notes.splice(notes.indexOf(drop), 1);
      }
    }
    fixed++;
  }
  return fixed;
}
// 금지 패턴 1 4 (23) · 2 4 (13) … 고치기 (안 되면 동시치기를 단타로)
function fixOuterInner(notes, hands = () => false) {
  return fixAwkward(notes, hands, d => findOuterInner(notes, d), h => {
    const pair = h.ev.find(e => e.g.length === 2).g;
    return pair.find(n => n.partner) || pair[1];
  });
}
// 금지 패턴 2 (14) 3 · 2 (13) 4 … 고치기 (안 되면 가운데 동시치기를 단타로)
function fixInnerSandwich(notes, hands = () => false) {
  return fixAwkward(notes, hands, d => findInnerSandwich(notes, d), h => {
    const pair = h.ev[1].g;
    return pair.find(n => n.partner) || pair[1];
  });
}
// (14) 2 3 · (14) 2 … 유형이 8마디 안에 다시 나오면 고치기 (안 되면 바깥 동시치기를 단타로)
function spaceOuterChord(notes, hands = () => false) {
  return fixAwkward(notes, hands, d => excessOuterChordInner(notes, d), h => {
    const pair = h.ev[0].g;
    return pair.find(n => n.partner) || pair[1];
  });
}

// 남은 반복 고치기: 반복이 난 박(또는 그 앞 박)·마디의 라인 순서를 바꿔 반복을 줄임
//  금지 패턴·가까운 (14) 유형·연타가 늘면 안 됨. hands(n) 가 true 인 노트는 같은 손 안에서만 바꿈
function fixRepeats(notes, hands = () => false) {
  const PERMS = [];
  (function perm(a, rest) {
    if (!rest.length) { if (a.some((v, i) => v !== i)) PERMS.push(a); return; }
    rest.forEach((v, i) => perm(a.concat(v), rest.filter((_, j) => j !== i)));
  })([], [0, 1, 2, 3]);
  const clash = (n, lane, others) => others.some(o => o.lane === lane && (
    Math.abs(o.s - n.s) <= 2 || (o.len && n.s >= o.s && n.s <= o.s + o.len + 1) || (n.len && o.s >= n.s && o.s <= n.s + n.len + 1)));
  let fixed = 0;
  for (let guard = 0; guard < 100; guard++) {
    const hits = repeatHits(notes), rep0 = hits.length;
    let done = false;
    for (const h of hits) {
      const ranges = h.prev !== undefined ? [[h.lo, h.hi], [h.prev, h.prev + 3]] : [[h.lo, h.hi], [h.lo, h.lo + 7], [h.lo + 8, h.hi]];
      for (const [lo, hi] of ranges) {
        const moving = notes.filter(n => n.s >= lo && n.s <= hi), others = notes.filter(n => n.s < lo || n.s > hi);
        if (!moving.length) continue;
        const handed = moving.some(hands), before = moving.map(n => n.lane);
        const alo = lo - OUTER_CHORD_SPACING, ahi = hi + OUTER_CHORD_SPACING, awk0 = awkwardCount(notes, alo, ahi);
        const probe = repeatProbe(notes, lo, hi), p0 = probe();
        let best = null;
        for (const P of PERMS) {
          if (handed && !P.every((l, i) => (l < 2) === (i < 2))) continue;
          if (moving.some(n => clash(n, P[n.lane], others))) continue;
          moving.forEach((n, i) => (n.lane = P[before[i]]));
          const awk = awkwardCount(notes, alo, ahi), rep = awk <= awk0 ? probe() : Infinity;
          moving.forEach((n, i) => (n.lane = before[i]));
          if (rep < p0 && (!best || rep < best.rep)) best = { P, rep };
        }
        if (!best) continue;
        moving.forEach((n, i) => (n.lane = best.P[before[i]]));
        if (repeatCount(notes) < rep0) { done = true; break; }
        moving.forEach((n, i) => (n.lane = before[i])); // 곡 전체로는 안 줄면 되돌림
      }
      if (done) break;
    }
    if (!done) break;
    fixed++;
  }
  return fixed;
}

/* ----------------------------------------------------------
 * 채보 다듬기: 반복 변형(varyPatterns), 금지 패턴 수정(fixOuterInner, fixInnerSandwich), (14) 유형 간격 맞추기(spaceOuterChord),
 *  남은 반복 고치기(fixRepeats)를
 *  더 바꿀 것이 없을 때까지 번갈아 실행 (최대 4번). 새 곡은 라인 배치 직후 이것만 부르면 됨
 * ---------------------------------------------------------- */
function polishPatterns(notes, hands = () => false) {
  let varied = 0, fixed = 0, spaced = 0;
  for (let r = 0; r < 4; r++) {
    const a = varyPatterns(notes, hands), b = fixOuterInner(notes, hands) + fixInnerSandwich(notes, hands), c = spaceOuterChord(notes, hands);
    const e = fixRepeats(notes, hands);
    varied += a + e;
    fixed += b;
    spaced += c;
    if (!a && !b && !c && !e) break;
  }
  return { varied, fixed, spaced };
}
