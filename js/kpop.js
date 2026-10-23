'use strict';
/* ==========================================================
 * kpop.js — K-pop 댄스곡 "DAZZLE" (132 BPM, D장조 → 마지막 후렴 Eb장조로 전조)
 *
 *  악기: 보컬 합성(모음 공명), 808 베이스, 일렉 피아노, 브라스 스탭, 클랩·스냅·킥
 *  리듬: 정박과 그 쪼개기 위주의 일반곡 (랩·댄스 브레이크는 16분으로 밀도 상승)
 *  키음: 모든 노트에 소리가 연결됨
 *
 *  구성 (42마디, 약 79초)
 *   인트로 4 → 벌스 4 + 랩 4 → 프리코러스 4 → 후렴 8 → 댄스 브레이크 4 → 브리지 4 → 마지막 후렴(전조) 8 → 아웃트로 2
 *  필요: music.js(Sound, INSTRUMENTS), boss.js(voice, layoutLanes, varyPatterns)
 * ========================================================== */

const KPOP = { id: 'dazzle', title: 'DAZZLE', bpm: 132 };
const KS = 60 / KPOP.bpm / 4; // 16분음표 길이(초)

/* ----------------------------------------------------------
 * 악기
 * ---------------------------------------------------------- */
// 모음별 공명 주파수 (F1, F2, F3)
const VOWELS = { a: [800, 1150, 2900], e: [400, 2000, 2550], i: [300, 2300, 3000], o: [450, 800, 2830], u: [325, 700, 2530] };

// 보컬: 톱니파를 모음 공명 필터 3개에 통과. ev: midi, dur, vowel, chop(짧게 끊기), from(끌어올릴 시작음), vib
INSTRUMENTS.vox = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1, f = mtof(ev.midi), d = ev.dur;
  const F = VOWELS[ev.vowel || 'a'];
  const att = ev.chop ? 0.004 : 0.02;
  const gate = ev.chop ? Math.min(d, KS * 1.6) * 0.85 : d;
  const amp = V.gain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(0.22 * vel, t + att);
  amp.gain.setTargetAtTime(0.18 * vel, t + att, 0.08);
  amp.gain.setTargetAtTime(0, t + Math.max(att + 0.01, gate - 0.02), ev.chop ? 0.015 : 0.05);
  amp.connect(bus.out);
  amp.connect(bus.send);
  const src = V.gain(1);
  [[F[0], 1, 6], [F[1], 0.6, 8], [F[2], 0.3, 10]].forEach(([fq, g, q]) => {
    const bp = V.filter('bandpass', fq, q), gg = V.gain(g * 3.2);
    src.connect(bp).connect(gg).connect(amp);
  });
  const body = V.filter('lowpass', 900, 0.7), bg = V.gain(0.22);
  src.connect(body).connect(bg).connect(amp);
  const oscs = [];
  for (const [type, det, g] of [['sawtooth', -6, 0.7], ['sawtooth', 6, 0.7], ['square', 0, 0.25]]) {
    const o = V.osc(type, f, det), og = V.gain(g);
    o.connect(og).connect(src);
    o.start(t);
    o.stop(t + gate + 0.3);
    oscs.push(o);
  }
  // 음 끌어올리기 + 긴 음 비브라토
  const from = ev.from !== undefined ? (ev.from - ev.midi) * 100 : -30;
  const lfo = V.osc('sine', 5.6), depth = V.gain(0);
  if (d > 0.35 && !ev.chop) {
    depth.gain.setValueAtTime(0, t + 0.22);
    depth.gain.linearRampToValueAtTime(ev.vib ?? 18, t + 0.5);
  }
  lfo.connect(depth);
  for (const o of oscs) {
    const base = o.detune.value;
    o.detune.setValueAtTime(base + from, t);
    o.detune.linearRampToValueAtTime(base, t + (ev.from !== undefined ? 0.1 : 0.035));
    depth.connect(o.detune);
  }
  lfo.start(t);
  lfo.stop(t + gate + 0.3);
  // 숨소리
  const n = V.noise(), nb = V.filter('bandpass', F[1] * 1.6, 2), ng = V.gain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.linearRampToValueAtTime(0.025 * vel, t + 0.01);
  ng.gain.setTargetAtTime(0.005 * vel, t + 0.02, 0.05);
  ng.gain.setTargetAtTime(0, t + gate, 0.03);
  n.connect(nb).connect(ng).connect(bus.out);
  n.start(t, Math.random());
  n.stop(t + gate + 0.2);
};

// 808 베이스: 찌그러뜨린 사인파 (from 이 있으면 미끄러져 들어옴)
INSTRUMENTS.sub808 = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1, f = mtof(ev.midi), d = ev.dur;
  const o = V.osc('sine', f), drive = V.gain(2.2), sh = V.shaper(), lp = V.filter('lowpass', 900), amp = V.gain();
  if (ev.from !== undefined) {
    o.frequency.setValueAtTime(mtof(ev.from), t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
  }
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(0.16 * vel, t + 0.004);
  amp.gain.setTargetAtTime(0.11 * vel, t + 0.02, 0.15);
  amp.gain.setTargetAtTime(0, t + d * 0.95, 0.03);
  o.connect(drive).connect(sh).connect(lp).connect(amp).connect(bus.out);
  o.start(t);
  o.stop(t + d + 0.2);
};

// 일렉 피아노 (FM 방식, 음 하나 또는 화음)
INSTRUMENTS.ep = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1, notes = ev.notes || [ev.midi], d = ev.dur || 0.5;
  const amp = V.gain(), peak = (0.14 * vel) / Math.sqrt(notes.length);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(peak, t + 0.004);
  amp.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.4);
  amp.gain.setTargetAtTime(0, t + d, 0.12);
  amp.connect(bus.out);
  amp.connect(bus.send);
  for (const m of notes) {
    const f = mtof(m);
    const car = V.osc('sine', f), mod = V.osc('sine', f), mg = V.gain();
    mg.gain.setValueAtTime(f * 1.6, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.12, t + 0.35);
    mod.connect(mg).connect(car.frequency);
    const tine = V.osc('sine', f * 4), tg = V.gain();
    tg.gain.setValueAtTime(0.22, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    car.connect(amp);
    tine.connect(tg).connect(amp);
    const end = t + d + 0.6;
    for (const o of [car, mod, tine]) { o.start(t); o.stop(end); }
  }
};

// 브라스 스탭 (톱니파 3겹 + 필터가 확 열렸다 닫힘)
INSTRUMENTS.brass = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1, notes = ev.notes, d = ev.dur || KS * 3;
  const peak = (0.25 * vel) / Math.sqrt(notes.length);
  const lp = V.filter('lowpass', 700, 2), amp = V.gain();
  lp.frequency.setValueAtTime(700, t);
  lp.frequency.linearRampToValueAtTime(4200, t + 0.03);
  lp.frequency.setTargetAtTime(1500, t + 0.05, 0.12);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(peak, t + 0.012);
  amp.gain.setTargetAtTime(peak * 0.65, t + 0.03, 0.1);
  amp.gain.setTargetAtTime(0, t + d, 0.05);
  lp.connect(amp);
  amp.connect(bus.out);
  amp.connect(bus.send);
  for (const m of notes) {
    for (const det of [-9, 0, 9]) {
      const o = V.osc('sawtooth', mtof(m), det);
      o.connect(lp);
      o.start(t);
      o.stop(t + d + 0.3);
    }
  }
};

// 팝 킥 (짧고 단단하게)
INSTRUMENTS.pkick = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1;
  const o = V.osc('sine', 170), amp = V.gain();
  o.frequency.setValueAtTime(170, t);
  o.frequency.exponentialRampToValueAtTime(50, t + 0.08);
  o.frequency.exponentialRampToValueAtTime(44, t + 0.25);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(0.85 * vel, t + 0.002);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  o.connect(amp).connect(bus.out);
  o.start(t);
  o.stop(t + 0.35);
  const n = V.noise(), hp = V.filter('highpass', 3000), ng = V.gain();
  ng.gain.setValueAtTime(0.18 * vel, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
  n.connect(hp).connect(ng).connect(bus.out);
  n.start(t, Math.random());
  n.stop(t + 0.02);
};

// 클랩 (노이즈 세 번 + 잔향)
INSTRUMENTS.clap = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1;
  const n = V.noise(), hp = V.filter('highpass', 600), bp = V.filter('bandpass', 1300, 1.2), amp = V.gain();
  amp.gain.setValueAtTime(0.0001, t);
  for (const dt of [0, 0.011, 0.022]) {
    amp.gain.setValueAtTime(0.5 * vel, t + dt);
    amp.gain.exponentialRampToValueAtTime(0.05 * vel, t + dt + 0.009);
  }
  amp.gain.setValueAtTime(0.35 * vel, t + 0.033);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  n.connect(hp).connect(bp).connect(amp);
  amp.connect(bus.out);
  amp.connect(bus.send);
  n.start(t, Math.random());
  n.stop(t + 0.25);
};

// 핑거 스냅
INSTRUMENTS.snap = (ctx, bus, t, ev) => {
  const V = voice(ctx), vel = ev.vel ?? 1;
  const n = V.noise(), bp = V.filter('bandpass', 2600, 2.5), amp = V.gain();
  amp.gain.setValueAtTime(0.6 * vel, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  n.connect(bp).connect(amp);
  amp.connect(bus.out);
  amp.connect(bus.send);
  n.start(t, Math.random());
  n.stop(t + 0.07);
  const o = V.osc('sine', 1900), og = V.gain();
  og.gain.setValueAtTime(0.15 * vel, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
  o.connect(og).connect(bus.out);
  o.start(t);
  o.stop(t + 0.03);
};

/* ----------------------------------------------------------
 * 화성 / 선율 (D장조). arp 는 라인 0~3 에 대응 (높은 음일수록 오른쪽)
 * ---------------------------------------------------------- */
const KCH = {
  Bm: { root: 35, pad: [59, 62, 66, 71], stab: [62, 66, 71], arp: [66, 71, 74, 78] },
  G: { root: 31, pad: [55, 59, 62, 67], stab: [62, 67, 71], arp: [67, 71, 74, 79] },
  D: { root: 38, pad: [57, 62, 66, 69], stab: [62, 66, 69], arp: [66, 69, 74, 78] },
  A: { root: 33, pad: [57, 61, 64, 69], stab: [61, 64, 69], arp: [64, 69, 73, 76] },
  Em: { root: 40, pad: [55, 59, 64, 67], stab: [59, 64, 67], arp: [64, 67, 71, 76] },
  'F#m': { root: 42, pad: [57, 61, 66, 69], stab: [61, 66, 69], arp: [66, 69, 73, 78] },
};

// [16분 위치, 음, 길이, 옵션] — 길이 6 이상은 롱노트
const KV = [ // 벌스
  [[0, 71, 2], [2, 74, 2], [4, 74, 2], [6, 73, 2], [8, 71, 4], [12, 69, 2], [14, 71, 2]],
  [[0, 74, 4], [4, 71, 2], [6, 69, 2], [8, 67, 6, { vib: 20 }], [14, 69, 2]],
  [[0, 69, 2], [2, 71, 2], [4, 74, 2], [6, 76, 2], [8, 78, 4], [12, 76, 2], [14, 74, 2]],
  [[0, 73, 4], [4, 74, 2], [6, 76, 2], [8, 73, 8, { vib: 25 }]],
];
// 후렴 훅 (G A F#m Bm)
const KH1 = [[0, 78, 2], [2, 78, 2], [4, 76, 2], [6, 74, 2], [8, 76, 4], [12, 74, 2], [14, 71, 2]];
const KH2 = [[0, 73, 2], [2, 74, 2], [4, 76, 4], [8, 78, 6, { vib: 25 }], [14, 79, 2]];
const KH3 = [[0, 81, 4], [4, 78, 2], [6, 76, 2], [8, 78, 2], [10, 76, 2], [12, 73, 4]];
const KH4 = [[0, 74, 2], [2, 73, 2], [4, 71, 8, { vib: 30 }], [14, 78, 2]];
const KH4B = [[0, 74, 2], [2, 76, 2], [4, 78, 2], [6, 81, 2], [8, 83, 8, { vib: 30 }]]; // 높이 올라가며 마무리
// 반복될 때 쓰는 응용 선율
const KH2R = [[0, 73, 4], [4, 76, 4], [8, 78, 8, { vib: 25 }]];                                          // 쉼표
const KH3H = [[0, 81, 8, { from: 79, vib: 25 }], [8, 78, 2], [10, 76, 2], [12, 73, 4]];                   // 롱노트
const KH1F = [[0, 78, 2], [2, 78, 2], [4, 76, 2], [6, 74, 2], [8, 76, 1], [9, 78, 1], [10, 79, 1], [11, 81, 1], [12, 83, 4]]; // 16분 폭타
const KH2H = [[0, 73, 8, { vib: 25 }], [8, 78, 8, { vib: 25 }]];                                          // 롱노트 두 개

/* ----------------------------------------------------------
 * 채보 패턴: 16칸 문자열 (공백 무시)
 *  0~3 = 그 라인에 노트 하나, a~f = 동시치기 두 라인, . = 지정 안 함
 *  대문자 A~F = 같은 두 라인이지만 주 노트(EASY에도 나오는 쪽)가 뒤 라인
 * ---------------------------------------------------------- */
const KPAIRS = { a: [0, 3], b: [1, 2], c: [0, 2], d: [1, 3], e: [0, 1], f: [2, 3] };
function parseKPat(pat) {
  const s = pat.replace(/\s/g, '');
  if (s.length !== 16) throw new Error('채보 패턴은 16칸이어야 합니다: ' + pat);
  return [...s].map(c => (KPAIRS[c] ? KPAIRS[c] : KPAIRS[c.toLowerCase()] ? [...KPAIRS[c.toLowerCase()]].reverse() : /[0-3]/.test(c) ? [+c] : null));
}

/* ----------------------------------------------------------
 * 작곡 + 채보
 * ---------------------------------------------------------- */
function composeKpop() {
  const T = s => SONG.leadIn + s * KS;
  const music = [], cands = [];
  const ev = (s, type, o) => { const e = Object.assign({ t: T(s), type }, o); music.push(e); return e; };
  const note = (s, diffs, ks, o) => {
    const n = Object.assign({ s, diffs, ks: [].concat(ks || []), lane: null, len: 0, pitch: null, partner: null }, o);
    cands.push(n);
    return n;
  };
  // 정박(4분) → EASY부터, 8분 → NORMAL부터, 16분 → HARD
  const beatMask = k => (k % 4 === 0 ? 'ENH' : k % 2 === 0 ? 'NH' : 'H');
  // 동시치기 짝: 마디 첫 박 → EASY부터, 셋째 박 → NORMAL부터, 나머지 → HARD
  const pairMask = k => (k === 0 ? 'ENH' : k === 8 ? 'NH' : 'H');
  const both = (a, b) => [...a].filter(c => b.includes(c)).join('');
  const chordWith = (main, diffs, ks) => note(main.s, diffs, ks, { partner: main });
  const CH = (name, tr = 0) => {
    const c = KCH[name];
    return { root: c.root + tr, pad: c.pad.map(m => m + tr), stab: c.stab.map(m => m + tr), arp: c.arp.map(m => m + tr) };
  };

  /* 한 마디: 선율(line)을 연주하고 각 음을 노트로
   *  pat      라인 지정 (없으면 음높이 따라 자동)
   *  fill     선율이 없는 칸에 pat 이 있을 때 그 노트의 소리 (k, lane) → 소리
   *  pair     동시치기 두 번째 노트의 소리 (k, lane, 주 노트) → 소리
   *  masks    { 칸: 'NH' } 난이도 직접 지정, double: 보컬 한 옥타브 아래 겹침
   */
  const play = (s0, o) => {
    const P = o.pat ? parseKPat(o.pat) : Array(16).fill(null);
    const masks = o.masks || {}, pm = o.pairMasks || {}, tr = o.tr || 0, type = o.type || 'vox';
    const at = {};
    for (const [st, m, len, opt = {}] of o.line || []) {
      const ks = [ev(s0 + st, type, Object.assign({ midi: m + tr, dur: len * KS, vowel: o.vowel }, opt))];
      if (o.double) ks.push(ev(s0 + st, type, Object.assign({ midi: m + tr - 12, dur: len * KS, vowel: o.vowel }, opt, { vel: 0.4 })));
      at[st] = note(s0 + st, masks[st] || beatMask(st), ks, { pitch: m + 2, lane: P[st] ? P[st][0] : null, len: len >= 6 ? len - 2 : 0 });
    }
    for (let k = 0; k < 16; k++) {
      const lanes = P[k];
      if (!lanes) continue;
      if (!at[k]) {
        if (!o.fill) throw new Error(`소리 없는 노트: ${s0 / 16}마디 ${k}칸`);
        at[k] = note(s0 + k, masks[k] || beatMask(k), o.fill(k, lanes[0]), { lane: lanes[0] });
      }
      if (lanes.length === 2) {
        if (!o.pair) throw new Error(`동시치기 소리 없음: ${s0 / 16}마디 ${k}칸`);
        note(s0 + k, pm[k] || both(pairMask(k), at[k].diffs), o.pair(k, lanes[1], at[k]), { partner: at[k], lane: lanes[1] });
      }
    }
    return at;
  };

  // 반주
  const stab = (s, ch, vel = 1, len = 3) => ev(s, 'brass', { notes: ch.stab, dur: len * KS, vel });
  const pad = (s0, ch, vel, cutoff, len = 16) => ev(s0, 'dpad', { notes: ch.pad, dur: len * KS, vel: vel * 1.6, cutoff });
  const bass = (s0, root, pat) => { for (const [k, len, up = 0] of pat) ev(s0 + k, 'sub808', { midi: root + up, dur: len * KS }); };
  const BASS_VERSE = [[0, 6], [8, 4], [12, 2, 12]];
  const BASS_8 = [[0, 2], [2, 2, 12], [4, 2], [6, 2], [8, 2], [10, 2, 12], [12, 2], [14, 2]];
  const BASS_POP = [[0, 2], [2, 2, 12], [4, 2], [6, 2, 12], [8, 2], [10, 2, 12], [12, 2], [14, 2, 12]];
  const arp16 = (s0, ch, vel) => {
    const order = [0, 1, 2, 3, 2, 1, 2, 3];
    for (let k = 0; k < 16; k++) ev(s0 + k, 'pluck', { midi: ch.arp[order[k % 8]] + 12, vel });
  };
  const drumsVerse = (s0, o = {}) => {
    const until = o.until ?? 16, d = { snap: {} };
    for (const k of o.kicks || [0, 8]) if (k < until) ev(s0 + k, 'pkick', { vel: 0.85 });
    for (const k of [4, 12]) {
      if (k >= until) continue;
      d.snap[k] = ev(s0 + k, 'snap', { vel: 0.8 });
      if (o.clap) ev(s0 + k, 'clap', { vel: 0.5 });
    }
    for (let k = 0; k < until; k += o.hats16 ? 1 : 2) ev(s0 + k, 'hat', { vel: k % 4 === 2 ? 0.35 : k % 2 ? 0.1 : 0.2 });
    return d;
  };
  const drumsPop = (s0, o = {}) => {
    const until = o.until ?? 16, d = { clap: {} };
    for (const k of [0, 4, 8, 12]) if (k < until) ev(s0 + k, 'pkick', { vel: 0.95 });
    for (const k of [4, 12]) {
      if (k >= until) continue;
      d.clap[k] = ev(s0 + k, 'clap', { vel: 0.8 });
      ev(s0 + k, 'snare', { vel: 0.3 });
    }
    for (let k = 0; k < until; k++) ev(s0 + k, 'hat', k % 4 === 2 ? { vel: 0.5, open: true } : { vel: k % 2 ? 0.1 : 0.18 });
    return d;
  };
  // 후렴 반주 (d.stab0 = 마디 첫 박 브라스, 동시치기 소리로 쓰지 않으면 배경으로 남음)
  const chorusBed = (s0, ch, o = {}) => {
    const d = drumsPop(s0, o);
    bass(s0, ch.root, BASS_POP);
    pad(s0, ch, 0.55, 1800);
    if (o.arp !== 0) arp16(s0, ch, o.arp ?? 0.3);
    d.stab0 = stab(s0, ch, 1, 3);
    return d;
  };
  const pluckOf = (s0, ch, vel = 0.9) => (k, lane) => ev(s0 + k, 'pluck', { midi: ch.arp[lane] + 12, vel });
  const epOf = (s0, ch, len = 2, vel = 0.85) => (k, lane) => ev(s0 + k, 'ep', { midi: ch.arp[lane], dur: len * KS, vel });
  const octaveOf = (s0, vowel) => (k, lane, main) => ev(s0 + k, 'vox', { midi: main.ks[0].midi - 12, dur: main.ks[0].dur, vowel, vel: 0.75 });

  /* ---------- 인트로 (0~3마디): 일렉 피아노 계단 → 보컬 찹 맛보기 ---------- */
  ['Bm', 'G', 'D', 'A'].forEach((name, i) => {
    const s0 = i * 16, ch = CH(name);
    pad(s0, ch, 0.7, [500, 800, 1300, 2000][i]);
    if (i >= 2) {
      ev(s0, 'pkick', { vel: 0.7 });
      ev(s0 + 8, 'pkick', { vel: 0.6 });
      for (const k of [4, 12]) ev(s0 + k, 'snap', { vel: 0.7 });
      bass(s0, ch.root, [[0, 14]]);
    }
    if (i < 3) play(s0, { pat: ['0... 1... 2... 3...', '3... 2... 1... 0...', '2.0. 3.1. 0.2. 1.3.'][i], fill: epOf(s0, ch, i < 2 ? 4 : 2, 0.9) });
    else {
      for (let k = 0; k < 16; k += 2) ev(s0 + k, 'hat', { vel: 0.2 });
      play(s0, {
        line: [[0, 78, 2, { chop: true }], [2, 78, 2, { chop: true }], [4, 76, 2, { chop: true }], [6, 74, 2, { chop: true }], [8, 76, 6, { vib: 20 }]],
        vowel: 'a', pat: '1.3. 2.0. 3.0. ....', fill: epOf(s0, ch), masks: { 10: 'H' },
      });
    }
  });

  /* ---------- 벌스 (4~7마디): 스냅 + 808 + 보컬 ---------- */
  ['Bm', 'G', 'D', 'A'].forEach((name, i) => {
    const s0 = (4 + i) * 16, ch = CH(name);
    const d = drumsVerse(s0);
    bass(s0, ch.root, BASS_VERSE);
    pad(s0, ch, 0.5, 1100);
    const c0 = ev(s0, 'ep', { notes: ch.pad.slice(1), dur: 6 * KS, vel: 0.55 });
    ev(s0 + 8, 'ep', { notes: ch.pad.slice(1), dur: 6 * KS, vel: 0.4 });
    const o = { line: KV[i], vowel: 'o' };
    if (i === 3) Object.assign(o, { pat: '.... .... 3.0. 1...', fill: epOf(s0, ch), masks: { 10: 'H', 12: 'NH' } });
    const at = play(s0, o);
    if (i % 2 === 0) chordWith(at[0], i === 0 ? 'ENH' : 'NH', c0);  // 마디 첫 박 피아노 화음
    else if (at[4]) chordWith(at[4], 'H', d.snap[4]);               // HARD: 둘째 박 스냅
  });

  /* ---------- 랩 (8~11마디): 16분 보컬 찹 — 계단·꺾인 계단이 매 박 다르게 ---------- */
  const RAP = ['0.21 3.0. 1230 2.1.', '3210 2.31 0.2. 1302', '3.0. 2103 1.20 3.1.', '0213 2031 c... ....'];
  ['Bm', 'G', 'D', 'A'].forEach((name, i) => {
    const s0 = (8 + i) * 16, ch = CH(name), last = i === 3;
    drumsVerse(s0, { kicks: i % 2 ? [0, 6, 8, 10] : [0, 8, 10], clap: true, hats16: true, until: last ? 9 : 16 });
    bass(s0, ch.root, last ? [[0, 2], [2, 2, 12], [4, 2], [6, 2, 12], [8, 4]] : BASS_8);
    pad(s0, ch, 0.4, 1000, last ? 9 : 16);
    const P = parseKPat(RAP[i]);
    play(s0, {
      pat: RAP[i],
      fill: (k, lane) => ev(s0 + k, 'vox', { midi: ch.arp[lane], dur: (P[k + 1] ? 1 : 2) * KS, vowel: 'aeao'[k >> 2], chop: true, vel: 1.15 }),
      pair: k => [stab(s0 + k, ch, 1.1, 4), ev(s0 + k, 'crash', {})],
    });
  });

  /* ---------- 프리코러스 (12~15마디): 롱노트 + 반대 손 → 스네어 롤 → 한 박 쉼 ---------- */
  const PRE = [
    { name: 'Em', line: [[0, 71, 8, { vib: 20 }], [8, 74, 4], [12, 76, 4]], pat: '0.3. 2.3. 1... 2...' },
    { name: 'F#m', line: [[0, 73, 8, { vib: 20 }], [8, 76, 4], [12, 78, 4]], pat: '3.0. 1.0. 2... 1...' },
    { name: 'G', line: [[0, 79, 4], [4, 78, 4], [8, 76, 4], [12, 74, 4]], pat: '3.1. 2.0. 1.3. 0.2.' },
    { name: 'A', line: [[0, 76, 12, { from: 74, vib: 25 }]], pat: 'a.2. 3.1. 2312 ....' },
  ];
  PRE.forEach(({ name, line, pat }, i) => {
    const s0 = (12 + i) * 16, ch = CH(name);
    pad(s0, ch, 0.7, 1200 + i * 400);
    if (i < 3) {
      for (const k of i < 2 ? [0, 8] : [0, 4, 8, 12]) ev(s0 + k, 'pkick', { vel: 0.85 });
      for (const k of [4, 12]) ev(s0 + k, 'clap', { vel: 0.6 });
      for (let k = 0; k < 16; k += 2) ev(s0 + k, 'hat', { vel: 0.22 });
    }
    bass(s0, ch.root, i === 3 ? [[0, 12]] : [[0, 6], [8, 6]]);
    if (i === 2) ev(s0, 'riser', { dur: 28 * KS });
    const snare = k => ev(s0 + k, 'snare', { vel: 0.3 + k * 0.035 });
    play(s0, { line, pat, vowel: 'o', fill: i < 2 ? epOf(s0, ch) : snare, pair: snare });
  });

  /* ---------- 후렴 (16~23마디): 1회차 기본 → 2회차 응용 (동시치기 → 쉼표 → 롱노트 → 접기) ---------- */
  const PROG_C = ['G', 'A', 'F#m', 'Bm'];
  for (let i = 0; i < 8; i++) {
    const s0 = (16 + i) * 16, ch = CH(PROG_C[i % 4]);
    if (i % 4 === 0) ev(s0, 'crash', {});
    const d = chorusBed(s0, ch);
    const pl = pluckOf(s0, ch);
    const base = { vowel: 'a', double: true, fill: pl };
    if (i === 0) {
      const at = play(s0, Object.assign({ line: KH1 }, base));
      chordWith(at[0], 'ENH', d.stab0);
      note(s0 + 10, 'H', pl(10, 2), { pitch: 80 });
    } else if (i === 1) {
      const at = play(s0, Object.assign({ line: KH2, pat: '........3.0...2.' }, base));
      chordWith(at[0], 'NH', d.stab0);
    } else if (i === 2) {
      const at = play(s0, Object.assign({ line: KH3 }, base));
      chordWith(at[0], 'NH', d.stab0);
      for (const k of [2, 14]) note(s0 + k, 'H', pl(k, k === 2 ? 3 : 0), { pitch: k === 2 ? 82 : 70 });
    } else if (i === 3) {
      // 14칸: 브라스 엇박 강조 한 번
      const at = play(s0, Object.assign({ line: KH4, pat: '....0.3.2.....f.', masks: { 6: 'NH', 8: 'NH' }, pair: k => stab(s0 + k, ch, 1.1, 2) }, base));
      chordWith(at[0], 'NH', d.stab0);
    } else if (i === 4) {
      // 응용 — 동시치기: 정박마다 짝이 달라짐 (0,1) (1,3) (1,2) (0,2)
      play(s0, Object.assign({ line: KH1, pat: 'e.2. d.0. b... c.3.', pair: k => (k === 0 ? d.stab0 : k === 8 ? stab(s0 + k, ch) : d.clap[k]) }, base));
    } else if (i === 5) {
      // 응용 — 쉼표: 2칸·14칸을 비움
      play(s0, Object.assign({ line: KH2R, pat: 'b...2...3.......', pair: () => d.stab0 }, base));
    } else if (i === 6) {
      // 응용 — 롱노트: 첫 음을 길게 잡고 반대 손으로 플럭
      play(s0, Object.assign({ line: KH3H, pat: '0.3. 2.3. 2.1. 0...' }, base));
    } else {
      // 응용 — 접기: 8분 계단 위에 옥타브 화음 동시치기 → 높은 롱노트 + 반대 손
      play(s0, Object.assign({ line: KH4B, pat: 'a.1. f.0. 3.1. 0...', masks: { 10: 'H', 12: 'NH' }, pair: (k, l, m) => (k === 0 ? d.stab0 : octaveOf(s0, 'a')(k, l, m)) }, base));
    }
  }

  /* ---------- 댄스 브레이크 (24~27마디): 보컬 찹, 셋째 박마다 16분 짧은 폭타 ---------- */
  const BREAK = ['b.3. 0.2. 0123 1.0.', 'd.2. 0.1. 3210 2.3.', 'c.3. 1.2. 0213 0.2.', 'a.2. 1.3. 2031 c...'];
  PROG_C.forEach((name, i) => {
    const s0 = (24 + i) * 16, ch = CH(name), last = i === 3;
    if (i === 0) ev(s0, 'crash', {});
    const d = chorusBed(s0, ch, { arp: 0, until: last ? 13 : 16 });
    play(s0, {
      pat: BREAK[i],
      fill: (k, lane) => ev(s0 + k, 'vox', { midi: ch.arp[lane], dur: (k % 4 === 0 || k % 4 === 2 ? 2 : 1) * KS, vowel: 'aoea'[k >> 2], chop: true, vel: 1.2 }),
      pair: k => (k === 0 ? d.stab0 : [stab(s0 + k, ch, 1.1, 4), ev(s0 + k, 'crash', {})]),
    });
  });

  /* ---------- 브리지 (28~31마디): 하프타임, 롱노트를 양손 번갈아 ---------- */
  const BRIDGE = [
    { name: 'Em', line: [[0, 79, 12, { vib: 22 }]], pat: '0.3. 2.3. 2.3. 1.0.' },
    { name: 'F#m', line: [[0, 81, 12, { vib: 22 }]], pat: '3.0. 1.0. 1.0. 2...' },
    { name: 'G', line: [[0, 83, 4], [4, 81, 4], [8, 79, 4], [12, 78, 4]], pat: '2.0. 3.0. 1.3. 0.2.' },
    { name: 'A', line: [[0, 81, 8, { vib: 22 }]], pat: '0.3. 2.3. 1023 1203' },
  ];
  BRIDGE.forEach(({ name, line, pat }, i) => {
    const s0 = (28 + i) * 16, ch = CH(name), build = i === 3;
    pad(s0, ch, 0.8, 1500);
    bass(s0, ch.root, [[0, 14]]);
    ev(s0, 'ep', { notes: ch.pad.slice(1), dur: 8 * KS, vel: 0.45 });
    if (build) {
      for (const k of [0, 4, 8, 12]) ev(s0 + k, 'pkick', { vel: 0.8 });
      ev(s0, 'riser', { dur: 16 * KS });
    } else {
      ev(s0, 'pkick', { vel: 0.8 });
      ev(s0 + 8, 'clap', { vel: 0.7 });
      for (let k = 0; k < 16; k += 2) ev(s0 + k, 'hat', { vel: 0.15 });
    }
    const ep = epOf(s0, ch, 2, 0.75);
    play(s0, {
      line, pat, vowel: 'o',
      fill: build ? (k, lane) => (k < 8 ? ep(k, lane) : ev(s0 + k, 'snare', { vel: 0.35 + (k - 8) * 0.07 })) : ep,
      masks: { 2: 'H', 6: 'H', 10: build ? 'NH' : 'H', 14: build ? 'NH' : 'H' },
    });
  });

  /* ---------- 마지막 후렴 (32~39마디): 반음 위로 전조, 네 번째 훅이라 마디마다 다른 응용 ---------- */
  const FINAL = [
    { line: KH1, pat: 'b.0. d.2. a... c.3.', fold: true },                                                      // 접기: 옥타브 화음 동시치기
    { line: KH2, pat: '0.1. 2... 3.01 012.', masks: { 10: 'NH', 11: 'H', 12: 'H', 13: 'H' } },                 // 롱노트 + 16분 트릴
    { line: KH3, pat: 'a... b.0. d.2. e...', chord: true },                                                     // 동시치기: 정박마다
    { line: KH4, pat: '2.1. 3.0. 1.0. ..f.', masks: { 6: 'NH', 8: 'NH', 10: 'H' }, accent: true },            // 롱노트 + 엇박 강조
    { line: KH1F, pat: 'e.2. 3.1. 2013 c...', pairMasks: { 12: 'NH' }, burst: true },                          // 16분 폭타
    { line: KH2H, pat: '0.3. 2.1. 3.0. 1.0.' },                                                                 // 롱노트 두 개 (양손 번갈아)
    { line: KH3, pat: 'b... c.3. e.3. b...', fold: true },                                                      // 접기
    { line: KH4B, pat: '0.1. 2.3. 1.23 23..', masks: { 10: 'NH', 11: 'H', 12: 'H', 13: 'H' } },               // 계단 → 롱노트(왼손) + 오른손 트릴
  ];
  FINAL.forEach((f, i) => {
    const s0 = (32 + i) * 16, ch = CH(PROG_C[i % 4], 1);
    if (i % 4 === 0) ev(s0, 'crash', {});
    const d = chorusBed(s0, ch, { arp: 0.4 });
    let pair = null;
    if (f.fold) pair = (k, l, m) => (k === 0 ? [d.stab0, octaveOf(s0, 'a')(k, l, m)] : octaveOf(s0, 'a')(k, l, m));
    if (f.chord) pair = k => (k === 0 ? d.stab0 : k === 8 ? stab(s0 + k, ch) : d.clap[k]);
    if (f.accent) pair = k => stab(s0 + k, ch, 1.1, 2);
    if (f.burst) pair = k => (k === 0 ? d.stab0 : [stab(s0 + k, ch, 1.1, 4), ev(s0 + k, 'crash', {})]);
    play(s0, { line: f.line, pat: f.pat, masks: f.masks, pairMasks: f.pairMasks, vowel: 'a', double: !f.fold, tr: 1, fill: pluckOf(s0, ch), pair });
  });

  /* ---------- 아웃트로 (40~41마디): 훅 한 번 더 → 양손 롱노트로 끝 ---------- */
  {
    const s0 = 40 * 16, ch = CH('G', 1);
    const d = chorusBed(s0, ch, { arp: 0 });
    play(s0, {
      line: [[0, 78, 2], [2, 78, 2], [4, 76, 2], [6, 74, 2], [8, 79, 8, { vib: 25 }]],
      pat: 'd.0. 2.3. 1... ....', vowel: 'a', double: true, tr: 1, pair: () => d.stab0,
    });
  }
  {
    const s0 = 41 * 16, ch = CH('D', 1);
    ev(s0, 'pkick');
    ev(s0, 'crash', {});
    bass(s0, ch.root, [[0, 14]]);
    pad(s0, ch, 0.9, 1600, 24);
    note(s0, 'ENH', [ev(s0, 'vox', { midi: 75, dur: 14 * KS, vowel: 'a', vib: 28 }), ev(s0, 'vox', { midi: 63, dur: 14 * KS, vowel: 'a', vel: 0.4 })], { lane: 0, len: 12 });
    note(s0, 'ENH', [ev(s0, 'brass', { notes: ch.stab, dur: 14 * KS, vel: 1 }), ev(s0, 'ep', { notes: ch.pad, dur: 14 * KS, vel: 0.7 })], { lane: 3, len: 12 });
  }

  const BARS = 42;
  const notes = layoutLanes(cands);
  polishPatterns(notes); // 반복 변형 + 금지 패턴(1 4 (23) 등) 수정
  music.sort((a, b) => a.t - b.t);
  const charts = ['E', 'N', 'H'].map(d => notes
    .filter(n => n.diffs.includes(d))
    .sort((a, b) => a.s - b.s || a.lane - b.lane)
    .map(n => ({ t: T(n.s), lane: n.lane, end: n.len ? T(n.s + n.len) : 0, ks: n.ks, s: n.s, len: n.len })));
  const playTime = BARS * 16 * KS;
  const levels = charts.map(c => Math.max(1, Math.min(15, Math.round(1.5 + (c.length / playTime) * 1.5 + (KPOP.bpm - 150) / 30))));
  return {
    music, charts, levels,
    duration: T(BARS * 16),
    beats: Array.from({ length: BARS * 4 + 1 }, (_, i) => T(i * 4)),
  };
}
