'use strict';
/* ==========================================================
 * gugak.js — 국악 퓨전 댄스곡 "Sinmyeong (신명)" (124 BPM, A 계면조풍 5음계)
 *
 *  악기: 가야금(줄 뜯는 소리를 물리 모델로 합성), 단소, 태평소,
 *        장구(덩·덕·쿵), 꽹과리, 징, 북 + 댄스 드럼/베이스
 *  리듬: 정박과 그 쪼개기(8분·16분) 위주의 일반곡
 *  키음: 모든 노트에 악기 소리가 연결됨
 *        장구는 덩 = 양손 동시치기, 쿵 = 왼손 라인(0·1), 덕 = 오른손 라인(2·3)
 *
 *  구성 (44마디, 약 85초)
 *   인트로 4 → 벌스 8 → 빌드 2 → 후렴 8 → 단소 솔로 8 → 사물놀이 4 → 후렴2 8 → 엔딩 2
 *  필요: music.js(Sound, INSTRUMENTS), boss.js(voice, layoutLanes)
 * ========================================================== */

const GUGAK = { id: 'sinmyeong', title: 'Sinmyeong', bpm: 124 };
const GS = 60 / GUGAK.bpm / 4; // 16분음표 길이(초)

/* ----------------------------------------------------------
 * 가야금: 카플러스-스트롱 알고리즘으로 줄 뜯는 소리를 미리 계산
 * ---------------------------------------------------------- */
const GAYA_SR = 44100;
const gayaWaves = new Map();
function gayaWave(midi) {
  let w = gayaWaves.get(midi);
  if (w) return w;
  const f = mtof(midi), sr = GAYA_SR;
  const N = Math.max(2, Math.floor(sr / f - 0.5));      // 줄 길이(샘플)
  const dur = midi < 60 ? 2.8 : midi < 72 ? 2.2 : 1.6;
  const len = Math.floor(sr * dur);
  const y = new Float32Array(len);
  // 손가락으로 뜯은 부드러운 떨림 (저역 노이즈) + 뜯는 위치에 따른 음색
  let seed = midi * 7919 + 13;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const exc = new Float32Array(N + 1);
  let lp = 0;
  for (let i = 0; i <= N; i++) { lp += 0.45 * (rnd() - lp); exc[i] = lp; }
  const pos = Math.max(1, Math.round(N * 0.2));
  for (let i = 0; i <= N; i++) y[i] = exc[i] - 0.85 * (i >= pos ? exc[i - pos] : 0);
  // 줄이 울리며 감쇠 (고음일수록 빨리)
  const rho = Math.pow(0.001, 1 / (dur * 0.75 * f));
  for (let n = N + 1; n < len; n++) y[n] = rho * (0.5 * y[n - N] + 0.5 * y[n - N - 1]);
  let pk = 0;
  for (let i = 0; i < len; i++) pk = Math.max(pk, Math.abs(y[i]));
  for (let i = 0; i < len; i++) y[i] /= pk || 1;
  w = { data: y, rate: (f * (N + 0.5)) / sr }; // rate: 정확한 음높이로 맞추는 재생 속도
  gayaWaves.set(midi, w);
  return w;
}
const gayaBufs = new WeakMap();
function gayaBuffer(ctx, midi) {
  let m = gayaBufs.get(ctx);
  if (!m) gayaBufs.set(ctx, (m = new Map()));
  let b = m.get(midi);
  if (!b) {
    const w = gayaWave(midi);
    const buffer = ctx.createBuffer(1, w.data.length, GAYA_SR);
    buffer.getChannelData(0).set(w.data);
    b = { buffer, rate: w.rate };
    m.set(midi, b);
  }
  return b;
}

// ev: midi, vel, dur(이후 손으로 막음), bend(꺾는 소리, 반음 수), vib(농현 깊이, 센트)
INSTRUMENTS.gaya = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1;
  const { buffer, rate } = gayaBuffer(ctx, ev.midi);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const pr = src.playbackRate;
  pr.setValueAtTime(rate, t);
  if (ev.bend) {
    pr.setValueAtTime(rate, t + 0.06);
    pr.linearRampToValueAtTime(rate * Math.pow(2, ev.bend / 12), t + 0.18);
    pr.linearRampToValueAtTime(rate, t + 0.36);
  }
  let lfo = null;
  if (ev.vib) {
    lfo = V.osc('sine', 4.6);
    const depth = V.gain(0);
    depth.gain.setValueAtTime(0, t + 0.2);
    depth.gain.linearRampToValueAtTime(rate * (Math.pow(2, ev.vib / 1200) - 1), t + 0.6);
    lfo.connect(depth).connect(pr);
  }
  const body = V.filter('peaking', 280, 1.2);
  body.gain.value = 5;
  const air = V.filter('highshelf', 4000);
  air.gain.value = -3;
  const amp = V.gain(0.9 * vel);
  const ring = Math.max(0.25, (ev.dur || 0.6) + 0.15);
  amp.gain.setTargetAtTime(0, t + ring, ev.vib ? 0.4 : 0.15);
  src.connect(body).connect(air).connect(amp);
  amp.connect(bus.out);
  amp.connect(bus.send);
  const end = t + Math.min(buffer.duration / rate, ring + (ev.vib ? 2 : 0.8));
  src.start(t);
  src.stop(end);
  if (lfo) { lfo.start(t); lfo.stop(end); }
};

/* ----------------------------------------------------------
 * 관악기: 시김새(아래에서 끌어올림) + 떨림. ev: midi, dur, from(시작음), vib(센트), fall(끝음 내림)
 * ---------------------------------------------------------- */
function windPitch(V, t, ev, oscs, defScoop, rate, vibDefault) {
  const d = ev.dur;
  const from = ev.from !== undefined ? (ev.from - ev.midi) * 100 : defScoop;
  const glide = ev.from !== undefined ? 0.12 : 0.05;
  const lfo = V.osc('sine', rate), depth = V.gain(0);
  if (d > 0.3) {
    depth.gain.setValueAtTime(0, t + 0.2);
    depth.gain.linearRampToValueAtTime(ev.vib ?? vibDefault, t + 0.55);
  }
  lfo.connect(depth);
  for (const o of oscs) {
    const base = o.detune.value;
    o.detune.setValueAtTime(base + from, t);
    o.detune.linearRampToValueAtTime(base, t + glide);
    if (ev.fall && d > 0.45) {
      o.detune.setValueAtTime(base, t + d - 0.18);
      o.detune.linearRampToValueAtTime(base - ev.fall * 100, t + d);
    }
    depth.connect(o.detune);
  }
  lfo.start(t);
  lfo.stop(t + d + 0.3);
}

// 단소: 맑은 대나무 피리 + 숨소리
INSTRUMENTS.danso = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1, f = mtof(ev.midi), d = ev.dur;
  const amp = V.gain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(0.2 * vel, t + 0.05);
  amp.gain.setTargetAtTime(0.16 * vel, t + 0.06, 0.1);
  amp.gain.setTargetAtTime(0, t + Math.max(0.06, d - 0.03), 0.05);
  amp.connect(bus.out);
  amp.connect(bus.send);
  const tone = V.filter('lowpass', Math.min(12000, f * 5), 0.5);
  tone.connect(amp);
  const oscs = [];
  for (const [type, mul, g] of [['sine', 1, 1], ['sine', 2, 0.1], ['triangle', 1, 0.25]]) {
    const o = V.osc(type, f * mul), og = V.gain(g);
    o.connect(og).connect(tone);
    o.start(t);
    o.stop(t + d + 0.3);
    oscs.push(o);
  }
  windPitch(V, t, ev, oscs, -35, 5.4, 16);
  const n = V.noise(), bp = V.filter('bandpass', f * 1.5, 1.5), breath = V.gain();
  breath.gain.setValueAtTime(0.0001, t);
  breath.gain.linearRampToValueAtTime(0.08 * vel, t + 0.03);
  breath.gain.setTargetAtTime(0.02 * vel, t + 0.05, 0.08);
  breath.gain.setTargetAtTime(0, t + Math.max(0.06, d - 0.03), 0.05);
  n.connect(bp).connect(breath).connect(bus.out);
  n.start(t, Math.random());
  n.stop(t + d + 0.3);
};

// 태평소: 겹리드의 쨍한 소리 (톱니파 → 찌그러짐 → 두 개의 공명대)
INSTRUMENTS.tps = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1, f = mtof(ev.midi), d = ev.dur;
  const amp = V.gain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(0.2 * vel, t + 0.03);
  amp.gain.setTargetAtTime(0.165 * vel, t + 0.04, 0.12);
  amp.gain.setTargetAtTime(0, t + Math.max(0.05, d - 0.03), 0.04);
  amp.connect(bus.out);
  amp.connect(bus.send);
  const drive = V.gain(1.4), sh = V.shaper(), hp = V.filter('highpass', 380, 0.7);
  const f1 = V.filter('bandpass', 1150, 2.5), f2 = V.filter('bandpass', 2700, 3.5), g2 = V.gain(0.7), dry = V.gain(0.3);
  drive.connect(sh).connect(hp);
  hp.connect(f1).connect(amp);
  hp.connect(f2).connect(g2).connect(amp);
  hp.connect(dry).connect(amp);
  const oscs = [];
  for (const [type, det, g] of [['sawtooth', 0, 1], ['square', 6, 0.45]]) {
    const o = V.osc(type, f, det), og = V.gain(g);
    o.connect(og).connect(drive);
    o.start(t);
    o.stop(t + d + 0.2);
    oscs.push(o);
  }
  windPitch(V, t, ev, oscs, -80, 6.2, 30);
};

/* ----------------------------------------------------------
 * 타악기
 * ---------------------------------------------------------- */
// 장구: stroke = deong(덩: 양면) / kung(쿵: 궁편, 낮은 울림) / deok(덕: 채편, 날카로운 대나무 채)
INSTRUMENTS.jang = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1, st = ev.stroke;
  if (st === 'kung' || st === 'deong') {
    const o = V.osc('sine', 165), amp = V.gain();
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(92, t + 0.14);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(0.55 * vel, t + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(amp).connect(bus.out);
    o.start(t);
    o.stop(t + 0.4);
    const n = V.noise(), lp = V.filter('lowpass', 500), ng = V.gain();
    ng.gain.setValueAtTime(0.18 * vel, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    n.connect(lp).connect(ng).connect(bus.out);
    n.start(t, Math.random());
    n.stop(t + 0.08);
  }
  if (st === 'deok' || st === 'deong') {
    const n = V.noise(), bp = V.filter('bandpass', 3200, 1.1), ng = V.gain();
    ng.gain.setValueAtTime(0.4 * vel, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    n.connect(bp).connect(ng).connect(bus.out);
    n.start(t, Math.random());
    n.stop(t + 0.06);
    const o = V.osc('triangle', 600), amp = V.gain();
    o.frequency.setValueAtTime(600, t);
    o.frequency.exponentialRampToValueAtTime(430, t + 0.06);
    amp.gain.setValueAtTime(0.22 * vel, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    o.connect(amp).connect(bus.out);
    o.start(t);
    o.stop(t + 0.12);
  }
};

// 꽹과리: 작은 놋쇠 징 (어긋난 배음), damp=true 면 손으로 막은 짧은 소리
INSTRUMENTS.kkwaeng = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1, dec = ev.damp ? 0.07 : 0.45;
  const hp = V.filter('highpass', 600), out = V.gain(vel);
  hp.connect(out).connect(bus.out);
  [[1, 1], [1.48, 0.8], [2.09, 0.6], [2.71, 0.45], [3.32, 0.35], [4.1, 0.25]].forEach(([r, a], i) => {
    const o = V.osc(i % 2 ? 'square' : 'sine', 1050 * r), g = V.gain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.035 * a, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec / (1 + i * 0.3));
    o.connect(g).connect(hp);
    o.start(t);
    o.stop(t + dec + 0.05);
  });
  const n = V.noise(), nh = V.filter('highpass', 4500), ng = V.gain();
  ng.gain.setValueAtTime(0.18, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  n.connect(nh).connect(ng).connect(out);
  n.start(t, Math.random());
  n.stop(t + 0.04);
};

// 징: 낮게 "웅~" 하고 오래 울리는 큰 징 (가까운 배음끼리 맥놀이)
INSTRUMENTS.jing = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1, f = 108;
  const out = V.gain(vel);
  out.connect(bus.out);
  out.connect(bus.send);
  [[1, 0.5, 4.5], [1.012, 0.35, 4], [2.04, 0.18, 2.5], [2.79, 0.12, 1.8], [3.6, 0.07, 1.2], [5.1, 0.04, 0.8]].forEach(([r, a, dec]) => {
    const o = V.osc('sine', f * r), g = V.gain();
    o.frequency.setValueAtTime(f * r * 0.985, t);
    o.frequency.linearRampToValueAtTime(f * r, t + 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(a * 0.5, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dec + 0.05);
  });
  const n = V.noise(), lp = V.filter('lowpass', 250), ng = V.gain();
  ng.gain.setValueAtTime(0.3, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  n.connect(lp).connect(ng).connect(out);
  n.start(t, Math.random());
  n.stop(t + 0.12);
};

// 북: 깊고 둥근 울림
INSTRUMENTS.buk = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1;
  const o = V.osc('sine', 120), amp = V.gain();
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(58, t + 0.2);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(0.75 * vel, t + 0.005);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  o.connect(amp).connect(bus.out);
  o.start(t);
  o.stop(t + 0.55);
  const n = V.noise(), lp = V.filter('lowpass', 300), ng = V.gain();
  ng.gain.setValueAtTime(0.25 * vel, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  n.connect(lp).connect(ng).connect(bus.out);
  n.start(t, Math.random());
  n.stop(t + 0.1);
};

/* ----------------------------------------------------------
 * 화성 / 선율
 *  모두 A 5음계(라 도 레 미 솔) 안의 음. arp 는 라인 0~3 에 대응
 * ---------------------------------------------------------- */
const GCH = {
  Am: { root: 45, pad: [57, 64, 69, 72], arp: [64, 69, 72, 76] },
  C: { root: 48, pad: [55, 60, 64, 67], arp: [64, 67, 72, 76] },
  G: { root: 43, pad: [55, 62, 67, 74], arp: [62, 67, 74, 79] },
};
const PROG_V = ['Am', 'Am', 'G', 'Am'];
const PROG_C = ['Am', 'C', 'G', 'Am'];
const PROG_S = ['Am', 'G', 'C', 'Am'];

// [16분 위치, 음, 길이, 옵션] — 옵션: lane(라인 지정), bend, vib, from, fall
const GAYA_HOOK = [
  [[0, 69, 2], [2, 72, 2], [4, 74, 2], [6, 76, 2], [8, 74, 2], [10, 72, 2], [12, 69, 4]],
  [[0, 76, 2], [2, 79, 2], [4, 76, 1], [5, 74, 1], [6, 72, 2], [8, 74, 4, { vib: 35 }], [12, 69, 2], [14, 72, 2]],
  [[0, 74, 2], [2, 76, 2], [4, 79, 2], [6, 81, 2], [8, 79, 2], [10, 76, 2], [12, 74, 4, { bend: 2 }]],
  [[0, 72, 2], [2, 69, 2], [4, 67, 2], [6, 69, 2], [8, 69, 8, { vib: 45 }]],
  // 두 번째 마무리: 16분 오름 계단으로 빌드에 연결
  [[0, 72, 2], [2, 69, 2], [4, 67, 2], [6, 69, 2],
    [8, 69, 1, { lane: 0 }], [9, 72, 1, { lane: 1 }], [10, 74, 1, { lane: 2 }], [11, 76, 1, { lane: 3 }],
    [12, 79, 1, { lane: 0 }], [13, 81, 1, { lane: 1 }], [14, 84, 1, { lane: 2 }], [15, 86, 1, { lane: 3 }]],
];
// 태평소 후렴 (길게 꺾어 우는 롱노트)
const TPS_LINE = [
  [[0, 81, 6, { from: 79, vib: 30, lane: 3 }], [6, 79, 2], [8, 76, 4], [12, 74, 2], [14, 76, 2]],
  [[0, 72, 8, { from: 69, vib: 30, lane: 0 }], [8, 74, 2], [10, 76, 2], [12, 79, 4]],
  [[0, 81, 4], [4, 79, 4], [8, 76, 4], [12, 74, 4]],
  [[0, 76, 8, { from: 74, vib: 30, lane: 3, fall: 2 }], [8, 74, 2], [10, 72, 2], [12, 69, 4]],
];
const TPS_LAST = [[0, 81, 8, { from: 79, vib: 35, lane: 3 }], [8, 79, 2], [10, 81, 2], [12, 84, 4, { from: 81 }]];

// 반복 구간에서 쓰는 응용 선율
//  쉼표: 훅에서 2·14 자리를 비움 (첫 음을 길게)
const GAYA_HOOK_REST = [[0, 76, 4, { vib: 20 }], [4, 76, 1], [5, 74, 1], [6, 72, 2], [8, 74, 4, { vib: 35 }], [12, 69, 4]];
//  롱노트: 벌스 2회차 G 마디에 단소가 길게 얹힘 (오른손 → 왼손)
const DANSO_OVER = [[0, 86, 8, { from: 84, vib: 25, lane: 3 }], [8, 81, 8, { from: 79, vib: 25, lane: 0 }]];
//  쉼표: 태평소 후렴 둘째 마디에서 10 자리를 비움
const TPS_REST = [[0, 72, 8, { from: 69, vib: 30, lane: 0 }], [8, 74, 4], [12, 79, 4]];
//  롱노트: 4분음표 마디를 태평소 롱노트 두 개로 (양손 번갈아 잡기)
const TPS_HOLD2 = [[0, 81, 8, { from: 79, vib: 30, lane: 3 }], [8, 76, 8, { from: 74, vib: 30, lane: 0 }]];
//  쌍현: 4분마다 가야금 두 줄을 함께 뜯어 동시치기
const GAYA_FOLD = [[67, 74], [67, 76], [64, 72], [62, 74]];
// 단소 솔로 (8마디) — 7마디째 16분 12연타 계단
const DANSO_SOLO = [
  [[0, 88, 4, { from: 86 }], [4, 86, 2], [6, 84, 2], [8, 81, 8, { vib: 22 }]],
  [[0, 84, 2], [2, 86, 2], [4, 88, 4], [8, 86, 2], [10, 84, 2], [12, 81, 4]],
  [[0, 79, 4], [4, 81, 2], [6, 84, 2], [8, 86, 4], [12, 84, 2], [14, 81, 2]],
  [[0, 88, 8, { from: 86, vib: 25 }], [8, 86, 4], [12, 84, 4]],
  [[0, 81, 2], [2, 84, 2], [4, 86, 2], [6, 88, 2], [8, 86, 2], [10, 84, 2], [12, 81, 2], [14, 79, 2]],
  [[0, 81, 4], [4, 76, 4], [8, 79, 4], [12, 81, 4]],
  [[0, 81, 1, { lane: 0 }], [1, 84, 1, { lane: 1 }], [2, 86, 1, { lane: 2 }], [3, 88, 1, { lane: 3 }],
    [4, 86, 1, { lane: 1 }], [5, 84, 1, { lane: 2 }], [6, 81, 1, { lane: 3 }], [7, 84, 1, { lane: 0 }],
    [8, 86, 1, { lane: 2 }], [9, 88, 1, { lane: 1 }], [10, 86, 1, { lane: 0 }], [11, 84, 1, { lane: 3 }], [12, 86, 4]],
  [[0, 88, 12, { from: 84, vib: 28 }]],
];
// 사물놀이 장구 장단 (D=덩, K=쿵, t=덕) — 모두 정박과 그 쪼개기
//  덕 16분 두 번(오른손 두 라인) 바로 뒤에는 덩이 오지 않게 → 다음은 쿵(왼손)
const SAMUL = [
  { 0: 'D', 2: 't', 4: 'K', 6: 't', 8: 'D', 10: 't', 12: 'K', 14: 't', 15: 'K' },
  { 0: 'D', 2: 't', 4: 'K', 6: 't', 8: 'D', 10: 't', 12: 'D', 14: 't' },
  { 0: 'D', 2: 't', 3: 't', 4: 'K', 6: 't', 8: 'D', 10: 't', 11: 't', 12: 'K', 14: 't', 15: 'K' },
  { 0: 'D', 2: 't', 4: 'K', 6: 't', 8: 'D', 10: 'D', 12: 'D' }, // 덩 덩 덩 — 한 박 쉬고 후렴으로
];

/* ----------------------------------------------------------
 * 작곡 + 채보
 * ---------------------------------------------------------- */
function composeGugak() {
  const T = s => SONG.leadIn + s * GS;
  const music = [], cands = [];
  const ev = (s, type, o) => { const e = Object.assign({ t: T(s), type }, o); music.push(e); return e; };
  const note = (s, diffs, ks, o) => {
    const n = Object.assign({ s, diffs, ks: [].concat(ks || []), lane: null, len: 0, pitch: null, partner: null }, o);
    cands.push(n);
    return n;
  };
  // 정박(4분) → EASY부터, 8분 → NORMAL부터, 16분 → HARD
  const beatMask = st => (st % 4 === 0 ? 'ENH' : st % 2 === 0 ? 'NH' : 'H');
  const maskOf = (k, E, N, H) => (E.includes(k) ? 'E' : '') + (N.includes(k) ? 'N' : '') + (H.includes(k) ? 'H' : '');
  // 동시치기 짝 (lane 을 주면 그 라인에 고정)
  const chordWith = (main, diffs, ks, lane = null) => note(main.s, diffs, ks, { partner: main, lane });
  // 선율 한 마디: 악기 type 으로 연주하고 각 음을 노트로. 반환: { 위치: 노트 }
  //  mirror=true: 같은 선율이 다시 나올 때 라인 흐름을 좌우 반전 (음이 올라가면 왼쪽으로)
  const melody = (s0, type, line, shift = 0, mirror = false) => {
    const at = {};
    for (const [st, m, len, opt = {}] of line) {
      const e = ev(s0 + st, type, Object.assign({ midi: m, dur: len * GS }, opt));
      at[st] = note(s0 + st, beatMask(st), e, { pitch: mirror ? 150 - (m - shift) : m - shift, lane: opt.lane ?? null, len: len >= 6 ? len - 2 : 0 });
    }
    return at;
  };

  // 반주
  const dance = (s0, o = {}) => {
    for (const k of [0, 4, 8, 12]) ev(s0 + k, 'kick', { vel: o.kick ?? 0.9 });
    if (o.clap !== false) for (const k of [4, 12]) ev(s0 + k, 'snare', { vel: 0.55 });
    for (let k = 2; k < 16; k += 4) ev(s0 + k, 'hat', { vel: 0.6, open: true });
    if (o.hats16) for (let k = 0; k < 16; k++) if (k % 4 !== 2) ev(s0 + k, 'hat', { vel: 0.14 });
  };
  // 장구 "덩 (기)덕 쿵 덕" — 3·11 은 박 직전 16분 꾸밈 덕(기덕)
  const jangGroove = (s0, vel = 0.8) => {
    const pat = { 0: 'deong', 2: 'deok', 3: 'deok', 4: 'kung', 6: 'deok', 8: 'deong', 10: 'deok', 11: 'deok', 12: 'kung', 14: 'deok' };
    const out = {};
    for (const k of Object.keys(pat)) {
      const soft = k === '3' || k === '11';
      out[k] = ev(s0 + +k, 'jang', { stroke: pat[k], vel: vel * (soft ? 0.4 : pat[k] === 'deok' ? 0.7 : 1) });
    }
    ev(s0 + 15, 'jang', { stroke: 'deok', vel: vel * 0.35 });
    return out;
  };
  const bassLine = (s0, root, vel = 0.6) => {
    for (let k = 0; k < 16; k += 2) ev(s0 + k, 'bass', { midi: root + (k % 4 === 2 ? 12 : 0), dur: 1.6 * GS, vel });
  };
  const gayaArp = (s0, ch, vel, every) => {
    const order = [0, 1, 2, 3, 2, 1, 2, 3];
    for (let k = 0; k < 16; k += every) ev(s0 + k, 'gaya', { midi: ch.arp[order[(k / every) % 8]], vel, dur: every * GS });
  };
  const pad = (s0, ch, vel, cutoff, len = 16) => ev(s0, 'dpad', { notes: ch.pad, dur: len * GS, vel: vel * 0.55, cutoff });

  // 후렴: 태평소 롱노트 동안 반대 손으로 가야금 (fast=true 면 16분 트릴)
  //  vary: chord(반 마디·넷째 박 장구 동시치기) / rest(쉼표 — 채움 노트 없음) / fold(4분마다 가야금 쌍현 동시치기)
  const chorusBar = (s0, pi, line, fast, mirror, vary) => {
    const ch = GCH[PROG_C[pi]];
    const jg = jangGroove(s0, 0.7);
    bassLine(s0, ch.root);
    pad(s0, ch, 0.7, 1500);
    gayaArp(s0, ch, 0.22, 2);
    if (mirror) line = line.map(([st, m, l, o]) => [st, m, l, o && o.lane !== undefined ? Object.assign({}, o, { lane: 3 - o.lane }) : o]);
    const at = melody(s0, 'tps', line, 0, mirror), first = at[0];
    const quarters = line.every(([, , l]) => l === 4);
    const M = l => (mirror ? 3 - l : l);
    const held = k => line.some(([st, , l, o = {}]) => l >= 6 && o.lane !== undefined && st < k && k <= st + l - 2);
    // HARD: 기덕 꾸밈 (쉼표 마디, 응용한 4분 마디, 롱노트를 누르는 중에는 뺌)
    if (!at[11] && vary !== 'rest' && !(quarters && vary) && !held(11)) note(s0 + 11, 'H', jg[11]);
    // 태평소가 4분으로 길게 갈 때: 4분 내림 계단 + 사이사이 가야금 8분
    //  동시치기 짝도 계단처럼 움직임 (0,3) → (2,3) → (1,2) → (0,1)
    const Q = { main: [3, 2, 1, 0], fill: { 2: 1, 6: 0, 10: 3, 14: 2 }, pair: [0, 3, 2, 1] };
    const pairLane = k => (quarters ? M(Q.pair[k / 4]) : null);
    if (quarters) {
      [0, 4, 8, 12].forEach((k, q) => { if (at[k]) at[k].lane = M(Q.main[q]); });
      for (const k of [2, 6, 10, 14]) {
        const lane = M(Q.fill[k]);
        const e = ev(s0 + k, 'gaya', { midi: ch.arp[lane] + 12, vel: 0.8, dur: GS * 2 });
        note(s0 + k, k === 6 || k === 14 ? 'NH' : 'H', e, { lane });
      }
    }
    if (vary === 'fold') {
      GAYA_FOLD.forEach(([a, b], q) => {
        const k = q * 4;
        if (at[k]) chordWith(at[k], 'NH', [ev(s0 + k, 'gaya', { midi: a, dur: 4 * GS, vel: 0.45 }), ev(s0 + k, 'gaya', { midi: b, dur: 4 * GS, vel: 0.45 })], pairLane(k));
      });
    }
    // 롱노트마다 반대 손으로 가야금
    let holdEnd = -1;
    for (const [st, , len, opt = {}] of line) {
      if (len < 6 || opt.lane === undefined) continue;
      holdEnd = st + len - 2;
      const other = opt.lane === 3 ? [0, 1] : [3, 2];
      if (pi % 2) other.reverse();
      const steps = fast ? (len >= 8 ? [2, 3, 4, 5] : [2, 3]) : len >= 8 ? [2, 4] : [2];
      steps.forEach((d, j) => {
        const lane = other[j % 2], k = st + d;
        const e = ev(s0 + k, 'gaya', { midi: ch.arp[lane] + 12, vel: 0.8, dur: GS });
        note(s0 + k, d === 4 ? 'NH' : 'H', e, { lane });
      });
    }
    if (vary === 'chord') {
      if (at[8] && !at[8].len) chordWith(at[8], 'NH', jg[8], pairLane(8));
      if (at[12] && !at[12].len) chordWith(at[12], 'H', jg[12], pairLane(12));
    }
    // HARD: 롱노트가 끝난 뒤 태평소가 쉬는 8분 자리는 가야금으로 채움 (쉼표 응용 마디는 비워 둠)
    if (holdEnd >= 0 && vary !== 'rest') {
      for (let k = holdEnd + 2; k < 16; k += 2) {
        if (at[k] || at[k - 1]?.len) continue;
        const e = ev(s0 + k, 'gaya', { midi: ch.arp[(k / 2) % 4] + 12, vel: 0.75, dur: GS * 2 });
        note(s0 + k, 'H', e, { pitch: ch.arp[(k / 2) % 4] });
      }
    }
    chordWith(first, pi === 0 ? 'ENH' : 'NH', jg[0]);
  };

  const SECTIONS = [['intro', 4], ['verse', 8], ['build', 2], ['chorus', 8], ['solo', 8], ['samul', 4], ['chorus2', 8], ['outro', 2]];
  let bar = 0;
  for (const [name, count] of SECTIONS) {
    for (let i = 0; i < count; i++, bar++) {
      const s0 = bar * 16;

      if (name === 'intro') {
        // 징 한 번 → 가야금 독주 (느린 계단 → 8분 → 16분 글리산도)
        const ch = GCH.Am;
        pad(s0, ch, 0.55, 900);
        if (i === 0) {
          ev(s0, 'jing');
          melody(s0, 'gaya', [[0, 57, 4, { lane: 0 }], [4, 64, 4, { lane: 1 }], [8, 69, 4, { lane: 2 }], [12, 72, 4, { lane: 3, vib: 40 }]]);
        } else if (i === 1) {
          melody(s0, 'gaya', [[0, 76, 6, { vib: 35 }], [6, 74, 2], [8, 72, 4, { bend: 2 }], [12, 69, 4]]);
        } else if (i === 2) {
          ['deong', 'deok', 'kung', 'deok'].forEach((st, q) => ev(s0 + q * 4, 'jang', { stroke: st, vel: 0.6 }));
          melody(s0, 'gaya', [69, 72, 74, 76, 74, 72, 69, 72].map((m, q) => [q * 2, m, 2, { lane: [0, 1, 2, 3, 2, 1, 0, 1][q] }]));
        } else {
          ev(s0, 'jang', { stroke: 'deong', vel: 0.7 });
          ev(s0 + 4, 'jang', { stroke: 'deok', vel: 0.6 });
          for (let k = 12; k < 16; k++) ev(s0 + k, 'jang', { stroke: 'deok', vel: 0.4 + (k - 12) * 0.12 });
          melody(s0, 'gaya', [[0, 76, 4, { bend: 2 }], [4, 74, 4],
            ...[69, 72, 74, 76, 79, 81, 84, 86].map((m, q) => [8 + q, m, 1, { lane: q % 4 }])]);
        }
      }

      else if (name === 'verse') {
        // 댄스 비트 + 장구 "덩 덕 쿵 덕" + 가야금 메인 훅, 마디 첫 박 장구 덩 동시치기
        //  두 번째(후반 4마디)는 마디마다 응용: 동시치기 → 쉼표 → 단소 롱노트 → 쌍현 동시치기 + 16분 계단
        const pi = i % 4, ch = GCH[PROG_V[pi]];
        const vary = i >= 4 ? ['chord', 'rest', 'hold', 'fold'][pi] : null;
        if (i === 0) ev(s0, 'jing', { vel: 0.8 });
        dance(s0, { hats16: i >= 4 });
        const jg = jangGroove(s0, 0.8);
        bassLine(s0, ch.root);
        pad(s0, ch, 0.45, 1200);
        const line = vary === 'rest' ? GAYA_HOOK_REST : GAYA_HOOK[vary === 'fold' ? 4 : pi];
        const at = melody(s0, 'gaya', line, 0, i >= 4);
        // 응용 마디는 라인을 직접 정함 (동시치기 짝이 매번 다른 조합이 되도록)
        const PRESET = {
          chord: { main: { 0: 0, 2: 2, 4: 1, 6: 0, 8: 1, 10: 3, 12: 0 }, pair: { 0: 3, 4: 3, 8: 2, 12: 2 } }, // (0,3) 2 (1,3) 0 (1,2) 3 (0,2)
          hold: { main: { 0: 0, 2: 1, 4: 0, 6: 1, 8: 2, 10: 3, 12: 2 }, pair: {} },                           // 롱노트 반대 손
          fold: { main: { 0: 1, 2: 0, 4: 2, 6: 3 }, pair: { 0: 3, 4: 1 } },                                    // (1,3) 0 (1,2) 3 → 16분 계단
        }[vary];
        if (PRESET) for (const k in PRESET.main) if (at[k]) at[k].lane = PRESET.main[k];
        const pairLane = k => (PRESET && PRESET.pair[k] !== undefined ? PRESET.pair[k] : null);
        if (vary === 'hold') melody(s0, 'danso', DANSO_OVER); // 단소가 길게 부르는 동안(롱노트) 가야금 훅은 반대 손으로
        if (vary === 'fold') {
          // 가야금 쌍현(두 줄 함께 뜯기) → 8분 동시치기
          for (const [k, m] of [[0, 76], [4, 72]]) chordWith(at[k], 'NH', ev(s0 + k, 'gaya', { midi: m, dur: 2 * GS, vel: 0.55 }), pairLane(k));
        } else chordWith(at[0], pi === 0 ? 'ENH' : pi === 2 ? 'NH' : 'H', jg[0], pairLane(0));
        if (vary === 'chord') {
          // 정박마다 장구 동시치기 (덩·쿵)
          chordWith(at[8], 'NH', jg[8], pairLane(8));
          for (const k of [4, 12]) chordWith(at[k], 'H', jg[k], pairLane(k));
        } else if (at[8] && !at[8].len) chordWith(at[8], 'H', jg[8]); // HARD: 반 마디 덩
        // HARD: 기덕 꾸밈 (응용 마디에서는 빼서 변화가 잘 들리게)
        if (!vary) for (const k of [3, 11]) if (!at[k] && !at[k - 1]?.len) note(s0 + k, 'H', jg[k]);
      }

      else if (name === 'build') {
        // 꽹과리 몰아치기 (8분 → 16분), 단소가 길게 부름
        const ch = GCH[i === 0 ? 'C' : 'G'];
        for (const k of [0, 4, 8, 12]) {
          ev(s0 + k, 'kick', { vel: 0.85 });
          ev(s0 + k, 'jang', { stroke: 'deong', vel: 0.75 });
        }
        pad(s0, ch, 0.6, 1400);
        ev(s0, 'bass', { midi: ch.root, dur: 15 * GS, vel: 0.5 });
        if (i === 0) {
          ev(s0, 'riser', { dur: 32 * GS });
          ev(s0, 'danso', { midi: 88, dur: 8 * GS, from: 84 });
          ev(s0 + 8, 'danso', { midi: 86, dur: 8 * GS });
          [0, 2, 1, 3, 0, 2, 1, 3].forEach((lane, q) => {
            const k = q * 2, e = ev(s0 + k, 'kkwaeng', { vel: 0.5 + q * 0.03, damp: q % 2 === 1 });
            note(s0 + k, maskOf(k, [0, 8], [0, 4, 8, 12], [0, 2, 4, 6, 8, 10, 12, 14]), e, { lane });
          });
        } else {
          ev(s0, 'danso', { midi: 84, dur: 14 * GS, from: 81, vib: 25 });
          const plan = [[0, 0], [2, 2], [4, 1], [6, 3], [8, 0], [9, 1], [10, 2], [11, 3], [12, 0], [13, 1], [14, 2], [15, 0]];
          plan.forEach(([k, lane]) => {
            const e = ev(s0 + k, 'kkwaeng', { vel: 0.6 + k * 0.02, damp: k % 2 === 1 });
            note(s0 + k, beatMask(k), e, { lane });
          });
        }
      }

      else if (name === 'chorus' || name === 'chorus2') {
        // 태평소 후렴은 네 번 나오므로 두 번째부터 응용
        //  후렴 후반: 동시치기·쉼표 / 후렴2 전반: 롱노트 두 개 / 후렴2 후반: 동시치기·쌍현
        const pi = i % 4, last = i === 7;
        const vary = (name === 'chorus'
          ? [null, null, null, null, 'chord', 'rest', 'chord', 'chord']
          : [null, null, 'hold2', null, 'chord', null, 'fold', 'chord'])[i];
        const line = vary === 'rest' ? TPS_REST : vary === 'hold2' ? TPS_HOLD2 : last ? TPS_LAST : TPS_LINE[pi];
        if (pi === 0) ev(s0, 'jing', { vel: 0.8 });
        dance(s0, { hats16: true });
        if (name === 'chorus2') {
          ev(s0, 'buk', { vel: 0.8 });
          for (let k = 0; k < 16; k += 2) ev(s0 + k, 'kkwaeng', { vel: k % 4 ? 0.2 : 0.32, damp: k % 4 !== 0 });
        } else {
          for (const k of [0, 4, 8, 12]) ev(s0 + k, 'kkwaeng', { vel: 0.3, damp: k % 8 !== 0 });
        }
        chorusBar(s0, pi, line, name === 'chorus2', (name === 'chorus2') !== (i >= 4), vary);
      }

      else if (name === 'solo') {
        // 단소 독주: 반주를 덜어내고, 마지막 두 마디에 다시 쌓음
        const pi = i % 4, ch = GCH[PROG_S[pi]];
        if (i === 0) ev(s0, 'jing', { vel: 0.7 });
        if (i >= 6) dance(s0, { kick: 0.8, clap: i === 7 });
        else { ev(s0, 'kick', { vel: 0.75 }); ev(s0 + 8, 'kick', { vel: 0.65 }); }
        const strokes = ['deong', 'deok', 'kung', 'deok'].map((st, q) => ev(s0 + q * 4, 'jang', { stroke: st, vel: 0.5 }));
        pad(s0, ch, 0.7, 1100);
        ev(s0, 'bass', { midi: ch.root, dur: 14 * GS, vel: 0.4 });
        gayaArp(s0, ch, 0.28, 2);
        const at = melody(s0, 'danso', DANSO_SOLO[i], 12);
        chordWith(at[0], 'H', strokes[0]); // HARD: 마디 첫 박 덩
        if (i === 7) {
          ev(s0, 'riser', { dur: 16 * GS });
          for (let k = 12; k < 16; k++) ev(s0 + k, 'jang', { stroke: 'deok', vel: 0.5 + (k - 12) * 0.12 });
        }
      }

      else if (name === 'samul') {
        // 사물놀이: 장구 덩 = 양손 동시치기, 쿵 = 왼손, 덕 = 오른손
        const ch = GCH.Am;
        if (i === 0) ev(s0, 'jing');
        for (const k of [0, 4, 8, 12]) ev(s0 + k, 'kick', { vel: 0.9 });
        ev(s0, 'buk');
        ev(s0 + 8, 'buk', { vel: 0.8 });
        for (let k = 0; k < 16; k += 2) ev(s0 + k, 'kkwaeng', { vel: k % 4 ? 0.22 : 0.38, damp: k % 4 !== 0 });
        for (const k of [0, 4, 8, 12]) ev(s0 + k, 'bass', { midi: ch.root, dur: 3 * GS, vel: 0.6 });
        ev(s0, 'dpad', { notes: [45, 52, 57, 64], dur: 16 * GS, vel: 0.33, cutoff: 900 });
        if (i === 2) ev(s0, 'tps', { midi: 88, dur: 16 * GS, from: 84, vib: 35 });
        if (i === 3) ev(s0, 'tps', { midi: 86, dur: 12 * GS, from: 88, vib: 35, fall: 2 });
        samulBar(s0, SAMUL[i]);
      }

      else if (name === 'outro') {
        const ch = GCH.Am;
        if (i === 0) {
          // 가야금 글리산도 → 징 + 덩
          pad(s0, ch, 0.7, 1300);
          for (const k of [0, 4]) ev(s0 + k, 'kick', { vel: 0.85 });
          [69, 72, 74, 76, 79, 81, 84].forEach((m, q) => {
            const e = ev(s0 + q, 'gaya', { midi: m, dur: GS, vel: 0.9 });
            note(s0 + q, beatMask(q), e, { lane: [0, 1, 2, 3, 0, 1, 2][q], pitch: m });
          });
          ev(s0 + 8, 'jing');
          ev(s0 + 8, 'kick');
          ev(s0 + 8, 'tps', { midi: 81, dur: 8 * GS, from: 79, vib: 30 });
          [[8, [0, 3], 'ENH'], [12, [1, 2], 'NH']].forEach(([k, [l, r], mask]) => {
            note(s0 + k, mask, ev(s0 + k, 'jang', { stroke: 'kung', vel: 0.9 }), { lane: l, hand: true });
            note(s0 + k, mask, ev(s0 + k, 'jang', { stroke: 'deok', vel: 0.9 }), { lane: r, hand: true });
          });
        } else {
          // 마지막 화음: 양손 롱노트
          ev(s0, 'jing', { vel: 0.8 });
          ev(s0, 'buk', { vel: 0.7 });
          pad(s0, ch, 0.9, 1100, 24);
          ev(s0, 'bass', { midi: ch.root, dur: 12 * GS, vel: 0.55 });
          note(s0, 'ENH', [ev(s0, 'jang', { stroke: 'kung' }), ev(s0, 'gaya', { midi: 57, dur: 14 * GS, vib: 30, vel: 0.5 }), ev(s0, 'gaya', { midi: 64, dur: 14 * GS, vel: 0.45 })], { lane: 0, len: 12 });
          note(s0, 'ENH', [ev(s0, 'jang', { stroke: 'deok' }), ev(s0, 'gaya', { midi: 69, dur: 14 * GS, vel: 0.45 }), ev(s0, 'tps', { midi: 81, dur: 14 * GS, from: 79, vib: 30, fall: 3, vel: 0.8 })], { lane: 3, len: 12 });
        }
      }
    }
  }

  // 장구 장단 → 노트 (같은 라인이 16분 2칸 안에 겹치지 않도록 번갈아 배치)
  function samulBar(s0, pat) {
    const used = {}; // lane → 마지막 위치
    for (const n of cands) if (n.lane !== null && n.s > s0 - 4) used[n.lane] = Math.max(used[n.lane] ?? -99, n.s);
    const free = (l, s) => s - (used[l] ?? -99) > 2;
    const take = (l, s) => (used[l] = s);
    let lastL = 1, lastR = 3;
    const pickHand = (s, lanes, last) => {
      const pref = [lanes.find(l => l !== last), last];
      const l = pref.find(x => free(x, s)) ?? pref[0];
      take(l, s);
      return l;
    };
    for (const k of Object.keys(pat).map(Number).sort((a, b) => a - b)) {
      const s = s0 + k, st = pat[k];
      if (st === 'D') {
        const mask = k % 8 === 0 ? 'ENH' : 'NH';
        const pairs = [[0, 3], [1, 2], [0, 2], [1, 3]];
        const pair = pairs.find(([a, b]) => free(a, s) && free(b, s) && !(a === lastL && b === lastR)) || pairs.find(([a, b]) => free(a, s) && free(b, s)) || [0, 3];
        take(pair[0], s);
        take(pair[1], s);
        lastL = pair[0];
        lastR = pair[1];
        note(s, mask, ev(s, 'jang', { stroke: 'kung', vel: 0.95 }), { lane: pair[0], hand: true });
        note(s, mask, ev(s, 'jang', { stroke: 'deok', vel: 0.95 }), { lane: pair[1], hand: true });
      } else if (st === 'K') {
        lastL = pickHand(s, [0, 1], lastL);
        note(s, beatMask(k), ev(s, 'jang', { stroke: 'kung', vel: 0.85 }), { lane: lastL, hand: true });
      } else {
        lastR = pickHand(s, [2, 3], lastR);
        note(s, k % 2 === 0 ? 'NH' : 'H', ev(s, 'jang', { stroke: 'deok', vel: k % 2 ? 0.6 : 0.8 }), { lane: lastR, hand: true });
      }
    }
  }

  const notes = layoutLanes(cands);
  polishPatterns(notes, n => n.hand); // 반복 변형 + 금지 패턴(1 4 (23) 등) 수정, 장구는 같은 손 안에서
  music.sort((a, b) => a.t - b.t);
  const charts = ['E', 'N', 'H'].map(d => notes
    .filter(n => n.diffs.includes(d))
    .sort((a, b) => a.s - b.s || a.lane - b.lane)
    .map(n => ({ t: T(n.s), lane: n.lane, end: n.len ? T(n.s + n.len) : 0, ks: n.ks, s: n.s, len: n.len })));
  const playTime = bar * 16 * GS;
  const levels = charts.map(c => Math.max(1, Math.min(15, Math.round(1.5 + (c.length / playTime) * 1.5 + (GUGAK.bpm - 150) / 30))));
  return {
    music, charts, levels,
    duration: T(bar * 16),
    beats: Array.from({ length: bar * 4 + 1 }, (_, i) => T(i * 4)),
  };
}
