'use strict';
/* ==========================================================
 * music.js
 *  - Web Audio API로 곡을 실시간 합성합니다 (음원 파일 없음)
 *  - 같은 악보 데이터로 리듬게임 채보(노트 배치)를 자동 생성합니다
 * ========================================================== */

const SONG = { title: 'Neon Drive', bpm: 128, leadIn: 2.5 };
const SD = 60 / SONG.bpm / 4;                 // 16분음표 한 칸의 길이(초)
const T = step => SONG.leadIn + step * SD;    // 16분음표 위치 → 곡 시간(초)
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

// 코드 진행: Am - F - C - G (한 마디에 한 코드)
const CHORDS = [
  { root: 45, pad: [57, 60, 64] }, // Am
  { root: 41, pad: [57, 60, 65] }, // F
  { root: 48, pad: [55, 60, 64] }, // C
  { root: 43, pad: [55, 59, 62] }, // G
];

// 곡 구성 [구간 이름, 마디 수]
const SECTIONS = [
  ['intro', 4], ['verse', 8], ['build', 4], ['chorus', 8],
  ['break', 4], ['chorus', 8], ['outro', 2],
];
const TOTAL_BARS = SECTIONS.reduce((a, s) => a + s[1], 0);

// 후렴 멜로디 (4마디) — [16분음표 위치, MIDI 음높이, 길이(16분음표 수)]
const MELODY_A = [
  [0, 69, 2], [2, 72, 2], [4, 76, 4], [8, 74, 2], [10, 72, 2], [12, 74, 2], [14, 76, 2],
  [16, 77, 6], [22, 76, 2], [24, 72, 4], [28, 69, 4],
  [32, 67, 2], [34, 72, 2], [36, 76, 4], [40, 79, 2], [42, 76, 2], [44, 74, 2], [46, 72, 2],
  [48, 74, 6], [54, 71, 2], [56, 67, 8],
];
// 두 번째 반복은 마지막 마디만 바꿔서 높게 끝냄
const MELODY_B = MELODY_A.filter(([s]) => s < 48)
  .concat([[48, 71, 2], [50, 74, 2], [52, 79, 4], [56, 81, 8]]);

// 매번 같은 채보가 나오도록 시드 고정 난수
function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 리듬 노트용 라인 선택: 기본은 왼손/오른손을 번갈아, 가끔 같은 손 다른 손가락
function lanePicker(rng) {
  let lane = 1;
  return () => {
    if (rng() < 0.2) lane = lane % 2 === 0 ? lane + 1 : lane - 1;
    else lane = (lane < 2 ? 2 : 0) + (rng() < 0.5 ? 0 : 1);
    return lane;
  };
}

// 멜로디 노트용 라인 선택: 음이 높을수록 오른쪽, 연타가 되지 않게 보정
function melodyLaner() {
  let prevLane = -1, prevPitch = -1;
  return pitch => {
    let lane = pitch <= 69 ? 0 : pitch <= 72 ? 1 : pitch <= 76 ? 2 : 3;
    if (lane === prevLane && pitch !== prevPitch) {
      const dir = pitch > prevPitch ? 1 : -1;
      lane += dir;
      if (lane < 0 || lane > 3) lane = prevLane - dir;
    }
    prevLane = lane;
    prevPitch = pitch;
    return lane;
  };
}

/**
 * 곡 전체를 만듭니다.
 *  music: 소리 이벤트 목록 { t, type, ... }
 *  notes: 노트 후보 { t, lane, level, end }  — level 1=EASY, 2=NORMAL, 3=HARD 부터 등장
 */
function composeSong() {
  const music = [], notes = [];
  const rng = mulberry32(128);
  const pick = lanePicker(rng);
  const melLane = melodyLaner();
  const coin = () => (rng() < 0.5 ? 0 : 1);
  const m = (s, type, o) => music.push(Object.assign({ t: T(s), type }, o));
  const n = (s, lane, level, len) => notes.push({ t: T(s), lane, level, end: len ? T(s + len) : 0 });
  const ARP = [0, 1, 2, 1];
  let bar = 0, melCur = 0;

  for (const [name, bars] of SECTIONS) {
    for (let i = 0; i < bars; i++, bar++) {
      const s0 = bar * 16;
      const ch = name === 'outro' ? CHORDS[0] : CHORDS[bar % 4];

      if (name === 'intro') {
        m(s0, 'pad', { notes: ch.pad, dur: 16 * SD, vel: 0.7 });
        for (let k = 0; k < 16; k += 2) m(s0 + k, 'hat', { vel: k % 4 ? 0.6 : 0.3 });
        if (i >= 2) for (let k = 0; k < 16; k += 4) m(s0 + k, 'kick', { vel: 0.8 });
        // 처음 두 마디는 롱노트로 몸풀기
        if (i < 2) { n(s0, 1, 1, 6); n(s0 + 8, 2, 1, 6); }
        else for (let k = 0; k < 16; k += 2) n(s0 + k, pick(), k % 4 === 0 ? 1 : 3);
      }

      else if (name === 'verse') {
        for (let k = 0; k < 16; k += 4) m(s0 + k, 'kick');
        m(s0 + 4, 'snare', { vel: 0.8 });
        m(s0 + 12, 'snare', { vel: 0.8 });
        for (let k = 0; k < 16; k++) m(s0 + k, 'hat', { vel: k % 4 === 2 ? 0.7 : 0.22 });
        for (let k = 2; k < 16; k += 4) m(s0 + k, 'bass', { midi: ch.root, dur: 2 * SD });
        m(s0, 'pad', { notes: ch.pad, dur: 16 * SD, vel: 0.5 });
        if (i >= 4) for (let k = 0; k < 16; k++) m(s0 + k, 'arp', { midi: ch.pad[ARP[k % 4]] + 12, vel: 0.55 });
        for (let k = 0; k < 16; k += 2) {
          n(s0 + k, pick(), k % 4 === 0 ? 1 : (i >= 4 || k === 14) ? 2 : 3);
          if (k === 14 && i % 2 === 1) n(s0 + 15, pick(), 3);
        }
      }

      else if (name === 'build') {
        const every = [4, 2, 2, 1][i]; // 스네어 롤이 점점 빨라짐
        for (let k = 0; k < 16; k += every) m(s0 + k, 'snare', { vel: 0.35 + 0.15 * i + 0.1 * k / 16 });
        if (i < 3) {
          for (let k = 0; k < 16; k += 4) m(s0 + k, 'kick');
          for (let k = 0; k < 16; k += 2) m(s0 + k, 'bass', { midi: ch.root, dur: 1.5 * SD });
        }
        m(s0, 'pad', { notes: ch.pad, dur: 16 * SD, vel: 0.55 });
        if (i === 0) m(s0, 'riser', { dur: 64 * SD });
        if (i < 3) for (let k = 0; k < 16; k += 2) n(s0 + k, pick(), k % 4 === 0 ? 1 : 2);
        else for (let k = 0; k < 16; k++) n(s0 + k, (k + (k >> 2)) % 4, k % 4 === 0 ? 1 : k % 2 === 0 ? 2 : 3); // 계단
      }

      else if (name === 'chorus') {
        const ci = i % 4, phrase = i < 4 ? MELODY_A : MELODY_B;
        if (ci === 0) m(s0, 'crash');
        for (let k = 0; k < 16; k += 4) m(s0 + k, 'kick');
        m(s0 + 4, 'snare');
        m(s0 + 12, 'snare');
        for (let k = 2; k < 16; k += 4) m(s0 + k, 'hat', { vel: 0.9, open: true });
        for (let k = 0; k < 16; k += 2) m(s0 + k, 'bass', { midi: ch.root + (k % 4 ? 12 : 0), dur: 1.6 * SD });
        m(s0, 'pad', { notes: ch.pad, dur: 16 * SD, vel: 0.6 });
        for (let k = 0; k < 16; k++) m(s0 + k, 'arp', { midi: ch.pad[ARP[k % 4]] + 24, vel: 0.22 });

        // 멜로디 = 노트. 긴 음은 롱노트
        const laneAt = [];
        for (const [st, midi, len] of phrase) {
          if ((st >> 4) !== ci) continue;
          const k = st & 15;
          m(s0 + k, 'lead', { midi, dur: len * SD });
          const lane = (laneAt[k] = melLane(midi));
          if (len >= 6) n(s0 + k, lane, 1, len - 2);
          else n(s0 + k, lane, k % 4 === 0 ? 1 : 2);
        }
        // HARD: 킥에 맞춰 반대손 동시치기
        for (let k = 0; k < 16; k++) {
          if (laneAt[k] !== undefined) melCur = laneAt[k];
          if (k % 4 === 0) n(s0 + k, melCur < 2 ? 2 + coin() : coin(), 3);
        }
      }

      else if (name === 'break') {
        m(s0, 'pad', { notes: ch.pad, dur: 16 * SD, vel: 0.85 });
        m(s0, 'bass', { midi: ch.root, dur: 14 * SD, vel: 0.8 });
        for (let k = 0; k < 16; k += 2) m(s0 + k, 'arp', { midi: ch.pad[[0, 1, 2, 1, 2, 0, 1, 2][k / 2]] + 12, vel: 0.65 });
        if (i >= 2) for (let k = 0; k < 16; k += 4) m(s0 + k, 'kick', { vel: 0.6 });
        if (i === 2) m(s0, 'riser', { dur: 32 * SD });
        if (i === 3) for (let k = 8; k < 16; k += k < 12 ? 2 : 1) m(s0 + k, 'snare', { vel: 0.3 + k / 30 });
        // 한 손은 롱노트를 누르고, 다른 손으로 아르페지오
        const hold = i % 2 ? 3 : 0;
        n(s0, hold, 1, 12);
        const wave = [1, 2, 3, 2, 1, 2, 3, 2];
        for (let k = 2; k < 16; k += 2) {
          const w = wave[k / 2];
          n(s0 + k, hold ? 3 - w : w, k % 4 === 0 ? 2 : 3);
        }
      }

      else if (name === 'outro' && i === 0) {
        m(s0, 'crash');
        m(s0, 'kick');
        m(s0, 'pad', { notes: ch.pad, dur: 32 * SD, vel: 0.8 });
        m(s0, 'bass', { midi: ch.root, dur: 24 * SD });
        m(s0, 'lead', { midi: 69, dur: 24 * SD });
        n(s0, 0, 1, 14);
        n(s0, 3, 1, 14);
      }
    }
  }

  music.sort((a, b) => a.t - b.t);
  return { music, notes, duration: T(TOTAL_BARS * 16) };
}

/**
 * 노트 후보 중 해당 난이도 이하만 골라 실제 채보를 만듭니다.
 * 같은 라인에 너무 붙은 노트, 롱노트와 겹치는 노트, 3개 이상 동시 입력은 제거합니다.
 */
function buildChart(cands, level) {
  const MIN_GAP = 0.15;
  const list = cands.filter(c => c.level <= level).sort((a, b) => a.t - b.t || a.level - b.level);
  const out = [], laneFree = [-1, -1, -1, -1];
  for (const c of list) {
    if (c.t < laneFree[c.lane] + MIN_GAP) continue;
    let busy = 0;
    for (let i = out.length - 1; i >= 0 && out[i].t > c.t - 10; i--) {
      const o = out[i];
      if (Math.abs(o.t - c.t) < 1e-6 || (o.end && o.t < c.t && o.end >= c.t)) busy++;
    }
    if (busy >= 2) continue;
    out.push({ t: c.t, lane: c.lane, end: c.end });
    laneFree[c.lane] = c.end || c.t;
  }
  return out;
}

/* ----------------------------------------------------------
 * 사운드 엔진
 * ---------------------------------------------------------- */
const Sound = {
  ctx: null,
  master: null,
  noise: null,

  // 반드시 키 입력/클릭 같은 사용자 동작 안에서 호출 (브라우저 자동재생 정책)
  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = (this.ctx = new AC());
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.knee.value = 10;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      this.master = ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(comp);
      comp.connect(ctx.destination);
      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  // 플레이 한 판마다 새 버스를 만들고, 끝나면 연결을 끊어 소리를 정리
  //  reverb: { time(초), wet(0~1) } 를 주면 공간 울림(잔향)을 더함 — 실제 악기 곡용
  createBus(delayTime = SD * 3, reverb = null) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    const send = ctx.createGain();
    send.gain.value = 0.28;
    const delay = ctx.createDelay(1);
    delay.delayTime.value = delayTime;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 2400;
    send.connect(delay);
    delay.connect(damp);
    damp.connect(fb);
    fb.connect(delay);
    damp.connect(out);
    out.connect(this.master);
    if (reverb) {
      // 점점 작아지는 노이즈로 만든 잔향 (콘서트홀 느낌), 고음은 조금 깎음
      const len = Math.floor(ctx.sampleRate * reverb.time);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.5);
      }
      const conv = ctx.createConvolver();
      conv.buffer = ir;
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 5000;
      const wet = ctx.createGain();
      wet.gain.value = reverb.wet;
      out.connect(conv);
      conv.connect(tone).connect(wet).connect(this.master);
    }
    return { out, send, fb };
  },

  closeBus(bus, fade) {
    if (!bus) return;
    const cut = () => {
      try { bus.out.disconnect(); } catch (e) { /* 이미 끊김 */ }
      bus.fb.gain.value = 0;
    };
    if (fade) {
      bus.out.gain.setTargetAtTime(0, this.ctx.currentTime, fade);
      setTimeout(cut, fade * 6000);
    } else cut();
  },

  // 키를 눌렀을 때 나는 짧은 타격음
  tick() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), amp = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(2200, t);
    o.frequency.exponentialRampToValueAtTime(1100, t + 0.03);
    amp.gain.setValueAtTime(0.05, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(amp).connect(this.master);
    o.start(t);
    o.stop(t + 0.06);
  },
};

// 곡별 추가 악기 (예: boss.js) — { 이름: (ctx, bus, t, ev) => {...} }
const INSTRUMENTS = {};

function envelope(amp, t, peak, attack, decay) {
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(peak, t + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

// 소리 이벤트 하나를 시각 t(AudioContext 시간)에 재생 예약
function playEvent(bus, t, ev) {
  const ctx = Sound.ctx, vel = ev.vel ?? 1;
  const osc = (type, freq) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; return o; };
  const gain = v => { const a = ctx.createGain(); a.gain.value = v; return a; };
  const filter = (type, freq, q = 1) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; };
  const noise = () => { const s = ctx.createBufferSource(); s.buffer = Sound.noise; s.loop = true; return s; };

  switch (ev.type) {
    case 'kick': {
      const o = osc('sine', 150), amp = gain(0);
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
      envelope(amp, t, 0.95 * vel, 0.002, 0.32);
      o.connect(amp).connect(bus.out);
      o.start(t);
      o.stop(t + 0.4);
      break;
    }
    case 'snare': {
      const s = noise(), f = filter('highpass', 1300), amp = gain(0);
      envelope(amp, t, 0.42 * vel, 0.001, 0.17);
      s.connect(f).connect(amp).connect(bus.out);
      s.start(t, Math.random() * 0.5);
      s.stop(t + 0.2);
      const o = osc('triangle', 230), body = gain(0);
      o.frequency.setValueAtTime(230, t);
      o.frequency.exponentialRampToValueAtTime(130, t + 0.08);
      envelope(body, t, 0.3 * vel, 0.001, 0.09);
      o.connect(body).connect(bus.out);
      o.start(t);
      o.stop(t + 0.12);
      break;
    }
    case 'hat': {
      const s = noise(), f = filter('highpass', 7500), amp = gain(0);
      envelope(amp, t, 0.14 * vel, 0.001, ev.open ? 0.16 : 0.035);
      s.connect(f).connect(amp).connect(bus.out);
      s.start(t, Math.random() * 0.5);
      s.stop(t + 0.25);
      break;
    }
    case 'crash': {
      const s = noise(), f = filter('highpass', 4500), amp = gain(0);
      envelope(amp, t, 0.28, 0.002, 1.6);
      s.connect(f).connect(amp).connect(bus.out);
      s.start(t);
      s.stop(t + 1.7);
      break;
    }
    case 'riser': {
      const s = noise(), f = filter('bandpass', 300, 2.5), amp = gain(0);
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(9000, t + ev.dur);
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(0.22, t + ev.dur);
      amp.gain.setValueAtTime(0, t + ev.dur);
      s.connect(f).connect(amp).connect(bus.out);
      s.start(t);
      s.stop(t + ev.dur + 0.02);
      break;
    }
    case 'bass': {
      const f = filter('lowpass', 900, 5), amp = gain(0);
      f.frequency.setValueAtTime(1400, t);
      f.frequency.exponentialRampToValueAtTime(220, t + Math.min(ev.dur, 0.25));
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.linearRampToValueAtTime(0.22 * vel, t + 0.006);
      amp.gain.setTargetAtTime(0, t + ev.dur * 0.9, 0.03);
      f.connect(amp).connect(bus.out);
      for (const o of [osc('sawtooth', mtof(ev.midi)), osc('sine', mtof(ev.midi - 12))]) {
        o.connect(f);
        o.start(t);
        o.stop(t + ev.dur + 0.2);
      }
      break;
    }
    case 'pad': {
      const f = filter('lowpass', 1000, 0.8), amp = gain(0);
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.linearRampToValueAtTime(0.05 * vel, t + 0.3);
      amp.gain.setTargetAtTime(0, t + ev.dur - 0.05, 0.15);
      f.connect(amp).connect(bus.out);
      for (const midi of ev.notes) {
        for (const det of [-9, 9]) {
          const o = osc('sawtooth', mtof(midi));
          o.detune.value = det;
          o.connect(f);
          o.start(t);
          o.stop(t + ev.dur + 0.8);
        }
      }
      break;
    }
    case 'arp': {
      const o = osc('square', mtof(ev.midi)), f = filter('lowpass', 2600), amp = gain(0);
      envelope(amp, t, 0.05 * vel, 0.002, 0.13);
      o.connect(f).connect(amp);
      amp.connect(bus.out);
      amp.connect(bus.send);
      o.start(t);
      o.stop(t + 0.18);
      break;
    }
    case 'lead': {
      const f = filter('lowpass', 3400, 1.5), amp = gain(0);
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.linearRampToValueAtTime(0.11, t + 0.012);
      amp.gain.setTargetAtTime(0.075, t + 0.03, 0.12);
      amp.gain.setTargetAtTime(0, t + ev.dur - 0.02, 0.04);
      f.connect(amp);
      amp.connect(bus.out);
      amp.connect(bus.send);
      // 긴 음에는 비브라토
      const lfo = osc('sine', 5.5), depth = gain(0);
      depth.gain.setValueAtTime(0, t + 0.18);
      depth.gain.linearRampToValueAtTime(18, t + 0.45);
      lfo.connect(depth);
      for (const [type, det] of [['sawtooth', -6], ['square', 6]]) {
        const o = osc(type, mtof(ev.midi));
        o.detune.value = det;
        depth.connect(o.detune);
        o.connect(f);
        o.start(t);
        o.stop(t + ev.dur + 0.3);
      }
      lfo.start(t);
      lfo.stop(t + ev.dur + 0.3);
      break;
    }
    default:
      if (INSTRUMENTS[ev.type]) INSTRUMENTS[ev.type](ctx, bus, t, ev);
  }
}
