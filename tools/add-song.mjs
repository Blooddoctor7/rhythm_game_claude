#!/usr/bin/env node
/* ==========================================================
 * add-song.mjs — mp3 파일을 분석해서 게임에 곡으로 추가합니다.
 *
 *  사용법 (macOS, 프로젝트 폴더에서):
 *    node tools/add-song.mjs <곡.mp3> --id last_note --title "Last Note" [--cover 커버.jpg]
 *
 *  옵션:
 *    --artist "이름"   아티스트 표시
 *    --unit 155.4      16분음표 길이(ms)를 직접 지정 (자동 인식이 틀릴 때)
 *    --shift 0         노트 전체를 ms 단위로 밀기 (+ 늦게)
 *    --seed 1          라인 배치 난수 시드 (다른 배치를 원할 때)
 *
 *  결과: songs/<id>/ 에 chart.js(채보), audio.js(음원), cover.jpg 생성 + index.html에 등록
 * ========================================================== */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as A from './analyze.mjs';
import vm from 'vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 게임 코드의 공용 함수 (패턴 변형 varyPatterns 등)
const GAME = vm.createContext({ window: {}, console, Math, Float32Array, Object, Array, Set, Map, WeakMap, JSON, Error });
for (const f of ['music.js', 'boss.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), GAME, { filename: f });

// ---------- 인자 ----------
const argv = process.argv.slice(2);
const opt = { artist: '', shift: 0, seed: 1 };
const files = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i];
  else files.push(argv[i]);
}
const src = files[0];
if (!src || !opt.id || !opt.title) {
  console.log('사용법: node tools/add-song.mjs <곡.mp3> --id <영문id> --title "<제목>" [--cover <이미지>] [--artist ..] [--unit ms] [--shift ms]');
  process.exit(1);
}
if (!/^[a-z0-9_]+$/.test(opt.id)) throw new Error('--id 는 영문 소문자/숫자/_ 만 사용하세요');

// ---------- 1. 디코딩 (macOS afconvert) ----------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'beatrush-'));
const wavPath = path.join(tmp, 'a.wav');
execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@22050', '-c', '1', src, wavPath]);
const { rate, x } = A.readWav(fs.readFileSync(wavPath));
fs.rmSync(tmp, { recursive: true, force: true });
const duration = x.length / rate;
console.log(`▶ ${opt.title}  (${duration.toFixed(2)}초)`);

// ---------- 2. 스펙트럼 / 어택 ----------
const sp = A.spectral(x, rate);
const env = A.smooth(A.rectify(sp.flux, 20), 1);
const band = { low: A.smooth(A.rectify(sp.low, 20), 1), mid: A.smooth(A.rectify(sp.mid, 20), 1), high: A.smooth(A.rectify(sp.high, 20), 1) };
const pct = (arr, p) => { const s = Array.from(arr).sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };
const envStd = Math.sqrt(env.reduce((a, v) => a + v * v, 0) / env.length);

// ---------- 3. 박자 ----------
const peakMin = pct(env, 0.6);
const slots = [];
if (opt.grid === 'track') {
  // 예전 방식: 8분음표를 하나씩 추적 (템포가 크게 바뀌는 곡용)
  let unit;
  if (opt.unit) unit = +opt.unit / 1000;
  else {
    const u = A.findUnit(env, sp);
    unit = u.period;
    console.log(`  격자 단위 ${(unit * 1000).toFixed(1)}ms (격자 일치도 ${u.ratio.toFixed(2)})`);
  }
  let beats = A.trackBeats(env.map(v => v / envStd), sp, unit * 2);
  beats = beats.map(t => { const p = A.peakNear(env, sp, t, 0.02, peakMin); return p ? p.t : t; });
  for (let i = 0; i < beats.length; i++) {
    slots.push({ t: beats[i], eighth: i });
    if (i + 1 < beats.length) slots.push({ t: (beats[i] + beats[i + 1]) / 2, eighth: -1 });
  }
} else {
  // 기본: 템포 맵 — 구간별 템포를 매끄럽게 이어 정박을 구하고, 한 박을 16분 4칸으로 나눔
  let bpm0 = +opt.bpm;
  if (!bpm0) {
    const cands = A.tempoCandidates(env, sp.hop, 70, 200);
    bpm0 = cands[0].bpm;
  }
  const map = A.tempoMap(env, band.low, sp, duration, bpm0);
  const q = map.beats;
  console.log(`  템포 맵: ${map.wins[0].bpm.toFixed(1)} → ${map.wins[map.wins.length - 1].bpm.toFixed(1)} BPM, 반 박 보정 ${map.halfFixes}곳, 곡선 오차 ${(map.maxRes * 1000).toFixed(1)}ms${map.shifted ? ', 정박 반 박 이동' : ''}`);
  for (let i = 0; i + 1 < q.length; i++) {
    const d = (q[i + 1] - q[i]) / 4;
    for (let j = 0; j < 4; j++) slots.push({ t: q[i] + j * d, eighth: j % 2 ? -1 : 2 * i + j / 2 });
  }
  slots.push({ t: q[q.length - 1], eighth: 2 * (q.length - 1) });
}
const toF = t => t / sp.hop - A.N / 2 / A.HOP;
const maxNear = (e, t) => { let m = 0; const f = toF(t); for (let k = Math.floor(f - 1.5); k <= Math.ceil(f + 1.5); k++) if (k >= 0 && k < e.length) m = Math.max(m, e[k]); return m; };
for (const s of slots) {
  s.raw = maxNear(env, s.t);
  s.low = maxNear(band.low, s.t);
  s.mid = maxNear(band.mid, s.t);
  s.high = maxNear(band.high, s.t);
  const pk = A.peakNear(env, sp, s.t, opt.grid === 'track' ? 0.035 : 0.03, peakMin * 0.5);
  s.at = pk ? pk.t : s.t;                       // 노트는 실제 어택 시각에 붙임
  s.cent = sp.cent[Math.max(0, Math.min(sp.frames - 1, Math.round(toF(s.at))))];
}
const p95 = pct(slots.map(s => s.raw), 0.95);
slots.forEach(s => (s.s = Math.min(1.5, s.raw / p95)));

// 정박(4분음표) 위치: 짝수/홀수 8분 중 저음+중음 어택이 강한 쪽
const par = [0, 0];
slots.forEach(s => { if (s.eighth >= 0) par[s.eighth % 2] += s.low + s.mid; });
const parity = opt.grid === 'track' ? (par[0] >= par[1] ? 0 : 1) : 0; // 템포 맵은 이미 정박을 정함
slots.forEach(s => (s.metric = s.eighth < 0 ? 0.65 : s.eighth % 2 === parity ? 1 : 0.85));
const quarters = slots.filter(s => s.eighth >= 0 && s.eighth % 2 === parity).map(s => s.t);
const ibi = [];
for (let i = 1; i < quarters.length; i++) ibi.push(quarters[i] - quarters[i - 1]);
const bpm = 60 / pct(ibi, 0.5);
// 마디 시작: 4박 중 저음이 가장 강한 위치
const barScore = [0, 0, 0, 0];
quarters.forEach((t, i) => (barScore[i % 4] += maxNear(band.low, t) + 0.5 * maxNear(env, t)));
const barPhase = barScore.indexOf(Math.max(...barScore));
console.log(`  BPM 약 ${bpm.toFixed(1)} (구간별로 따라감), 정박 ${quarters.length}개`);

// 노트 시각: 기본은 박 격자 위 (실제 리듬게임처럼 일정한 간격) + 구간별 어택 보정
//  정박에서 잰 '실제 어택 - 격자' 값을 앞뒤 6초 안의 중앙값으로 보정, --snap 이면 노트마다 어택에 붙임
const beatOffs = A.attackOffsets(x, rate, quarters, 0.04);
const allOffs = beatOffs.map(o => o.off).sort((a, b) => a - b);
const globalOff = allOffs.length ? allOffs[Math.floor(allOffs.length / 2)] : 0;
const localOff = t => {
  const near = beatOffs.filter(o => Math.abs(o.beat - t) < 6).map(o => o.off).sort((a, b) => a - b);
  return near.length >= 5 ? near[Math.floor(near.length / 2)] : globalOff;
};
const offCache = new Map();
const noteTime = i => {
  if (opt.snap) return slots[i].at;
  const t = slots[i].t, key = Math.round(t);
  if (!offCache.has(key)) offCache.set(key, localOff(key));
  return t + offCache.get(key);
};
console.log(`  어택 보정: 전체 ${(globalOff * 1000).toFixed(1)}ms (구간별로 따로 적용)`);

// 구간 에너지 (앞뒤 1마디 평균 음량) → 조용한 곳은 노트를 덜
const rmsAt = t => sp.rms[Math.max(0, Math.min(sp.frames - 1, Math.round(toF(t))))];
const eRaw = slots.map((s, i) => {
  let sum = 0, n = 0;
  for (let k = Math.max(0, i - 16); k < Math.min(slots.length, i + 16); k++) { sum += rmsAt(slots[k].t); n++; }
  return sum / n;
});
const eMax = pct(eRaw, 0.98);
slots.forEach((s, i) => (s.e = Math.min(1, eRaw[i] / eMax)));

// ---------- 4. 노트 선택 ----------
// 마디 구조: 정박(4분음표) → 슬롯 번호
const quarterSlots = [];
slots.forEach((s, i) => { if (s.eighth >= 0 && s.eighth % 2 === parity) quarterSlots.push(i); });
const isBeat = i => slots[i].eighth >= 0 && slots[i].eighth % 2 === parity;
const bars = [], barOf = new Int32Array(slots.length).fill(-1);
for (let q = barPhase; q < quarterSlots.length; q += 4) {
  const a = quarterSlots[q], b = q + 4 < quarterSlots.length ? quarterSlots[q + 4] : slots.length;
  for (let i = a; i < b; i++) barOf[i] = bars.length;
  bars.push({ a, b });
}

// 난이도 설정
//  gap: 노트 사이 최소 간격(16분 슬롯)   chain: 그 간격으로 이어질 수 있는 최대 개수
//  nps: 목표 밀도(초당)   chord: 동시치기 비율   burst: 폭타 마디 비율   pattern: 계단 패턴을 쓸 확률
const DIFFS = [
  { name: 'EASY', gap: 2, chain: 4, nps: 2.1, minS: 0.15, longGap: 6, chord: 0.04, inside: 0, burst: 0, pattern: 0.5 },
  { name: 'NORMAL', gap: 1, chain: 3, nps: 3.9, minS: 0.12, longGap: 6, chord: 0.12, inside: 6, burst: 0, pattern: 0.75 },
  { name: 'HARD', gap: 1, chain: 10, nps: 5.6, minS: 0.08, longGap: 8, chord: 0.14, inside: 10, burst: 0.25, pattern: 0.9 },
];
const longFrom = new Map(); // EASY에서 찾은 롱노트(지속음) → 상위 난이도에도 유지
const slotDur = (slots[slots.length - 1].t - slots[0].t) / (slots.length - 1);
const active = slots.filter(s => s.e > 0.15).length * slotDur; // 소리가 나는 시간
const score = s => s.s * s.metric * (0.5 + 0.5 * s.e);

// i 를 포함해서 간격 gap 이하로 이어진 노트 개수
function chainLen(sel, i, gap) {
  let n = 1;
  for (const dir of [-1, 1]) {
    let k = i;
    for (;;) {
      let f = -1;
      for (let d = 1; d <= gap; d++) if (sel.has(k + dir * d)) { f = k + dir * d; break; }
      if (f < 0) break;
      n++;
      k = f;
    }
  }
  return n;
}

let prevSel = new Set();
const charts = [];
for (const D of DIFFS) {
  const sel = new Set(prevSel);

  // 폭타: 어택이 촘촘하고 음량이 큰 마디를 골라 16분을 꽉 채움 (3마디 연속은 피함)
  const burstBars = new Set();
  if (D.burst > 0) {
    const cand = bars.map((b, bi) => {
      let dens = 0, e = 0;
      for (let i = b.a; i < b.b; i++) { if (slots[i].s >= 0.3) dens++; e += slots[i].e; }
      return { bi, dens: dens / (b.b - b.a), e: e / (b.b - b.a) };
    }).filter(c => c.e >= 0.7 && c.dens >= 0.45).sort((x, y) => y.dens * y.e - x.dens * x.e);
    const want = Math.round(bars.length * D.burst);
    const has = bi => burstBars.has(bi);
    for (const c of cand) {
      if (burstBars.size >= want) break;
      const b = c.bi;
      if ((has(b - 1) && has(b - 2)) || (has(b + 1) && has(b + 2)) || (has(b - 1) && has(b + 1))) continue;
      burstBars.add(b);
    }
    // 짧은 폭타: 마디 후반 두 박만 16분으로 채움
    for (const bi of burstBars) for (let i = bars[bi].a + 8; i < bars[bi].b; i++) if (slots[i].s >= D.minS) sel.add(i);
  }

  const target = Math.round(D.nps * active);
  const order = slots.map((_, i) => i).filter(i => slots[i].s >= D.minS).sort((a, b) => score(slots[b]) - score(slots[a]));
  const spaced = i => { for (let k = i - D.gap + 1; k <= i + D.gap - 1; k++) if (k !== i && sel.has(k)) return false; return true; };
  for (const i of order) {
    if (sel.size >= target) break;
    if (sel.has(i) || !spaced(i)) continue;
    sel.add(i);
    if (chainLen(sel, i, D.gap) > D.chain) sel.delete(i);
  }
  prevSel = sel;
  const idx = [...sel].sort((a, b) => a - b);

  // 롱노트: 다음 노트까지 비어 있고 소리가 이어지면
  const midE = sp.midE;
  const meanMid = (t0, t1) => { let s = 0, n = 0; for (let f = Math.round(toF(t0)); f <= Math.round(toF(t1)); f++) if (f >= 0 && f < sp.frames) { s += midE[f]; n++; } return n ? s / n : 0; };
  const notes = idx.map((i, k) => {
    const s = slots[i], next = idx[k + 1];
    const n = { slot: i, t: noteTime(i), end: 0, cent: s.cent, s: s.s, burst: burstBars.has(barOf[i]) };
    if (!n.burst && next !== undefined && next - i >= D.longGap) {
      const endSlot = next - 2;
      const hold = slots[endSlot].t - s.at;
      const between = Math.max(0, ...slots.slice(i + 1, next).map(q => q.s));
      const sustain = meanMid(s.at + 0.12, slots[endSlot].t) / (meanMid(s.at, s.at + 0.1) || 1);
      if (hold >= 0.4 && between < 0.55 && sustain > 0.5) { n.end = noteTime(endSlot); n.endSlot = endSlot; }
    }
    // 상위 난이도: 쉬운 난이도의 롱노트를 이어받고, 누르는 동안 다른 라인 노트를 침
    if (!n.end && !n.burst && longFrom.has(i)) {
      const endSlot = longFrom.get(i);
      const inside = idx.filter(j => j > i && j <= endSlot + 1).length;
      if (inside <= D.inside) { n.end = noteTime(endSlot); n.endSlot = endSlot; }
    }
    return n;
  });
  if (D === DIFFS[0]) notes.forEach(n => n.end && longFrom.set(n.slot, n.endSlot));

  // 동시치기: 가장 센 어택 상위 비율 + 폭타 마디의 정박
  //  롱노트를 누르는 중에는 제외 → 손가락은 최대 2개
  if (D.chord > 0) {
    const holds = notes.filter(n => n.end);
    const inHold = n => holds.some(h => n.slot >= h.slot && n.slot <= h.endSlot + 1);
    const strong = notes.filter(n => !n.end).map(n => n.s).sort((a, b) => b - a);
    const cut = strong[Math.floor(strong.length * D.chord)] ?? Infinity;
    notes.forEach(n => {
      if (n.end || inHold(n)) return;
      if ((n.s >= cut && n.s > 0.6) || (n.burst && isBeat(n.slot) && slots[n.slot].t - slots[bars[barOf[n.slot]].a].t < 0.01 && n.s >= 0.3)) n.chord = true;
    });
  }
  charts.push({ D, notes, burstBars });
}

// ---------- 5. 라인 배치 ----------
function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const centLo = pct(slots.map(s => s.cent).filter(Boolean), 0.1), centHi = pct(slots.map(s => s.cent).filter(Boolean), 0.9);
const hand = l => (l < 2 ? 0 : 1);

// 계단 패턴 (라인 순서)
const PATTERNS = {
  up: [0, 1, 2, 3],             // 오름 계단
  down: [3, 2, 1, 0],           // 내림 계단
  zigUp: [0, 1, 2, 3, 2, 1],    // 지그재그
  zigDown: [3, 2, 1, 0, 1, 2],
  splitA: [0, 2, 1, 3],         // 꺾인 계단 (손 번갈아)
  splitB: [3, 1, 2, 0],
};
const PATTERN_NAMES = { up: '오름 계단', down: '내림 계단', zigUp: '지그재그', zigDown: '지그재그', splitA: '꺾인 계단', splitB: '꺾인 계단' };

function assignLanes(notes, seed, D, stats) {
  const rng = mulberry32(seed);
  const freeAt = [-1, -1, -1, -1]; // 라인이 비는 슬롯
  const recent = [];
  let prev = null, prev2 = null, lastKind = '';
  const out = [];
  const put = (l, n, isChordNote) => {
    out.push({ t: n.t, lane: l, end: isChordNote ? 0 : n.end, slot: n.slot, endSlot: isChordNote || !n.end ? n.slot : n.endSlot });
    freeAt[l] = (!isChordNote && n.end ? n.endSlot : n.slot) + 3; // 같은 라인은 8분 간격 안에 다시 치지 않음 (연타 방지)
    recent.push(l);
    if (recent.length > 8) recent.shift();
  };
  // 동시치기 두 번째 노트: 반대 손, 바로 앞/뒤 16분 노트 라인은 피함
  const addChord = (n, lane, avoid) => {
    const avail = [0, 1, 2, 3].filter(l => l !== lane && freeAt[l] <= n.slot && !avoid.includes(l));
    const other = avail.filter(l => hand(l) !== hand(lane));
    const pool = other.length ? other : avail;
    if (pool.length) { put(pool[Math.floor(rng() * pool.length)], n, true); stats.chord++; }
  };
  const cost = (l, n) => {
    let c = rng() * 1.2;
    if (prev) {
      const gap = n.slot - prev.slot;
      if (l === prev.lane) c += gap <= 2 ? 50 : gap <= 4 ? 5 : 1;             // 연타(같은 라인) 피하기
      if (gap <= 2 && hand(l) === hand(prev.lane)) c += 2.5;                     // 빠른 구간은 손 번갈아
      if (prev2 && n.slot - prev2.slot <= 3 && l === prev2.lane) c += 1.5;      // 트릴 너무 길지 않게
      const dc = n.cent - prev.cent;                                             // 음 높이 따라 좌우 이동
      const want = dc > 0.35 ? 1 : dc < -0.35 ? -1 : 0;
      if (want && Math.sign(l - prev.lane) !== want) c += 1.5;
    }
    const target = 3 * Math.min(1, Math.max(0, (n.cent - centLo) / (centHi - centLo || 1)));
    c += 0.35 * Math.abs(l - target);
    c += 0.45 * recent.filter(r => r === l).length;                              // 라인 고르게
    for (let k = 0; k < 4; k++) if (k !== l && freeAt[k] > n.slot && hand(k) === hand(l)) c += 3; // 롱노트 누르는 손 피하기
    return c;
  };

  let k = 0;
  while (k < notes.length) {
    const n = notes[k];
    // 같은 간격(16분 또는 8분)으로 4개 이상 이어지면 계단 패턴 후보
    let L = 1;
    const step = k + 1 < notes.length ? notes[k + 1].slot - n.slot : 0;
    if (step === 1 || step === 2) {
      while (k + L < notes.length && notes[k + L].slot - notes[k + L - 1].slot === step && !notes[k + L].end) L++;
    }
    const free = [0, 1, 2, 3].filter(l => freeAt[l] <= n.slot);
    if (L >= 4 && !n.end && free.length >= 3 && rng() < D.pattern) {
      const run = notes.slice(k, k + L);
      const lanes = [];
      // 긴 연타는 8개씩 끊어서 패턴을 바꿈 (계단 → 지그재그 → 꺾인 계단 ...)
      for (let s0 = 0; s0 < L; s0 += 8) {
        const seg = run.slice(s0, Math.min(L, s0 + 8));
        const h = Math.max(1, seg.length >> 1);
        const slope = seg.slice(h).reduce((a, q) => a + q.cent, 0) / (seg.length - h) - seg.slice(0, h).reduce((a, q) => a + q.cent, 0) / h;
        let kinds = slope > 0.3 ? ['up', 'zigUp'] : slope < -0.3 ? ['down', 'zigDown'] : ['splitA', 'splitB', 'zigUp', 'zigDown', 'up', 'down'];
        if (kinds.length > 1) kinds = kinds.filter(x => x !== lastKind);
        const kind = kinds[Math.floor(rng() * kinds.length)];
        lastKind = kind;
        stats.patterns[PATTERN_NAMES[kind]] = (stats.patterns[PATTERN_NAMES[kind]] || 0) + 1;
        // 롱노트로 막힌 라인이 있으면 남은 3라인으로 지그재그
        const seq = free.length === 4 ? PATTERNS[kind] : [free[0], free[1], free[2], free[1]];
        const before = lanes.length ? lanes[lanes.length - 1] : prev && n.slot - prev.slot <= 2 ? prev.lane : -1;
        let off = 0;
        const startSlot = seg[0].slot;
        while (off < seq.length && (seq[off % seq.length] === before || freeAt[seq[off % seq.length]] > startSlot)) off++;
        seg.forEach((_, i) => lanes.push(seq[(i + off) % seq.length]));
      }
      run.forEach((q, i) => {
        put(lanes[i], q, false);
        if (q.chord) addChord(q, lanes[i], step === 1 ? [lanes[i - 1], lanes[i + 1]] : [lanes[i + 1]]);
      });
      prev2 = run.length > 1 ? { lane: lanes[L - 2], slot: run[L - 2].slot, cent: run[L - 2].cent } : prev;
      prev = { lane: lanes[L - 1], slot: run[L - 1].slot, cent: run[L - 1].cent };
      k += L;
      continue;
    }

    const avail = [0, 1, 2, 3].filter(l => freeAt[l] <= n.slot);
    if (!avail.length) { k++; continue; }
    const lane = avail.reduce((a, b) => (cost(a, n) <= cost(b, n) ? a : b));
    put(lane, n, false);
    if (n.chord) addChord(n, lane, []);
    prev2 = prev;
    prev = { lane, slot: n.slot, cent: n.cent };
    k++;
  }
  return out.sort((a, b) => a.t - b.t || a.lane - b.lane);
}

const shift = +opt.shift / 1000;
const r3 = v => Math.round(v * 1000) / 1000;
const DENS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const results = charts.map(({ D, notes, burstBars }, i) => {
  const stats = { chord: 0, patterns: {} };
  const lanes = assignLanes(notes, +opt.seed * 100 + i, D, stats);
  // 패턴 변형: 같은 리듬에서 같은 라인 배치가 세 번 연속 / 앞 마디와 똑같은 마디가 나오지 않게 (js/boss.js 의 varyPatterns)
  //  슬롯 번호는 마디 시작이 16의 배수가 되도록 맞춤
  const barSlot0 = quarterSlots[barPhase] ?? 0;
  const vn = lanes.map(n => ({ n, s: n.slot - barSlot0 + 16, lane: n.lane, len: n.end ? n.endSlot - n.slot : 0, diffs: 'H' }));
  const vnAll = vn.slice(); // fixOuterInner 가 지운 노트는 vn 에서 빠지므로 원본 목록으로 옮겨 적음
  const pol = GAME.polishPatterns(vn); // 반복 변형 + 금지 패턴(1 4 (23), 2 (14) 3 등) 수정
  stats.varied = pol.varied;
  stats.outerInner = pol.fixed;
  stats.spaced = pol.spaced;
  vnAll.forEach(v => (v.n.lane = v.lane, v.n.drop = v.drop));
  const arr = lanes.filter(n => !n.drop).map(n => [r3(n.t + shift), n.lane, n.end ? r3(n.end + shift) : 0, n.slot - barSlot0 + 16, n.end ? n.endSlot - n.slot : 0]);
  const nps = arr.length / active;
  const lv = Math.max(1, Math.min(15, Math.round(0.6 + nps * 1.6)));
  const longs = arr.filter(n => n[2]).length;
  const laneCount = [0, 1, 2, 3].map(l => arr.filter(n => n[1] === l).length);
  console.log(`  ${D.name.padEnd(6)} 노트 ${String(arr.length).padStart(3)}  롱노트 ${String(longs).padStart(2)}  동시치기 ${String(stats.chord).padStart(3)}  초당 ${nps.toFixed(2)}  Lv.${lv}  라인별 ${laneCount.join('/')}`);
  const pat = Object.entries(stats.patterns).map(([k, v]) => `${k} ${v}`).join(', ');
  console.log(`         패턴: ${pat || '없음'}${burstBars.size ? `  |  폭타 ${burstBars.size}마디` : ''}  |  반복 변형 ${stats.varied}곳  |  금지 패턴 수정 ${stats.outerInner}곳  |  (14) 유형 간격 ${stats.spaced}곳`);
  // 마디별 노트 수 (폭타 마디는 밑줄)
  const perBar = bars.map((b, bi) => {
    const t0 = slots[b.a].t, t1 = b.b < slots.length ? slots[b.b].t : Infinity;
    const c = arr.filter(n => n[0] - shift >= t0 - 0.02 && n[0] - shift < t1 - 0.02).length;
    return DENS[Math.min(DENS.length - 1, c)];
  }).join('');
  const marks = bars.map((_, bi) => (burstBars.has(bi) ? '^' : ' ')).join('');
  console.log(`         마디별 ${perBar}`);
  if (burstBars.size) console.log(`                ${marks}`);
  return { lv, notes: arr };
});

// ---------- 6. 검증: 같은 라인 겹침 / 3개 이상 동시 ----------
results.forEach((r, i) => {
  const free = [-1, -1, -1, -1];
  let bad = 0;
  for (const [t, l, e] of r.notes) { if (t < free[l] + 0.1) bad++; free[l] = e || t; }
  if (bad) console.log(`  ⚠ ${DIFFS[i].name}: 겹치는 노트 ${bad}개`);
});

// ---------- 7. 파일 쓰기 ----------
const dir = path.join(ROOT, 'songs', opt.id);
fs.mkdirSync(dir, { recursive: true });
let cover = null;
if (opt.cover) {
  const ext = path.extname(opt.cover).toLowerCase() === '.png' ? '.png' : '.jpg';
  cover = `songs/${opt.id}/cover${ext}`;
  fs.copyFileSync(opt.cover, path.join(ROOT, cover));
}
const song = {
  id: opt.id,
  title: opt.title,
  artist: opt.artist,
  bpm: Math.round(bpm * 10) / 10,
  duration: r3(duration),
  beats: quarters.map(r3),     // 정박 위치 (화면 마디선/박동 효과용)
  barPhase,
  cover,
  audio: `songs/${opt.id}/audio.js`,
  levels: results.map(r => r.lv),
  charts: results.map(r => r.notes),
};
fs.writeFileSync(path.join(dir, 'chart.js'),
  `// 자동 생성: node tools/add-song.mjs (직접 수정해도 됩니다 — [시간(초), 라인 0~3, 롱노트 끝(초) 또는 0])\n` +
  `(window.BEAT_RUSH_SONGS = window.BEAT_RUSH_SONGS || []).push(${JSON.stringify(song)});\n`);
const b64 = fs.readFileSync(src).toString('base64');
fs.writeFileSync(path.join(dir, 'audio.js'),
  `// 음원 (index.html을 더블클릭해도 재생되도록 스크립트로 포함)\n` +
  `(window.BEAT_RUSH_AUDIO = window.BEAT_RUSH_AUDIO || {})[${JSON.stringify(opt.id)}] = "${b64}";\n`);

// index.html 에 등록
const indexPath = path.join(ROOT, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
const tag = `<script src="songs/${opt.id}/chart.js"></script>`;
if (!html.includes(tag)) {
  html = html.replace('<!-- songs -->', `${tag}\n<!-- songs -->`);
  fs.writeFileSync(indexPath, html);
}
console.log(`✔ songs/${opt.id}/ 에 저장했습니다`);
