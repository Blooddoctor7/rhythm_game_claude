#!/usr/bin/env node
/* ==========================================================
 * check-charts.js — 합성곡 채보 점검
 *
 *  사용법 (프로젝트 폴더에서):
 *    node tools/check-charts.js composeKpop             요약 + 문제 목록
 *    node tools/check-charts.js composeGugak H 8,9,10   HARD 8~10마디를 그림으로
 *    node tools/check-charts.js songs/last_note         mp3 곡 채보 점검
 *
 *  점검 항목
 *   - 같은 라인 노트가 16분 2칸 미만으로 붙음 / 롱노트와 겹침
 *   - 동시에 누르는 손가락 3개 이상 (롱노트 누르는 중 포함)
 *   - 바로 이어지는 노트 묶음이 같은 라인을 다시 침 (연타)
 *   - 키음이 없는 노트
 *   - 금지 패턴: 단타 두 개 + 나머지 두 라인 동시치기 (1 4 (23), (23) 1 4, 2 4 (13), 1 3 (24) 등)
 *   - 금지 패턴: 단타 사이에 동시치기 (2 (14) 3, 3 (14) 2, 2 (13) 4, 1 (24) 3 등)
 *   - (14) 2 3 · (14) 2 유형이 8마디 안에 다시 나오는 곳
 *   - 반복: 같은 리듬·같은 배치가 박 단위로 3연속 / 앞 마디와 완전히 같은 마디
 * ========================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

// 브라우저에서는 모든 js 파일이 전역 이름을 같이 쓰므로, 같은 이름을 두 파일에서 선언하면 페이지 전체가 멈춤
{
  const seen = new Map(), dups = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
    const names = [];
    for (const m of src.matchAll(/^(?:function|class)\s+([A-Za-z_$][\w$]*)/gm)) names.push(m[1]);
    for (const m of src.matchAll(/^(?:const|let|var)\s+([^;]*)/gm)) {
      for (const part of m[1].split(',')) {
        const id = /^\s*([A-Za-z_$][\w$]*)\s*=/.exec(part);
        if (id) names.push(id[1]);
      }
    }
    for (const n of names) {
      if (seen.has(n) && seen.get(n) !== f) dups.push(`${n} (${seen.get(n)}, ${f})`);
      else seen.set(n, f);
    }
  }
  if (dups.length) console.log(`⚠ 전역 이름 중복: ${dups.join(', ')}`);
}
const ctx = vm.createContext({ window: {}, console, Math, Float32Array, Object, Array, Set, Map, WeakMap, JSON, Error });
// music.js, boss.js(공용 함수) 먼저, 그다음 곡 파일들 (game.js 제외)
const songFiles = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js') && !['music.js', 'boss.js', 'game.js'].includes(f)).sort();
for (const f of ['music.js', 'boss.js', ...songFiles]) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f });
}
const fn = process.argv[2] || 'composeGugak';
let song;
if (fn.startsWith('songs/')) {
  // mp3 곡 채보: songs/<id>/chart.js — [시간, 라인, 롱노트 끝, 슬롯, 길이(슬롯)]
  const w = {};
  new Function('window', fs.readFileSync(path.join(ROOT, fn, 'chart.js'), 'utf8'))(w);
  const s = w.BEAT_RUSH_SONGS[0];
  // 예전 형식 [시간, 라인, 끝] 은 박 시각(beats)으로 슬롯을 계산
  const B = s.beats, toSlot = t => { let i = 0; while (i + 1 < B.length && B[i + 1] <= t) i++; return Math.round((i + (t - B[i]) / ((B[i + 1] || 2 * B[i] - B[i - 1]) - B[i])) * 4); };
  const charts = s.charts.map(c => c.map(([t, lane, end, slot, len]) => slot === undefined
    ? { t, lane, end, s: toSlot(t), len: end ? toSlot(end) - toSlot(t) : 0, ks: ['음원'] }
    : { t, lane, end, s: slot, len: len || 0, ks: ['음원'] }));
  const last = Math.max(...charts.flat().map(n => n.s));
  song = { duration: s.duration + 2.5, levels: s.levels, music: [], charts, beats: Array.from({ length: Math.ceil(last / 4) + 2 }) };
} else song = vm.runInContext(`${fn}()`, ctx);
const NAMES = ['EASY', 'NORMAL', 'HARD'];
const bars = Math.round((song.beats.length - 1) / 4);
const playTime = song.duration - 2.5;
const pos = s => `${Math.floor(s / 16)}.${s % 16}`;

console.log(`${fn}: ${song.duration.toFixed(1)}초, ${bars}마디, 소리 ${song.music.length}개, 레벨 ${song.levels.join('/')}`);
song.charts.forEach((c, d) => {
  const errs = [];
  const byLane = [[], [], [], []];
  c.forEach(n => byLane[n.lane].push(n));
  byLane.forEach((arr, l) => {
    for (let i = 1; i < arr.length; i++) {
      const p = arr[i - 1], q = arr[i];
      if (q.s - (p.s + (p.len || 0)) < 2) errs.push(`라인${l} ${pos(q.s)} 간격`);
    }
  });
  const steps = [...new Set(c.map(n => n.s))].sort((a, b) => a - b);
  for (const s of steps) {
    const f = c.filter(n => n.s === s || (n.len && n.s < s && s <= n.s + n.len)).length;
    if (f > 2) errs.push(`${pos(s)} 손가락${f}`);
  }
  const jacks = [];
  for (let i = 1; i < steps.length; i++) {
    if (steps[i] - steps[i - 1] > 2) continue;
    const a = c.filter(n => n.s === steps[i - 1]).map(n => n.lane), b = c.filter(n => n.s === steps[i]).map(n => n.lane);
    if (a.some(x => b.includes(x))) jacks.push(pos(steps[i]));
  }
  const chords = steps.filter(s => c.filter(n => n.s === s).length === 2).length;
  const longs = c.filter(n => n.len).length;
  const noKs = c.filter(n => !n.ks || !n.ks.length).length;

  // 반복
  const groups = new Map();
  for (const n of c) { const g = Math.floor(n.s / 4); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(n); }
  const hist = new Map(), triples = [];
  for (const gi of [...groups.keys()].sort((a, b) => a - b)) {
    const g = groups.get(gi).sort((a, b) => a.s - b.s || a.lane - b.lane);
    const rhythm = g.map(n => n.s - gi * 4).join(',');
    const sig = g.map(n => `${n.s - gi * 4}:${n.lane}`).join(' ');
    const h = (hist.get(rhythm) || []).filter(o => gi - o.gi <= 8);
    if (h.length >= 2 && h[h.length - 1].sig === sig && h[h.length - 2].sig === sig) triples.push(`${Math.floor(gi / 4)}.${(gi % 4) * 4}`);
    h.push({ gi, sig });
    hist.set(rhythm, h);
  }
  const barSig = new Map(), sameBars = [];
  for (let b = 0; b < bars; b++) {
    const arr = c.filter(n => Math.floor(n.s / 16) === b).map(n => `${n.s % 16}:${n.lane}${n.len ? 'L' : ''}`).sort();
    if (arr.length < 3) continue;
    const k = arr.join(' ');
    if (barSig.has(k)) sameBars.push(`${b}=${barSig.get(k)}`);
    else barSig.set(k, b);
  }

  console.log(`\n${NAMES[d]}  노트 ${c.length} (초당 ${(c.length / playTime).toFixed(2)})  동시치기 ${chords}  롱노트 ${longs}  라인별 ${[0, 1, 2, 3].map(l => byLane[l].length).join('/')}`);
  console.log(`  오류 ${errs.length}${errs.length ? ' — ' + errs.slice(0, 8).join(', ') : ''}`);
  const plain = c.map(n => ({ s: n.s, lane: n.lane, len: n.len || 0, diffs: 'H' }));
  const oi = vm.runInContext('findOuterInner', ctx)(plain), sw = vm.runInContext('findInnerSandwich', ctx)(plain);
  const oc = vm.runInContext('findOuterChordInner', ctx)(plain), ocx = vm.runInContext('excessOuterChordInner', ctx)(plain);
  console.log(`  연타 ${jacks.length}${jacks.length ? ' — ' + jacks.slice(0, 8).join(', ') : ''}  |  키음 없는 노트 ${noKs}  |  금지 패턴 1 4 (23)·2 4 (13) ${oi.length}${oi.length ? ' — ' + oi.slice(0, 6).map(h => pos(h.s)).join(', ') : ''}, 2 (14) 3·2 (13) 4 ${sw.length}${sw.length ? ' — ' + sw.slice(0, 6).map(h => pos(h.s)).join(', ') : ''}  |  (14) 2 3 유형 ${oc.length}번, 8마디 안에 다시 ${ocx.length}${ocx.length ? ' — ' + ocx.slice(0, 6).map(h => pos(h.s)).join(', ') : ''}`);
  console.log(`  반복: 박 단위 3연속 ${triples.length}${triples.length ? ' — ' + triples.slice(0, 8).join(', ') : ''}  |  같은 마디 ${sameBars.length}${sameBars.length ? ' — ' + sameBars.join(', ') : ''}`);
  console.log(`  마디별 노트 ${Array.from({ length: bars }, (_, b) => c.filter(n => Math.floor(n.s / 16) === b).length.toString(36)).join('')}`);
});

// 마디 그림: 위에서부터 라인 0~3, o=노트 O=롱노트 시작 |=누르는 중
const di = { E: 0, N: 1, H: 2 }[(process.argv[3] || '').toUpperCase()];
if (di !== undefined) {
  const c = song.charts[di];
  console.log(`\n${NAMES[di]} 마디 그림 (줄 = 라인 0~3, 칸 = 16분)`);
  for (const b of (process.argv[4] || '').split(',').filter(Boolean).map(Number)) {
    const rows = [0, 1, 2, 3].map(() => Array(16).fill('.'));
    for (const n of c) {
      for (let k = 0; k < 16; k++) {
        const s = b * 16 + k;
        if (n.s === s) rows[n.lane][k] = n.len ? 'O' : 'o';
        else if (n.len && s > n.s && s <= n.s + n.len) rows[n.lane][k] = '|';
      }
    }
    console.log(`  ${String(b).padStart(2)}마디  ${rows.map(r => r.join('')).join('  ')}`);
  }
}
