'use strict';
/* ==========================================================
 * game.js — 게임 루프, 입력, 판정, 화면 그리기
 * ========================================================== */

// ---------- 설정 ----------
const KEYS = ['KeyD', 'KeyF', 'KeyJ', 'KeyK']; // e.code 사용 → 한글 입력 상태여도 동작
const KEY_LABELS = ['D', 'F', 'J', 'K'];
const LANE_COLORS = ['#e9f1ff', '#46b6ff', '#46b6ff', '#e9f1ff'];
const WINDOW = { PERFECT: 0.042, GREAT: 0.084, GOOD: 0.125 }; // 판정 범위(초) — 이보다 일찍 누르면 무시
const JUDGES = {
  PERFECT: { color: '#ffe066', weight: 1 },
  GREAT: { color: '#5dffa8', weight: 0.7 },
  GOOD: { color: '#5cc8ff', weight: 0.3 },
  MISS: { color: '#ff4d6d', weight: 0 },
};
const DIFFS = [
  { name: 'EASY', level: 1, color: '#4ade80' },
  { name: 'NORMAL', level: 2, color: '#facc15' },
  { name: 'HARD', level: 3, color: '#fb7185' },
];
const RANK_COLORS = { S: '#ffe066', A: '#5dffa8', B: '#5cc8ff', C: '#c49bff', D: '#9aa0b5' };
const FONT = '"Pretendard","Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif';

// ---------- 저장 (최고 점수, 설정) ----------
const store = {
  get(k, def) {
    try { const v = localStorage.getItem('beatrush.' + k); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  },
  set(k, v) {
    try { localStorage.setItem('beatrush.' + k, JSON.stringify(v)); } catch (e) { /* 저장 불가 환경 */ }
  },
};
const settings = Object.assign({ diff: 1, speed: 3, offset: 0, hitsound: true, song: null }, store.get('settings', {}));
const best = store.get('best', {}); // { '곡id:난이도': 점수 }
const saveSettings = () => store.set('settings', settings);

/* ==========================================================
 * 곡 목록
 *  - 합성곡: music.js(Neon Drive), boss.js(Crimson Throne) 에서 실시간 합성
 *  - mp3 곡: songs/<id>/chart.js (tools/add-song.mjs 로 생성)
 *  모든 시간은 "게임 시간" = 음원 시간 + LEAD (노트가 내려올 여유)
 *  keysound 곡은 노트마다 연주할 소리(ks)가 있어서, 노트를 쳐야 그 소리가 남
 * ========================================================== */
const LEAD = SONG.leadIn;
const synth = composeSong();
const boss = composeBoss();
const gugak = composeGugak();
const kpop = composeKpop();
const orch = composeOrch();
const rock = composeRock();
const SONGS = [{
  id: 'neon_drive',
  title: SONG.title,
  artist: 'BEAT RUSH 자체 합성곡',
  bpm: SONG.bpm,
  kind: 'synth',
  music: synth.music,
  length: synth.duration - LEAD,
  levels: [3, 6, 9],
  charts: DIFFS.map(d => buildChart(synth.notes, d.level)),
  beats: Array.from({ length: TOTAL_BARS * 4 + 1 }, (_, i) => T(i * 4)),
  barPhase: 0,
  status: 'ready',
}, {
  id: BOSS.id,
  title: BOSS.title,
  artist: 'BEAT RUSH 자체 합성곡 · 키음',
  bpm: BOSS.bpm,
  kind: 'synth',
  music: boss.music,
  keysound: true,
  boss: true,
  delay: BS * 3,
  gain: 0.72, // 소리가 꽉 찬 곡이라 전체 볼륨을 낮춰 찌그러짐 방지
  art: ['#3a0010', '#ff2e4d', '♛'],
  length: boss.duration - LEAD,
  levels: boss.levels,
  charts: boss.charts,
  beats: boss.beats,
  barPhase: 0,
  status: 'ready',
}, {
  id: GUGAK.id,
  title: GUGAK.title,
  artist: '신명 · 국악 퓨전 · 키음',
  bpm: GUGAK.bpm,
  kind: 'synth',
  music: gugak.music,
  keysound: true,
  delay: GS * 3,
  gain: 0.8,
  art: ['#123a6b', '#c8102e', '樂'],
  length: gugak.duration - LEAD,
  levels: gugak.levels,
  charts: gugak.charts,
  beats: gugak.beats,
  barPhase: 0,
  status: 'ready',
}, {
  id: KPOP.id,
  title: KPOP.title,
  artist: 'K-pop 댄스 · 키음',
  bpm: KPOP.bpm,
  kind: 'synth',
  music: kpop.music,
  keysound: true,
  delay: KS * 3,
  gain: 0.8,
  art: ['#ff4f9a', '#6c4dff', '★'],
  length: kpop.duration - LEAD,
  levels: kpop.levels,
  charts: kpop.charts,
  beats: kpop.beats,
  barPhase: 0,
  status: 'ready',
}, {
  id: ORCH.id,
  title: ORCH.title,
  artist: '오케스트라 · 실제 악기 · 키음',
  bpm: ORCH.bpm,
  kind: 'synth',
  music: orch.music,
  keysound: true,
  samples: ['piano', 'strings', 'brass', 'winds', 'perc'], // 실제 악기 샘플 (sampler.js)
  reverb: { time: 2.4, wet: 0.22 },
  gain: 0.75,
  art: ['#14213d', '#c9a227', '✦'],
  length: orch.duration - LEAD,
  levels: orch.levels,
  charts: orch.charts,
  beats: orch.beats,
  barPhase: 0,
  status: 'idle',
}, {
  id: ROCK.id,
  title: ROCK.title,
  artist: '밴드 팝록 · 실제 악기 · 키음',
  bpm: ROCK.bpm,
  kind: 'synth',
  music: rock.music,
  keysound: true,
  samples: ['guitar', 'bass', 'drums'], // 실제 악기 샘플 (sampler.js)
  reverb: { time: 1.2, wet: 0.12 },     // 작은 방 울림
  gain: 0.62,
  art: ['#0a84ff', '#ffd60a', '♬'],
  length: rock.duration - LEAD,
  levels: rock.levels,
  charts: rock.charts,
  beats: rock.beats,
  barPhase: 0,
  status: 'idle',
}];
for (const s of window.BEAT_RUSH_SONGS || []) {
  SONGS.push(Object.assign({}, s, {
    kind: 'audio',
    length: s.duration,
    charts: s.charts.map(c => c.map(([t, lane, end]) => ({ t: t + LEAD, lane, end: end ? end + LEAD : 0 }))),
    beats: s.beats.map(b => b + LEAD),
    status: 'idle',
    buffer: null,
  }));
}
for (const s of SONGS) {
  if (!s.cover) continue;
  s.img = new Image();
  s.img.src = s.cover;
}
// 새로 추가된 곡이 있으면 한 번 자동 선택 (보스곡 우선)
const fresh = SONGS.filter(s => !(settings.seen || []).includes(s.id));
if (fresh.length) {
  settings.song = (fresh.find(s => s.boss) || fresh[fresh.length - 1]).id;
  settings.seen = SONGS.map(s => s.id);
  saveSettings();
}
if (!SONGS.some(s => s.id === settings.song)) settings.song = SONGS[0].id;
const curSong = () => SONGS.find(s => s.id === settings.song);
const bestKey = (s, d) => `${s.id}:${d}`;

// mp3 불러오기: 스크립트로 포함된 음원(base64)을 디코딩 → 파일을 더블클릭해서 열어도 동작
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = resolve;
    el.onerror = () => reject(new Error('불러오기 실패: ' + src));
    document.head.appendChild(el);
  });
}
async function loadAudio(s) {
  if (s.status !== 'idle') return;
  s.status = 'loading';
  try {
    if (s.samples) { // 실제 악기 샘플을 쓰는 합성곡
      await Samples.load(s.samples);
      s.status = 'ready';
      return;
    }
    await loadScript(s.audio);
    const bin = atob(window.BEAT_RUSH_AUDIO[s.id]);
    delete window.BEAT_RUSH_AUDIO[s.id];
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const dec = new OAC(2, 1, 48000);
    s.buffer = await new Promise((resolve, reject) => dec.decodeAudioData(bytes.buffer, resolve, reject));
    s.status = 'ready';
  } catch (e) {
    console.error(e);
    s.status = 'error';
  }
}
(async () => {
  await loadAudio(curSong()); // 선택된 곡 먼저
  for (const s of SONGS) await loadAudio(s);
})();

// ---------- 캔버스 ----------
const cvs = document.getElementById('game');
const g = cvs.getContext('2d');
let W = 0, H = 0;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  cvs.width = Math.round(W * dpr);
  cvs.height = Math.round(H * dpr);
  cvs.style.width = W + 'px';
  cvs.style.height = H + 'px';
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ---------- 상태 ----------
let scene = 'title'; // title | play | result
let play = null;     // 플레이 중인 판의 상태
let result = null;
let buttons = [];    // 이번 프레임에 그려진 클릭 가능한 버튼들
const mouse = { x: -1, y: -1 };
const pointerLanes = new Map();

/* ==========================================================
 * 게임 진행
 * ========================================================== */
function startGame() {
  const s = curSong();
  if (s.status !== 'ready') return; // mp3를 아직 불러오는 중
  const ctx = Sound.init();
  if (play) stopMusic(play);
  const chart = s.charts[settings.diff].map(n => Object.assign({ state: 0 }, n)); // 0 대기, 1 롱노트 누르는 중, 2 처리됨, 3 놓침
  const lanes = [[], [], [], []];
  chart.forEach(n => lanes[n.lane].push(n));
  const lastNote = chart.reduce((a, n) => Math.max(a, n.end || n.t), 0);
  const p = (play = {
    song: s,
    diff: settings.diff,
    chart, lanes,
    ptr: [0, 0, 0, 0],                                         // 라인별로 아직 처리 안 된 첫 노트
    total: chart.reduce((a, n) => a + (n.end ? 2 : 1), 0),    // 롱노트는 시작+끝 2번 판정
    endTime: s.kind === 'audio' ? Math.max(lastNote + 2, LEAD + s.buffer.duration + 1) : lastNote + 2,
    bus: Sound.createBus(s.delay, s.reverb),
    source: null,
    // 키음 모드: 노트에 연결된 소리는 배경 재생에서 빼고, 노트를 칠 때 재생
    claimed: s.keysound && settings.hitsound ? new Set(chart.flatMap(n => n.ks || [])) : null,
    start: ctx.currentTime + 0.2,                              // 게임 시간 0초에 해당하는 AudioContext 시간
    beatIdx: 0,
    evIdx: 0,
    wall: null,                                                // 오디오가 막혔을 때 쓰는 대체 시계
    lastT: -Infinity,
    paused: false, pausedAt: 0, pausedRaw: 0,
    counts: { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 },
    combo: 0, maxCombo: 0, judged: 0, sumW: 0,
    held: [false, false, false, false],
    releaseAt: [-1e9, -1e9, -1e9, -1e9],
    effects: [],
    last: null,
    speedAt: -1e9,
  });
  if (s.gain) p.bus.out.gain.value = s.gain;
  if (s.kind === 'audio') {
    // mp3는 통째로 한 번에 예약 재생 (게임 시간 LEAD초에 음원 0초)
    p.source = ctx.createBufferSource();
    p.source.buffer = s.buffer;
    p.source.connect(p.bus.out);
    p.source.start(p.start + LEAD);
  }
  pointerLanes.clear();
  scene = 'play';
  // 오디오 장치가 없거나 재생이 막히면 시계가 멈추므로, 일반 시계로 대체
  setTimeout(() => {
    if (play === p && !p.paused && ctx.state !== 'running') p.wall = performance.now() / 1000 - rawTime();
  }, 1000);
}

function stopMusic(p, fade) {
  Sound.closeBus(p.bus, fade);
  if (p.source) {
    try { p.source.stop(fade ? Sound.ctx.currentTime + fade * 6 : 0); } catch (e) { /* 이미 멈춤 */ }
  }
}

function toTitle() {
  if (play) {
    stopMusic(play);
    if (Sound.ctx.state === 'suspended') Sound.ctx.resume();
  }
  play = null;
  scene = 'title';
}

function pauseGame() {
  const p = play;
  if (!p || p.paused) return;
  p.pausedRaw = rawTime();
  p.pausedAt = songTime();
  p.paused = true;
  Sound.ctx.suspend();
}

function resumeGame() {
  const p = play;
  if (!p || !p.paused) return;
  if (p.wall !== null) p.wall = performance.now() / 1000 - p.pausedRaw;
  p.paused = false;
  Sound.ctx.resume();
}

function finish() {
  const p = play;
  stopMusic(p, 0.5);
  const score = calcScore(p);
  const acc = p.sumW / p.total;
  const rank = acc >= 0.95 ? 'S' : acc >= 0.9 ? 'A' : acc >= 0.8 ? 'B' : acc >= 0.7 ? 'C' : 'D';
  const key = bestKey(p.song, p.diff);
  const isBest = score > (best[key] || 0);
  if (isBest) {
    best[key] = score;
    store.set('best', best);
  }
  result = {
    song: p.song, diff: p.diff, score, acc, rank, isBest,
    counts: Object.assign({}, p.counts), maxCombo: p.maxCombo, total: p.total,
    fc: p.counts.MISS === 0,
    ap: p.counts.MISS + p.counts.GREAT + p.counts.GOOD === 0,
    at: performance.now(),
  };
  play = null;
  scene = 'result';
}

const calcScore = p => Math.floor((1e6 * p.sumW) / p.total);

// ---------- 시계: 화면과 음악의 싱크는 전부 오디오 시간 기준 ----------
function audioClock() {
  const ctx = Sound.ctx;
  if (ctx.getOutputTimestamp) {
    // 실제로 스피커에서 나오고 있는 시점 (출력 지연 보정)
    const ts = ctx.getOutputTimestamp();
    if (ts.contextTime > 0 && ts.performanceTime > 0) {
      const ahead = Math.min(Math.max(performance.now() - ts.performanceTime, 0), 200);
      return ts.contextTime + ahead / 1000;
    }
  }
  return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
}

function rawTime() {
  const p = play;
  return p.wall !== null ? performance.now() / 1000 - p.wall : audioClock() - p.start;
}

function songTime() {
  const p = play;
  if (p.paused) return p.pausedAt;
  let t = rawTime() - settings.offset / 1000;
  if (t < p.lastT) t = p.lastT; // 시간이 뒤로 가지 않게
  return (p.lastT = t);
}

// 소리를 조금씩 미리 예약 (look-ahead 스케줄러)
function schedule() {
  const p = play;
  if (!p || p.paused || !Sound.ctx || !p.song.music) return;
  const ctx = Sound.ctx, ev = p.song.music, horizon = ctx.currentTime + 0.3;
  while (p.evIdx < ev.length && p.start + ev[p.evIdx].t < horizon) {
    const e = ev[p.evIdx++];
    if (p.claimed && p.claimed.has(e)) continue; // 키음은 노트를 칠 때 재생
    const when = p.start + e.t;
    if (when > ctx.currentTime - 0.05) playEvent(p.bus, Math.max(when, ctx.currentTime), e);
  }
}

/* ==========================================================
 * 판정
 * ========================================================== */
function judge(j, lane, diff = 0, tail = false) {
  const p = play, now = performance.now();
  p.counts[j]++;
  p.judged++;
  p.sumW += JUDGES[j].weight;
  if (j === 'MISS') p.combo = 0;
  else {
    p.combo++;
    if (p.combo > p.maxCombo) p.maxCombo = p.combo;
    p.effects.push({ lane, j, at: now });
  }
  const timing = !tail && (j === 'GREAT' || j === 'GOOD') ? (diff < 0 ? 'FAST' : 'SLOW') : '';
  p.last = { j, at: now, timing };
}

function press(l) {
  const p = play;
  p.held[l] = true;
  if (settings.hitsound && !p.claimed) Sound.tick();
  const t = songTime(), arr = p.lanes[l];
  for (let i = p.ptr[l]; i < arr.length; i++) {
    const n = arr[i];
    if (n.state !== 0) continue;
    const d = t - n.t;                       // + 늦음 / - 빠름
    if (d > WINDOW.GOOD) continue;           // 이미 지나간 노트 (곧 MISS 처리됨)
    if (d < -WINDOW.GOOD) return;            // 판정 범위보다 일찍 누름 → 무시 (실수로 눌러도 MISS 아님)
    const a = Math.abs(d);
    const j = a <= WINDOW.PERFECT ? 'PERFECT' : a <= WINDOW.GREAT ? 'GREAT' : 'GOOD';
    n.state = n.end ? 1 : 2;
    judge(j, l, d);
    if (p.claimed && n.ks) for (const e of n.ks) playEvent(p.bus, Sound.ctx.currentTime, e); // 키음
    return;
  }
}

function release(l) {
  const p = play;
  if (!p.held[l]) return;
  p.held[l] = false;
  p.releaseAt[l] = performance.now();
  if (p.paused) return; // 재개 후 update()에서 처리
  const t = songTime(), arr = p.lanes[l];
  for (let i = p.ptr[l]; i < arr.length && arr[i].t <= t + 0.5; i++) {
    if (arr[i].state === 1) return endHold(arr[i], l, t);
  }
}

// 롱노트에서 손을 뗐을 때
function endHold(n, l, t) {
  if (t >= n.end - WINDOW.GREAT) {
    n.state = 2;
    judge('PERFECT', l, 0, true);
  } else if (t >= n.end - 0.2) {
    n.state = 2;
    judge('GREAT', l, 0, true);
  } else {
    n.state = 3;
    n.brokeAt = t;
    judge('MISS', l, 0, true);
  }
}

function update(t) {
  const p = play;
  for (let l = 0; l < 4; l++) {
    const arr = p.lanes[l];
    for (let i = p.ptr[l]; i < arr.length; i++) {
      const n = arr[i];
      if (n.t > t) break;
      if (n.state === 0 && t - n.t > WINDOW.GOOD) {
        n.state = 3;
        judge('MISS', l);
        if (n.end) judge('MISS', l, 0, true);
      } else if (n.state === 1) {
        if (t >= n.end) { n.state = 2; judge('PERFECT', l, 0, true); } // 끝까지 누르고 있으면 자동 성공
        else if (!p.held[l]) endHold(n, l, t);
      }
    }
    while (p.ptr[l] < arr.length && arr[p.ptr[l]].state >= 2) p.ptr[l]++;
  }
  const now = performance.now();
  p.effects = p.effects.filter(e => now - e.at < 400);
  if (t > p.endTime) finish();
}

/* ==========================================================
 * 설정 변경
 * ========================================================== */
function selectDiff(i) { settings.diff = (i + DIFFS.length) % DIFFS.length; saveSettings(); }
function selectSong(d) {
  const i = SONGS.indexOf(curSong());
  settings.song = SONGS[(i + d + SONGS.length) % SONGS.length].id;
  saveSettings();
}
function changeSpeed(d) {
  settings.speed = Math.min(8, Math.max(1, Math.round((settings.speed + d) * 10) / 10));
  if (play) play.speedAt = performance.now();
  saveSettings();
}
function changeOffset(d) { settings.offset = Math.min(300, Math.max(-300, settings.offset + d)); saveSettings(); }
function toggleHit() { settings.hitsound = !settings.hitsound; saveSettings(); }

/* ==========================================================
 * 입력
 * ========================================================== */
window.addEventListener('keydown', e => {
  const lane = KEYS.indexOf(e.code);
  if (lane >= 0 || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.repeat) return;

  if (scene === 'play') {
    if (e.code === 'Escape') return play.paused ? resumeGame() : pauseGame();
    if (play.paused) {
      if (e.code === 'KeyR') startGame();
      else if (e.code === 'KeyQ') toTitle();
      else if (e.code === 'Enter' || e.code === 'Space') resumeGame();
      return;
    }
    if (lane >= 0) press(lane);
    else if (e.code === 'ArrowUp' || e.code === 'Equal' || e.code === 'NumpadAdd') changeSpeed(0.5);
    else if (e.code === 'ArrowDown' || e.code === 'Minus' || e.code === 'NumpadSubtract') changeSpeed(-0.5);
  } else if (scene === 'title') {
    switch (e.code) {
      case 'ArrowUp': selectSong(-1); break;
      case 'ArrowDown': selectSong(1); break;
      case 'ArrowLeft': selectDiff(settings.diff - 1); break;
      case 'ArrowRight': selectDiff(settings.diff + 1); break;
      case 'Equal': case 'NumpadAdd': changeSpeed(0.5); break;
      case 'Minus': case 'NumpadSubtract': changeSpeed(-0.5); break;
      case 'BracketLeft': changeOffset(-5); break;
      case 'BracketRight': changeOffset(5); break;
      case 'KeyH': toggleHit(); break;
      case 'Enter': case 'NumpadEnter': case 'Space': startGame(); break;
    }
  } else if (scene === 'result') {
    if (e.code === 'Enter' || e.code === 'Space') startGame();
    else if (e.code === 'Escape') toTitle();
  }
});

window.addEventListener('keyup', e => {
  const lane = KEYS.indexOf(e.code);
  if (lane >= 0 && scene === 'play') release(lane);
});

// 창을 벗어나면 keyup을 못 받을 수 있으므로 정리
window.addEventListener('blur', () => {
  if (scene === 'play') for (let l = 0; l < 4; l++) release(l);
  pointerLanes.clear();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && scene === 'play') pauseGame();
});

const inside = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

// 마우스/터치: 버튼 클릭, 플레이 중에는 라인을 직접 눌러서 칠 수 있음
cvs.addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
cvs.addEventListener('pointerdown', e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  const b = buttons.find(b => inside(b, e.clientX, e.clientY));
  if (b) return b.action();
  if (scene === 'play' && !play.paused) {
    const L = layout();
    const lane = Math.floor((e.clientX - L.fx) / L.lw);
    if (lane >= 0 && lane < 4) {
      pointerLanes.set(e.pointerId, lane);
      press(lane);
    }
  }
});
const pointerUp = e => {
  const lane = pointerLanes.get(e.pointerId);
  if (lane === undefined) return;
  pointerLanes.delete(e.pointerId);
  if (scene === 'play') release(lane);
};
cvs.addEventListener('pointerup', pointerUp);
cvs.addEventListener('pointercancel', pointerUp);

/* ==========================================================
 * 그리기 도구
 * ========================================================== */
const _rgb = {};
function hexA(hex, a) {
  let c = _rgb[hex];
  if (!c) {
    const v = parseInt(hex.slice(1), 16);
    c = _rgb[hex] = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

function rr(x, y, w, h, r) {
  w = Math.max(0, w);
  h = Math.max(0, h);
  r = Math.max(0, Math.min(r, w / 2, h / 2)); // 창이 아주 작아도 음수가 되지 않게
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function text(s, x, y, size, color, o = {}) {
  g.font = `${o.weight || 700} ${Math.round(size)}px ${FONT}`;
  g.textAlign = o.align || 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  if (o.spacing) g.letterSpacing = o.spacing + 'px';
  if (o.max) g.fillText(s, x, y, o.max);
  else g.fillText(s, x, y);
  if (o.spacing) g.letterSpacing = '0px';
}

function panel(x, y, w, h, r = 12) {
  rr(x, y, w, h, r);
  g.fillStyle = 'rgba(255,255,255,0.04)';
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.1)';
  g.lineWidth = 1;
  g.stroke();
}

function button(x, y, w, h, label, action, o = {}) {
  buttons.push({ x, y, w, h, action });
  rr(x, y, w, h, o.r ?? 12);
  g.save();
  if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = 20; }
  g.fillStyle = o.fill || 'rgba(255,255,255,0.06)';
  g.fill();
  g.restore();
  if (inside({ x, y, w, h }, mouse.x, mouse.y)) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fill(); }
  g.strokeStyle = o.stroke || 'rgba(255,255,255,0.16)';
  g.lineWidth = o.lw || 1.2;
  g.stroke();
  if (label) text(label, x + w / 2, y + h / 2 + 1, o.size || 15, o.color || '#fff', { weight: 700, max: w - 12 });
}

function stepper(x, y, w, h, label, value, dec, inc, k) {
  panel(x, y, w, h);
  const bs = Math.min(h - 12, w * 0.24), by = y + (h - bs) / 2; // 좁은 화면에선 버튼을 줄여 값 표시 공간 확보
  button(x + 5, by, bs, bs, '−', dec, { r: 8, size: 18 });
  button(x + w - 5 - bs, by, bs, bs, '+', inc, { r: 8, size: 18 });
  text(label, x + w / 2, y + h / 2 - 9 * k, Math.max(10, 11 * k), 'rgba(255,255,255,0.5)', { weight: 600 });
  text(value, x + w / 2, y + h / 2 + 9 * k, Math.max(12, 15 * k), '#fff', { weight: 800, max: w - bs * 2 - 14 });
}

const fmtScore = n => n.toLocaleString('en-US');
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function drawBg(now, pulse) {
  g.fillStyle = '#06070f';
  g.fillRect(0, 0, W, H);
  const big = Math.max(W, H);
  const r1 = g.createRadialGradient(W / 2, H * 1.05, 0, W / 2, H * 1.05, big * 0.8);
  r1.addColorStop(0, `rgba(110,70,255,${0.28 + 0.18 * pulse})`);
  r1.addColorStop(1, 'rgba(110,70,255,0)');
  g.fillStyle = r1;
  g.fillRect(0, 0, W, H);
  const r2 = g.createRadialGradient(W * 0.15, 0, 0, W * 0.15, 0, big * 0.6);
  r2.addColorStop(0, 'rgba(0,200,255,0.14)');
  r2.addColorStop(1, 'rgba(0,200,255,0)');
  g.fillStyle = r2;
  g.fillRect(0, 0, W, H);
  // 은은하게 흐르는 격자
  g.strokeStyle = 'rgba(255,255,255,0.025)';
  g.lineWidth = 1;
  g.beginPath();
  const off = (now / 40) % 48;
  for (let y = off - 48; y < H; y += 48) { g.moveTo(0, y); g.lineTo(W, y); }
  for (let x = (W / 2) % 48; x < W; x += 48) { g.moveTo(x, 0); g.lineTo(x, H); }
  g.stroke();
}

/* ==========================================================
 * 타이틀 화면
 * ========================================================== */
function drawTitle(now) {
  drawBg(now, 0);

  // 배경에 떨어지는 장식 노트
  const colW = W / 12;
  for (let i = 0; i < 24; i++) {
    const speed = 120 + ((i * 37) % 160);
    const y = (((now / 1000) * speed + i * 211) % (H + 100)) - 50;
    g.fillStyle = i % 3 ? 'rgba(94,231,255,0.07)' : 'rgba(255,94,196,0.07)';
    rr(((i * 7) % 12) * colW + colW * 0.2, y, colW * 0.6, 10, 4);
    g.fill();
  }

  const k = Math.min(1, H / 700);
  const fs = v => Math.max(10, v * k);
  const cw = Math.min(640, W - 32), x0 = (W - cw) / 2, cx = W / 2, gap = 12;
  let y = Math.max(16, (H - 626 * k) / 2);
  const s = curSong(), si = SONGS.indexOf(s);

  // 로고
  const ts = Math.min(78, W * 0.14) * k;
  y += ts * 0.6;
  const grad = g.createLinearGradient(cx - ts * 3, 0, cx + ts * 3, 0);
  grad.addColorStop(0, '#5ee7ff');
  grad.addColorStop(1, '#ff5ec4');
  g.save();
  g.shadowColor = 'rgba(120,200,255,0.55)';
  g.shadowBlur = 28;
  text('BEAT RUSH', cx, y, ts, grad, { weight: 900, spacing: 2 });
  g.restore();
  y += ts * 0.55 + 6;
  text('4 KEY RHYTHM GAME', cx, y, fs(13), 'rgba(255,255,255,0.5)', { spacing: 6, weight: 600 });
  y += 30 * k;

  // 곡 선택
  const ch = 80 * k, ab = 34 * k, multi = SONGS.length > 1;
  panel(x0, y, cw, ch);
  if (multi) {
    button(x0 + 8, y + (ch - ab) / 2, ab, ab, '◀', () => selectSong(-1), { r: 8, size: fs(12) });
    button(x0 + cw - 8 - ab, y + (ch - ab) / 2, ab, ab, '▶', () => selectSong(1), { r: 8, size: fs(12) });
  }
  const in0 = x0 + (multi ? ab + 16 : 12), in1 = x0 + cw - (multi ? ab + 16 : 16);
  const cs = ch - 20;
  drawCover(s, in0, y + 10, cs);
  const tx = in0 + cs + 14;
  text(s.title, tx, y + ch / 2 - 10 * k, fs(20), '#fff', { align: 'left', weight: 800, max: in1 - tx - 76 - (s.boss ? 52 : 0) });
  if (s.boss) {
    // BOSS 표시
    g.font = `800 ${Math.round(fs(20))}px ${FONT}`;
    const bx = tx + Math.min(g.measureText(s.title).width, in1 - tx - 128) + 8, by = y + ch / 2 - 10 * k - 9;
    rr(bx, by, 44, 18, 5);
    g.fillStyle = `rgba(255,46,77,${0.75 + 0.25 * Math.sin(now / 200)})`;
    g.fill();
    text('BOSS', bx + 22, by + 9.5, 10, '#fff', { weight: 900, spacing: 1 });
  }
  text(s.artist || 'mp3 · 자동 생성 채보', tx, y + ch / 2 + 12 * k, fs(12), 'rgba(255,255,255,0.5)', { align: 'left', weight: 500, max: in1 - tx - 76 });
  text(`${Math.round(s.bpm)} BPM`, in1, y + ch / 2 - 10 * k, fs(15), '#fff', { align: 'right', weight: 800 });
  text(fmtTime(s.length) + (multi ? `  ·  ${si + 1}/${SONGS.length}` : ''), in1, y + ch / 2 + 12 * k, fs(12), 'rgba(255,255,255,0.5)', { align: 'right', weight: 500 });
  y += ch + 16 * k;

  // 난이도 선택
  const bh = 116 * k, bw = (cw - gap * 2) / 3;
  DIFFS.forEach((d, i) => {
    const bx = x0 + i * (bw + gap), sel = settings.diff === i;
    button(bx, y, bw, bh, '', () => selectDiff(i), {
      fill: sel ? hexA(d.color, 0.14) : 'rgba(255,255,255,0.04)',
      stroke: sel ? d.color : 'rgba(255,255,255,0.12)',
      lw: sel ? 2.5 : 1,
      glow: sel ? hexA(d.color, 0.6) : null,
    });
    text(d.name, bx + bw / 2, y + 22 * k, fs(15), d.color, { weight: 900, spacing: 2 });
    text('Lv.' + s.levels[i], bx + bw / 2, y + 52 * k, fs(28), '#fff', { weight: 900 });
    text(`노트 ${s.charts[i].length}`, bx + bw / 2, y + 80 * k, fs(12), 'rgba(255,255,255,0.6)', { weight: 500 });
    text(`BEST ${fmtScore(best[bestKey(s, i)] || 0)}`, bx + bw / 2, y + 98 * k, fs(11), 'rgba(255,255,255,0.45)', { weight: 600, max: bw - 12 });
  });
  y += bh + 16 * k;

  // 옵션
  const oh = 48 * k, ow = (cw - gap * 2) / 3;
  stepper(x0, y, ow, oh, '속도', '×' + settings.speed.toFixed(1), () => changeSpeed(-0.5), () => changeSpeed(0.5), k);
  stepper(x0 + ow + gap, y, ow, oh, '싱크', (settings.offset > 0 ? '+' : '') + settings.offset + 'ms', () => changeOffset(-5), () => changeOffset(5), k);
  const hx = x0 + (ow + gap) * 2;
  button(hx, y, ow, oh, '', toggleHit);
  text(s.keysound ? '키음' : '타격음', hx + ow / 2, y + oh / 2 - 9 * k, fs(11), 'rgba(255,255,255,0.5)', { weight: 600 });
  text(settings.hitsound ? 'ON' : 'OFF', hx + ow / 2, y + oh / 2 + 9 * k, fs(15), settings.hitsound ? '#5ee7ff' : 'rgba(255,255,255,0.5)', { weight: 800 });
  y += oh + 22 * k;

  // 시작 버튼
  const sw = Math.min(320, cw), sh = 54 * k;
  const sg = g.createLinearGradient(cx - sw / 2, 0, cx + sw / 2, 0);
  sg.addColorStop(0, '#5ee7ff');
  sg.addColorStop(1, '#ff5ec4');
  if (s.status === 'ready') {
    button(cx - sw / 2, y, sw, sh, '', startGame, { fill: sg, stroke: 'rgba(255,255,255,0)', r: sh / 2, glow: 'rgba(160,180,255,0.7)' });
    text('▶  START', cx, y + sh / 2 + 1, fs(19), `rgba(8,10,25,${0.85 + 0.15 * Math.sin(now / 250)})`, { weight: 900, spacing: 3 });
  } else {
    panel(cx - sw / 2, y, sw, sh, sh / 2);
    const what = s.samples ? '악기 샘플' : '음원';
    const msg = s.status === 'error' ? `${what}을 불러오지 못했어요` : `${what} 불러오는 중` + '.'.repeat(1 + Math.floor(now / 400) % 3);
    text(msg, cx, y + sh / 2 + 1, fs(15), 'rgba(255,255,255,0.6)', { weight: 700 });
  }
  y += sh + 14 * k;
  text('Enter / Space', cx, y, fs(11), 'rgba(255,255,255,0.4)', { weight: 600 });
  y += 26 * k;

  // 키 안내
  const kc = 40 * k, kg = 10;
  for (let l = 0; l < 4; l++) {
    const kx = cx - (kc * 4 + kg * 3) / 2 + l * (kc + kg);
    rr(kx, y, kc, kc, 8);
    g.fillStyle = hexA(LANE_COLORS[l], 0.1);
    g.fill();
    g.strokeStyle = hexA(LANE_COLORS[l], 0.7);
    g.lineWidth = 1.5;
    g.stroke();
    text(KEY_LABELS[l], kx + kc / 2, y + kc / 2 + 1, fs(17), LANE_COLORS[l], { weight: 800 });
  }
  y += kc + 18 * k;
  text('노트가 판정선에 닿을 때 누르세요 · 롱노트는 끝까지 누르고 있기', cx, y, fs(13), 'rgba(255,255,255,0.7)', { weight: 500, max: cw });
  y += 22 * k;
  text(`↑/↓ 곡   ←/→ 난이도   -/+ 속도   [/] 싱크   H ${s.keysound ? '키음' : '타격음'}   Esc 일시정지`, cx, y, fs(11), 'rgba(255,255,255,0.4)', { weight: 500, max: cw });

  // 샘플 출처 (CC BY 표기 — 자세한 내용은 CREDITS.md)
  if (y < H - 44) {
    g.save();
    g.globalAlpha = 0.45;
    text('Piano: Salamander Grand Piano by Alexander Holm (CC BY 3.0)  ·  Orchestra: VSCO 2 CE (CC0)', W - 12, H - 26, 10, '#fff', { align: 'right', weight: 500, max: W - 24 });
    text('Drum samples provided by DrumGizmo.org (MuldjordKit by Lars Muldjord, CC BY 4.0)  ·  Guitar: FreePats (CC0)  ·  Bass: Karoryfer (CC0)', W - 12, H - 12, 10, '#fff', { align: 'right', weight: 500, max: W - 24 });
    g.restore();
  }
}

// 곡 커버 (없으면 그라데이션 기본 이미지)
function drawCover(s, x, y, size) {
  g.save();
  rr(x, y, size, size, 10);
  g.clip();
  if (s.img && s.img.complete && s.img.naturalWidth) g.drawImage(s.img, x, y, size, size);
  else {
    const gr = g.createLinearGradient(x, y, x + size, y + size);
    const [c0, c1, icon] = s.art || ['#3b2a8f', '#0e7fa8', '♪'];
    gr.addColorStop(0, c0);
    gr.addColorStop(1, c1);
    g.fillStyle = gr;
    g.fillRect(x, y, size, size);
    text(icon, x + size / 2, y + size / 2 + 1, size * 0.5, 'rgba(255,255,255,0.85)', { weight: 900 });
  }
  g.restore();
  rr(x, y, size, size, 10);
  g.strokeStyle = 'rgba(255,255,255,0.15)';
  g.lineWidth = 1;
  g.stroke();
}

/* ==========================================================
 * 플레이 화면
 * ========================================================== */
function layout() {
  const lw = Math.floor(Math.min(100, (W - 24) / 4));
  const fw = lw * 4, fx = Math.floor((W - fw) / 2);
  const jy = Math.floor(H - Math.max(96, H * 0.16)); // 판정선 y
  return { lw, fw, fx, jy };
}

function drawPlay(t, now) {
  const p = play, L = layout(), { lw, fw, fx, jy } = L;
  const pps = settings.speed * H * 0.25; // 초당 이동 픽셀
  // 박자 위치 (템포가 변하는 곡도 실제 박을 따라감)
  const bt = p.song.beats;
  while (p.beatIdx + 1 < bt.length && bt[p.beatIdx + 1] <= t) p.beatIdx++;
  const b0 = bt[p.beatIdx], b1 = bt[p.beatIdx + 1];
  const pulse = t >= b0 && b1 !== undefined ? Math.pow(1 - (t - b0) / (b1 - b0), 3) : 0;

  drawBg(now, pulse);

  // 필드
  g.fillStyle = 'rgba(4,6,16,0.9)';
  g.fillRect(fx, 0, fw, H);
  for (let l = 0; l < 4; l++) {
    g.fillStyle = l % 2 ? 'rgba(255,255,255,0.012)' : 'rgba(255,255,255,0.028)';
    g.fillRect(fx + l * lw, 0, lw, jy);
  }
  g.fillStyle = 'rgba(255,255,255,0.06)';
  for (let l = 1; l < 4; l++) g.fillRect(fx + l * lw - 0.5, 0, 1, jy);
  g.fillStyle = `rgba(120,200,255,${0.25 + 0.55 * pulse})`;
  g.fillRect(fx - 2, 0, 2, H);
  g.fillRect(fx + fw, 0, 2, H);

  // 마디선
  g.fillStyle = 'rgba(255,255,255,0.09)';
  for (let i = p.beatIdx; i < bt.length; i++) {
    const y = jy - (bt[i] - t) * pps;
    if (y < 0) break;
    if (y > jy || (i - p.song.barPhase) % 4 !== 0) continue;
    g.fillRect(fx, y, fw, 1);
  }

  // 키를 누를 때 라인 빛기둥
  for (let l = 0; l < 4; l++) {
    const a = p.held[l] ? 1 : Math.max(0, 1 - (now - p.releaseAt[l]) / 150);
    if (a <= 0) continue;
    const bh = H * 0.45;
    const gr = g.createLinearGradient(0, jy, 0, jy - bh);
    gr.addColorStop(0, hexA(LANE_COLORS[l], 0.32 * a));
    gr.addColorStop(1, hexA(LANE_COLORS[l], 0));
    g.fillStyle = gr;
    g.fillRect(fx + l * lw, jy - bh, lw, bh);
  }

  // 노트
  const nh = Math.max(12, Math.round(lw * 0.22));
  const pad = Math.max(3, Math.round(lw * 0.06));
  const ahead = (jy + nh) / pps;
  for (const n of p.chart) {
    if (n.t > t + ahead) break;
    if (n.state === 2 || (n.end || n.t) < t - 1) continue;
    const x = fx + n.lane * lw, col = LANE_COLORS[n.lane], dim = n.state === 3;
    let yh = jy - (n.t - t) * pps;
    if (n.end) {
      if (n.state === 1) yh = jy;                                 // 누르는 중엔 머리가 판정선에 고정
      else if (dim && n.brokeAt) yh = jy + (t - n.brokeAt) * pps; // 중간에 놓친 경우
      const yt = jy - (n.end - t) * pps;
      const bw = lw * 0.6;
      g.fillStyle = dim ? 'rgba(120,124,150,0.22)'
        : hexA(col, n.state === 1 ? 0.5 + 0.15 * Math.sin(now / 45) : 0.3);
      g.fillRect(x + (lw - bw) / 2, yt, bw, Math.max(0, yh - yt));
      rr(x + pad * 2, yt - nh * 0.3, lw - pad * 4, nh * 0.6, 4);
      g.fillStyle = dim ? 'rgba(120,124,150,0.5)' : hexA(col, 0.85);
      g.fill();
    }
    if (yh - nh / 2 > H) continue;
    rr(x + pad, yh - nh / 2, lw - pad * 2, nh, Math.min(6, nh / 2));
    g.fillStyle = dim ? '#4a4f63' : col;
    g.fill();
    g.fillStyle = dim ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.75)';
    g.fillRect(x + pad + 4, yh - nh / 2 + 2, lw - pad * 2 - 8, 2);
  }

  // 판정선 아래 키 영역
  g.fillStyle = 'rgba(8,10,22,0.97)';
  g.fillRect(fx, jy, fw, H - jy);
  const kh = Math.min(60, H - jy - 30);
  for (let l = 0; l < 4; l++) {
    const x = fx + l * lw, on = p.held[l], col = LANE_COLORS[l];
    rr(x + 6, jy + 16, lw - 12, kh, 10);
    g.fillStyle = on ? hexA(col, 0.55) : 'rgba(255,255,255,0.05)';
    g.fill();
    g.strokeStyle = hexA(col, on ? 0.9 : 0.25);
    g.lineWidth = 1.5;
    g.stroke();
    text(KEY_LABELS[l], x + lw / 2, jy + 16 + kh / 2 + 1, 18, on ? '#0a0d1c' : hexA(col, 0.8), { weight: 900 });
  }

  // 판정선
  g.save();
  g.shadowColor = '#7fd4ff';
  g.shadowBlur = 14 + 10 * pulse;
  g.fillStyle = `rgba(190,230,255,${0.85 + 0.15 * pulse})`;
  g.fillRect(fx, jy - 2, fw, 4);
  g.restore();

  // 롱노트 누르는 중 반짝임
  for (let l = 0; l < 4; l++) {
    const n = p.lanes[l][p.ptr[l]];
    if (!n || n.state !== 1) continue;
    const cxl = fx + (l + 0.5) * lw, r = lw * (0.32 + 0.06 * Math.sin(now / 40));
    const gr = g.createRadialGradient(cxl, jy, 0, cxl, jy, r);
    gr.addColorStop(0, hexA(JUDGES.PERFECT.color, 0.7));
    gr.addColorStop(1, hexA(JUDGES.PERFECT.color, 0));
    g.fillStyle = gr;
    g.fillRect(cxl - r, jy - r, r * 2, r * 2);
  }

  // 타격 이펙트
  for (const e of p.effects) {
    const a = (now - e.at) / 300;
    if (a < 0 || a >= 1) continue;
    const cxl = fx + (e.lane + 0.5) * lw, c = JUDGES[e.j].color;
    const fh = lw * 1.6 * (1 - a * 0.6);
    const gr = g.createLinearGradient(0, jy, 0, jy - fh);
    gr.addColorStop(0, hexA(c, 0.45 * (1 - a)));
    gr.addColorStop(1, hexA(c, 0));
    g.fillStyle = gr;
    g.fillRect(fx + e.lane * lw, jy - fh, lw, fh);
    g.strokeStyle = hexA(c, 1 - a);
    g.lineWidth = 1 + 3 * (1 - a);
    g.beginPath();
    g.arc(cxl, jy, lw * (0.22 + 0.4 * a), 0, Math.PI * 2);
    g.stroke();
  }

  drawHud(t, now, L);

  // 시작 안내 (판정 글자와 겹치지 않게 콤보 자리에 표시)
  if (t < LEAD - 0.3) {
    text('READY', fx + fw / 2, jy * 0.34, 44, `rgba(255,255,255,${0.55 + 0.4 * Math.sin(now / 130)})`, { weight: 900, spacing: 8 });
  } else if (t < LEAD + 0.3 && p.judged === 0) {
    text('GO!', fx + fw / 2, jy * 0.34, 52, '#5ee7ff', { weight: 900, spacing: 6 });
  }

  if (p.paused) drawPause();
}

function drawHud(t, now, L) {
  const p = play, { lw, fw, fx, jy } = L, mx = fx + fw / 2;

  // 진행 바
  const prog = Math.min(1, Math.max(0, t / p.endTime));
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(fx, 0, fw, 4);
  const pg = g.createLinearGradient(fx, 0, fx + fw, 0);
  pg.addColorStop(0, '#5ee7ff');
  pg.addColorStop(1, '#ff5ec4');
  g.fillStyle = pg;
  g.fillRect(fx, 0, fw * prog, 4);

  // 콤보
  if (p.combo > 0 && p.last) {
    const pop = 1 + 0.2 * Math.min(1, Math.max(0, 1 - (now - p.last.at) / 90));
    text('COMBO', mx, jy * 0.3, 12, 'rgba(255,255,255,0.55)', { spacing: 5, weight: 800 });
    text(String(p.combo), mx, jy * 0.3 + lw * 0.55, lw * 0.75 * pop, '#fff', { weight: 900 });
  }

  // 판정 글자
  if (p.last) {
    const age = now - p.last.at;
    if (age < 650) {
      const info = JUDGES[p.last.j];
      const s = 1 + 0.3 * Math.min(1, Math.max(0, 1 - age / 90));
      g.save();
      g.globalAlpha = Math.min(1, (650 - age) / 250);
      g.shadowColor = info.color;
      g.shadowBlur = 16;
      text(p.last.j, mx, jy * 0.52, lw * 0.42 * s, info.color, { weight: 900, spacing: 3 });
      g.shadowBlur = 0;
      if (p.last.timing) {
        text(p.last.timing, mx, jy * 0.52 + lw * 0.36, 13, p.last.timing === 'FAST' ? '#5cc8ff' : '#ffa65c', { weight: 800, spacing: 2 });
      }
      g.restore();
    }
  }

  // 곡 정보 (필드 왼쪽에 공간이 있으면 옆에, 없으면 화면 왼쪽 위)
  const d = DIFFS[p.diff];
  const side = fx > 210;
  const lx = side ? fx - 28 : 16, la = side ? 'right' : 'left';
  text(p.song.title, lx, 34, 18, '#fff', { align: la, weight: 800, max: side ? fx - 40 : W * 0.45 });
  text(`${d.name}  Lv.${p.song.levels[p.diff]}`, lx, 58, 12, d.color, { align: la, weight: 800, spacing: 2 });
  const sp = now - p.speedAt < 800;
  text(`SPEED ×${settings.speed.toFixed(1)}`, lx, side ? H - 56 : 80, sp ? 16 : 12, sp ? '#5ee7ff' : 'rgba(255,255,255,0.5)', { align: la, weight: 800 });
  if (side) text('↑/↓ 속도 · Esc 일시정지', lx, H - 34, 11, 'rgba(255,255,255,0.35)', { align: la, weight: 500 });

  // 점수 (필드 오른쪽)
  const rx = side ? fx + fw + 28 : W - 16, ra = side ? 'left' : 'right';
  text('SCORE', rx, 24, 11, 'rgba(255,255,255,0.5)', { align: ra, spacing: 3 });
  text(fmtScore(calcScore(p)), rx, 50, 28, '#fff', { align: ra, weight: 900 });
  const acc = p.judged ? (p.sumW / p.judged) * 100 : 100;
  text(acc.toFixed(2) + '%', rx, 78, 13, 'rgba(255,255,255,0.65)', { align: ra, weight: 600 });
  if (side) {
    let y = 120;
    for (const j of ['PERFECT', 'GREAT', 'GOOD', 'MISS']) {
      text(j, rx, y, 11, hexA(JUDGES[j].color, 0.8), { align: 'left', weight: 800, spacing: 1 });
      text(String(p.counts[j]), rx + 120, y, 13, '#fff', { align: 'right', weight: 700 });
      y += 22;
    }
  }

  // 일시정지 버튼 (터치용)
  button(side ? W - 56 : W - 52, side ? 20 : 96, 36, 36, 'II', pauseGame, { r: 10, size: 13 });
}

function drawPause() {
  g.fillStyle = 'rgba(3,4,10,0.75)';
  g.fillRect(0, 0, W, H);
  const cx = W / 2, bw = Math.min(260, W - 48), bh = 48;
  let y = H * 0.32;
  text('PAUSED', cx, y, 40, '#fff', { weight: 900, spacing: 8 });
  y += 50;
  button(cx - bw / 2, y, bw, bh, '계속하기 (Esc)', resumeGame);
  button(cx - bw / 2, y + 60, bw, bh, '처음부터 (R)', startGame);
  button(cx - bw / 2, y + 120, bw, bh, '메뉴로 (Q)', toTitle);
}

/* ==========================================================
 * 결과 화면
 * ========================================================== */
function drawResult(now) {
  const r = result;
  drawBg(now, 0);
  const k = Math.min(1, H / 700);
  const fs = v => Math.max(10, v * k);
  const cw = Math.min(520, W - 32), x0 = (W - cw) / 2, cx = W / 2;
  const age = (now - r.at) / 1000;
  let y = Math.max(24, (H - 600 * k) / 2);

  text('RESULT', cx, y, fs(14), 'rgba(255,255,255,0.55)', { spacing: 8, weight: 700 });
  y += 36 * k;
  text(r.song.title, cx, y, fs(20), '#fff', { weight: 800, max: cw });
  y += 24 * k;
  const d = DIFFS[r.diff];
  text(`${d.name}  Lv.${r.song.levels[r.diff]}`, cx, y, fs(13), d.color, { weight: 800, spacing: 2 });
  y += 86 * k;

  // 랭크
  const pop = 1 + 0.6 * Math.pow(Math.max(0, 1 - age / 0.35), 2);
  g.save();
  g.shadowColor = RANK_COLORS[r.rank];
  g.shadowBlur = 40;
  text(r.rank, cx, y, fs(120) * pop, RANK_COLORS[r.rank], { weight: 900 });
  g.restore();
  y += 80 * k;
  if (r.fc) text(r.ap ? 'ALL PERFECT' : 'FULL COMBO', cx, y, fs(16), r.ap ? '#ffe066' : '#5dffa8', { weight: 900, spacing: 4 });
  y += 42 * k;

  // 점수 (카운트 업)
  text(fmtScore(Math.floor(r.score * Math.min(1, age / 0.8))), cx, y, fs(44), '#fff', { weight: 900 });
  if (r.isBest && age > 0.8) text('NEW BEST!', cx, y + 32 * k, fs(12), '#ff5ec4', { weight: 900, spacing: 3 });
  y += 62 * k;

  // 상세
  const ph = 140 * k;
  panel(x0, y, cw, ph);
  const half = cw / 2, rowH = ph / 4;
  ['PERFECT', 'GREAT', 'GOOD', 'MISS'].forEach((j, i) => {
    const ry = y + rowH * (i + 0.5);
    text(j, x0 + 24, ry, fs(13), JUDGES[j].color, { align: 'left', weight: 800, spacing: 1 });
    text(String(r.counts[j]), x0 + half - 20, ry, fs(15), '#fff', { align: 'right', weight: 700 });
  });
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(x0 + half, y + 14, 1, ph - 28);
  [['MAX COMBO', String(r.maxCombo)], ['정확도', (r.acc * 100).toFixed(2) + '%'], ['판정 수', String(r.total)]].forEach(([label, v], i) => {
    const ry = y + (ph / 3) * (i + 0.5);
    text(label, x0 + half + 20, ry, fs(12), 'rgba(255,255,255,0.55)', { align: 'left', weight: 700 });
    text(v, x0 + cw - 24, ry, fs(15), '#fff', { align: 'right', weight: 800 });
  });
  y += ph + 24 * k;

  // 버튼
  const bw = (cw - 12) / 2, bh = 50 * k;
  button(x0, y, bw, bh, '다시하기 (Enter)', startGame, { size: fs(15) });
  button(x0 + bw + 12, y, bw, bh, '메뉴 (Esc)', toTitle, { size: fs(15) });
}

/* ==========================================================
 * 메인 루프
 * ========================================================== */
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  buttons = [];
  if (scene === 'play') {
    schedule();
    const t = songTime();
    if (!play.paused) update(t);          // 곡이 끝나면 여기서 결과 화면으로 바뀜
    if (scene === 'play') drawPlay(t, now);
  }
  if (scene === 'title') drawTitle(now);
  else if (scene === 'result') drawResult(now);
  cvs.style.cursor = buttons.some(b => inside(b, mouse.x, mouse.y)) ? 'pointer' : 'default';
}
requestAnimationFrame(frame);
// 탭이 잠깐 느려져도 음악이 끊기지 않게 타이머로도 예약
setInterval(() => { if (scene === 'play') schedule(); }, 25);
