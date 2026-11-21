#!/usr/bin/env python3
"""Gera INDEX.md e conhecimento/AAAA.md a partir de transcricoes/."""
import re
from pathlib import Path

raiz = Path("transcricoes")
meta = []
for f in sorted(raiz.glob("*/*/transcricao.md")):
    txt = f.read_text(encoding="utf-8")
    g = lambda k: (re.search(rf"^{k}: (.*)$", txt, re.M) or [None, ""])[1].strip('"')
    resumo = f.with_name("resumo.md").exists()
    meta.append((g("data"), g("titulo"), g("url"), f, txt, resumo))

meta.sort(reverse=True)
linhas = ["# Índice de vídeos VTURB\n", f"Total: {len(meta)} vídeos\n", "| Data | Título | Transcrição | YouTube |", "|---|---|---|---|"]
for d, t, u, f, _, r in meta:
    linhas.append(f"| {d} | {t.replace('|', '/')} | [{'resumo+' if r else ''}texto]({f.as_posix()}) | [link]({u}) |")
Path("INDEX.md").write_text("\n".join(linhas) + "\n", encoding="utf-8")

Path("conhecimento").mkdir(exist_ok=True)
anos = {}
for d, t, u, f, txt, _ in meta:
    corpo = txt.split("---", 2)[-1].strip()
    anos.setdefault(d[:4], []).append(f"\n\n---\n\n{corpo}\n\nFonte: {u} ({d})")
for ano, partes in anos.items():
    Path(f"conhecimento/{ano}.md").write_text(f"# Transcrições VTURB {ano}" + "".join(partes) + "\n", encoding="utf-8")
print(f"{len(meta)} vídeos indexados; anos: {sorted(anos)}")
