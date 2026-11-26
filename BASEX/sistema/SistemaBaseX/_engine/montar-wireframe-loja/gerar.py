#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
montar-wireframe-loja · gerador
Le um perfil de nicho (perfis/{slug}.json) e escreve o documento de wireframe
em HTML standalone (mais PDF opcional). Fonte canonica da skill:
"03. Skills/99. Desenhar a Loja Antes de Montar.md".

  python3 gerar.py perfis/x.json --preflight
  python3 gerar.py perfis/x.json --dry-run
  python3 gerar.py perfis/x.json --pdf --abrir
  python3 gerar.py perfis/x.json --cor destaque=#7A2E3B secundaria=#F7EFF0 --marca "Casa Nova"
"""
import argparse, json, os, re, subprocess, sys, unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
VAULT = RAIZ.parent.parent
SAIDA_PADRAO = VAULT / "06. Anexos" / "Apresentações"

PAPEIS = {"destaque": "brand", "secundaria": "soft", "preto": "ink", "branco": "branco",
          "ganho": "gain", "ganho_fundo": "gainbg", "borda": "line"}
HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")

# Simbolo de moeda do documento. Trocado por --moeda.
MOEDA = "€"
# Assinatura do documento. Padrao: a propria marca da loja.
# Quem produz para terceiro troca com --assinatura.
ASSINATURA = ""


def marca_mark(p):
    """Brandmark da capa: a marca da loja, com separador no meio quando cabe."""
    nome = str(p.get("marca", "")).strip() or "SUA MARCA"
    partes = nome.upper().split()
    if len(partes) >= 2:
        return e(partes[0]) + '<i>·</i>' + e(" ".join(partes[1:]))
    return e(nome)

# ---------------------------------------------------------------- pre-flight
STOP_PT = {"de","da","do","das","dos","com","sem","para","por","que","voce","seu","sua","frete",
           "gratis","compre","leve","tamanho","cor","carrinho","comprar","entrega","desconto",
           "avaliacoes","produto","colecao","loja","peca","pecas","calca","conjunto"}

def sem_acento(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")

def parece_portugues(txt):
    t = sem_acento(txt).lower()
    if any(unicodedata.category(c) == "Mn" for c in unicodedata.normalize("NFD", txt)):
        return True
    palavras = set(re.findall(r"[a-z]+", t))
    return bool(palavras & STOP_PT)

def coletar_textos_loja(no, achados, caminho=""):
    """Percorre o perfil e junta tudo que o cliente final le na tela."""
    CHAVES = {"texto","cta","titulo_en","label_en","nota","msg","itens_en","abas","chips",
              "acordeoes","colunas","prova","badge","preco_label","filtros","placeholder_en",
              "urgencia","faixa","degraus","garantia","faixa_meio","variante_en","sugestao_en",
              "frete_en","labels","badge2"}
    if isinstance(no, dict):
        for k, v in no.items():
            p = f"{caminho}.{k}" if caminho else k
            if k in CHAVES:
                itens = [v] if isinstance(v, str) else (list(v.values()) if isinstance(v, dict) else (v if isinstance(v, list) else []))
                for s in itens:
                    if isinstance(s, str) and s.strip():
                        achados.append((p, s))
                    elif isinstance(s, dict):
                        for sv in s.values():
                            for x in ([sv] if isinstance(sv, str) else (sv if isinstance(sv, list) else [])):
                                if isinstance(x, str) and x.strip():
                                    achados.append((p, x))
            else:
                coletar_textos_loja(v, achados, p)
    elif isinstance(no, list):
        for i, v in enumerate(no):
            coletar_textos_loja(v, achados, f"{caminho}[{i}]")

def preflight(perfil):
    erros = []
    for campo in ("nicho","slug","marca","paleta","oferta","telas","referencias"):
        if not perfil.get(campo):
            erros.append(f"campo obrigatorio ausente: {campo}")
    if erros:
        return erros

    pal = perfil["paleta"]
    marca_cores = [k for k in pal if k not in ("gain","gainbg","line")]
    if sorted(marca_cores) != ["branco","brand","ink","soft"]:
        erros.append(f"regra das quatro cores: esperado brand, branco, ink, soft. veio {sorted(marca_cores)}")
    for k, v in pal.items():
        if not HEX.match(str(v)):
            erros.append(f"cor fora do formato #RRGGBB: paleta.{k} = {v}")

    of = perfil["oferta"]
    for campo in ("faixa","degraus","heroi","frete_gratis","garantia"):
        if not of.get(campo):
            erros.append(f"oferta incompleta: falta {campo}")
    her = of.get("heroi", {})
    for campo in ("nome","preco","de"):
        if her.get(campo) in (None, ""):
            erros.append(f"oferta.heroi incompleto: falta {campo}")
    if not of.get("carrinho_estados"):
        erros.append("oferta sem carrinho_estados (os estados sao calculados, nunca inventados)")

    pdp = perfil["telas"].get("pdp", {})
    def tem_chips(no):
        if isinstance(no, dict):
            return bool(no.get("chips")) or any(tem_chips(v) for v in no.values())
        if isinstance(no, list):
            return any(tem_chips(v) for v in no)
        return False
    tem_tamanho = tem_chips(pdp.get("desktop", []))
    sc = [b for b in pdp.get("desktop", []) if b.get("tipo") == "size_chart"]
    if tem_tamanho and not sc:
        erros.append("a tela de produto tem seletor de tamanho e nao tem size_chart")
    for b in sc:
        ncol = len(b.get("colunas", []))
        for i, linha in enumerate(b.get("linhas", [])):
            if len(linha) != ncol:
                erros.append(f"size_chart: linha {i+1} tem {len(linha)} celulas para {ncol} colunas")
        if not b.get("nota"):
            erros.append("size_chart sem nota ensinando a medir em casa")

    achados = []
    coletar_textos_loja(perfil["telas"], achados)
    coletar_textos_loja(perfil["oferta"], achados)
    for campo, txt in achados:
        if parece_portugues(txt):
            erros.append(f"texto de loja fora do ingles em {campo}: \"{txt}\"")
    return erros

# ---------------------------------------------------------------- utilidades
def e(s):
    return (str(s).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;"))

def rot(num, txt):
    n = f'<span class="n">{num}</span>' if num else ""
    return f'<div class="lb">{n}{e(txt)}</div>'

def moeda(v):
    return (MOEDA + f"{v:,.2f}").replace(",", "X").replace(".", ",").replace("X", ".")


def so_numero(txt):
    """Le preco escrito com qualquer simbolo de moeda: 79,90 / €79,90 / $79.90 / R$ 79,90."""
    bruto = re.sub(r"[^0-9,.]", "", str(txt))
    if not bruto:
        raise SystemExit(f"preco sem numero no perfil: {txt!r}")
    if "," in bruto and "." in bruto:
        bruto = bruto.replace(".", "") if bruto.rfind(",") > bruto.rfind(".") else bruto.replace(",", "")
    bruto = bruto.replace(",", ".")
    try:
        return float(bruto)
    except ValueError:
        raise SystemExit(f"preco que o gerador nao consegue ler: {txt!r}")

# ---------------------------------------------------------------- blocos
def bl_band(b, ctx):
    cls = "band soft" if b.get("variante") == "soft" else "band"
    return f'<div class="{cls}">{e(b["texto"])}</div>'

def bl_header(b, ctx):
    return (f'<div class="shophead"><div class="logo">{e(ctx["marca"])}</div>'
            '<div class="navdots"><i></i><i></i><i></i><i></i></div>'
            '<div class="icons"><i></i><i></i><i></i></div></div>')

def bl_hero(b, ctx):
    cta = f'<div style="padding:0 12px 10px"><div class="cta" style="max-width:150px">{e(b["cta"])}</div></div>' if b.get("cta") else ""
    return (rot(b.get("n"), b["rotulo"]) +
            f'<div style="padding:0 12px"><div class="ph tall">{e(b.get("placeholder_en",""))}</div></div>' +
            cta)

def _pcard(badge, stars, mini=False):
    tag = f'<span class="tag save">{e(badge)}</span>' if badge else ""
    st = '<span class="stars">★★★★★</span>' if stars else '<span class="tb w45" style="display:block;width:38px"></span>'
    return (f'<div class="pcard{" mini" if mini else ""}">{tag}<div class="ph"></div>'
            f'<div class="meta">{st}<span class="tb w30" style="width:22px;margin:0"></span></div></div>')

def bl_vitrine(b, ctx):
    cols = b.get("cols", 4)
    cards = "".join(_pcard(b.get("badge"), b.get("stars", True)) for _ in range(cols))
    extra = ""
    if b.get("linha2"):
        extra = f'<div class="pgrid c{cols}" style="margin-top:8px">' + \
                "".join(_pcard(b.get("badge2", b.get("badge")), b.get("stars", True)) for _ in range(cols)) + "</div>"
    return rot(b.get("n"), b["rotulo"]) + f'<div class="pgrid c{cols}">{cards}</div>' + extra

def bl_categorias(b, ctx):
    itens = b.get("itens_en", [])
    cards = "".join(f'<div class="ph low">{e(i)}</div>' for i in itens)
    return rot(b.get("n"), b["rotulo"]) + f'<div class="pgrid c{len(itens) or 4}">{cards}</div>'

def bl_look(b, ctx):
    return (rot(b.get("n"), b["rotulo"]) +
            '<div style="padding:0 12px;display:grid;grid-template-columns:1.4fr 1fr;gap:8px">'
            f'<div class="ph mid">{e(b.get("placeholder_en",""))}</div>'
            '<div><div class="tb w90"></div><div class="tb w60"></div>'
            f'<div class="cta" style="margin-top:8px">{e(b["cta"])}</div></div></div>')

def bl_feature(b, ctx):
    cols = b.get("itens_en", [])
    blocos = "".join(f'<div><div class="ph low"></div><div style="font-size:8px;letter-spacing:.07em;'
                     f'text-transform:uppercase;color:#8B8781;font-weight:600;margin-top:4px">{e(c)}</div></div>'
                     for c in cols)
    return rot(b.get("n"), b["rotulo"]) + f'<div class="pgrid c{len(cols) or 3}">{blocos}</div>'

def bl_ugc(b, ctx):
    cards = "".join('<div class="ph low"></div>' for _ in range(5))
    return rot(b.get("n"), b["rotulo"]) + f'<div class="pgrid c5">{cards}</div>'

def bl_trust(b, ctx):
    itens = "".join(f'<div style="text-align:center"><div style="width:14px;height:14px;border-radius:3px;'
                    f'background:var(--wire);margin:0 auto 4px"></div>'
                    f'<div style="font-size:8px;color:#8B8781;letter-spacing:.06em">{e(i)}</div></div>'
                    for i in b.get("itens_en", []))
    return (rot(b.get("n"), b["rotulo"]) +
            f'<div style="padding:8px 12px;display:grid;grid-template-columns:repeat({len(b.get("itens_en",[]))},1fr);'
            f'gap:8px;background:var(--soft)">{itens}</div>')

def bl_vip(b, ctx):
    return (rot(b.get("n"), b["rotulo"]) +
            '<div style="padding:0 12px 12px;display:grid;grid-template-columns:1fr 90px;gap:6px;align-items:center">'
            '<div style="border:1px solid var(--wire);border-radius:3px;height:22px"></div>'
            f'<div class="cta">{e(b["cta"])}</div></div>')

def bl_capa_colecao(b, ctx):
    return (rot(b.get("n"), b["rotulo"]) +
            f'<div style="padding:0 12px"><div class="ph mid">{e(b.get("placeholder_en",""))}</div></div>')

def bl_abas(b, ctx):
    abas = "".join(f'<span class="chip{" on" if i == 0 else ""}">{e(a)}</span>' for i, a in enumerate(b.get("abas", [])))
    return (rot(b.get("n"), b["rotulo"]) +
            f'<div style="padding:0 12px;display:flex;justify-content:space-between;align-items:center;gap:8px">'
            f'<div class="chips">{abas}</div>'
            f'<span class="chip">{e(b.get("cta","sort by ∨"))}</span></div>')

def bl_grade_filtro(b, ctx):
    grupos = ""
    for g in b.get("filtros", []):
        if isinstance(g, dict):
            nome, valores = g.get("nome"), g.get("valores", [])
        else:
            nome, valores = g, []
        chips = "".join(f'<span class="chip">{e(v)}</span>' for v in valores)
        corpo = f'<div class="chips">{chips}</div>' if chips else '<div class="tb w75"></div><div class="tb w45"></div>'
        grupos += f'<div class="fgroup"><h4>{e(nome)}</h4>{corpo}</div>'
    fila = lambda badge: '<div class="pgrid c4" style="padding:0">' + "".join(_pcard(badge, True) for _ in range(4)) + "</div>"
    faixa = (f'<div class="band alt" style="margin:8px 0">{e(b["faixa_meio"])}</div>') if b.get("faixa_meio") else ""
    return (rot(b.get("n"), b["rotulo"]) +
            '<div style="padding:0 12px;display:grid;grid-template-columns:88px 1fr;gap:12px">'
            f'<div class="filters">{grupos}</div>'
            f'<div>{fila(b.get("badge"))}<div style="height:8px"></div>{fila(b.get("badge2", b.get("badge")))}'
            f'{faixa}{fila(b.get("badge"))}'
            f'<div class="cta ghost" style="margin-top:10px;max-width:120px;margin-left:auto;margin-right:auto">'
            f'{e(b.get("cta","LOAD MORE"))}</div></div></div>')

def bl_texto_colecao(b, ctx):
    return (rot(b.get("n"), b["rotulo"]) +
            '<div style="padding:0 12px 12px"><div class="tb w90"></div><div class="tb w90"></div>'
            '<div class="tb w75"></div><div class="tb w45"></div></div>')

def bl_galeria(b, ctx):
    minis = "".join('<div class="ph" style="min-height:26px"></div>' for _ in range(5))
    return (f'<div style="padding:0 0 0 0"><div class="pgrid c1" style="padding:0 12px;grid-template-columns:1fr">'
            f'<div class="ph tall">{e(b.get("placeholder_en",""))}</div></div>'
            f'<div class="pgrid c5" style="margin-top:6px">{minis}</div></div>')

def bl_pdp_info(b, ctx):
    of = ctx["oferta"]
    pad = b.get("padding", "10px 12px 0")
    chips = "".join(f'<span class="chip{" on" if i == 1 else ""}">{e(c)}</span>' for i, c in enumerate(b.get("chips", [])))
    cores = "".join('<span class="swatchdot"></span>' for _ in range(4))
    acc = "".join(f'<div class="acc"><b>{e(a)}</b><span>+</span></div>' for a in b.get("acordeoes", []))
    return (f'<div style="padding:{pad}">'
            f'{rot(b.get("n_badge"), b["rotulo_badge"])}'
            f'<div style="padding:0"><span class="chip">{e(b["badge"])}</span></div>'
            f'{rot(b.get("n_titulo"), b["rotulo_titulo"])}'
            f'<div class="tb w75 dark" style="height:9px"></div>'
            f'<div style="display:flex;gap:8px;align-items:center;margin:5px 0 0">'
            f'<span class="stars">★★★★★</span><span class="rev">{e(b["prova"])}</span></div>'
            f'{rot(b.get("n_preco"), b["rotulo_preco"])}'
            f'<div style="display:flex;gap:9px;align-items:baseline">'
            f'<b style="font-size:14px;color:var(--brand)">{e(of["heroi"]["preco"])}</b>'
            f'<s style="font-size:9.5px;color:#9A9793">{e(of["heroi"]["de"])}</s>'
            f'<span class="save">{e(of["heroi"]["save"])}</span></div>'
            f'{rot(b.get("n_chips"), b["rotulo_chips"])}'
            f'<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">{cores}</div>'
            f'<div class="chips">{chips}</div>'
            f'<div style="font-size:8.5px;color:var(--gain);font-weight:600;margin-top:6px">{e(b["urgencia"])}</div>'
            f'{rot(b.get("n_cta"), b["rotulo_cta"])}'
            f'<div class="cta">{e(b["cta"])}</div>'
            f'<div class="band" style="margin-top:7px">{e(of["degraus"])}</div>'
            f'<div style="margin-top:8px">{acc}</div></div>')

def bl_pdp_topo(b, ctx):
    g, i = b["galeria"], b["info"]
    return (rot(g.get("n"), g["rotulo"]) +
            '<div style="padding:0 12px;display:grid;grid-template-columns:1.15fr 1fr;gap:12px;align-items:start">'
            f'<div><div class="ph tall">{e(g.get("placeholder_en",""))}</div>'
            '<div class="pgrid c5" style="padding:0;margin-top:6px">' +
            "".join('<div class="ph" style="min-height:26px"></div>' for _ in range(5)) +
            f'</div></div><div>{bl_pdp_info(i, ctx)}</div></div>')


def bl_dobra(b, ctx):
    cols = "".join(f'<div style="border:1px solid var(--line);border-radius:5px;padding:9px">'
                   f'<div style="font-size:8px;letter-spacing:.09em;text-transform:uppercase;color:#8B8781;'
                   f'font-weight:700;margin-bottom:5px">{e(c["rotulo"])}</div>'
                   f'<div style="font-size:8.5px;color:var(--muted);line-height:1.45">{e(c["texto"])}</div>'
                   f'<div class="tb w90" style="margin-top:6px"></div><div class="tb w60"></div></div>'
                   for c in b.get("colunas_dobra", []))
    return (rot(b.get("n"), b["rotulo"]) +
            f'<div style="padding:0 12px;display:grid;grid-template-columns:repeat({len(b.get("colunas_dobra",[]))},1fr);gap:8px">{cols}</div>')

def bl_size_chart(b, ctx):
    th = "".join(f"<th>{e(c)}</th>" for c in b["colunas"])
    trs = "".join("<tr>" + "".join(f"<td>{e(c)}</td>" for c in l) + "</tr>" for l in b["linhas"])
    return (rot(b.get("n"), b["rotulo"]) +
            f'<div style="padding:0 12px 4px"><table><thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table>'
            f'<div class="tnote">{e(b["nota"])}</div></div>')

def bl_complete(b, ctx):
    cards = "".join(_pcard(b.get("badge"), True) for _ in range(4))
    return rot(b.get("n"), b["rotulo"]) + f'<div class="pgrid c4">{cards}</div>'

def bl_foot(b, ctx):
    return ('<div style="padding:10px 12px;background:var(--brand);margin-top:10px;display:grid;'
            'grid-template-columns:repeat(4,1fr);gap:8px">' +
            "".join('<div><div class="tb w60" style="background:rgba(255,255,255,.45)"></div>'
                    '<div class="tb w45" style="background:rgba(255,255,255,.28)"></div>'
                    '<div class="tb w45" style="background:rgba(255,255,255,.28)"></div></div>'
                    for _ in range(4)) + "</div>")

def bl_html(b, ctx):
    return b.get("html", "")

# --------- blocos de celular
def bl_m_hero(b, ctx):
    return (rot(b.get("n"), b["rotulo"]) +
            f'<div style="padding:0 8px"><div class="ph mid"></div>'
            f'<div class="cta" style="margin-top:6px">{e(b["cta"])}</div></div>')

def bl_m_vitrine(b, ctx):
    cards = "".join(_pcard(b.get("badge"), True, mini=True) for _ in range(3))
    return (rot(b.get("n"), b["rotulo"]) +
            f'<div class="pgrid c3" style="margin-right:-14px">{cards}</div>')

def bl_m_grade(b, ctx):
    cards = "".join(_pcard(b.get("badge"), True, mini=True) for _ in range(6))
    return rot(b.get("n"), b["rotulo"]) + f'<div class="pgrid c2">{cards}</div>' + \
           f'<div class="cta ghost" style="margin:8px 8px 0">{e(b.get("cta","LOAD MORE"))}</div>'

def bl_m_look(b, ctx):
    return (rot(b.get("n"), b["rotulo"]) +
            f'<div style="padding:0 8px"><div class="ph low"></div>'
            f'<div class="cta" style="margin-top:6px">{e(b["cta"])}</div></div>')

def bl_m_trust(b, ctx):
    itens = "".join(f'<div style="text-align:center;font-size:6.5px;color:#8B8781;letter-spacing:.04em">{e(i)}</div>'
                    for i in b.get("itens_en", []))
    return (f'<div style="margin-top:8px;padding:7px 8px;background:var(--soft);display:grid;'
            f'grid-template-columns:repeat({len(b.get("itens_en",[]))},1fr);gap:5px">{itens}</div>')

def bl_m_vip(b, ctx):
    return ('<div style="padding:8px">'
            '<div style="border:1px solid var(--wire);border-radius:3px;height:18px;margin-bottom:5px"></div>'
            f'<div class="cta">{e(b["cta"])}</div></div>')

def bl_m_capa(b, ctx):
    return rot(b.get("n"), b["rotulo"]) + '<div style="padding:0 8px"><div class="ph low"></div></div>'

def bl_m_filtros(b, ctx):
    chips = "".join(f'<span class="chip">{e(c)}</span>' for c in b.get("chips", []))
    return f'<div style="padding:6px 8px 0"><div class="chips">{chips}</div></div>'

def bl_m_barra_fixa(b, ctx):
    return f'<div class="band" style="margin-top:8px">{e(b["texto"])}</div>'

def bl_m_galeria(b, ctx):
    return rot(b.get("n"), b["rotulo"]) + '<div style="padding:0 8px"><div class="ph mid"></div></div>'

def bl_m_pdp(b, ctx):
    of = ctx["oferta"]
    chips = "".join(f'<span class="chip{" on" if i == 1 else ""}">{e(c)}</span>' for i, c in enumerate(b.get("chips", [])))
    return (f'<div style="padding:6px 8px 0">'
            f'<div style="display:flex;gap:6px;align-items:center"><span class="stars">★★★★★</span>'
            f'<span class="rev" style="font-size:7px">{e(b["prova"])}</span></div>'
            f'<div style="display:flex;gap:6px;align-items:baseline;margin-top:4px">'
            f'<b style="font-size:11px;color:var(--brand)">{e(of["heroi"]["preco"])}</b>'
            f'<s style="font-size:8px;color:#9A9793">{e(of["heroi"]["de"])}</s>'
            f'<span class="save">{e(of["heroi"]["save"])}</span></div></div>' +
            rot(b.get("n"), b["rotulo"]) +
            f'<div style="padding:0 8px"><div class="chips">{chips}</div></div>')

def bl_m_acordeao(b, ctx):
    acc = "".join(f'<div class="acc" style="font-size:7.5px"><b>{e(a)}</b><span>+</span></div>'
                  for a in b.get("acordeoes", []))
    return f'<div style="padding:0 8px">{acc}</div>'

def bl_m_size(b, ctx):
    th = "".join(f"<th>{e(c)}</th>" for c in b["colunas"])
    trs = "".join("<tr>" + "".join(f"<td>{e(c)}</td>" for c in l) + "</tr>" for l in b["linhas"])
    return (rot(b.get("n"), b["rotulo"]) +
            f'<div style="padding:0 8px"><table><thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table></div>')

def bl_m_reviews(b, ctx):
    return rot(b.get("n"), b["rotulo"]) + \
        '<div class="pgrid c3" style="padding:0 8px">' + "".join('<div class="ph" style="min-height:34px"></div>' for _ in range(3)) + "</div>"

def bl_m_stickybuy(b, ctx):
    of = ctx["oferta"]
    return (f'<div class="stickybuy"><span class="n">{e(b.get("n",""))}</span>'
            f'<span class="price">{e(of["heroi"]["preco"])}</span>'
            f'<span class="cta">{e(b["cta"])}</span></div>')

BLOCOS = {k[3:]: v for k, v in list(globals().items()) if k.startswith("bl_")}

def montar_blocos(lista, ctx):
    out = []
    for b in lista:
        f = BLOCOS.get(b.get("tipo"))
        if not f:
            raise SystemExit(f"tipo de bloco desconhecido: {b.get('tipo')}")
        out.append(f(b, ctx))
    return "".join(out)

# ---------------------------------------------------------------- telas
def tela_desktop(tela, ctx, url, fit=True):
    ab, fb = ('<div class="autofit">', "</div>") if fit else ("", "")
    return (f'{ab}<div class="browser"><div class="urlbar"><span class="dot"></span><span class="dot"></span>'
            f'<span class="dot"></span><span class="url">{e(url)}</span></div>'
            f'<div class="screen">{montar_blocos(tela["desktop"], ctx)}</div></div>{fb}')

def tela_mobile(tela, ctx, solo=False):
    return (f'<div class="phone{" solo" if solo else ""}">{montar_blocos(tela["mobile"], ctx)}</div>')

def carrinho(estado, ctx):
    of = ctx["oferta"]
    steps = "".join(f'<div class="step{" on" if s["on"] else ""}"><i></i><span>{e(s["label_en"])}</span></div>'
                    for s in estado["degraus"])
    linhas = "".join('<div class="line"><div class="ph"></div><div class="info">'
                     '<div class="tb w75"></div>'
                     f'<div class="v">{e(estado["variante_en"])}</div></div>'
                     '<span class="chip">1</span></div>' for _ in range(estado["itens"]))
    sug = ('<div class="line" style="background:#FBFAF8"><div class="ph"></div><div class="info">'
           '<div class="tb w60"></div>'
           f'<div class="v">{e(estado["sugestao_en"])}</div></div><span class="chip">+</span></div>'
           ) if estado.get("sugestao_en") else ""
    frete = (f'<div style="padding:5px 10px;font-size:8px;color:var(--gain);font-weight:700;letter-spacing:.04em">'
             f'{e(estado["frete_en"])}</div>') if estado.get("frete_en") else ""
    return (f'<div class="cart"><div class="head"><b>{e(estado["titulo_en"])}</b><span class="chip">×</span></div>'
            f'<div class="msg">{e(estado["msg"])}</div>'
            f'<div class="steps">{steps}</div>'
            f'{linhas}{sug}{frete}'
            f'<div class="sum"><div><span>{e(of["labels"]["subtotal"])}</span><span>{moeda(estado["subtotal"])}</span></div>'
            f'<div class="{"gain" if estado["economia"] > 0 else ""}"><span>{e(of["labels"]["economia"])}</span>'
            f'<b>{moeda(estado["economia"])}</b></div>'
            f'<div class="total"><span>{e(of["labels"]["total"])}</span><span>{moeda(estado["total"])}</span></div>'
            f'<div class="cta" style="margin-top:7px">{e(of["labels"]["checkout"])}</div></div></div>')

# ---------------------------------------------------------------- documento
def documento(p):
    pal, of, t = p["paleta"], p["oferta"], p["telas"]
    ctx = {"marca": p["marca"], "oferta": of}
    css = (RAIZ / "css-base.css").read_text(encoding="utf-8")
    root = (f":root{{--brand:{pal['brand']};--soft:{pal['soft']};--ink:{pal['ink']};"
            f"--gain:{pal['gain']};--gainbg:{pal['gainbg']};--line:{pal.get('line','#E4E1DC')}}}")

    legenda = "".join(f'<div class="leg"><span class="sq" style="{l["css"]}"></span><span>{e(l["texto"])}</span></div>'
                      for l in p["legenda"])
    swatches = "".join(f'<div class="swatch"><div class="fill" style="background:{c["hex"]};'
                       f'{"border-bottom:1px solid var(--line)" if c["hex"].upper() == "#FFFFFF" else ""}"></div>'
                       f'<div class="txt"><b>{e(c["nome"])}</b><code>{c["hex"]}</code><p>{e(c["papel"])}</p></div></div>'
                       for c in p["swatches"])

    estados = "".join(carrinho(s, ctx) for s in of["carrinho_estados"])
    mec = "".join(f'<li>{e(m)}</li>' for m in p["carrinho_mecanica"])
    passos = "".join(f'<li><i>&rarr;</i><span>{e(s)}</span></li>' for s in p["proximos_passos"])

    def decisoes(lista):
        return '<div class="dec"><h3>As decisões que estão neste desenho</h3><ul>' + \
               "".join(f'<li>{e(d)}</li>' for d in lista) + "</ul></div>"

    def slide_tela(num, eyebrow, titulo, lead, chave, url, cap_d, cap_m):
        tela = t[chave]
        return f'''
<section class="slide">
  <div class="eyebrow">{eyebrow}</div>
  <h1>{e(titulo)}</h1>
  <p class="lead">{e(lead)}</p>
  {tela_desktop(tela, ctx, url)}
  <div class="cap">{e(cap_d)}</div>
  {decisoes(tela["decisoes"])}
  <div class="foot-note">{e(p["nicho"])} · {e(p["marca"])} · wireframe</div>
</section>
<section class="slide">
  <div class="eyebrow">{eyebrow} · celular</div>
  <h2>A mesma página no celular</h2>
  <p class="lead">{e(tela["nota_mobile"])}</p>
  <div class="autofit"><div class="phones">{tela_mobile(tela, ctx, solo=True)}</div></div>
  <div class="cap">{e(cap_m)}</div>
  {decisoes(tela["decisoes_mobile"])}
  <div class="foot-note">{e(p["nicho"])} · {e(p["marca"])} · wireframe</div>
</section>'''

    over_d = "".join(f'<div><div class="ovtitle"><span class="n">{i+1}</span>{e(o["titulo"])}</div>'
                     f'{tela_desktop(t[o["chave"]], ctx, o["url"], fit=False)}</div>'
                     for i, o in enumerate(p["visao_geral"]))
    over_m = "".join(f'<div><div class="ovtitle"><span class="n">{i+1}</span>{e(o["titulo"])}</div>'
                     f'{tela_mobile(t[o["chave"]], ctx)}</div>' for i, o in enumerate(p["visao_geral"])) + \
             f'<div><div class="ovtitle"><span class="n">4</span>CARRINHO</div>{carrinho(of["carrinho_estados"][1], ctx)}</div>'

    return f'''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="light">
<style>:root{{color-scheme:only light}}</style>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wireframe da Loja · {e(p["nicho"])} · {e(p["marca"])}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
{root}
{css}
</style>
</head>
<body>

<div class="toolbar">
  <div><b>Base·X · Wireframe da Loja</b> <span>{e(p["nicho"])}</span></div>
  <button onclick="window.print()">Salvar como PDF</button>
</div>

<section class="slide dark cover">
  <div class="brandmark">{marca_mark(p)}</div>
  <div class="eyebrow">wireframe da loja · edição 2026</div>
  <h1>{e(p["capa"]["titulo"])}</h1>
  <p class="lead">{e(p["capa"]["subtitulo"])}</p>
  <div class="cover-meta">
    <span class="pill">nicho {e(p["nicho"].lower())}</span>
    <span class="credit">{e(ASSINATURA)} · v1.0</span>
  </div>
</section>

<section class="slide">
  <div class="eyebrow">0 0 · como ler este documento</div>
  <h1>Isto é a planta da casa,<br>não a casa pintada.</h1>
  <p class="lead">{e(p["como_ler"])}</p>
  <h3>A legenda</h3>
  <div class="legend">{legenda}</div>
  <h3>A oferta que sustenta todas as telas</h3>
  <p style="font-size:12.5px;line-height:1.65;color:var(--muted);margin-bottom:18px">{e(p["oferta_texto"])}</p>
  <h3>Quatro cores, e só</h3>
  <p style="font-size:12.5px;line-height:1.65;color:var(--muted)">{e(p["paleta_texto"])}</p>
  <div class="sw">{swatches}</div>
  <div class="card"><h3>Por que isto importa</h3><p>{e(p["porque_importa"])}</p></div>
  <div class="foot-note">{e(p["nicho"])} · {e(p["marca"])} · wireframe</div>
</section>

<section class="slide">
  <div class="eyebrow">0 1 · visão geral</div>
  <h1>A loja inteira<br>numa olhada só.</h1>
  <p class="lead">{e(p["visao_geral_lead"])}</p>
  <div class="autofit">
    <h3>No computador</h3>
    <div class="overview">{over_d}</div>
    <h3 style="margin-top:18px">No celular, que é de onde vem quase todo o tráfego</h3>
    <div class="overview" style="grid-template-columns:repeat(4,1fr)">{over_m}</div>
  </div>
  <div class="card" style="margin-top:18px"><h3>O caminho que o cliente faz</h3><p>{e(p["caminho_cliente"])}</p></div>
  <div class="foot-note">{e(p["nicho"])} · {e(p["marca"])} · wireframe</div>
</section>

{slide_tela(2, "0 2 · página inicial", t["home"]["titulo"], t["home"]["lead"], "home", p["urls"]["home"], "página inicial no computador", "página inicial no celular")}
{slide_tela(3, "0 3 · página de coleção", t["collection"]["titulo"], t["collection"]["lead"], "collection", p["urls"]["collection"], "página de coleção no computador", "página de coleção no celular")}
{slide_tela(4, "0 4 · página de produto", t["pdp"]["titulo"], t["pdp"]["lead"], "pdp", p["urls"]["pdp"], "página de produto no computador", "página de produto no celular")}

<section class="slide">
  <div class="eyebrow">0 5 · carrinho lateral</div>
  <h1>O carrinho não é uma sacola.<br>É a última chance de vender.</h1>
  <p class="lead">{e(p["carrinho_lead"])}</p>
  <div class="autofit"><div class="carts">{estados}</div></div>
  <div class="cartcap">os 3 estados do carrinho lateral</div>
  <div class="dec"><h3>Como a mecânica funciona</h3><ul>{mec}</ul></div>
  <div class="card"><h3>O detalhe que muda o resultado</h3><p>{e(p["carrinho_detalhe"])}</p></div>
  <div class="foot-note">{e(p["nicho"])} · {e(p["marca"])} · wireframe</div>
</section>

<section class="slide">
  <div class="eyebrow">0 6 · próximos passos</div>
  <h1>O que acontece<br>a partir daqui.</h1>
  <p class="lead">{e(p["proximos_lead"])}</p>
  <ul class="steps-next">{passos}</ul>
  <div class="card"><h3>O que precisamos de você agora</h3><p>{e(p["pedido_final"])}</p></div>
  <div class="foot-note">{e(p["nicho"])} · {e(p["marca"])} · wireframe</div>
</section>

<section class="slide dark cover">
  <div class="brandmark">{marca_mark(p)}</div>
  <div class="eyebrow">wireframe da loja</div>
  <h1>Estrutura desenhada.<br>Agora é construir.</h1>
  <div class="cover-meta">
    <span class="credit">{e(ASSINATURA)}</span>
    <span class="pill">nicho {e(p["nicho"].lower())} · v1.0</span>
  </div>
</section>

<script>
window.addEventListener('load',function(){{
  var LIM=1123;  // min-height do slide: so encolhe quem passa disso
  document.querySelectorAll('.slide').forEach(function(s){{
    var alvo=s.querySelector('.autofit');
    if(!alvo) return;
    var k=1;
    for(var i=0;i<24 && s.getBoundingClientRect().height>LIM;i++){{k-=0.025;alvo.style.zoom=k.toFixed(3);}}
  }});
}});
</script>
</body>
</html>'''

# ---------------------------------------------------------------- validacao
def validar_saida(html, p):
    erros = []
    if "—" in html or "–" in html:
        erros.append("travessão encontrado no documento (usar vírgula, ponto ou dois-pontos)")
    if 'name="color-scheme"' not in html or "color-scheme:only light" not in html:
        erros.append("guarda de contraste ausente (meta color-scheme)")
    if ".slide.dark .card" not in html:
        erros.append("guarda de contraste ausente (componente claro em slide escuro)")
    if f'class="credit">{e(ASSINATURA)}' not in html:
        erros.append("assinatura ausente no documento")
    her = p["oferta"]["heroi"]
    unit = so_numero(her["preco"])
    for s in p["oferta"]["carrinho_estados"]:
        sub = round(unit * s["itens"], 2)
        eco = round(sub * s["desconto"], 2)
        tot = round(sub - eco, 2)
        for nome, calc, decl in (("subtotal", sub, s["subtotal"]), ("economia", eco, s["economia"]), ("total", tot, s["total"])):
            if abs(calc - float(decl)) > 0.011:
                erros.append(f"carrinho estado {s['itens']}: {nome} declarado {decl}, calculado {calc}")
    return erros

# ---------------------------------------------------------------- cli
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("perfil")
    ap.add_argument("--preflight", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--pdf", action="store_true")
    ap.add_argument("--abrir", action="store_true")
    ap.add_argument("--marca")
    ap.add_argument("--saida")
    ap.add_argument("--cor", nargs="*", default=[])
    ap.add_argument("--moeda", default="€", help="simbolo de moeda dos precos calculados (padrao €)")
    ap.add_argument("--assinatura", help="quem assina o documento (padrao: a marca da loja)")
    a = ap.parse_args()

    global MOEDA, ASSINATURA
    MOEDA = a.moeda

    p = json.loads(Path(a.perfil).read_text(encoding="utf-8"))
    if a.marca:
        p["marca"] = a.marca
    ASSINATURA = a.assinatura or p.get("marca") or "sua marca"

    for par in a.cor:
        if "=" not in par:
            raise SystemExit(f"--cor espera papel=#RRGGBB, veio: {par}")
        papel, val = par.split("=", 1)
        if papel not in PAPEIS:
            raise SystemExit(f"papel de cor inexistente: {papel}. aceitos: {', '.join(PAPEIS)}")
        if not HEX.match(val):
            raise SystemExit(f"cor fora do formato #RRGGBB: {val}")
        p["paleta"][PAPEIS[papel]] = val

    erros = preflight(p)
    if erros:
        print("PRE-FLIGHT BLOQUEOU:")
        for x in erros:
            print("  ·", x)
        sys.exit(1)
    print(f"pre-flight ok · {p['nicho']} · marca {p['marca']}")
    if a.preflight:
        return

    html = documento(p)
    erros = validar_saida(html, p)
    if erros:
        print("VALIDAÇÃO DE SAÍDA BLOQUEOU:")
        for x in erros:
            print("  ·", x)
        sys.exit(1)
    print("validação de saída ok")

    nome = f"Wireframe da Loja · {p['nicho']} · {p['marca']}".replace("/", "·")
    destino = Path(a.saida) if a.saida else (Path("/tmp") if a.dry_run else SAIDA_PADRAO) / f"{nome}.html"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(html, encoding="utf-8")
    print(f"html: {destino}")

    if a.pdf and not a.dry_run:
        pdf = destino.with_suffix(".pdf")
        chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        if Path(chrome).exists():
            subprocess.run([chrome, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                            "--virtual-time-budget=20000", f"--print-to-pdf={pdf}", f"file://{destino}"],
                           capture_output=True)
            if pdf.exists():
                paginas = len(re.findall(rb"/Type\s*/Page[^s]", pdf.read_bytes()))
                slides = html.count('<section class="slide')
                print(f"pdf: {pdf} · {paginas} páginas para {slides} slides"
                      + ("" if paginas == slides else "  <<< ATENÇÃO: slide estourando a folha"))
            else:
                print("pdf não gerado")
    if a.abrir and not a.dry_run:
        subprocess.run(["open", str(destino)], capture_output=True)

if __name__ == "__main__":
    main()
