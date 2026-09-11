#!/usr/bin/env python3
"""Densify admin Section*.tsx for 100% browser zoom. Run from repo root:
  python3 scripts/densify-admin-sections.py
"""
import re
from pathlib import Path

DIR = Path('frontend/src/app/admin/dashboard/_components')
TEXT_MAP = {28:22,26:20,24:18,22:18,20:16,19:15,17:14,16:13,15:13,14:12}
FONT_MAP = dict(TEXT_MAP)
EXTRA = {44:30,30:22,21:16,35:26}

def densify(s: str) -> str:
    def text_repl(m):
        prefix = m.group(1) or ''
        n = int(m.group(2))
        if n in TEXT_MAP: return f'{prefix}text-[{TEXT_MAP[n]}px]'
        if n in EXTRA: return f'{prefix}text-[{EXTRA[n]}px]'
        return m.group(0)
    s = re.sub(r'(md:)?text-\[(\d+)px\]', text_repl, s)
    for a,b in [
        ('md:px-8','md:px-6'),('md:py-7','md:py-5'),('md:py-6','md:py-4'),
        ('md:p-8','md:p-5'),('md:p-6','md:p-4'),('md:gap-6','md:gap-4'),
        ('md:gap-5','md:gap-3'),('md:mb-8','md:mb-5'),('md:mb-6','md:mb-4'),
        ('px-[20px]','px-3.5'),('py-[16px]','py-3'),('px-[18px]','px-3.5'),
        ('py-[14px]','py-2.5'),('py-[19px]','py-3'),('p-[20px]','p-3.5'),
        ('p-[18px]','p-3.5'),('p-[16px]','p-3'),
        ('rounded-[14px]','rounded-[10px]'),('rounded-[12px]','rounded-[8px]'),
        ('rounded-[16px]','rounded-[10px]'),
        ('w-[40px]','w-8'),('h-[40px]','h-8'),('w-[44px]','w-8'),('h-[44px]','h-8'),
        ('w-[36px]','w-7'),('h-[36px]','h-7'),('w-[32px]','w-7'),('h-[32px]','h-7'),
        ('md:w-10','md:w-8'),('md:h-10','md:h-8'),
    ]:
        s = s.replace(a,b)
    def font_size_repl(m):
        n = float(m.group(1)); key = int(n) if n==int(n) else None
        if key in FONT_MAP: return f'fontSize: {FONT_MAP[key]}'
        if key in EXTRA: return f'fontSize: {EXTRA[key]}'
        if n >= 40: return f'fontSize: {int(round(n*0.75))}'
        if n >= 28: return f'fontSize: {int(round(n*0.78))}'
        if n >= 20: return f'fontSize: {int(round(n*0.82))}'
        if n >= 14: return f'fontSize: {int(round(n*0.88))}'
        return m.group(0)
    s = re.sub(r'fontSize:\s*(\d+(?:\.\d+)?)', font_size_repl, s)
    def pad_str_repl(m):
        quote, body = m.group(1), m.group(2)
        parts = re.findall(r'(\d+)px', body)
        if not parts: return m.group(0)
        scaled=[]
        for p in parts:
            v=int(p)
            if v>=28: scaled.append(f'{max(12,int(v*0.65))}px')
            elif v>=20: scaled.append(f'{max(10,int(v*0.7))}px')
            elif v>=14: scaled.append(f'{max(8,int(v*0.8))}px')
            else: scaled.append(f'{v}px')
        return f'padding: {quote}{" ".join(scaled)}{quote}'
    s = re.sub(r"padding:\s*(['\"])([^'\"]+)\1", pad_str_repl, s)
    def pad_num(m):
        n=int(m.group(1))
        if n>=28: return f'padding: {max(12,int(n*0.65))}'
        if n>=20: return f'padding: {max(10,int(n*0.7))}'
        return m.group(0)
    s = re.sub(r'padding:\s*(\d+)(?!\s*px)', pad_num, s)
    def br_repl(m):
        n=int(m.group(1))
        if n>=16: return 'borderRadius: 10'
        if n>=12: return 'borderRadius: 8'
        if n==10: return 'borderRadius: 8'
        return m.group(0)
    s = re.sub(r'borderRadius:\s*(\d+)', br_repl, s)
    def size_repl(m):
        n=int(m.group(1))
        if n>=24: return 'size={16}'
        if n>=20: return 'size={15}'
        if n==18: return 'size={15}'
        return m.group(0)
    s = re.sub(r'size=\{(\d+)\}', size_repl, s)
    def gap_style(m):
        n=int(m.group(1))
        if n>=16: return f'gap: {max(8,int(n*0.7))}'
        if n>=12: return f'gap: {max(8,n-4)}'
        return m.group(0)
    s = re.sub(r'gap:\s*(\d+)', gap_style, s)
    def mb_style(m):
        n=int(m.group(1))
        if n>=20: return f'marginBottom: {max(10,int(n*0.65))}'
        if n>=14: return f'marginBottom: {max(8,int(n*0.75))}'
        return m.group(0)
    s = re.sub(r'marginBottom:\s*(\d+)', mb_style, s)
    def wh(m):
        prop,n=m.group(1),int(m.group(2))
        if n>=40: return f'{prop}: 32'
        if n>=36: return f'{prop}: 28'
        if n==32: return f'{prop}: 28'
        return m.group(0)
    s = re.sub(r'(width|height):\s*(\d+)(?!\s*px)', wh, s)
    return s

skip = {
  'SectionDashboard.tsx',
}
changed = 0
for f in sorted(DIR.glob('Section*.tsx')):
    if f.name in skip:
        continue
    orig = f.read_text(encoding='utf-8')
    new = densify(orig)
    if new != orig:
        f.write_text(new, encoding='utf-8')
        changed += 1
        print('OK', f.name)
print(f'Done: {changed} files')
