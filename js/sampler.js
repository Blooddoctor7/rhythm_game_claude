'use strict';
/* ==========================================================
 * sampler.js — 실제 악기 녹음 샘플 재생
 *
 *  samples/<묶음>.js 에 base64(AAC)로 들어 있는 샘플을 필요할 때 불러와 디코딩합니다.
 *  (파일을 더블클릭해서 열어도 동작하도록 fetch 대신 <script> 로 불러옴)
 *  출처와 라이선스는 CREDITS.md
 *
 *  소리 이벤트: { type: 'smp', inst, midi | notes, dur, vel, attack, rel }
 *               타악기는 { type: 'smp', inst: 'perc', key: 'timp1', shift(반음) }
 *               밴드: inst 'gtr_clean' | 'gtr_dist' | 'bass' (midi), 'drums' (key: kick, snare, hhc, hho, tom1~4, crash …)
 * ========================================================== */

// 악기별 기본 음량 (샘플은 가공할 때 비슷한 크기로 맞춰 둠)
const SAMPLE_GAIN = {
  piano: 1.1, harp: 0.65,
  vln_sus: 0.75, vln_spic: 0.8, vc_sus: 0.8, vc_spic: 0.9, cb_sus: 0.8,
  hn_sus: 1.2, tpt_sus: 1.1, tpt_stac: 1.1, tbn_sus: 1.1,
  fl_sus: 1, fl_stac: 1,
  perc: 0.7,
  gtr_clean: 0.9, gtr_dist: 0.6, bass: 1.1, drums: 1.3,
};
// 소리가 끝날 때 기본 여운(초)
const SAMPLE_REL = { piano: 0.35, harp: 0.6, vln_sus: 0.3, vc_sus: 0.3, cb_sus: 0.3, hn_sus: 0.2, tpt_sus: 0.15, tbn_sus: 0.2, fl_sus: 0.15, gtr_clean: 0.25, gtr_dist: 0.12, bass: 0.12 };
// 이 소리가 나면 울리고 있던 소리를 끊음 (닫힌 하이햇이 열린 하이햇을 막는 것처럼)
const SAMPLE_CHOKE = { drums: { hhc: ['hho'], hhc_soft: ['hho'] } };
const CHOKED = new Set(Object.entries(SAMPLE_CHOKE).flatMap(([inst, m]) => Object.values(m).flat().map(k => `${inst}:${k}`)));

const Samples = {
  buf: {},     // 악기 → [{ key, root, buffer, offset }] (root 오름차순)
  groups: {},  // 묶음 → Promise
  rr: {},      // "악기:키" → 마지막으로 낸 녹음 번호 (같은 소리의 여러 녹음을 번갈아 냄)
  ringing: [], // 끊길 수 있는 소리 { id, amp, t, end }

  // 묶음 이름 목록을 불러옴 (이미 불러온 묶음은 건너뜀)
  load(groups) {
    return Promise.all(groups.map(g => this.groups[g] || (this.groups[g] = this._load(g))));
  },

  async _load(g) {
    await new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = `samples/${g}.js`;
      el.onload = resolve;
      el.onerror = () => reject(new Error('샘플 불러오기 실패: ' + g));
      document.head.appendChild(el);
    });
    const all = window.BEAT_RUSH_SAMPLES || {};
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const dec = new OAC(1, 1, 44100);
    const touched = [], jobs = [];
    for (const inst of Object.keys(all)) {
      if (this.buf[inst]) continue;
      const list = (this.buf[inst] = []);
      touched.push(inst);
      for (const [key, { root, data }] of Object.entries(all[inst])) {
        const bin = atob(data), bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        jobs.push(new Promise((res, rej) => dec.decodeAudioData(bytes.buffer, res, rej)).then(buffer => {
          list.push({ key, root: root ?? Number(key), buffer, offset: onsetOf(buffer) });
        }));
      }
      delete all[inst]; // base64 원본은 메모리에서 지움
    }
    await Promise.all(jobs);
    for (const inst of touched) this.buf[inst].sort((a, b) => a.root - b.root);
  },

  ready(insts) { return insts.every(i => this.buf[i] && this.buf[i].length); },
};

// 압축 코덱이 앞에 붙이는 짧은 무음을 건너뛰기 위한 소리 시작 지점(초)
function onsetOf(buffer) {
  const d = buffer.getChannelData(0), n = Math.min(d.length, Math.floor(buffer.sampleRate * 0.5));
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
  let i = 0;
  while (i < n && Math.abs(d[i]) < peak * 0.02) i++;
  return Math.max(0, i - Math.floor(buffer.sampleRate * 0.002)) / buffer.sampleRate;
}

INSTRUMENTS.smp = (ctx, bus, t, ev) => {
  const list = Samples.buf[ev.inst];
  if (!list || !list.length) return;
  const notes = ev.key ? [null] : ev.notes || [ev.midi];
  const vel = ev.vel ?? 1;
  const peak = (vel * (SAMPLE_GAIN[ev.inst] ?? 1)) / Math.sqrt(notes.length);
  const rel = ev.rel ?? SAMPLE_REL[ev.inst] ?? 0.1;
  for (const m of notes) {
    let s, rate;
    if (ev.key) {
      // "snare~2" 처럼 같은 소리의 다른 녹음이 있으면 번갈아 냄
      const vars = list.filter(x => x.key === ev.key || x.key.startsWith(ev.key + '~'));
      if (!vars.length) continue;
      const id = `${ev.inst}:${ev.key}`;
      s = vars[(Samples.rr[id] = ((Samples.rr[id] ?? -1) + 1) % vars.length)];
      rate = Math.pow(2, (ev.shift || 0) / 12);
    } else {
      s = list[0];
      for (const x of list) if (Math.abs(x.root - m) < Math.abs(s.root - m)) s = x;
      rate = Math.pow(2, (m - s.root) / 12);
    }
    const src = ctx.createBufferSource();
    src.buffer = s.buffer;
    src.playbackRate.value = rate;
    const amp = ctx.createGain();
    if (ev.attack) {
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.linearRampToValueAtTime(peak, t + ev.attack);
    } else amp.gain.setValueAtTime(peak, t);
    let end = t + (s.buffer.duration - s.offset) / rate;
    if (ev.dur !== undefined) {
      amp.gain.setTargetAtTime(0, t + ev.dur, rel);
      end = Math.min(end, t + ev.dur + rel * 6);
    }
    src.connect(amp).connect(bus.out);
    src.start(t, s.offset);
    src.stop(end);
    if (ev.key) {
      const choke = SAMPLE_CHOKE[ev.inst]?.[ev.key];
      if (choke) for (const r of Samples.ringing) {
        if (choke.some(k => r.id === `${ev.inst}:${k}`) && r.t < t && r.end > t) { r.amp.gain.setTargetAtTime(0, t, 0.015); r.end = t; }
      }
      if (CHOKED.has(`${ev.inst}:${ev.key}`)) {
        Samples.ringing = Samples.ringing.filter(r => r.end > t - 1);
        Samples.ringing.push({ id: `${ev.inst}:${ev.key}`, amp, t, end });
      }
    }
  }
};
