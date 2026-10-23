'use strict';
/* ==========================================================
 * orch.js — 오케스트라 곡 "Ascension" (150 BPM, D단조 → 끝에서 D장조)
 *
 *  실제 악기 녹음 샘플로 연주합니다 (sampler.js, 출처는 CREDITS.md)
 *  피아노, 바이올린·첼로·콘트라베이스, 하프, 호른·트럼펫·트롬본, 플루트, 팀파니·큰북·스네어·심벌
 *  리듬: 정박과 그 쪼개기 위주의 일반곡, 반복 구간은 마디마다 다른 응용
 *  키음: 모든 노트에 악기 소리가 연결됨
 *
 *  구성 (38마디, 약 61초)
 *   인트로 4 → A 테마 8 → 빌드 4 → 클라이맥스 8 → 간주 4 → 마지막 클라이맥스 8 → 엔딩 2
 *  필요: music.js, boss.js(layoutLanes, varyPatterns), kpop.js(parseKPat), sampler.js
 * ========================================================== */

const ORCH = { id: 'ascension', title: 'Ascension', bpm: 150 };
const OS = 60 / ORCH.bpm / 4; // 16분음표 길이(초)

// 화음별 음 (cb: 콘트라베이스, vc: 첼로, timp: 팀파니, pad: 바이올린 화음, brass: 금관 화음, arp: 라인 0~3 하프 음)
const OCH = {
  Dm: { cb: 38, vc: 50, timp: 38, pad: [69, 74, 77], brass: [62, 65, 69], arp: [62, 65, 69, 74] },
  Bb: { cb: 34, vc: 46, timp: 34, pad: [70, 74, 77], brass: [62, 65, 70], arp: [58, 62, 65, 70] },
  F: { cb: 41, vc: 41, timp: 41, pad: [69, 72, 77], brass: [60, 65, 69], arp: [60, 65, 69, 72] },
  C: { cb: 36, vc: 48, timp: 36, pad: [67, 72, 76], brass: [60, 64, 67], arp: [60, 64, 67, 72] },
  Gm: { cb: 43, vc: 43, timp: 43, pad: [67, 70, 74], brass: [62, 67, 70], arp: [55, 62, 67, 70] },
  A: { cb: 45, vc: 45, timp: 45, pad: [69, 73, 76], brass: [61, 64, 69], arp: [57, 61, 64, 69] },
  D: { cb: 38, vc: 50, timp: 38, pad: [69, 74, 78], brass: [62, 66, 69, 74], arp: [62, 66, 69, 74] },
};
const OST = [0, 0, 7, 0, 12, 7, 0, 7]; // 첼로 스피카토 8분 반복 음형 (근음 기준)

/* ----------------------------------------------------------
 * 마디별 악보 + 채보
 *  line: [16분 위치, 음, 길이, 옵션]  (길이 6 이상 = 롱노트, 옵션 inst/notes 로 악기·화음 지정)
 *  pat : 16칸 라인 패턴 (0~3 노트, a~f 동시치기, . 없음) — kpop.js 와 같은 표기
 *  fill: 선율이 없는 칸의 노트 소리 (vc 첼로 / harp 하프 / snare 스네어 / stab 금관 / vln 바이올린)
 *  pair: 동시치기 짝 소리 (perc 심벌+팀파니+큰북 / timp 팀파니 / stab 금관 / oct 호른 옥타브)
 * ---------------------------------------------------------- */
const OH = 'H', ONH = 'NH'; // 난이도 표기 (game.js 의 H 와 이름이 겹치지 않게)
const ORCH_BARS = [
  // ---------- 인트로: 피아노 ----------
  { sec: 'intro', ch: 'Dm', inst: 'piano', line: [[0, 74, 4], [4, 69, 4], [8, 65, 4], [12, 69, 4]], pat: '3... 1... 0... 2...' },
  { sec: 'intro', ch: 'Bb', inst: 'piano', line: [[0, 70, 4], [4, 65, 4], [8, 62, 4], [12, 65, 4]], pat: '2... 0... 1... 3...' },
  { sec: 'intro', ch: 'F', inst: 'piano', line: [[0, 69, 2], [2, 72, 2], [4, 77, 2], [6, 72, 2], [8, 69, 2], [10, 72, 2], [12, 77, 2], [14, 81, 2]], pat: '0.1. 2.1. 0.1. 2.3.' },
  { sec: 'intro', ch: 'C', inst: 'piano', line: [[0, 67, 2], [2, 72, 2], [4, 76, 2], [6, 79, 2], [8, 76, 8]], pat: '1.0. 2.3. 2... ....' },
  // ---------- A 테마: 호른 롱노트 + 반대 손 첼로 스피카토 ----------
  { sec: 'A', ch: 'Dm', inst: 'hn_sus', fill: 'vc', line: [[0, 62, 8], [8, 65, 4], [12, 69, 4]], pat: '0.2. 3.2. 1... 3...', masks: { 2: OH, 4: ONH, 6: OH } },
  { sec: 'A', ch: 'Bb', inst: 'hn_sus', fill: 'vc', line: [[0, 70, 6], [6, 69, 2], [8, 65, 8]], pat: '3.1. ..2. 0.3. 2.3.', masks: { 2: OH, 10: OH, 12: ONH, 14: OH } },
  { sec: 'A', ch: 'F', inst: 'hn_sus', fill: 'vc', line: [[0, 69, 4], [4, 72, 4], [8, 70, 4], [12, 69, 4]], pat: '1.3. 0.2. 3.1. 2.0.', masks: { 2: OH, 6: OH, 10: OH, 14: OH } },
  { sec: 'A', ch: 'C', inst: 'hn_sus', fill: 'vc', line: [[0, 67, 12], [12, 64, 4]], pat: '3.1. 0.1. 0... 2...', masks: { 2: OH, 4: ONH, 6: OH, 8: ONH } },
  // 반복(후반) — 동시치기 → 쉼표 → 동시치기로 마무리 → 롱노트
  { sec: 'A', ch: 'Dm', inst: 'hn_sus', fill: 'vc', pair: 'timp', line: [[0, 62, 4], [4, 65, 4], [8, 69, 4], [12, 74, 4]], pat: 'a.2. 1.3. c.1. 3.0.', masks: { 2: OH, 6: OH, 10: OH, 14: OH } },
  { sec: 'A', ch: 'Bb', inst: 'hn_sus', line: [[0, 77, 8], [8, 74, 4], [12, 72, 4]], pat: '3... .... 2... 0...' },
  { sec: 'A', ch: 'F', inst: 'hn_sus', fill: 'vc', pair: 'timp', line: [[0, 72, 4], [4, 69, 4], [8, 70, 2], [10, 72, 2], [12, 74, 4]], pat: '1.3. 0.1. 2.3. e...', masks: { 2: OH, 6: OH } },
  { sec: 'A', ch: 'A', inst: 'hn_sus', fill: 'vc', line: [[0, 73, 12], [12, 76, 4]], pat: '3.0. 1.2. 0.1. 2...', masks: { 2: OH, 4: ONH, 6: OH, 8: ONH, 10: OH } },
  // ---------- 빌드: 바이올린 스피카토 계단 → 16분 상행 → 스네어 롤 → 한 박 쉼 ----------
  { sec: 'build', ch: 'Dm', inst: 'vln_spic', line: [[0, 74, 2], [2, 76, 2], [4, 77, 2], [6, 79, 2], [8, 81, 2], [10, 79, 2], [12, 77, 2], [14, 76, 2]], pat: '0.1. 2.3. 2.1. 0.1.' },
  { sec: 'build', ch: 'Bb', inst: 'vln_spic', pair: 'stab', line: [[0, 77, 2], [2, 76, 2], [4, 74, 2], [6, 72, 2], [8, 70, 2], [10, 72, 2], [12, 74, 2], [14, 76, 2]], pat: 'a.2. 1.0. d.2. 3.2.' },
  {
    sec: 'build', ch: 'Gm', inst: 'vln_spic', pair: 'timp',
    line: [[0, 67, 1], [1, 69, 1], [2, 70, 1], [3, 72, 1], [4, 74, 1], [5, 76, 1], [6, 77, 1], [7, 79, 1],
      [8, 74, 2, { inst: 'tpt_stac', notes: [62, 67, 70, 74] }], [10, 82, 2], [12, 74, 2, { inst: 'tpt_stac', notes: [62, 67, 70, 74] }], [14, 86, 2]],
    pat: '0123 1230 b.0. f.1.',
  },
  { sec: 'build', ch: 'A', fill: 'snare', pair: 'perc', line: [[0, 69, 2, { inst: 'tpt_stac', notes: [61, 64, 69, 73] }]], pat: 'a.2. 1.3. 0213 ....' },
  // ---------- 클라이맥스: 트럼펫 선율 + 호른 옥타브 아래 ----------
  { sec: 'climax', ch: 'Bb', fill: 'vc', pair: 'perc', line: [[0, 74, 4], [4, 77, 4], [8, 81, 6], [14, 79, 2]], pat: 'a.2. 1.0. 3.0. ..2.', masks: { 2: OH, 6: OH, 10: OH } },
  { sec: 'climax', ch: 'F', fill: 'vc', line: [[0, 77, 4], [4, 72, 4], [8, 77, 4], [12, 81, 4]], pat: '1.3. 0.2. 1.3. 2.0.', masks: { 2: OH, 6: OH, 10: OH, 14: OH } },
  { sec: 'climax', ch: 'C', fill: 'vc', line: [[0, 79, 8], [8, 76, 4], [12, 72, 4]], pat: '3.1. 0.1. 2.3. 0.1.', masks: { 2: OH, 4: ONH, 6: OH, 10: OH, 14: OH } },
  // 14칸: 금관 엇박 강조 한 번
  { sec: 'climax', ch: 'Dm', fill: k => (k === 14 ? 'stab' : 'vc'), pair: 'timp', line: [[0, 74, 12]], pat: '0.3. 2.1. 3.2. ..d.', masks: { 2: OH, 4: ONH, 6: OH, 8: ONH, 10: OH } },
  // 반복(후반) — 접기 → 동시치기 → 쉼표 → 롱노트 + 16분 트릴
  { sec: 'climax', ch: 'Bb', fill: 'vc', pair: 'oct', double: [], line: [[0, 74, 4], [4, 77, 4], [8, 81, 6], [14, 79, 2]], pat: 'c.1. f.0. b.3. ..2.', masks: { 2: OH, 6: OH, 10: OH } },
  { sec: 'climax', ch: 'F', fill: 'vc', pair: { 0: 'stab', 8: 'stab', 12: 'timp' }, line: [[0, 81, 4], [4, 77, 4], [8, 84, 4], [12, 81, 4]], pat: 'd.0. 1.2. e.3. E.2.', masks: { 2: OH, 6: OH, 10: OH, 14: OH } },
  { sec: 'climax', ch: 'Gm', line: [[0, 82, 4], [4, 81, 4], [8, 79, 4], [12, 77, 4]], pat: '3... 2... 1... 0...' },
  { sec: 'climax', ch: 'A', fill: 'vc', line: [[0, 76, 4], [4, 73, 4], [8, 81, 8]], pat: '2.3. 1.0. 3.01 01..', masks: { 2: OH, 6: OH, 10: ONH, 11: OH, 12: OH, 13: OH } },
  // ---------- 간주: 플루트 롱노트 + 하프 아르페지오 ----------
  { sec: 'inter', ch: 'Dm', inst: 'fl_sus', fill: 'harp', line: [[0, 81, 8], [8, 77, 4], [12, 74, 4]], pat: '0.2. 3.2. 1.3. 0.2.', masks: { 10: OH, 14: OH } },
  { sec: 'inter', ch: 'Bb', inst: 'fl_sus', fill: 'harp', line: [[0, 82, 8], [8, 81, 4], [12, 77, 4]], pat: '3.1. 0.1. 2.0. 1.3.', masks: { 10: OH, 14: OH } },
  { sec: 'inter', ch: 'Gm', inst: 'fl_sus', fill: 'harp', line: [[0, 79, 4], [4, 82, 4], [8, 86, 8]], pat: '2.0. 3.1. 0123 123.', masks: { 9: OH, 10: ONH, 11: OH, 12: ONH, 13: OH, 14: ONH } },
  { sec: 'inter', ch: 'A', inst: 'fl_sus', fill: k => (k >= 12 ? 'snare' : 'harp'), line: [[0, 85, 12]], pat: '1.3. 2.0. 3.2. 0132', masks: { 2: OH, 6: OH, 10: OH } },
  // ---------- 마지막 클라이맥스: 네 번째 반복이라 마디마다 다른 응용 + 바이올린이 선율을 겹침 ----------
  { sec: 'final', ch: 'Bb', fill: 'vc', pair: { 0: 'perc', 8: 'stab' }, line: [[0, 74, 4], [4, 77, 4], [8, 81, 6], [14, 79, 2]], pat: 'e.3. 2.1. a.2. ..3.', masks: { 2: OH, 6: OH, 10: OH } },
  { sec: 'final', ch: 'F', fill: k => (k >= 9 && k <= 11 ? 'vln' : 'vc'), run: { 9: 79, 10: 81, 11: 82 }, pair: 'timp', line: [[0, 77, 4], [4, 72, 4], [8, 77, 4], [12, 81, 4]], pat: '1.0. 3.2. 0123 E.2.', masks: { 2: OH, 6: OH, 14: OH } },
  { sec: 'final', ch: 'C', fill: 'vc', line: [[0, 79, 8], [8, 76, 4], [12, 72, 4]], pat: '3.01 01.. 2.3. 0.1.', masks: { 2: ONH, 3: OH, 4: OH, 5: OH, 10: OH, 14: OH } },
  { sec: 'final', ch: 'Dm', fill: k => (k === 14 ? 'stab' : 'vc'), pair: { 0: 'oct', 14: 'timp' }, double: [['vln_sus', 0, 0.45]], line: [[0, 74, 12]], pat: 'f.0. 1.3. 0.1. ..d.', masks: { 2: OH, 4: ONH, 6: OH, 8: ONH, 10: OH } },
  { sec: 'final', ch: 'Bb', fill: 'vc', pair: { 0: 'perc', 8: 'stab' }, line: [[0, 74, 4], [4, 77, 4], [8, 82, 6], [14, 81, 2]], pat: 'c.1. 3.0. b.3. ..0.', masks: { 2: OH, 6: OH, 10: OH } },
  { sec: 'final', ch: 'F', fill: 'vc', pair: 'oct', double: [['vln_sus', 0, 0.45]], line: [[0, 81, 4], [4, 77, 4], [8, 84, 4], [12, 81, 4]], pat: 'd.2. 0.3. b.0. 3.1.', masks: { 2: OH, 6: OH, 10: OH, 14: OH } },
  { sec: 'final', ch: 'Gm', pair: { 0: 'perc', 4: 'timp', 8: 'stab', 12: 'timp' }, line: [[0, 82, 4], [4, 81, 4], [8, 79, 4], [12, 77, 4]], pat: 'c... d... f... e...' },
  { sec: 'final', ch: 'A', fill: 'vc', pair: 'timp', line: [[0, 76, 4], [4, 73, 4], [8, 81, 8]], pat: '2.3. 1.0. d.2. 3.2.', masks: { 2: OH, 6: OH, 10: OH, 12: ONH, 14: OH } },
  // ---------- 엔딩: D장조 화음 세 번 → 양손 롱노트 ----------
  {
    sec: 'outro', ch: 'D', pair: { 0: 'perc', 4: 'timp', 8: 'perc' },
    line: [[0, 74, 3, { inst: 'tpt_stac', notes: [62, 66, 69, 74] }], [4, 74, 3, { inst: 'tpt_stac', notes: [62, 66, 69, 74] }], [8, 74, 3, { inst: 'tpt_stac', notes: [62, 66, 69, 74] }]],
    pat: 'a... B... F... ....',
  },
  { sec: 'end', ch: 'D' },
];

function composeOrch() {
  const T = s => SONG.leadIn + s * OS;
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
  const S = (s, inst, midi, len, o) => ev(s, 'smp', Object.assign({ inst, midi, dur: len * OS }, o));
  const SC = (s, inst, notes, len, o) => ev(s, 'smp', Object.assign({ inst, notes, dur: len * OS }, o));
  const P = (s, key, o) => ev(s, 'smp', Object.assign({ inst: 'perc', key }, o));
  const timp = (s, midi, vel = 0.9) => P(s, 'timp1', { shift: midi - 41.33, vel });

  const fillOf = (s0, ch, b) => (k, lane) => {
    const kind = typeof b.fill === 'function' ? b.fill(k) : b.fill;
    if (kind === 'vc') return S(s0 + k, 'vc_spic', ch.vc + OST[(k >> 1) % 8], 1, { vel: 1 });
    if (kind === 'vln') return S(s0 + k, 'vln_spic', b.run[k], 1, { vel: 0.95 });
    if (kind === 'harp') return S(s0 + k, 'harp', ch.arp[lane] + 12, 3, { vel: 0.9 });
    if (kind === 'snare') return P(s0 + k, k % 2 ? 'sn2' : 'sn', { vel: 0.4 + k * 0.035 });
    if (kind === 'stab') return SC(s0 + k, 'tpt_stac', ch.brass, 2, { vel: 1 });
    throw new Error(`채울 소리 없음: ${s0 / 16}마디 ${k}칸`);
  };
  const pairOf = (s0, ch, b) => (k, lane, main) => {
    const kind = typeof b.pair === 'string' ? b.pair : b.pair && b.pair[k];
    if (kind === 'perc') return [P(s0 + k, 'crash', { vel: 0.8 }), timp(s0 + k, ch.timp), P(s0 + k, 'bd')];
    if (kind === 'timp') return [timp(s0 + k, ch.timp, 0.85), P(s0 + k, 'bd_soft', { vel: 0.8 })];
    if (kind === 'stab') return [SC(s0 + k, 'hn_sus', ch.brass, 2, { vel: 0.9 }), timp(s0 + k, ch.timp, 0.7)];
    if (kind === 'oct') {
      const e = main.ks[0];
      return S(s0 + k, 'hn_sus', e.midi - 12, Math.round(e.dur / OS), { vel: 0.85 });
    }
    throw new Error(`동시치기 소리 없음: ${s0 / 16}마디 ${k}칸`);
  };

  // 한 마디 연주 + 노트 (반환: 칸 → 노트)
  const play = (s0, ch, b) => {
    const P16 = b.pat ? parseKPat(b.pat) : Array(16).fill(null);
    const masks = b.masks || {};
    const at = {};
    for (const [st, m, len, opt = {}] of b.line || []) {
      const { inst: oi, notes, ...rest } = opt;
      const inst = oi || (len <= 2 && b.short ? b.short : b.inst);
      const ks = [notes ? SC(s0 + st, inst, notes, len, rest) : S(s0 + st, inst, m, len, rest)];
      for (const [di, shift, vel] of notes ? [] : b.double || []) ks.push(S(s0 + st, di, m + shift, len, Object.assign({}, rest, { vel })));
      at[st] = note(s0 + st, masks[st] || beatMask(st), ks, { pitch: m, lane: P16[st] ? P16[st][0] : null, len: len >= 6 ? len - 2 : 0 });
    }
    const fill = fillOf(s0, ch, b), pair = pairOf(s0, ch, b);
    for (let k = 0; k < 16; k++) {
      const lanes = P16[k];
      if (!lanes) continue;
      if (!at[k]) at[k] = note(s0 + k, masks[k] || beatMask(k), fill(k, lanes[0]), { lane: lanes[0], fill: true });
      if (lanes.length === 2) {
        note(s0 + k, both(pairMask(k), at[k].diffs), pair(k, lanes[1], at[k]), { partner: at[k], lane: lanes[1] });
        at[k].paired = true;
      }
    }
    return at;
  };

  // 반주
  const ostinato = (s0, ch, vel, at, until = 16) => {
    for (let k = 0; k < until; k += 2) if (!(at[k] && at[k].fill)) S(s0 + k, 'vc_spic', ch.vc + OST[(k >> 1) % 8], 1, { vel: k % 4 ? vel * 0.75 : vel });
  };
  const strings = (s0, ch, o) => {
    if (o.pad) SC(s0, 'vln_sus', ch.pad, o.len || 16, { vel: o.pad, attack: o.attack ?? 0.3 });
    if (o.cb) S(s0, 'cb_sus', ch.cb, o.len || 16, { vel: o.cb, attack: 0.05 });
    if (o.vc) S(s0, 'vc_sus', ch.vc, o.len || 16, { vel: o.vc, attack: 0.08 });
  };
  const drums = (s0, ch, at, o) => {
    for (const k of o.timp || []) if (!(at[k] && at[k].paired)) timp(s0 + k, ch.timp, o.timpVel ?? 0.75);
    for (const k of o.bd || []) if (!(at[k] && at[k].paired)) P(s0 + k, 'bd', { vel: o.bdVel ?? 0.75 });
    for (const k of o.sn || []) P(s0 + k, k % 8 ? 'sn2' : 'sn', { vel: o.snVel ?? 0.45 });
  };

  ORCH_BARS.forEach((b, i) => {
    const s0 = i * 16, ch = OCH[b.ch];
    if (b.sec === 'end') {
      // 마지막 화음: 양손 롱노트
      P(s0, 'crash');
      P(s0, 'bd');
      timp(s0, 38);
      strings(s0, ch, { pad: 0.6, cb: 0.8, vc: 0.7, len: 14, attack: 0.05 });
      SC(s0, 'tbn_sus', [50, 57], 14, { vel: 0.6 });
      note(s0, 'ENH', [SC(s0, 'hn_sus', [62, 66, 69], 14, { vel: 0.9 }), S(s0, 'piano', 38, 14, { vel: 0.8 })], { lane: 0, len: 12 });
      note(s0, 'ENH', [S(s0, 'tpt_sus', 74, 14, { vel: 1 }), S(s0, 'vln_sus', 78, 14, { vel: 0.6 }), S(s0, 'piano', 74, 14, { vel: 0.7 })], { lane: 3, len: 12 });
      return;
    }
    if (b.sec === 'climax' || b.sec === 'final') {
      b = Object.assign({ inst: 'tpt_sus', short: 'tpt_stac', double: [['hn_sus', -12, 0.55]].concat(b.sec === 'final' ? [['vln_sus', 0, 0.45]] : []) }, b);
    }
    const at = play(s0, ch, b);

    if (b.sec === 'intro') {
      strings(s0, ch, { pad: 0.22, vc: 0.35, attack: 0.8 });
      if (i % 2 === 0) timp(s0, ch.timp, 0.5);
      if (i === 3) S(s0 + 8, 'cb_sus', ch.cb, 8, { vel: 0.5, attack: 0.4 });
    } else if (b.sec === 'A') {
      strings(s0, ch, { pad: 0.28, cb: 0.55 });
      ostinato(s0, ch, 0.45, at);
      drums(s0, ch, at, { timp: [0], timpVel: 0.65, bd: i >= 8 ? [0, 8] : [], bdVel: 0.55 });
    } else if (b.sec === 'build') {
      const n = i - 12;
      strings(s0, ch, { pad: 0.3 + n * 0.08, cb: 0.6, len: n === 3 ? 12 : 16 });
      if (n < 2) ostinato(s0, ch, 0.5, at);
      SC(s0, 'tbn_sus', [ch.cb + 12, ch.cb + 19], n === 3 ? 12 : 16, { vel: 0.35 + n * 0.08, attack: 0.2 });
      drums(s0, ch, at, { timp: n < 2 ? [0, 8] : n === 2 ? [0, 2, 4, 6] : [], bd: n < 3 ? [0, 8] : [] });
    } else if (b.sec === 'climax' || b.sec === 'final') {
      const fin = b.sec === 'final';
      strings(s0, ch, { pad: fin ? 0.4 : 0.32, cb: 0.7 });
      SC(s0, 'tbn_sus', [ch.cb + 12, ch.cb + 19], 16, { vel: fin ? 0.5 : 0.42, attack: 0.05 });
      ostinato(s0, ch, fin ? 0.6 : 0.55, at);
      drums(s0, ch, at, { timp: [0, 8], bd: [0, 8], sn: [4, 12], snVel: fin ? 0.5 : 0.42 });
      if (!(at[0] && at[0].paired) && (i === 16 || i === 20 || i === 28 || i === 32)) P(s0, 'crash', { vel: 0.7 });
    } else if (b.sec === 'inter') {
      strings(s0, ch, { pad: 0.18, cb: 0.35, attack: 0.6, len: i === 27 ? 12 : 16 });
      SC(s0, 'piano', ch.pad.map(m => m - 12), 8, { vel: 0.45 });
      if (i < 27) SC(s0 + 8, 'piano', ch.pad.map(m => m - 12), 8, { vel: 0.35 });
      if (i === 24) timp(s0, ch.timp, 0.5);
    } else if (b.sec === 'outro') {
      strings(s0, ch, { pad: 0.5, cb: 0.7, len: 12, attack: 0.05 });
      SC(s0, 'tbn_sus', [50, 57], 12, { vel: 0.5 });
    }
  });

  const BARS = ORCH_BARS.length;
  const notes = layoutLanes(cands);
  polishPatterns(notes); // 반복 변형 + 금지 패턴(1 4 (23) 등) 수정
  music.sort((a, b) => a.t - b.t);
  const charts = ['E', 'N', 'H'].map(d => notes
    .filter(n => n.diffs.includes(d))
    .sort((a, b) => a.s - b.s || a.lane - b.lane)
    .map(n => ({ t: T(n.s), lane: n.lane, end: n.len ? T(n.s + n.len) : 0, ks: n.ks, s: n.s, len: n.len })));
  const playTime = BARS * 16 * OS;
  const levels = charts.map(c => Math.max(1, Math.min(15, Math.round(1.5 + (c.length / playTime) * 1.5 + (ORCH.bpm - 150) / 30))));
  return {
    music, charts, levels,
    duration: T(BARS * 16),
    beats: Array.from({ length: BARS * 4 + 1 }, (_, i) => T(i * 4)),
  };
}
