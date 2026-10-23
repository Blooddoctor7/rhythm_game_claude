'use strict';
/* ==========================================================
 * band.js — 밴드 팝록 "Blue Horizon" (160 BPM, E장조)
 *
 *  실제 악기 녹음 샘플: 일렉 기타(클린·디스토션), 베이스, 드럼 세트 (sampler.js, 출처는 CREDITS.md)
 *  리듬: 정박과 그 쪼개기 위주의 일반곡 — 엇박은 후렴 끝 강조 한두 번만
 *  반복 구간은 응용(동시치기, 롱노트 + 반대 손, 쉼표, 접기, 16분 짧은 폭타)으로 매번 다르게
 *  키음: 모든 노트에 기타·드럼 소리가 연결됨 (드럼 필인도 노트 — 높은 탐일수록 오른쪽)
 *
 *  구성 (42마디, 약 63초)
 *   인트로 4 → 벌스 8 → 프리코러스 4 → 후렴 8 → 리프 브레이크 4 → 브리지 4 → 마지막 후렴 8 → 아웃트로 2
 *  필요: music.js, sampler.js, boss.js(layoutLanes, varyPatterns), kpop.js(parseKPat)
 * ========================================================== */

const ROCK = { id: 'blue_horizon', title: 'Blue Horizon', bpm: 160 };
const RS = 60 / ROCK.bpm / 4; // 16분음표 길이(초)

// 화음: b 베이스 근음, pw 디스토션 파워코드, cl 클린 기타 화음 (라인 0~3, 낮은 음 → 높은 음)
const RCH = {
  E: { b: 28, pw: [40, 47, 52], cl: [52, 56, 59, 64] },
  B: { b: 35, pw: [47, 54, 59], cl: [54, 59, 63, 66] },
  'C#m': { b: 37, pw: [37, 44, 49], cl: [56, 61, 64, 68] },
  A: { b: 33, pw: [45, 52, 57], cl: [52, 57, 61, 64] },
  'G#m': { b: 32, pw: [44, 51, 56], cl: [56, 59, 63, 68] },
};
const RH = 'H', RNH = 'NH'; // 난이도 표기 (다른 파일과 이름이 겹치지 않게)
const PW = (st, len = 2) => [st, 0, len, { pw: true }]; // 디스토션 파워코드 한 번

// 후렴 선율 (E B C#m A)
const RC1 = [[0, 76, 4], [4, 75, 2], [6, 76, 2], [8, 78, 4], [12, 76, 2], [14, 75, 2]];
const RC2 = [[0, 73, 4], [4, 75, 4], [8, 78, 6], [14, 75, 2]];
const RC3 = [[0, 76, 4], [4, 75, 2], [6, 73, 2], [8, 71, 4], [12, 73, 2], [14, 75, 2]];
const RC4 = [[0, 73, 8], [8, 71, 4], [12, 69, 4]];
const RC6 = [[0, 73, 4], [4, 75, 4], [8, 78, 4], [12, 80, 4]];
const RC7 = [[0, 80, 8], [8, 75, 4], [12, 73, 2], [14, 75, 2]];
const RC8 = [[0, 76, 12]];
const RRIFF = [ // 인트로 리프 (E B C#m A)
  [PW(0), [2, 76, 2], [4, 75, 2], [6, 76, 2], [8, 78, 2], [10, 76, 2], [12, 75, 2], [14, 71, 2]],
  [PW(0), [2, 75, 2], [4, 73, 2], [6, 75, 2], [8, 78, 4], [12, 75, 2], [14, 73, 2]],
  [PW(0), [2, 73, 2], [4, 71, 2], [6, 73, 2], [8, 76, 2], [10, 73, 2], [12, 71, 2], [14, 68, 2]],
  [PW(0), [2, 69, 2], [4, 71, 2], [6, 73, 2]],
];
const TOMS_DOWN = { 12: 'tom1', 13: 'tom2', 14: 'tom3', 15: 'tom4' };

/* ----------------------------------------------------------
 * 마디별 악보 + 채보 (표기는 orch.js 와 같음)
 *  pat : 16칸 라인 패턴 (0~3 노트, a~f 동시치기, 대문자는 주 노트가 뒤 라인, . 없음)
 *  fill: 선율이 없는 칸의 노트 소리 — arp 클린 기타 / chug 파워코드 짧게 / snare / tom1~4
 *  pair: 동시치기 짝 — crash 크래시+킥 / chord 파워코드+킥 / snare 스네어 / oct 클린 기타 옥타브 위 / clean 클린 화음
 *  sec : 반주 종류
 * ---------------------------------------------------------- */
const ROCK_BARS = [
  // ---------- 인트로: 디스토션 리프, 마지막은 탐 내림 계단 ----------
  { sec: 'intro', ch: 'E', inst: 'gtr_dist', pair: 'crash', line: RRIFF[0], pat: 'a.2. 1.2. 3.2. 1.0.' },
  { sec: 'intro', ch: 'B', inst: 'gtr_dist', pair: 'chord', line: RRIFF[1], pat: 'f.1. 0.1. 3... 2.1.' },
  { sec: 'intro', ch: 'C#m', inst: 'gtr_dist', pair: 'chord', line: RRIFF[2], pat: 'a.1. 2.1. 0.1. 2.3.' },
  { sec: 'introEnd', ch: 'A', inst: 'gtr_dist', pair: 'chord', fill: Object.assign({ 8: 'snare', 10: 'snare' }, TOMS_DOWN), line: RRIFF[3], pat: 'e.2. 3.0. 1.2. 3210' },
  // ---------- 벌스: 클린 기타 선율, 롱노트 동안 반대 손 아르페지오 ----------
  { sec: 'verse', ch: 'C#m', inst: 'gtr_clean', fill: 'arp', pair: 'crash', line: [[0, 68, 4], [4, 71, 2], [6, 73, 2], [8, 71, 4], [12, 68, 2], [14, 66, 2]], pat: 'f.0. 1.2. 1.3. 0.3.', masks: { 2: RH, 10: RH } },
  { sec: 'verse', ch: 'A', inst: 'gtr_clean', fill: 'arp', line: [[0, 69, 4], [4, 68, 2], [6, 66, 2], [8, 64, 6], [14, 66, 2]], pat: '2.3. 1.0. 3.1. ..2.', masks: { 2: RH, 10: RH } },
  { sec: 'verse', ch: 'E', inst: 'gtr_clean', fill: 'arp', line: [[0, 68, 2], [2, 69, 2], [4, 71, 4], [8, 76, 4], [12, 75, 2], [14, 73, 2]], pat: '0.1. 2.0. 3.1. 2.1.', masks: { 6: RH, 10: RH } },
  { sec: 'verse', ch: 'B', inst: 'gtr_clean', fill: 'arp', line: [[0, 71, 8], [8, 75, 4], [12, 73, 4]], pat: '0.3. 2.3. 1.3. 0.2.', masks: { 2: RH, 4: RNH, 6: RH, 10: RH, 14: RH } },
  // 반복(후반) — 동시치기 → 쉼표 → 16분 폭타 → 롱노트 + 반대 손
  { sec: 'verse2', ch: 'C#m', inst: 'gtr_clean', fill: 'arp', pair: 'clean', line: [[0, 68, 2], [2, 68, 2], [4, 71, 2], [6, 73, 2], [8, 76, 4], [12, 73, 2], [14, 71, 2]], pat: 'a.1. 2.3. B.0. 1.0.', masks: { 10: RH } },
  { sec: 'verse2', ch: 'A', inst: 'gtr_clean', line: [[0, 73, 4], [4, 71, 2], [6, 69, 2], [8, 68, 6], [14, 69, 2]], pat: '3... 2.1. 0... ..1.' },
  { sec: 'verse2', ch: 'E', inst: 'gtr_clean', fill: 'arp', line: [[0, 68, 2], [2, 71, 2], [4, 76, 2], [6, 75, 2], [8, 76, 4], [12, 78, 4]], pat: '0.2. 3.2. 3012 3...', masks: { 9: RH, 10: RH, 11: RH } },
  { sec: 'verse2', ch: 'B', inst: 'gtr_clean', fill: 'arp', line: [[0, 78, 8], [8, 75, 4], [12, 71, 2], [14, 73, 2]], pat: '0.2. 3.2. 1.3. 0.2.', masks: { 2: RH, 4: RNH, 6: RH, 10: RH } },
  // ---------- 프리코러스: 디스토션 롱노트 + 반대 손 파워코드 → 스네어·탐 필인 ----------
  { sec: 'pre', ch: 'A', inst: 'gtr_dist', fill: 'chug', line: [[0, 73, 8], [8, 71, 4], [12, 69, 4]], pat: '1.3. 2.3. 0.2. 1.3.', masks: { 2: RH, 4: RNH, 6: RH, 10: RH, 14: RH } },
  { sec: 'pre', ch: 'B', inst: 'gtr_dist', fill: 'chug', line: [[0, 75, 8], [8, 73, 4], [12, 71, 4]], pat: '2.0. 1.0. 3.1. 2.0.', masks: { 2: RH, 4: RNH, 6: RH, 10: RH, 14: RH } },
  { sec: 'pre', ch: 'A', inst: 'gtr_dist', fill: 'chug', line: [[0, 76, 4], [4, 75, 4], [8, 73, 4], [12, 76, 4]], pat: '3.1. 2.0. 1.3. 2.0.', masks: { 2: RH, 6: RNH, 10: RH, 14: RNH } },
  { sec: 'preEnd', ch: 'B', inst: 'gtr_dist', pair: 'crash', fill: Object.assign({ 8: 'snare', 10: 'snare' }, TOMS_DOWN), line: [PW(0, 3), PW(4, 3)], pat: 'd... c... 3.1. 3210' },
  // ---------- 후렴 ----------
  { sec: 'chorus', ch: 'E', fill: 'chug', pair: 'crash', line: RC1, pat: 'f.0. 1.2. 3.0. 2.1.', masks: { 2: RH, 10: RH } },
  { sec: 'chorus', ch: 'B', fill: 'chug', line: RC2, pat: '0.2. 1.0. 3.1. ..1.', masks: { 2: RH, 6: RH, 10: RH } },
  { sec: 'chorus', ch: 'C#m', fill: 'chug', line: RC3, pat: '3.0. 2.1. 0.3. 1.2.', masks: { 2: RH, 10: RH } },
  { sec: 'chorus', ch: 'A', fill: 'chug', line: RC4, pat: '0.3. 2.3. 1.2. 0.3.', masks: { 2: RH, 4: RNH, 6: RH, 10: RH, 14: RH } },
  // 반복(후반) — 정박마다 짝이 바뀌는 동시치기 → 16분 리크 → 롱노트 + 16분 트릴 → 큰 롱노트 + 탐 필인
  { sec: 'chorus', ch: 'E', pair: { 0: 'crash', 4: 'snare', 8: 'chord', 12: 'snare' }, line: RC1, pat: 'b... a.2. D... C.1.' },
  { sec: 'chorus', ch: 'B', fill: 'chug', line: [[0, 73, 4], [4, 75, 4], [8, 78, 1], [9, 80, 1], [10, 78, 1], [11, 76, 1], [12, 80, 4]], pat: '3.2. 0.1. 2310 3.2.', masks: { 2: RH, 6: RH, 14: RH } },
  { sec: 'chorus', ch: 'C#m', fill: 'chug', line: RC7, pat: '3.01 01.. 2.0. 1.2.', masks: { 2: RNH, 3: RH, 4: RH, 5: RH, 10: RH } },
  { sec: 'chorusEnd', ch: 'A', fill: Object.assign({ def: 'chug' }, { 12: 'tom4', 13: 'tom3', 14: 'tom2', 15: 'tom1' }), pair: 'chord', line: RC8, pat: 'A... 1.0. 2.1. 0123', masks: { 4: RNH, 6: RH, 8: RNH, 10: RH } },
  // ---------- 리프 브레이크: 리프 + 16분 기타 폭타 ----------
  { sec: 'solo', ch: 'E', inst: 'gtr_dist', pair: 'crash', line: [PW(0), [2, 76, 2], [4, 75, 2], [6, 76, 2], [8, 78, 1], [9, 80, 1], [10, 78, 1], [11, 76, 1], [12, 75, 2], [14, 71, 2]], pat: 'e.2. 3.2. 0132 1.0.' },
  { sec: 'solo', ch: 'B', inst: 'gtr_dist', pair: 'chord', line: [PW(0), [2, 75, 2], [4, 73, 2], [6, 75, 2], [8, 78, 4], [12, 75, 1], [13, 73, 1], [14, 71, 1], [15, 73, 1]], pat: 'F.1. 0.1. 2... 3013' },
  { sec: 'solo', ch: 'C#m', inst: 'gtr_dist', pair: { 0: 'crash', def: 'chord' }, line: RRIFF[2], pat: 'c.1. A.2. d.0. f.1.' },
  { sec: 'soloEnd', ch: 'A', inst: 'gtr_dist', pair: 'chord', fill: { 8: 'snare', 9: 'snare', 10: 'tom3', 11: 'tom1', 12: 'tom2', 13: 'tom4', 14: 'tom1', 15: 'tom3' }, line: RRIFF[3], pat: 'a.2. 1.3. 0213 2031' },
  // ---------- 브리지: 하프타임, 롱노트를 양손 번갈아 → 스네어 몰아치기 ----------
  { sec: 'bridge', ch: 'A', inst: 'gtr_clean', fill: 'arp', line: [[0, 73, 8], [8, 76, 8]], pat: '0.3. 2.3. 2.0. 1.0.', masks: { 2: RH, 6: RH, 10: RH, 14: RH } },
  { sec: 'bridge', ch: 'B', inst: 'gtr_clean', fill: 'arp', line: [[0, 75, 8], [8, 78, 8]], pat: '3.0. 1.0. 1.3. 2.3.', masks: { 2: RH, 6: RH, 10: RH, 14: RH } },
  { sec: 'bridge', ch: 'G#m', inst: 'gtr_clean', fill: 'arp', line: [[0, 71, 4], [4, 75, 4], [8, 80, 8]], pat: '0.2. 1.3. 2.0. 1.0.', masks: { 2: RH, 6: RH, 10: RH, 14: RH } },
  { sec: 'bridgeEnd', ch: 'B', inst: 'gtr_dist', pair: 'crash', fill: { def: 'snare', 12: 'tom1', 13: 'tom2', 14: 'tom3', 15: 'tom4' }, line: [PW(0, 2)], pat: 'd.0. 2.3. 1023 1203' },
  // ---------- 마지막 후렴: 마디마다 다른 응용 ----------
  { sec: 'final', ch: 'E', fill: 'chug', pair: { 0: 'crash', def: 'oct' }, double: [], line: RC1, pat: 'b.0. F.0. d.2. a.1.', masks: { 2: RH, 10: RH } },
  { sec: 'final', ch: 'B', fill: 'chug', line: RC2, pat: '2.0. 3.1. 2010 1.3.', masks: { 2: RH, 6: RH, 9: RH, 10: RNH, 11: RH, 12: RH } },
  { sec: 'final', ch: 'C#m', pair: { 0: 'chord', 4: 'snare', 8: 'chord', 12: 'snare' }, line: RC3, pat: 'C... D.0. f... E.3.' },
  { sec: 'final', ch: 'A', fill: 'chug', pair: 'chord', line: RC4, pat: 'C.1. 0.1. 3.0. 1.3.', masks: { 2: RH, 4: RNH, 6: RH, 10: RH, 14: RH } },
  { sec: 'final', ch: 'E', fill: 'chug', pair: 'crash', line: [[0, 76, 4], [4, 75, 2], [6, 76, 2], [8, 78, 1], [9, 80, 1], [10, 81, 1], [11, 80, 1], [12, 78, 2], [14, 76, 2]], pat: 'C.1. 3.0. 1230 2.1.', masks: { 2: RH } },
  { sec: 'final', ch: 'B', pair: 'chord', line: RC6, pat: 'a... 1... f... 3...' },
  { sec: 'final', ch: 'C#m', fill: 'chug', line: RC7, pat: '0.32 32.. 1.3. 0.2.', masks: { 2: RNH, 3: RH, 4: RH, 5: RH, 10: RH } },
  { sec: 'finalEnd', ch: 'A', fill: Object.assign({ def: 'chug' }, { 12: 'tom2', 13: 'tom3', 14: 'tom4', 15: 'tom1' }), pair: 'chord', line: RC8, pat: 'D... 0.1. 0.1. 2103', masks: { 4: RNH, 6: RH, 8: RNH, 10: RH } },
  // ---------- 아웃트로: 리프 한 번 더 → 큰 화음 ----------
  { sec: 'outro', ch: 'E', inst: 'gtr_dist', pair: { 0: 'crash', def: 'chord' }, line: [PW(0), [2, 76, 2], [4, 75, 2], [6, 76, 2], PW(8, 3), PW(12, 3)], pat: 'b.0. 3.2. a... b...' },
  { sec: 'end', ch: 'E' },
];

function composeRock() {
  const T = s => SONG.leadIn + s * RS;
  const music = [], cands = [];
  const ev = (s, type, o) => { const e = Object.assign({ t: T(s), type }, o); music.push(e); return e; };
  const note = (s, diffs, ks, o) => {
    const n = Object.assign({ s, diffs, ks: [].concat(ks || []), lane: null, len: 0, pitch: null, partner: null }, o);
    cands.push(n);
    return n;
  };
  const beatMask = k => (k % 4 === 0 ? 'ENH' : k % 2 === 0 ? 'NH' : 'H');
  const pairMask = k => (k === 0 ? 'ENH' : k === 8 ? 'NH' : 'H');
  const both = (a, b) => [...a].filter(c => b.includes(c)).join('');
  // 샘플 소리
  const S = (s, inst, midi, len, o) => ev(s, 'smp', Object.assign({ inst, midi, dur: len * RS }, o));
  const SC = (s, inst, notes, len, o) => ev(s, 'smp', Object.assign({ inst, notes, dur: len * RS }, o));
  const D = (s, key, vel = 1) => ev(s, 'smp', { inst: 'drums', key, vel });

  const kindOf = (spec, k) => (typeof spec === 'string' ? spec : spec && (spec[k] || spec.def));
  const fillOf = (s0, ch, b) => (k, lane) => {
    const kind = kindOf(b.fill, k);
    if (kind === 'arp') return S(s0 + k, 'gtr_clean', ch.cl[lane], 2, { vel: 0.9 });
    if (kind === 'chug') return SC(s0 + k, 'gtr_dist', ch.pw, 1.5, { vel: 0.85 });
    if (kind === 'snare') return D(s0 + k, 'snare', 0.85);
    if (/^tom[1-4]$/.test(kind)) return D(s0 + k, kind, 0.95);
    throw new Error(`채울 소리 없음: ${s0 / 16}마디 ${k}칸`);
  };
  const pairOf = (s0, ch, b) => (k, lane, main) => {
    const kind = kindOf(b.pair, k);
    if (kind === 'crash') return [D(s0 + k, 'crash', 0.8), D(s0 + k, 'kick')];
    if (kind === 'chord') return [SC(s0 + k, 'gtr_dist', ch.pw, 2, { vel: 0.9 }), D(s0 + k, 'kick')];
    if (kind === 'snare') return D(s0 + k, 'snare', 0.95);
    if (kind === 'clean') return SC(s0 + k, 'gtr_clean', ch.cl, 3, { vel: 0.8 });
    if (kind === 'oct') { const e = main.ks[0]; return S(s0 + k, 'gtr_clean', e.midi + 12, Math.round(e.dur / RS), { vel: 0.75 }); }
    throw new Error(`동시치기 소리 없음: ${s0 / 16}마디 ${k}칸`);
  };

  // 한 마디 연주 + 노트 (반환: 칸 → 노트)
  const play = (s0, ch, b) => {
    const P16 = b.pat ? parseKPat(b.pat) : Array(16).fill(null);
    const masks = b.masks || {};
    const at = {};
    for (const [st, m, len, opt = {}] of b.line || []) {
      const { pw, ...rest } = opt;
      let ks;
      if (pw) ks = [SC(s0 + st, 'gtr_dist', ch.pw, len, Object.assign({ vel: 0.95 }, rest))];
      else {
        ks = [S(s0 + st, b.inst, m, len, Object.assign({ vel: b.vel ?? 1 }, rest))];
        for (const [di, shift, vel] of b.double || []) ks.push(S(s0 + st, di, m + shift, len, Object.assign({}, rest, { vel })));
      }
      at[st] = note(s0 + st, masks[st] || beatMask(st), ks, { pitch: m, lane: P16[st] ? P16[st][0] : null, len: len >= 6 ? len - 2 : 0, pw });
    }
    const fill = fillOf(s0, ch, b), pair = pairOf(s0, ch, b);
    for (let k = 0; k < 16; k++) {
      const lanes = P16[k];
      if (!lanes) continue;
      if (!at[k]) at[k] = note(s0 + k, masks[k] || beatMask(k), fill(k, lanes[0]), { lane: lanes[0], fill: true });
      if (lanes.length === 2) {
        note(s0 + k, both(pairMask(k), at[k].diffs), pair(k, lanes[1], at[k]), { partner: at[k], lane: lanes[1] });
        const kind = kindOf(b.pair, k);
        at[k].pairDrum = kind === 'crash' || kind === 'chord' || kind === 'snare';
        at[k].pairChord = kind === 'chord';
      }
    }
    return at;
  };

  // 반주
  const busy = (at, k) => at[k] && (at[k].fill || at[k].pw || at[k].pairChord);
  const groove = (s0, at, o) => {
    const skip = k => at[k] && at[k].pairDrum;
    for (const k of o.kick || []) if (!skip(k)) D(s0 + k, 'kick', k % 4 ? (o.kickVel ?? 0.9) * 0.8 : o.kickVel ?? 0.9);
    for (const k of o.snare || []) if (!skip(k)) D(s0 + k, 'snare', 0.8);
    for (const k of o.hat || []) D(s0 + k, k % 4 === 0 ? 'hhc' : 'hhc_soft', k % 4 === 0 ? 0.55 : 0.45);
    for (const k of o.ride || []) D(s0 + k, k % 4 === 0 ? 'ride_bell' : 'ride', k % 4 === 0 ? 0.35 : 0.4);
    for (const k of o.hho || []) D(s0 + k, 'hho', 0.4);
    if (o.crash && !skip(0)) D(s0, 'crash', 0.7);
  };
  const EIGHTHS = [0, 2, 4, 6, 8, 10, 12, 14];
  const bass8 = (s0, ch, until = 16, vel = 0.8) => {
    for (const k of EIGHTHS) if (k < until) S(s0 + k, 'bass', ch.b + (k % 8 === 6 ? 12 : 0), 1.7, { vel: k % 4 ? vel * 0.85 : vel });
  };
  const cleanArp = (s0, ch, at, vel, until = 16) => {
    const order = [0, 1, 2, 3, 2, 1, 2, 3];
    for (const k of EIGHTHS) if (k < until && !busy(at, k)) S(s0 + k, 'gtr_clean', ch.cl[order[k >> 1]], 2, { vel });
  };
  const chugs = (s0, ch, at, vel, steps = EIGHTHS, len = 1.3) => {
    for (const k of steps) if (!busy(at, k)) SC(s0 + k, 'gtr_dist', ch.pw, len, { vel: k % 4 ? vel * 0.8 : vel });
  };

  ROCK_BARS.forEach((b, i) => {
    const s0 = i * 16, ch = RCH[b.ch];
    if (b.sec === 'end') {
      // 마지막 화음: 양손 롱노트
      D(s0, 'crash');
      D(s0, 'crash2', 0.8);
      D(s0, 'kick');
      S(s0, 'bass', ch.b, 14, { vel: 0.9 });
      note(s0, 'ENH', [SC(s0, 'gtr_dist', ch.pw, 14, { vel: 1 }), S(s0, 'bass', ch.b + 12, 14, { vel: 0.5 })], { lane: 0, len: 12 });
      note(s0, 'ENH', [S(s0, 'gtr_dist', 76, 14, { vel: 0.9 }), SC(s0, 'gtr_clean', ch.cl, 14, { vel: 0.7 })], { lane: 3, len: 12 });
      return;
    }
    if (/^(chorus|final)/.test(b.sec)) b = Object.assign({ inst: 'gtr_dist', vel: 1.3, double: [['gtr_clean', 0, 0.5]] }, b); // 후렴 리드는 반주보다 크게
    const at = play(s0, ch, b);

    switch (b.sec) {
      case 'intro':
        groove(s0, at, { kick: [0, 8], snare: [4, 12], hat: EIGHTHS, crash: i === 0 });
        bass8(s0, ch);
        break;
      case 'introEnd':
        groove(s0, at, { kick: [0], snare: [4], hat: [0, 2, 4, 6] });
        bass8(s0, ch, 8);
        break;
      case 'verse':
      case 'verse2':
        groove(s0, at, { kick: b.sec === 'verse2' ? [0, 8, 10] : [0, 8], snare: [4, 12], hat: EIGHTHS, crash: i === 4 });
        bass8(s0, ch, 16, 0.7);
        cleanArp(s0, ch, at, 0.4);
        break;
      case 'pre':
        groove(s0, at, { kick: EIGHTHS, kickVel: 0.75, snare: [4, 12], hat: EIGHTHS });
        bass8(s0, ch);
        chugs(s0, ch, at, 0.5);
        break;
      case 'preEnd':
        groove(s0, at, { kick: [0, 4], hat: [0, 2, 4, 6] });
        bass8(s0, ch, 8);
        break;
      case 'chorus':
      case 'final':
        groove(s0, at, { kick: [0, 8, 10], snare: [4, 12], ride: EIGHTHS, crash: i === 16 || i === 20 || i === 32 || i === 36 });
        bass8(s0, ch, 16, 0.85);
        chugs(s0, ch, at, b.sec === 'final' ? 0.55 : 0.5, EIGHTHS, 2);
        if (b.sec === 'final') for (let k = 0; k < 16; k++) S(s0 + k, 'gtr_clean', ch.cl[[0, 1, 2, 3, 2, 1, 2, 3][k % 8]] + 12, 1, { vel: 0.18 });
        break;
      case 'chorusEnd':
      case 'finalEnd':
        groove(s0, at, { kick: [0, 8], snare: [4], ride: [0, 2, 4, 6, 8, 10] });
        bass8(s0, ch, 12, 0.85);
        break;
      case 'solo':
        groove(s0, at, { kick: [0, 8, 10], snare: [4, 12], hho: [2, 6, 10, 14], hat: [0, 4, 8, 12] });
        bass8(s0, ch, 16, 0.85);
        chugs(s0, ch, at, 0.45, [4, 8, 12], 2);
        break;
      case 'soloEnd':
        groove(s0, at, { kick: [0], snare: [4], hat: [0, 2, 4, 6] });
        bass8(s0, ch, 8, 0.85);
        break;
      case 'bridge':
        groove(s0, at, { kick: [0], snare: [8], hat: [0, 4, 8, 12] });
        S(s0, 'bass', ch.b, 14, { vel: 0.7 });
        cleanArp(s0, ch, at, 0.3);
        break;
      case 'bridgeEnd':
        groove(s0, at, { kick: [0, 4, 8], hat: [] });
        S(s0, 'bass', ch.b, 12, { vel: 0.8 });
        break;
      case 'outro':
        groove(s0, at, { kick: [0, 4], snare: [4], ride: [0, 2, 4, 6] });
        bass8(s0, ch, 8, 0.85);
        S(s0 + 8, 'bass', ch.b, 3);
        S(s0 + 12, 'bass', ch.b, 3);
        break;
    }
  });

  const BARS = ROCK_BARS.length;
  const notes = layoutLanes(cands);
  polishPatterns(notes); // 반복 변형 + 금지 패턴(1 4 (23) 등) 수정
  music.sort((a, b) => a.t - b.t);
  const charts = ['E', 'N', 'H'].map(d => notes
    .filter(n => n.diffs.includes(d))
    .sort((a, b) => a.s - b.s || a.lane - b.lane)
    .map(n => ({ t: T(n.s), lane: n.lane, end: n.len ? T(n.s + n.len) : 0, ks: n.ks, s: n.s, len: n.len })));
  const playTime = BARS * 16 * RS;
  const levels = charts.map(c => Math.max(1, Math.min(15, Math.round(1.5 + (c.length / playTime) * 1.5 + (ROCK.bpm - 150) / 30))));
  return {
    music, charts, levels,
    duration: T(BARS * 16),
    beats: Array.from({ length: BARS * 4 + 1 }, (_, i) => T(i * 4)),
  };
}
