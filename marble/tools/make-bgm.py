# -*- coding: utf-8 -*-
"""生成背景音乐芯片音 WAV(公版/传统旋律编曲)。
运行: python tools/make-bgm.py
输出: assets/bgm/*.wav(游戏按同名 mp3 优先、wav 兜底播放)
"""
import io
import math
import os
import struct
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'bgm')
SR = 22050


def m2f(m):
    return 440.0 * math.pow(2, (m - 69) / 12.0)


def render_song(spec):
    bpm = spec['bpm']
    spb8 = 60.0 / bpm / 2.0            # 每个八分音符秒数
    loops = spec.get('loops', 1)
    total8 = len(spec['lead']) * loops
    n = int(total8 * spb8 * SR)
    buf = [0.0] * n

    def add_tone(start8, dur8, freq, vol, wave_type):
        s0 = int(start8 * spb8 * SR)
        ns = int(dur8 * spb8 * SR)
        for i in range(ns):
            k = s0 + i
            if k >= n:
                break
            t = i / SR
            env = min(1.0, t / 0.008) * math.exp(-2.2 * t / max(0.05, dur8 * spb8))
            ph = 2 * math.pi * freq * t
            if wave_type == 'sq':
                v = 1.0 if math.sin(ph) >= 0 else -1.0
                v *= 0.6
            elif wave_type == 'tri':
                v = 2 / math.pi * math.asin(math.sin(ph))
            else:
                v = math.sin(ph)
            buf[k] += v * vol * 2.2 * env

    lead = spec['lead']
    bass = spec['bass']
    for i in range(total8):
        ln = lead[i % len(lead)]
        if ln:
            add_tone(i, 0.92, m2f(ln), 0.16, 'sq')
        bn = bass[i % len(bass)]
        if bn:
            add_tone(i, 0.95, m2f(bn), 0.2, 'tri')
        if i % 2 == 0:
            add_tone(i, 0.08, 6000, 0.05, 'sq')   # 底镲质感

    # 限幅 + 转 16bit
    frames = b''.join(struct.pack('<h', int(max(-1, min(1, v)) * 30000)) for v in buf)
    p = os.path.join(OUT, spec['file'])
    with wave.open(p, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(frames)
    print('%-30s %5.1f KB  %.1fs' % (os.path.relpath(p, ROOT), os.path.getsize(p) / 1024, total8 * spb8))


def bars(*bar_lists):
    out = []
    for b in bar_lists:
        out.extend(b)
    return out


E = [76, 74, 76, 71, 76, 74, 76, 0]
E2 = [76, 74, 76, 71, 81, 79, 78, 76]
AM = [72, 0, 71, 72, 69, 0, 72, 71]
AM2 = [72, 0, 71, 72, 69, 0, 72, 0]
BASS_EM = [40, 47, 40, 47, 40, 47, 40, 47]
BASS_AM = [45, 52, 45, 52, 45, 52, 45, 52]

# 卡农:D A Bm F#m G D G A 每小节低音根五交替,主旋律三段变奏
CANON_B = []
for _r in [50, 45, 47, 42, 43, 50, 43, 45]:
    CANON_B += [_r, _r + 7, _r, _r + 7, _r, _r + 7, _r, _r + 7]
CANON_L1 = [78, 0, 76, 0, 74, 0, 73, 0,
            71, 0, 69, 0, 71, 0, 73, 0,
            74, 0, 73, 0, 71, 0, 69, 0,
            67, 0, 69, 0, 71, 0, 73, 0]
CANON_L2 = [74, 73, 74, 0, 76, 74, 73, 71,
            74, 71, 74, 0, 79, 74, 79, 0,
            78, 74, 76, 73, 74, 78, 81, 79,
            78, 74, 78, 76, 74, 71, 74, 69]
CANON_L3 = [81, 78, 74, 78, 81, 79, 78, 76,
            74, 71, 74, 78, 81, 78, 79, 76,
            78, 74, 76, 73, 74, 78, 81, 79,
            78, 74, 78, 76, 74, 71, 74, 69]

ODE1 = [78, 78, 79, 81, 81, 79, 78, 76]
ODE2 = [74, 74, 76, 78, 78, 0, 76, 0]
ODE3 = [74, 74, 74, 0, 74, 76, 74, 0]
ODE_B1 = [50, 50, 50, 50, 45, 45, 45, 45]
ODE_B2 = [43, 43, 43, 43, 50, 50, 50, 50]
ODE_B3 = [43, 43, 43, 43, 45, 45, 45, 45]

# 康康:C 大调加洛普主题 + 下行琶音段,16 小节
CANCAN1 = [79, 76, 72, 76, 79, 79, 79, 79,
           81, 77, 74, 77, 81, 81, 81, 81]
CANCAN2 = [79, 76, 72, 76, 79, 79, 79, 79,
           77, 76, 74, 76, 72, 72, 72, 72]
CANCAN3 = [84, 81, 77, 81, 84, 84, 84, 84,
           86, 83, 79, 83, 86, 86, 86, 86]
CANCAN4 = [79, 79, 79, 79, 77, 76, 74, 72,
           72, 74, 76, 74, 72, 71, 72, 0]
CC_B1 = [48, 43, 48, 43, 48, 43, 48, 43]
CC_B2 = [53, 48, 53, 48, 53, 48, 53, 48]
CC_B3 = [55, 50, 55, 50, 55, 50, 55, 50]

TW1 = [72, 72, 79, 79, 81, 81, 79, 0]
TW2 = [77, 77, 76, 76, 74, 74, 72, 0]
TW3 = [79, 79, 77, 77, 76, 76, 74, 0]
TW_B1 = [48, 48, 48, 48, 41, 41, 41, 41]
TW_B2 = [43, 43, 43, 43, 48, 48, 48, 48]

SONGS = [
    {'name': '甩葱歌', 'file': '01-ievan.wav', 'bpm': 150, 'loops': 10,
     'lead': bars(E, E, E, E2, AM, AM2, E, E2), 'bass': bars(BASS_EM, BASS_EM, BASS_AM, BASS_AM, BASS_EM, BASS_EM, BASS_EM, BASS_EM)},
    {'name': '卡农', 'file': '02-canon.wav', 'bpm': 122, 'loops': 4,
     'lead': bars(CANON_L1, CANON_L2, CANON_L3, CANON_L3), 'bass': CANON_B},
    {'name': '欢乐颂', 'file': '03-ode.wav', 'bpm': 118, 'loops': 8,
     'lead': bars(ODE1, ODE2, ODE1, ODE2, ODE1, ODE2, ODE1, ODE3),
     'bass': bars(ODE_B1, ODE_B2, ODE_B3, ODE_B1, ODE_B2, ODE_B3, ODE_B1, ODE_B3)},
    {'name': '康康舞曲', 'file': '04-cancan.wav', 'bpm': 152, 'loops': 5,
     'lead': bars(CANCAN1, CANCAN2, CANCAN3, CANCAN4, CANCAN1, CANCAN2, CANCAN3, CANCAN4),
     'bass': bars(CC_B1, CC_B2, CC_B3, CC_B1, CC_B1, CC_B2, CC_B3, CC_B1)},
    {'name': '小星星', 'file': '05-twinkle.wav', 'bpm': 104, 'loops': 9,
     'lead': bars(TW1, TW2, TW3, TW3, TW1, TW2),
     'bass': bars(TW_B1, TW_B2, TW_B1, TW_B2, TW_B1, TW_B2)},
]

os.makedirs(OUT, exist_ok=True)
for spec in SONGS:
    render_song(spec)
print('完成 →', OUT)
