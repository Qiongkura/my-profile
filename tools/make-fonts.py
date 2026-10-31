# -*- coding: utf-8 -*-
"""生成站点自托管字体(子集化 woff2):
   下载 Google Fonts 变量字体 → 按字重实例化 → 只保留站点实际用到的字符 → woff2
   运行: python tools/make-fonts.py   (依赖: pip install fonttools brotli)
   站点文案改动后重新跑一次即可刷新子集。
"""
import io
import os
import string
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(ROOT, 'fonts')
CACHE = os.path.join(os.environ.get('TEMP', '/tmp'), 'site-font-cache')
os.makedirs(FONT_DIR, exist_ok=True)
os.makedirs(CACHE, exist_ok=True)

SOURCES = {
    'inter': 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inter/Inter%5Bopsz,wght%5D.ttf',
    'noto': 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf',
}
AXES_PIN = {
    'inter': {'opsz': 14},
    'noto': {},
}
WEIGHTS = {
    'inter': [400, 500, 600, 700],
    'noto': [400, 500, 700],
}
EXTRA_CHARS = set('，。、；：？！""''（）《》〈〉【】〔〕·—…％￥℃×÷±°↑↓←→↗★☆✓→')


def collect_chars():
    chars = set(string.printable) | EXTRA_CHARS
    for name in ('index.html', 'script.js'):
        p = os.path.join(ROOT, name)
        if os.path.exists(p):
            with io.open(p, encoding='utf-8') as fh:
                chars |= set(fh.read())
    chars -= set('\n\r\t\x0b\x0c')
    return ''.join(sorted(chars))


def get_vf(key, url):
    raw = os.path.join(CACHE, key + '-vf.ttf')
    if not os.path.exists(raw) or os.path.getsize(raw) < 1000:
        print('下载', key, '变量字体 ...')
        urllib.request.urlretrieve(url, raw)
    return raw


def build(key, url, weights):
    raw = get_vf(key, url)
    for w in weights:
        f = TTFont(raw)
        pins = dict(AXES_PIN[key])
        pins['wght'] = w
        instancer.instantiateVariableFont(f, pins, inplace=True)
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['*']   # 保留 kern 等排版特性
        opts.name_IDs = [1, 2]
        ss = subset.Subsetter(options=opts)
        ss.populate(text=CHARS)
        ss.subset(f)
        f.flavor = 'woff2'
        out = os.path.join(FONT_DIR, '%s-%d.woff2' % (key, w))
        f.save(out)
        print('%-22s %5d KB' % (os.path.relpath(out, ROOT), os.path.getsize(out) // 1024))


CHARS = collect_chars()
print('用字集:', len(CHARS), '字符')
for key in SOURCES:
    build(key, SOURCES[key], WEIGHTS[key])
print('完成 →', os.path.relpath(FONT_DIR, ROOT))
