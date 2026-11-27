#!/usr/bin/env python3
"""Gera INDEX.md, conhecimento/AAAA.md e as páginas-hub (temas/, convidados/) com [[links]] para o grafo do Obsidian."""
import re
import unicodedata
from pathlib import Path

raiz = Path("transcricoes")

TEMAS = {
    "VSL e vídeo de vendas": r"\bvsls?\b|v[ií]deo de vendas|mini-?vsl",
    "Nutra": r"nutra",
    "Native Ads": r"native",
    "Infoprodutos": r"infoproduto|produto digital|produtos digitais|neg[óo]cio digital|digital",
    "Low ticket": r"low ?ticket",
    "High ticket": r"high ?ticket",
    "Perpétuo e lançamento": r"perp[ée]tuo|lan[çc]amento",
    "Inteligência artificial": r"\bia\b|intelig[êe]ncia artificial|automa[çc][õo]es",
    "Copy": r"copy|copywriter|marketing direto",
    "Afiliados": r"afiliad",
    "Dropshipping e e-commerce": r"dropshipping|e-?commerce|loja",
    "Tráfego pago": r"tr[áa]fego|meta ads|google ads|youtube ads|ads\b|an[úu]ncios?",
    "Criativos e creators": r"criativ|creator|ugc|influenc",
    "Recuperação de vendas": r"recupera[çc][ãa]o",
    "Escala e faturamento": r"escal|faturand|fatur|milh[õo]es|\bmm\b|d[ií]gitos|\b\d+d\b",
}

# Notas de BASEX/MARKETING a ligar a cada tema (nome do arquivo sem .md), só se existirem
LIGACOES = {
    "Copy": ["Doc Copy", "Doc Criativos", "Copy Anti-IA - Padroes de Escrita Humana"],
    "Tráfego pago": ["Bid Cap Sem Mistério (Copy)", "Bloco 09 - Aula 1 - Funil de Vendas", "Bloco 09 - Aula 2 - Setup do Meta Ads"],
    "Criativos e creators": ["Doc Criativos", "Anatomia do Criativo - Hook Dev CTA"],
    "Dropshipping e e-commerce": ["Doc Introdução", "Doc Escolha de Paises", "Bloco 06 - Precificacao - Slides", "Doc Oferta e Precificação"],
    "Inteligência artificial": ["anthropic-growth-marketing-claude", "00. Comece Aqui"],
    "Escala e faturamento": ["Bloco 06 - Precificacao - Slides"],
}


def sem_acento(t):
    return unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()


def campo(txt, k):
    m = re.search(rf"^{k}: (.*)$", txt, re.M)
    return m.group(1).strip().strip('"') if m else ""


def parse_titulo(titulo):
    m = re.search(r"(?:\|\s*|\s[-–]\s)([^|]*?)\s*[-–]?\s*(?:Segredos da Escala|Scaling Secrets|SDE)\s*#?\s*(\d+)\s*$", titulo, re.I)
    if not m:
        return "", ""
    conv = re.sub(r"\s+", " ", m.group(1)).strip(" -–|")
    return conv, m.group(2)


def nome_arquivo(t):
    return re.sub(r'[\\/:*?"<>|#^\[\]]+', "", t).strip()


videos = []
for f in sorted(raiz.glob("*/*/*.md")):
    if f.name.endswith("-resumo.md"):
        continue
    txt = f.read_text(encoding="utf-8")
    titulo = campo(txt, "titulo")
    conv, ep = parse_titulo(titulo)
    base = sem_acento(titulo.lower())
    temas = [t for t, rx in TEMAS.items() if re.search(sem_acento(rx.lower()) if t != "Inteligência artificial" else rx, base)]
    videos.append(dict(data=campo(txt, "data"), titulo=titulo, url=campo(txt, "url"), f=f, txt=txt,
                       nome=f.stem, conv=conv, ep=ep, temas=temas,
                       resumo=f.with_name(f.stem + "-resumo.md").exists()))

videos.sort(key=lambda v: v["data"], reverse=True)

# INDEX.md
linhas = ["# Índice de vídeos VTURB\n", f"Total: {len(videos)} vídeos · hubs em `temas/` e `convidados/`\n",
          "| Data | Ep. | Título | Convidado | Temas |", "|---|---|---|---|---|"]
for v in videos:
    conv = f"[[{nome_arquivo(v['conv'])}]]" if v["conv"] else ""
    temas = ", ".join(f"[[{t}]]" for t in v["temas"])
    linhas.append(f"| {v['data']} | {v['ep']} | [[{v['nome']}]] | {conv} | {temas} |")
Path("INDEX.md").write_text("\n".join(linhas).replace("|", "\\|", 0) + "\n", encoding="utf-8")

# Hubs
for pasta in ("temas", "convidados"):
    Path(pasta).mkdir(exist_ok=True)
    for old in Path(pasta).glob("*.md"):
        old.unlink()

BASE_NOTAS = {p.stem for d in ("BASEX", "MARKETING") for p in Path(d).rglob("*.md")} if Path("BASEX").exists() else set()
por_tema, por_conv = {}, {}
for v in videos:
    for t in v["temas"]:
        por_tema.setdefault(t, []).append(v)
    if v["conv"]:
        por_conv.setdefault(v["conv"], []).append(v)

for t, vs in por_tema.items():
    corpo = [f"---\ntags: [tema, vturb]\n---\n# {t}\n", f"{len(vs)} vídeos da VTURB sobre este tema.\n"]
    corpo += [f"- {v['data']} · [[{v['nome']}]]" for v in vs]
    lig = [n for n in LIGACOES.get(t, []) if n in BASE_NOTAS]
    if lig:
        corpo += ["", "## Material relacionado (BASEX / MARKETING)"] + [f"- [[{n}]]" for n in lig]
    Path(f"temas/{nome_arquivo(t)}.md").write_text("\n".join(corpo) + "\n", encoding="utf-8")

for c, vs in por_conv.items():
    corpo = [f"---\ntags: [convidado, vturb]\n---\n# {c}\n", f"{len(vs)} episódio(s) no canal VTURB.\n"]
    corpo += [f"- {v['data']} · [[{v['nome']}]]" for v in vs]
    temas = sorted({t for v in vs for t in v["temas"]})
    if temas:
        corpo += ["", "## Temas"] + [f"- [[{t}]]" for t in temas]
    Path(f"convidados/{nome_arquivo(c)}.md").write_text("\n".join(corpo) + "\n", encoding="utf-8")

# conhecimento/AAAA.md
Path("conhecimento").mkdir(exist_ok=True)
anos = {}
for v in videos:
    corpo = v["txt"].split("---", 2)[-1].strip()
    anos.setdefault(v["data"][:4], []).append(f"\n\n---\n\n{corpo}\n\nFonte: {v['url']} ({v['data']})")
for ano, partes in anos.items():
    Path(f"conhecimento/{ano}.md").write_text(f"# Transcrições VTURB {ano}" + "".join(partes) + "\n", encoding="utf-8")

sem_conv = sum(1 for v in videos if not v["conv"])
print(f"{len(videos)} vídeos; {len(por_tema)} temas; {len(por_conv)} convidados; {sem_conv} sem convidado identificado; anos: {sorted(anos)}")
