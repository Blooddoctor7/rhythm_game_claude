/* ==========================================================
 * build-band-samples.mjs — 밴드 악기 샘플 만들기
 *
 *  sample-sources/ 의 원본 라이브러리에서 필요한 음만 골라
 *  samples/guitar.js, samples/bass.js, samples/drums.js 를 만듭니다.
 *  (앞 무음 자르기 → 모노 → 길이 줄이고 페이드아웃 → 음량 맞추기 → AAC → base64)
 *
 *  사용: node tools/build-band-samples.mjs        (macOS afconvert 필요)
 *        node tools/build-band-samples.mjs --dry  (파일은 안 만들고 분석 결과만 출력)
 *  출처와 라이선스는 sample-sources/README.md, CREDITS.md
 * ========================================================== */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'sample-sources');
const RATE = 44100;
const DRY = process.argv.includes('--dry');
const TMP = mkdtempSync(join(tmpdir(), 'beat-rush-band-'));

// 폴더 안에서 이름으로 하위 폴더 찾기 (FreePats 압축은 날짜가 붙은 폴더가 하나 더 있음)
const sub = (dir, prefix) => join(dir, readdirSync(dir).find(n => n.startsWith(prefix)));

const NOTE = { c: 0, 'c#': 1, db: 1, d: 2, 'd#': 3, eb: 3, e: 4, f: 5, 'f#': 6, gb: 6, g: 7, 'g#': 8, ab: 8, a: 9, 'a#': 10, bb: 10, b: 11 };
const midiOf = (name, oct) => 12 * (Number(oct) + 1) + NOTE[name.toLowerCase()];

// ---------- 악기별 설정 ----------

// FreePats FSBS 일렉 기타: "E2_s1_01.flac" (음_줄_라운드로빈), 여린 소리는 "_soft_"
function fsbs(variant, want) {
  const dir = join(sub(join(SRC, `guitar_freepats-fsbs-${variant}`), 'EGuitarFSBS'), 'samples', 'bridge');
  const byMidi = {};
  for (const f of readdirSync(dir)) {
    const m = f.match(/^([A-G]#?)(\d)_s\d_01\.flac$/);
    if (m) byMidi[midiOf(m[1], m[2])] = join(dir, f);
  }
  return want.map(n => ({ label: n, file: byMidi[n] }));
}

// Karoryfer Black And Blue Basses (darkblack, 보통 주법, f 세기, 첫 번째 라운드로빈)
// 파일 이름의 음 이름은 sfz 매핑 기준 (b1 = 35)
function darkblack(want) {
  const dir = join(SRC, 'bass_karoryfer-black-and-blue', 'Samples', 'darkblack', 'reg');
  const byMidi = {};
  for (const f of readdirSync(dir)) {
    const m = f.match(/^darkblack_([a-g]b?)(\d)_f_rr1\.wav$/);
    if (m) byMidi[midiOf(m[1], m[2])] = join(dir, f);
  }
  return want.map(n => ({ label: n, file: byMidi[n] }));
}

// MuldjordKit (FreePats 스테레오판): 파일 번호가 클수록 세게 친 소리
const KIT = sub(join(SRC, 'drums_muldjordkit'), 'MuldjordKit');
const kit = (piece, n, name = piece) => join(KIT, 'samples', piece, `${n}-${name}.flac`);

const GROUPS = {
  guitar: {
    // 클린 일렉 기타 (앰프·이펙트를 거친 소리)
    gtr_clean: { pitched: true, len: 3.2, fade: 1.2, notes: fsbs('clean', [36, 40, 45, 48, 52, 55, 59, 61, 64, 67, 71, 74, 77, 80, 85]) },
    // 디스토션 기타 (파워코드는 근음 + 5도를 겹쳐서)
    gtr_dist: { pitched: true, len: 2.8, fade: 1.0, notes: fsbs('dist1', [36, 40, 45, 48, 52, 55, 59, 61, 64, 67, 71, 74, 77]) },
  },
  bass: {
    bass: { pitched: true, len: 2.6, fade: 1.0, notes: darkblack([35, 38, 41, 44, 47, 50, 53, 56, 59, 62, 65, 68]) },
  },
  drums: {
    // 키 이름 뒤 "~2" 는 같은 소리의 다른 녹음 (sampler.js 가 번갈아 재생)
    drums: {
      pitched: false,
      keys: {
        kick:      { file: kit('KdrumL', 25), len: 0.9 },
        'kick~2':  { file: kit('KdrumL', 24), len: 0.9 },
        snare:     { file: kit('Snare1', 56, 'Snare'), len: 1.1 },
        'snare~2': { file: kit('Snare1', 55, 'Snare'), len: 1.1 },
        snare_soft:{ file: kit('Snare1', 20, 'Snare'), len: 0.8 },
        hhc:       { file: kit('HihatClosed', 29), len: 0.5 },
        'hhc~2':   { file: kit('HihatClosed', 28), len: 0.5 },
        hhc_soft:  { file: kit('HihatClosed', 12), len: 0.4 },
        hho:       { file: kit('HihatOpen', 26), len: 1.8 },
        tom1:      { file: kit('Tom1', 11), len: 1.4 },
        tom2:      { file: kit('Tom2', 13), len: 1.5 },
        tom3:      { file: kit('Tom3', 15), len: 1.7 },
        tom4:      { file: kit('Tom4', 20), len: 1.9 },
        crash:     { file: kit('CrashL', 9), len: 3.2 },
        crash2:    { file: kit('CrashR', 12), len: 3.2 },
        ride:      { file: kit('RideL', 8), len: 2.4 },
        ride_bell: { file: kit('RideLBell', 3), len: 2.4 },
        china:     { file: kit('China', 12), len: 2.6 },
      },
    },
  },
};

// ---------- 오디오 처리 ----------

// 아무 형식이나 → 44.1kHz float32 WAV 로 풀고 모노로 합침
function decode(file) {
  const out = join(TMP, 'dec.wav');
  execFileSync('afconvert', ['-f', 'WAVE', '-d', `LEF32@${RATE}`, file, out]);
  const buf = readFileSync(out);
  let off = 12, ch = 1, data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4), size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') ch = buf.readUInt16LE(off + 10);
    if (id === 'data') data = buf.subarray(off + 8, off + 8 + size);
    off += 8 + size + (size & 1);
  }
  const frames = Math.floor(data.length / 4 / ch), x = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let c = 0; c < ch; c++) s += data.readFloatLE((i * ch + c) * 4);
    x[i] = s / ch;
  }
  return x;
}

const peakOf = (x, a = 0, b = x.length) => { let p = 0; for (let i = a; i < b; i++) p = Math.max(p, Math.abs(x[i])); return p; };
const rmsOf = (x, a, b) => { let s = 0; b = Math.min(b, x.length); for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); };

// 소리 시작 지점: 전체 최댓값의 3%를 처음 넘는 곳에서 3ms 앞
function onset(x) {
  const th = peakOf(x) * 0.03;
  let i = 0;
  while (i < x.length && Math.abs(x[i]) < th) i++;
  return Math.max(0, i - Math.round(RATE * 0.003));
}

// 잘라내고 끝을 부드럽게 줄임
function cut(x, start, len, fade) {
  const n = Math.min(x.length - start, Math.round(len * RATE)), y = x.slice(start, start + n);
  const f = Math.min(n, Math.round(fade * RATE));
  for (let i = 0; i < f; i++) y[n - f + i] *= 0.5 + 0.5 * Math.cos((Math.PI * (i + 1)) / f);
  const fi = Math.round(RATE * 0.002); // 시작 클릭 방지
  for (let i = 0; i < fi && i < n; i++) y[i] *= i / fi;
  return y;
}

// 음높이 찾기 (YIN). 어택이 지난 뒤 구간에서 측정, 반환값은 MIDI 번호(소수)
function pitchOf(x, start) {
  const W = 4096, tMin = Math.floor(RATE / 1200), tMax = Math.floor(RATE / 25);
  const a = start + Math.round(RATE * 0.12);
  if (a + W + tMax > x.length) return null;
  const d = new Float64Array(tMax + 1);
  for (let t = tMin; t <= tMax; t++) {
    let s = 0;
    for (let i = 0; i < W; i++) { const v = x[a + i] - x[a + i + t]; s += v * v; }
    d[t] = s;
  }
  // 누적 평균으로 나눈 차이 함수에서 0.15 아래로 처음 내려가는 지점
  let sum = 0, best = -1;
  const dn = new Float64Array(tMax + 1);
  for (let t = 1; t <= tMax; t++) {
    if (t < tMin) { let s = 0; for (let i = 0; i < W; i++) { const v = x[a + i] - x[a + i + t]; s += v * v; } d[t] = s; }
    sum += d[t];
    dn[t] = (d[t] * t) / (sum || 1);
  }
  for (let t = tMin; t < tMax; t++) if (dn[t] < 0.15) { while (t + 1 < tMax && dn[t + 1] < dn[t]) t++; best = t; break; }
  if (best < 0) { let m = Infinity; for (let t = tMin; t < tMax; t++) if (dn[t] < m) { m = dn[t]; best = t; } }
  // 포물선 보간
  const y0 = dn[best - 1], y1 = dn[best], y2 = dn[best + 1];
  const tau = best + (y0 - y2) / (2 * (y0 - 2 * y1 + y2) || 1);
  return 69 + 12 * Math.log2(RATE / tau / 440);
}

// 모노 16bit WAV → AAC(m4a) → base64
function encode(y) {
  const wav = join(TMP, 'enc.wav'), m4a = join(TMP, 'enc.m4a');
  const b = Buffer.alloc(44 + y.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + y.length * 2, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(RATE, 24); b.writeUInt32LE(RATE * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(y.length * 2, 40);
  for (let i = 0; i < y.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(y[i] * 32767))), 44 + i * 2);
  writeFileSync(wav, b);
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '80000', '-q', '127', wav, m4a]);
  return readFileSync(m4a).toString('base64');
}

// ---------- 만들기 ----------

const TARGET_PEAK = 0.89; // -1dBFS
for (const [group, insts] of Object.entries(GROUPS)) {
  const lines = [
    '// 실제 악기 샘플 (출처는 CREDITS.md) — tools 없이도 열리도록 스크립트에 포함',
    'var S = (window.BEAT_RUSH_SAMPLES = window.BEAT_RUSH_SAMPLES || {});',
  ];
  for (const [inst, cfg] of Object.entries(insts)) {
    const items = cfg.pitched
      ? cfg.notes.map(n => ({ key: String(n.label), file: n.file, len: cfg.len, fade: cfg.fade, label: n.label }))
      : Object.entries(cfg.keys).map(([key, k]) => ({ key, file: k.file, len: k.len, fade: k.fade ?? k.len * 0.5 }));
    for (const it of items) {
      if (!it.file || !existsSync(it.file)) throw new Error(`${inst} ${it.key}: 원본 파일 없음`);
      const x = decode(it.file), s = onset(x);
      it.y = cut(x, s, it.len, it.fade);
      it.rms = rmsOf(it.y, 0, Math.round(RATE * 0.4));
      if (cfg.pitched) {
        it.pitch = pitchOf(x, s);
        // 이름과 몇 옥타브 차이 나는지 (반음 0.5 안으로 맞을 때만)
        const o = it.pitch == null ? null : Math.round((it.pitch - it.label) / 12) * 12;
        it.oct = o != null && Math.abs(it.pitch - it.label - o) < 0.5 ? o : null;
      }
    }
    if (cfg.pitched) {
      // 악기 전체에서 가장 많이 나온 옥타브 차이를 매핑 차이로 보고, 그와 맞는 음만 측정한 미세 조율을 반영
      const cnt = {};
      for (const it of items) if (it.oct != null) cnt[it.oct] = (cnt[it.oct] || 0) + 1;
      const oct = Number(Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0);
      for (const it of items) it.root = it.oct === oct ? Math.round(it.pitch * 100) / 100 : it.label + oct;
    }
    // 음 사이 음량 맞추기 (가락 악기만: 앞 0.4초 RMS 를 가운데값에 맞춤). 드럼은 킷 안의 균형을 그대로 둠
    if (cfg.pitched) {
      const med = items.map(i => i.rms).sort((a, b) => a - b)[items.length >> 1];
      for (const it of items) { const g = Math.min(2, Math.max(0.5, med / it.rms)); for (let i = 0; i < it.y.length; i++) it.y[i] *= g; }
    }
    const pk = Math.max(...items.map(i => peakOf(i.y)));
    for (const it of items) for (let i = 0; i < it.y.length; i++) it.y[i] *= TARGET_PEAK / pk;

    const entries = {};
    for (const it of items) {
      if (cfg.pitched) it.key = String(Math.round(it.root)); // 키는 실제 음높이 (원본 파일 이름과 다를 수 있음)
      const info = cfg.pitched ? `root ${it.root} (원본 이름 ${it.label}, 측정 ${it.pitch?.toFixed(2)})` : '';
      console.log(`${inst.padEnd(10)} ${it.key.padEnd(10)} ${(it.y.length / RATE).toFixed(2)}s  rms ${(rmsOf(it.y, 0, RATE * 0.4)).toFixed(3)}  ${info}`);
      if (!DRY) entries[it.key] = cfg.pitched ? { root: it.root, data: encode(it.y) } : { data: encode(it.y) };
    }
    lines.push(`S[${JSON.stringify(inst)}] = ${JSON.stringify(entries)};`);
  }
  if (!DRY) {
    const out = join(ROOT, 'samples', `${group}.js`);
    writeFileSync(out, lines.join('\n') + '\n');
    console.log(`→ samples/${group}.js ${(readFileSync(out).length / 1024).toFixed(0)}KB`);
  }
}
rmSync(TMP, { recursive: true, force: true });
