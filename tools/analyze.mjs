/* ==========================================================
 * analyze.mjs — 오디오 분석 (BPM, 박자 위치, 악기별 어택)
 *  입력: 모노 PCM (Float32Array) + 샘플레이트
 * ========================================================== */

export const N = 1024;   // FFT 크기
export const HOP = 256;  // 프레임 간격

export function readWav(buf) {
  let off = 12, fmt = null, data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { channels: buf.readUInt16LE(off + 10), rate: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) };
    if (id === 'data') data = buf.subarray(off + 8, off + 8 + size);
    off += 8 + size + (size & 1);
  }
  if (!fmt || !data || fmt.bits !== 16 || fmt.channels !== 1) throw new Error('16bit 모노 WAV만 지원합니다');
  const x = new Float32Array(data.length >> 1);
  for (let i = 0; i < x.length; i++) x[i] = data.readInt16LE(i * 2) / 32768;
  return { rate: fmt.rate, x };
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/**
 * 스펙트럼 분석: 프레임별 대역 플럭스(어택 세기), 에너지, 스펙트럼 중심
 */
export function spectral(x, rate) {
  const frames = Math.floor((x.length - N) / HOP) + 1;
  const hop = HOP / rate;
  const binHz = rate / N, K = N / 2 + 1;
  const bin = hz => Math.min(K - 1, Math.round(hz / binHz));
  const bands = { low: [bin(30), bin(150)], mid: [bin(150), bin(2500)], high: [bin(2500), K - 1] };
  const win = new Float64Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  const re = new Float64Array(N), im = new Float64Array(N);
  let prev = new Float32Array(K), cur = new Float32Array(K);
  const out = {
    frames, hop, binHz,
    time: f => (f * HOP + N / 2) / rate,      // 프레임 중심 시각
    flux: new Float32Array(frames),
    low: new Float32Array(frames), mid: new Float32Array(frames), high: new Float32Array(frames),
    rms: new Float32Array(frames), midE: new Float32Array(frames),
    cent: new Float32Array(frames),          // 새로 생긴 소리의 높이 (log2 Hz)
  };
  for (let f = 0; f < frames; f++) {
    const s = f * HOP;
    let e = 0;
    for (let i = 0; i < N; i++) { const v = x[s + i]; re[i] = v * win[i]; im[i] = 0; e += v * v; }
    out.rms[f] = Math.sqrt(e / N);
    fft(re, im);
    let midE = 0;
    for (let k = 0; k < K; k++) {
      const mag = Math.hypot(re[k], im[k]);
      cur[k] = Math.log1p(100 * mag);
      if (k >= bands.mid[0] && k < bands.mid[1]) midE += mag * mag;
    }
    out.midE[f] = midE;
    if (f > 0) {
      let tot = 0, cw = 0, cs = 0;
      for (const name of ['low', 'mid', 'high']) {
        const [a, b] = bands[name];
        let sum = 0;
        for (let k = a; k < b; k++) {
          const d = cur[k] - prev[k];
          if (d > 0) {
            sum += d;
            if (k >= bands.mid[0]) { cw += d; cs += d * Math.log2(k * binHz); }
          }
        }
        out[name][f] = sum;
        tot += sum;
      }
      out.flux[f] = tot;
      out.cent[f] = cw > 0 ? cs / cw : 0;
    }
    [prev, cur] = [cur, prev];
  }
  return out;
}

// 이동 평균을 빼고 음수는 0으로 → 어택만 남김
export function rectify(env, radius) {
  const n = env.length, out = new Float32Array(n);
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + env[i];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - radius), b = Math.min(n, i + radius + 1);
    out[i] = Math.max(0, env[i] - (pre[b] - pre[a]) / (b - a));
  }
  return out;
}

export function smooth(env, sigma) {
  const r = Math.ceil(sigma * 3), w = [];
  for (let i = -r; i <= r; i++) w.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
  const ws = w.reduce((a, b) => a + b, 0);
  const out = new Float32Array(env.length);
  for (let i = 0; i < env.length; i++) {
    let s = 0;
    for (let j = -r; j <= r; j++) { const k = i + j; if (k >= 0 && k < env.length) s += env[k] * w[j + r]; }
    out[i] = s / ws;
  }
  return out;
}

const interp = (env, f) => {
  if (f < 0 || f >= env.length - 1) return 0;
  const i = Math.floor(f), a = f - i;
  return env[i] * (1 - a) + env[i + 1] * a;
};

/**
 * 템포 후보: 자기상관 + 배수 박자 강화, 120~140 근처를 약간 선호
 */
export function tempoCandidates(env, hop, lo = 60, hi = 200) {
  const n = env.length;
  let mean = 0;
  for (const v of env) mean += v;
  mean /= n;
  const maxLag = Math.ceil((60 / lo / hop) * 4) + 2;
  const ac = new Float64Array(maxLag + 1);
  for (let lag = 0; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += (env[i] - mean) * (env[i + lag] - mean);
    ac[lag] = s / (n - lag);
  }
  const acAt = l => { const i = Math.floor(l), a = l - i; return i + 1 <= maxLag ? ac[i] * (1 - a) + ac[i + 1] * a : 0; };
  const res = [];
  for (let bpm = lo; bpm <= hi; bpm += 0.05) {
    const L = 60 / bpm / hop;
    const raw = acAt(L) + 0.5 * acAt(2 * L) + 0.33 * acAt(3 * L) + 0.25 * acAt(4 * L) + 0.4 * acAt(L / 2);
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 130) / 0.6, 2));
    res.push({ bpm, raw, score: raw * (0.6 + 0.4 * prior) });
  }
  // 극대값만 추림
  const peaks = res.filter((r, i) => i > 0 && i < res.length - 1 && r.score >= res[i - 1].score && r.score >= res[i + 1].score);
  return peaks.sort((a, b) => b.score - a.score).slice(0, 8);
}

/**
 * BPM과 첫 박 위치를 곡 전체에 맞춰 정밀하게 맞춤
 *  박 위치 가중치 1, 8분 뒷박 0.35 → 앞박/뒷박이 뒤바뀌는 것 방지
 */
export function fitGrid(env, sp, bpm0, span = 0.012) {
  const dur = sp.time(env.length - 1);
  const toF = t => (t * sp.hop ** -1) - (N / 2 / HOP);
  let best = { score: -1 };
  for (let bpm = bpm0 * (1 - span); bpm <= bpm0 * (1 + span); bpm += bpm0 * 0.0002) {
    const P = 60 / bpm;
    for (let ph = 0; ph < P; ph += 0.002) {
      let s = 0;
      for (let t = ph; t < dur; t += P) s += interp(env, toF(t)) + 0.35 * interp(env, toF(t + P / 2));
      if (s > best.score) best = { score: s, bpm, phase: ph };
    }
  }
  // 위상 미세 조정 (0.25ms)
  const P = 60 / best.bpm;
  for (let ph = best.phase - 0.003; ph <= best.phase + 0.003; ph += 0.00025) {
    let s = 0;
    for (let t = ph; t < dur; t += P) s += interp(env, toF(t)) + 0.35 * interp(env, toF(t + P / 2));
    if (s > best.score) best = { score: s, bpm: best.bpm, phase: ph };
  }
  return best;
}

/**
 * 시간 영역 정밀 어택 위치 측정: 박 근처에서 에너지가 가장 가파르게 오르는 지점
 *  반환: 각 박에 대한 (실제 어택 - 박 그리드) 초 단위 차이
 */
export function attackOffsets(x, rate, beats, win = 0.04) {
  const step = Math.round(rate * 0.001); // 1ms
  const env = new Float32Array(Math.floor(x.length / step));
  for (let i = 0; i < env.length; i++) {
    let s = 0;
    for (let j = 0; j < step; j++) { const v = x[i * step + j]; s += v * v; }
    env[i] = s;
  }
  const sm = smooth(env, 2);
  const out = [];
  for (const b of beats) {
    const c = Math.round(b * 1000), r = Math.round(win * 1000);
    if (c - r - 10 < 0 || c + r + 10 >= sm.length) continue;
    let bestD = 0, at = null;
    for (let i = c - r; i <= c + r; i++) {
      const d = Math.log(sm[i + 3] + 1e-9) - Math.log(sm[i - 3] + 1e-9);
      if (d > bestD) { bestD = d; at = i; }
    }
    if (at !== null && bestD > 1.0) out.push({ beat: b, off: at / 1000 - b, strength: bestD });
  }
  return out;
}

/**
 * 가장 촘촘한 박자 단위(16분음표 등) 찾기: 100~200ms 사이에서 어택이 가장 잘 맞는 격자 간격
 *  반환: { period(초), ratio(격자 위/중간 어택 비율) }
 */
export function findUnit(env, sp, lo = 0.1, hi = 0.2) {
  const dur = sp.time(env.length - 1);
  const toF = t => t / sp.hop - N / 2 / HOP;
  let best = null;
  for (let P = lo; P <= hi; P *= 1.0005) {
    let bestPh = null;
    for (let ph = 0; ph < P; ph += 0.004) {
      let on = 0, off = 0;
      for (let t = ph; t < dur; t += P) { on += interp(env, toF(t)); off += interp(env, toF(t + P / 2)); }
      if (!bestPh || on - off > bestPh.d) bestPh = { d: on - off, on, off };
    }
    const ratio = bestPh.on / (bestPh.off || 1);
    if (!best || bestPh.d > best.d) best = { period: P, ratio, d: bestPh.d };
  }
  return best;
}

/**
 * 동적 계획법 비트 트래킹 (Ellis 2007)
 *  템포가 조금씩 변하는 곡도 박자를 따라감. period: 목표 박 간격(초)
 */
export function trackBeats(env, sp, period, tightness = 100) {
  const n = env.length, p = period / sp.hop;
  const C = new Float64Array(n), back = new Int32Array(n).fill(-1);
  for (let f = 0; f < n; f++) {
    let best = 0, bi = -1;
    for (let tau = Math.max(0, Math.floor(f - 2 * p)); tau <= f - Math.round(p / 2); tau++) {
      const s = C[tau] - tightness * Math.log((f - tau) / p) ** 2;
      if (bi < 0 || s > best) { best = s; bi = tau; }
    }
    C[f] = env[f] + (bi >= 0 ? Math.max(0, best) : 0);
    back[f] = bi >= 0 && best > 0 ? bi : -1;
  }
  let f = n - Math.round(p);
  for (let k = f; k < n; k++) if (C[k] > C[f]) f = k;
  const beats = [];
  while (f >= 0) { beats.unshift(f); f = back[f]; }
  return beats.map(b => sp.time(b));
}

/**
 * t 근처(±win초)에서 어택(플럭스 극대) 정확한 시각을 찾음. 없으면 null
 */
export function peakNear(env, sp, t, win, minVal) {
  const toF = tt => tt / sp.hop - N / 2 / HOP;
  const a = Math.max(1, Math.floor(toF(t - win))), b = Math.min(env.length - 2, Math.ceil(toF(t + win)));
  let bi = -1;
  for (let f = a; f <= b; f++) if (env[f] >= env[f - 1] && env[f] >= env[f + 1] && env[f] > minVal && (bi < 0 || env[f] > env[bi])) bi = f;
  if (bi < 0) return null;
  const y0 = env[bi - 1], y1 = env[bi], y2 = env[bi + 1], den = y0 - 2 * y1 + y2;
  const d = den ? (0.5 * (y0 - y2)) / den : 0;
  return { t: sp.time(bi + Math.max(-0.5, Math.min(0.5, d))), v: y1 };
}

// 최소제곱 다항식 맞춤 (반환: 계수 [c0, c1, …], x 는 내부에서 정규화)
function polyfit(xs, ys, deg) {
  const sc = Math.max(1, ...xs.map(Math.abs));
  const m = deg + 1, M = Array.from({ length: m }, () => new Float64Array(m + 1));
  xs.forEach((x0, i) => {
    const x = x0 / sc, pw = [1];
    for (let k = 1; k < 2 * m; k++) pw.push(pw[k - 1] * x);
    for (let r = 0; r < m; r++) {
      for (let c = 0; c < m; c++) M[r][c] += pw[r + c];
      M[r][m] += pw[r] * ys[i];
    }
  });
  for (let c = 0; c < m; c++) { // 가우스 소거
    let p = c;
    for (let r = c + 1; r < m; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < m; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= m; k++) M[r][k] -= f * M[c][k];
    }
  }
  const coef = M.map((row, r) => row[m] / row[r]);
  return n => coef.reduce((a, c, k) => a + c * Math.pow(n / sc, k), 0);
}

/**
 * 템포 맵: 템포가 조금씩 변하는 곡의 박 위치를 매끄럽게 구함
 *  1) 12초 창마다 템포·박 위치를 따로 맞춤
 *  2) 창끼리 이어 붙이며 반 박 어긋남(엇박에 맞춰진 창)을 바로잡음
 *  3) (박 번호 → 시각) 을 3차 곡선으로 맞추고, 맞지 않으면 창 사이를 직선으로 이음
 *  4) 저음(킥) 기준으로 정박/엇박 전체를 한 번 더 판정
 *  반환: { beats(초), anchors, maxRes(초), halfFixes, wins }
 */
export function tempoMap(env, low, sp, dur, bpm0, o = {}) {
  const toF = t => t / sp.hop - N / 2 / HOP;
  const W = o.window ?? 12, STEP = o.step ?? 6, span = o.span ?? 0.04;
  const wins = [];
  for (let s = 0; s + W / 2 <= dur; s += STEP) {
    const e = Math.min(dur, s + W);
    let best = null;
    for (let bpm = bpm0 * (1 - span); bpm <= bpm0 * (1 + span); bpm += 0.05) {
      const P = 60 / bpm;
      for (let ph = 0; ph < P; ph += 0.003) {
        let sc = 0;
        for (let t = s + ph; t < e; t += P) sc += interp(env, toF(t)) + 0.6 * interp(low, toF(t)) + 0.3 * interp(env, toF(t + P / 2));
        if (!best || sc > best.sc) best = { sc, bpm, ph };
      }
    }
    const P = 60 / best.bpm, mid = (s + e) / 2;
    const k = Math.round((mid - s - best.ph) / P);
    wins.push({ s, e, bpm: best.bpm, P, at: s + best.ph + k * P, sc: (best.sc * P) / (e - s) });
  }
  // 조용한(믿기 어려운) 창은 빼고 이어 붙임
  const scs = wins.map(w => w.sc).sort((a, b) => a - b);
  const cut = scs[Math.floor(scs.length * 0.5)] * 0.35;
  const good = wins.filter(w => w.sc >= cut);
  const anchors = [{ n: 0, t: good[0].at, P: good[0].P }];
  let halfFixes = 0;
  for (let i = 1; i < good.length; i++) {
    const p = anchors[anchors.length - 1], w = good[i], P = (p.P + w.P) / 2;
    let t = w.at, d = (t - p.t) / P;
    const frac = d - Math.round(d);
    if (Math.abs(frac) > 0.3) { t -= Math.sign(frac) * w.P / 2; d = (t - p.t) / P; halfFixes++; }
    anchors.push({ n: p.n + Math.round(d), t, P: w.P });
  }
  // 박 번호 → 시각
  let beatAt = polyfit(anchors.map(a => a.n), anchors.map(a => a.t), Math.min(3, anchors.length - 1));
  let maxRes = Math.max(...anchors.map(a => Math.abs(a.t - beatAt(a.n))));
  if (maxRes > 0.015) {
    // 곡선이 안 맞으면 창 사이 직선 연결 (양 끝은 끝 창 템포로 연장)
    const A0 = anchors;
    beatAt = n => {
      if (n <= A0[0].n) return A0[0].t + (n - A0[0].n) * A0[0].P;
      const L = A0[A0.length - 1];
      if (n >= L.n) return L.t + (n - L.n) * L.P;
      let i = 1;
      while (A0[i].n < n) i++;
      const a = A0[i - 1], b = A0[i];
      return a.t + ((n - a.n) / (b.n - a.n)) * (b.t - a.t);
    };
    maxRes = 0;
  }
  let n0 = anchors[0].n;
  while (beatAt(n0 - 1) > 0) n0--;
  let beats = [];
  for (let n = n0; beatAt(n) < dur; n++) beats.push(beatAt(n));
  // 정박/엇박 판정 (킥이 정박에 오도록)
  let on = 0, off = 0;
  for (let i = 0; i + 1 < beats.length; i++) {
    const m = (beats[i] + beats[i + 1]) / 2;
    on += interp(low, toF(beats[i])) + 0.5 * interp(env, toF(beats[i]));
    off += interp(low, toF(m)) + 0.5 * interp(env, toF(m));
  }
  if (off > on * 1.1) beats = beats.slice(0, -1).map((t, i) => (t + beats[i + 1]) / 2);
  return { beats, anchors, maxRes, halfFixes, wins: good, shifted: off > on * 1.1 };
}

export { interp };
