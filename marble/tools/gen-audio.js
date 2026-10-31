/* 生成小游戏端音效 WAV 文件(纯 Node,无依赖)
 * 运行: node tools/gen-audio.js
 * 输出: assets/sounds/*.wav
 * 浏览器端不使用这些文件(浏览器用 WebAudio 实时合成);微信/抖音小游戏端使用。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SR = 22050;

/* 音色定义:notes = [{f0, f1, t, dur, type, vol}] */
const SOUNDS = {
  peg: [{ f0: 700, f1: 1150, t: 0, dur: 0.07, type: 'tri', vol: 0.7 }],
  bumper: [
    { f0: 300, f1: 620, t: 0, dur: 0.13, type: 'square', vol: 0.4 },
    { f0: 160, f1: 90, t: 0, dur: 0.12, type: 'sine', vol: 0.7 }
  ],
  mover: [{ f0: 240, f1: 420, t: 0, dur: 0.1, type: 'tri', vol: 0.6 }],
  star: [
    { f0: 880, t: 0, dur: 0.09, type: 'tri', vol: 0.6 },
    { f0: 1320, t: 0.07, dur: 0.12, type: 'tri', vol: 0.55 }
  ],
  slot: [
    { f0: 520, f1: 260, t: 0, dur: 0.2, type: 'sine', vol: 0.8 },
    { f0: 660, t: 0.06, dur: 0.14, type: 'tri', vol: 0.45 }
  ],
  jackpot: [
    { f0: 523, t: 0, dur: 0.12, type: 'tri', vol: 0.6 },
    { f0: 659, t: 0.085, dur: 0.12, type: 'tri', vol: 0.6 },
    { f0: 784, t: 0.17, dur: 0.12, type: 'tri', vol: 0.6 },
    { f0: 1046, t: 0.255, dur: 0.12, type: 'tri', vol: 0.6 },
    { f0: 1318, t: 0.34, dur: 0.2, type: 'tri', vol: 0.6 },
    { f0: 1568, t: 0.45, dur: 0.3, type: 'sine', vol: 0.5 }
  ],
  launch: [
    { f0: 320, f1: 90, t: 0, dur: 0.18, type: 'saw', vol: 0.45 },
    { f0: 900, f1: 1400, t: 0, dur: 0.08, type: 'sine', vol: 0.3 }
  ],
  click: [{ f0: 660, f1: 500, t: 0, dur: 0.05, type: 'square', vol: 0.4 }],
  over: [
    { f0: 392, t: 0, dur: 0.2, type: 'sine', vol: 0.7 },
    { f0: 311, t: 0.17, dur: 0.2, type: 'sine', vol: 0.7 },
    { f0: 262, t: 0.34, dur: 0.34, type: 'sine', vol: 0.7 }
  ],
  record: [
    { f0: 523, t: 0, dur: 0.1, type: 'square', vol: 0.35 },
    { f0: 659, t: 0.07, dur: 0.1, type: 'square', vol: 0.35 },
    { f0: 784, t: 0.14, dur: 0.1, type: 'square', vol: 0.35 },
    { f0: 1046, t: 0.21, dur: 0.16, type: 'square', vol: 0.35 }
  ]
};

function osc(type, phase) {
  switch (type) {
    case 'square': return Math.sign(Math.sin(phase)) * 0.6;
    case 'saw': return ((phase / Math.PI) % 2 - 1) * 0.6;
    case 'tri': return Math.asin(Math.sin(phase)) * (2 / Math.PI);
    default: return Math.sin(phase);
  }
}

function render(name, notes) {
  let total = 0;
  for (const n of notes) total = Math.max(total, n.t + n.dur);
  const N = Math.ceil(total * SR) + SR * 0.05;
  const data = new Float32Array(N);
  for (const n of notes) {
    const start = Math.floor(n.t * SR);
    const len = Math.floor(n.dur * SR);
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const k = i / len;
      const f = n.f1 ? n.f0 + (n.f1 - n.f0) * k : n.f0;
      phase += 2 * Math.PI * f / SR;
      const env = Math.exp(-4.5 * k) * Math.min(1, i / (SR * 0.004));
      const idx = start + i;
      if (idx < N) data[idx] += osc(n.type, phase) * env * n.vol;
    }
  }
  /* 简单限幅 */
  for (let i = 0; i < N; i++) data[i] = Math.max(-0.95, Math.min(0.95, data[i]));
  return data;
}

function writeWav(file, data) {
  const n = data.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);        // PCM
  buf.writeUInt16LE(1, 22);        // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(data[i] * 32767), 44 + i * 2);
  }
  fs.writeFileSync(file, buf);
}

const outDir = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(outDir, { recursive: true });
for (const name of Object.keys(SOUNDS)) {
  const data = render(name, SOUNDS[name]);
  writeWav(path.join(outDir, name + '.wav'), data);
  console.log('生成', name + '.wav', Math.round(data.length / SR * 1000) + 'ms');
}
console.log('完成 →', outDir);
