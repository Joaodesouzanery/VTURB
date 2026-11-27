#!/usr/bin/env python3
"""Raio-X, fechamento: junta a classificação, separa as peças por formato e escreve catálogo e resumo.

    python3 organizar.py <pasta do concorrente> [--parcial]

Lê pecas.json (coletar_pecas.py), classif*.json (o Claude, por classificar.md) e loja.json (loja.py).
Grava:
  criativos/<NN Formato>/PNNN · Nd · Gancho · funil.ext   (link do arquivo de _brutos, sem duplicar disco)
  catalogo.html    abre no navegador: miniatura, filtros por formato, gancho, funil e oferta, link da peça
  resumo.md        os números do raio-x, cada um com o denominador
  resumo.json      os mesmos números, para a apresentação da marca

Recusa valor fora da lista e peça sem classificação (sai com código 2 e diz qual). --parcial ignora a falta.
"""
import collections, glob, html, json, os, re, shutil, statistics, sys

FORMATOS = ['Oferta Direta', 'Catálogo', 'Lifestyle', 'Problema x Solução', 'Review', 'Demonstração', 'POV',
            'Storytelling', 'UGC', 'Unboxing', 'Viral', 'VSL']
GANCHOS = ['Curiosidade', 'Problema', 'Demonstração', 'Benefício']
FUNIS = ['topo', 'meio', 'fundo']
OFERTAS = ['Encerramento de loja', 'Desconto %', 'Leve X por Y', 'Preço riscado', 'Frete grátis / garantia', 'Sem oferta']
OFERTA_RE = re.compile(r'(\d+\s?%|[$€£]\s?\d|\d+[.,]?\d*\s?(€|eur|usd|gbp|kr)|\bfree\b|\boff\b|buy \d|\d for \d)', re.I)


def num(x):
    return '—' if x is None else (f'{x:.0f}' if float(x).is_integer() else f'{x:.1f}')


def pct(n, t):
    return f'{n}/{t} ({round(100 * n / t)}%)' if t else '0/0'


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    P = sys.argv[1]
    parcial = '--parcial' in sys.argv
    pecas = json.load(open(os.path.join(P, 'pecas.json')))
    coleta = json.load(open(os.path.join(P, 'coleta.json'))) if os.path.exists(os.path.join(P, 'coleta.json')) else {}
    loja = json.load(open(os.path.join(P, 'loja.json'))) if os.path.exists(os.path.join(P, 'loja.json')) else None
    classif = {}
    for f in sorted(glob.glob(os.path.join(P, 'classif*.json'))):
        for c in json.load(open(f)):
            classif[c['codigo']] = c

    erros = []
    for p in pecas:
        c = classif.get(p['codigo'])
        if not c:
            erros.append(f"{p['codigo']}: sem classificação")
            continue
        for campo, lista in (('formato', FORMATOS), ('gancho', GANCHOS), ('funil', FUNIS), ('oferta', OFERTAS)):
            if c.get(campo) not in lista:
                erros.append(f"{p['codigo']}: {campo} = {c.get(campo)!r} fora da lista")
        if c.get('formato2') not in [None, ''] + FORMATOS:
            erros.append(f"{p['codigo']}: formato2 = {c.get('formato2')!r} fora da lista")
    faltam = [e for e in erros if 'sem classificação' in e]
    if erros and not (parcial and len(faltam) == len(erros)):
        if len(faltam) == len(pecas):
            print(f'nenhuma das {len(pecas)} peças foi classificada: siga o classificar.md e grave classif.json antes (ou rode com --parcial)')
        else:
            print('\n'.join(e for e in erros if 'sem classificação' not in e)[:4000])
            if faltam:
                print(f'{len(faltam)} peças sem classificação: ' + ', '.join(e.split(':')[0] for e in faltam[:30]))
        sys.exit(2)

    # o que se mede por código, sem depender de leitura
    censo = json.load(open(os.path.join(P, 'censo.json'))) if os.path.exists(os.path.join(P, 'censo.json')) else {'anuncios': []}
    template = sum(1 for a in censo['anuncios'] if '{{' in str(a.get('corpo') or '') + str(a.get('titulo') or ''))
    for p in pecas:
        p.update({k: v for k, v in classif.get(p['codigo'], {}).items() if k != 'codigo'})
        primeira = (p.get('texto') or '').strip().split('\n')[0][:140]
        p['preco_1a_linha'] = bool(OFERTA_RE.search(primeira)) if primeira else None
        p['titulo_com_oferta'] = bool(OFERTA_RE.search(p.get('titulo') or '')) if p.get('titulo') else None

    # pastas por formato: link físico do bruto (não duplica disco); sem suporte a link, copia
    destino_raiz = os.path.join(P, 'criativos')
    if os.path.isdir(destino_raiz):
        shutil.rmtree(destino_raiz)
    for p in pecas:
        if not p.get('formato'):
            continue
        pasta = os.path.join(destino_raiz, f"{FORMATOS.index(p['formato']) + 1:02d} {p['formato'].replace(' x ', ' x ')}")
        os.makedirs(pasta, exist_ok=True)
        ext = os.path.splitext(p['arquivo'])[1]
        nome = f"{p['codigo']} · {p['dias_no_ar']}d · {p.get('gancho')} · {p.get('funil')}{' · DESTAQUE' if p.get('destaque') else ''}{ext}"
        alvo = os.path.join(pasta, nome)
        try:
            os.link(os.path.join(P, p['arquivo']), alvo)
        except OSError:
            shutil.copy2(os.path.join(P, p['arquivo']), alvo)
        p['arquivo_organizado'] = os.path.relpath(alvo, P)

    cl = [p for p in pecas if p.get('formato')]
    T = len(cl)
    def tabela(campo, ordem):
        linhas = []
        for v in ordem:
            g = [p for p in cl if p.get(campo) == v]
            if not g:
                continue
            dias = [p['dias_no_ar'] for p in g]
            linhas.append({'valor': v, 'pecas': len(g), 'pct': round(100 * len(g) / T) if T else 0,
                           'videos': sum(1 for p in g if p['tipo'] == 'video'), 'mediana_dias': statistics.median(dias),
                           'max_dias': max(dias), 'destaques': sum(1 for p in g if p.get('destaque'))})
        return sorted(linhas, key=lambda l: -l['pecas'])
    agg = {'formato': tabela('formato', FORMATOS), 'gancho': tabela('gancho', GANCHOS), 'funil': tabela('funil', FUNIS),
           'oferta': tabela('oferta', OFERTAS)}
    com_desc = [p for p in cl if p.get('oferta') not in ('Sem oferta', None)]
    com_motivo = [p for p in com_desc if (p.get('motivo_desconto') or 'sem motivo') != 'sem motivo']
    textos = [p for p in cl if p.get('texto')]
    titulos = [p for p in cl if p.get('titulo')]
    copy = {'preco_1a_linha': [sum(1 for p in textos if p['preco_1a_linha']), len(textos)],
            'titulo_com_oferta': [sum(1 for p in titulos if p['titulo_com_oferta']), len(titulos)],
            'desconto_com_motivo': [len(com_motivo), len(com_desc)],
            'template_no_ar': [template, len(censo['anuncios'])],
            'corpos_distintos': len({p['texto'] for p in textos}), 'titulos_distintos': len({p['titulo'] for p in titulos}),
            'motivos': collections.Counter(p.get('motivo_desconto') for p in com_motivo).most_common(6),
            'angulos': collections.Counter((p.get('angulo') or '').strip().lower() for p in cl if p.get('angulo')).most_common(10),
            'ctas': collections.Counter(p.get('cta') for p in cl if p.get('cta')).most_common(5),
            'idiomas': collections.Counter(p.get('idioma') for p in cl if p.get('idioma')).most_common(5)}
    mais_antigas = sorted(cl, key=lambda p: -p['dias_no_ar'])[:10]
    destaques = [p for p in cl if p.get('destaque')]
    vids = sum(1 for p in cl if p['tipo'] == 'video')
    resumo = {'pagina': coleta.get('pagina'), 'coleta': coleta, 'pecas': T, 'videos': vids, 'imagens': T - vids,
              'mediana_dias': statistics.median([p['dias_no_ar'] for p in cl]) if cl else None,
              'agregados': agg, 'copy': copy, 'loja': loja,
              'mais_antigas': [{k: p.get(k) for k in ('codigo', 'dias_no_ar', 'tipo', 'formato', 'gancho', 'angulo', 'link', 'arquivo_organizado')} for p in mais_antigas],
              'destaques': [{k: p.get(k) for k in ('codigo', 'dias_no_ar', 'tipo', 'formato', 'gancho', 'angulo', 'promessa', 'nota', 'link', 'arquivo_organizado')} for p in destaques]}
    json.dump(resumo, open(os.path.join(P, 'resumo.json'), 'w'), ensure_ascii=False, indent=1)
    json.dump(pecas, open(os.path.join(P, 'pecas.json'), 'w'), ensure_ascii=False, indent=1)

    # resumo.md
    nome = coleta.get('pagina') or os.path.basename(os.path.abspath(P))
    md = [f'# Raio-X de criativos · {nome}', '',
          f"{T} peças distintas ({vids} vídeos, {T - vids} imagens), de {coleta.get('anuncios_no_censo', '?')} anúncios coletados. "
          f"A biblioteca declara {coleta.get('declarado') or '?'}. Mediana de {num(resumo['mediana_dias'])} dias no ar.", '']
    if coleta.get('cortado_no_teto'):
        md.append(f"Ficaram as {T} peças mais antigas no ar de {coleta.get('arquivos_distintos')} arquivos distintos (teto da coleta).\n")
    if loja and loja.get('shopify'):
        md += ['## A loja', '',
               f"{loja.get('produtos')}{'+' if loja.get('produtos_teto') else ''} produtos · preço mediano {loja.get('preco_mediano')} {loja.get('moeda') or ''} "
               f"(de {loja['preco_faixa'][0]} a {loja['preco_faixa'][1]}) · variantes com riscado {loja.get('riscado')} · contexto na home: {', '.join(loja.get('contexto_home') or []) or 'nenhum'}", '']
        if loja.get('colecoes'):
            md.append('Coleções: ' + ' · '.join(f"{c['titulo']} ({c['produtos']})" for c in loja['colecoes'][:15]) + '\n')
        if loja.get('mais_vendidos'):
            md += ['Mais vendidos, pela ordem pública da loja:', '']
            md += [f"{i}. [{m['titulo']}]({m['link']}) · {m['preco']}{' (riscado ' + m['riscado'] + ')' if m.get('riscado') else ''}" for i, m in enumerate(loja['mais_vendidos'], 1)]
            md.append('')
    for campo, titulo in (('formato', 'Formatos'), ('gancho', 'Ganchos'), ('funil', 'Funil'), ('oferta', 'Ofertas')):
        md += [f'## {titulo}', '', f'| {titulo[:-1] if titulo != "Funil" else "Etapa"} | Peças | Vídeos | Mediana de dias no ar | Mais antiga | Destaques |', '|---|---|---|---|---|---|']
        md += [f"| {l['valor']} | {l['pecas']}/{T} ({l['pct']}%) | {l['videos']} | {num(l['mediana_dias'])} | {l['max_dias']} | {l['destaques']} |" for l in agg[campo]]
        md.append('')
    md += ['## Copy', '',
           f"- {copy['corpos_distintos']} corpo(s) de anúncio distinto(s) e {copy['titulos_distintos']} título(s) para {T} peças",
           f"- Preço ou percentual na primeira linha do corpo: {pct(*copy['preco_1a_linha'])}",
           f"- Oferta no título do link: {pct(*copy['titulo_com_oferta'])}",
           f"- Desconto com motivo declarado: {pct(*copy['desconto_com_motivo'])}" + (f" · motivos: {', '.join(f'{m} ({n})' for m, n in copy['motivos'])}" if copy['motivos'] else ''),
           f"- Variável de template no ar (`{{{{product.name}}}}` literal): {pct(*copy['template_no_ar'])} dos anúncios",
           f"- Ângulos mais repetidos: {'; '.join(f'{a} ({n})' for a, n in copy['angulos']) or '—'}",
           f"- Botões: {', '.join(f'{c} ({n})' for c, n in copy['ctas']) or '—'} · idiomas: {', '.join(f'{c} ({n})' for c, n in copy['idiomas']) or '—'}", '',
           '## As 10 peças mais antigas no ar', '', '| Peça | Dias | Tipo | Formato | Gancho | Ângulo |', '|---|---|---|---|---|---|']
    md += [f"| [{p['codigo']}]({p['link']}) | {p['dias_no_ar']} | {p['tipo']} | {p.get('formato')} | {p.get('gancho')} | {p.get('angulo') or ''} |" for p in mais_antigas]
    md += ['', f'## O que modelar primeiro ({len(destaques)} destaques)', '']
    md += [f"- [{p['codigo']}]({p['link']}) · {p['dias_no_ar']} dias · {p.get('formato')} · {p.get('angulo') or ''}: {p.get('nota') or ''}" for p in destaques]
    md += ['', 'Arquivos separados por formato em `criativos/`. Catálogo navegável: `catalogo.html`.']
    open(os.path.join(P, 'resumo.md'), 'w').write('\n'.join(md) + '\n')

    # catalogo.html: autocontido, miniaturas por caminho relativo
    dados = [{k: p.get(k) for k in ('codigo', 'tipo', 'duracao', 'dias_no_ar', 'anuncios', 'versoes', 'formato', 'formato2', 'gancho',
                                    'funil', 'oferta', 'motivo_desconto', 'angulo', 'dor', 'promessa', 'texto_tela', 'texto', 'titulo',
                                    'cta', 'link', 'destaque', 'nota', 'arquivo_organizado', 'pessoa', 'idioma')} for p in pecas]
    pagina = MOLDE.replace('__TITULO__', html.escape(f'Criativos · {nome}')).replace(
        '__SUB__', html.escape(f"{T} peças · {vids} vídeos · {T - vids} imagens · mediana de {num(resumo['mediana_dias'])} dias no ar")).replace(
        '__DADOS__', json.dumps(dados, ensure_ascii=False).replace('</', '<\\/'))
    open(os.path.join(P, 'catalogo.html'), 'w').write(pagina)
    print(f"ok: {T} peças em {len(agg['formato'])} formatos · {len(destaques)} destaques\n  {os.path.join(P, 'resumo.md')}\n  {os.path.join(P, 'catalogo.html')}")
    if faltam:
        print(f'aviso: {len(faltam)} peças sem classificação ficaram fora das pastas e do resumo')


MOLDE = r'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>__TITULO__</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@400;600&family=IBM+Plex+Mono&display=swap" rel="stylesheet">
<style>
:root{--ground:#FAFAF8;--surface:#FFFFFF;--surface-2:#F2F4EE;--ink:#0A0A0A;--ink-soft:#2E312C;--muted:#555956;--line:#E0E3D8;--accent:#5F6905;--solid:#BACD0B;--wash:#F3F6E0}
@media (prefers-color-scheme:dark){:root{--ground:#0A0A0A;--surface:#1C1C1C;--surface-2:#242520;--ink:#F4F7EF;--ink-soft:#DCE0D6;--muted:#A3A89E;--line:#2E302A;--accent:#BACD0B;--wash:#1F2408}}
*{box-sizing:border-box}body{margin:0;background:var(--ground);color:var(--ink);font:15px/1.5 Inter,system-ui,sans-serif}
header{padding:28px 16px 8px;max-width:1280px;margin:auto}h1{font:600 30px/1.15 Fraunces,serif;margin:0 0 4px}.sub{color:var(--muted);font:13px 'IBM Plex Mono',monospace}
.filtros{max-width:1280px;margin:auto;padding:8px 16px;display:flex;flex-direction:column;gap:6px;position:sticky;top:0;background:var(--ground);z-index:2;border-bottom:1px solid var(--line)}
.linha{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.linha b{font:12px 'IBM Plex Mono',monospace;color:var(--muted);min-width:64px}
button{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:3px 10px;cursor:pointer}
button.on{background:var(--solid);color:#0A0A0A;border-color:var(--solid)}
main{max-width:1280px;margin:auto;padding:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:10px;overflow:hidden;display:flex;flex-direction:column}
.card img{width:100%;aspect-ratio:4/3;object-fit:contain;background:var(--surface-2)}.c{padding:10px 12px;display:flex;flex-direction:column;gap:5px}
.top{display:flex;justify-content:space-between;font:12px 'IBM Plex Mono',monospace;color:var(--muted)}.tags{display:flex;flex-wrap:wrap;gap:4px}
.tag{font-size:12px;background:var(--surface-2);border-radius:4px;padding:1px 6px}.tag.f{background:var(--wash);color:var(--accent);font-weight:600}
.ang{font-weight:600}.txt{font-size:13px;color:var(--ink-soft);max-height:5.6em;overflow:hidden}.lk{font-size:13px;display:flex;gap:12px}
a{color:var(--accent)}.star{color:var(--accent);font-weight:600}@media (max-width:600px){h1{font-size:24px}}
</style></head><body>
<header><h1>__TITULO__</h1><div class="sub">__SUB__</div></header>
<div class="filtros" id="f"></div><main id="g"></main>
<script>
const D=__DADOS__;const campos=[['formato','Formato'],['gancho','Gancho'],['funil','Funil'],['oferta','Oferta'],['tipo','Tipo']];
const sel={};let ordem='dias';
function chips(){const f=document.getElementById('f');f.innerHTML='';for(const[c,n]of campos){const vs={};D.forEach(d=>{if(d[c])vs[d[c]]=(vs[d[c]]||0)+1});
const l=document.createElement('div');l.className='linha';l.innerHTML='<b>'+n+'</b>';
Object.entries(vs).sort((a,b)=>b[1]-a[1]).forEach(([v,k])=>{const b=document.createElement('button');b.textContent=v+' '+k;if(sel[c]===v)b.className='on';
b.onclick=()=>{sel[c]=sel[c]===v?null:v;chips();grade()};l.appendChild(b)});f.appendChild(l)}
const l=document.createElement('div');l.className='linha';l.innerHTML='<b>Ordem</b>';[['dias','mais antigas no ar'],['anuncios','mais anúncios'],['destaque','destaques primeiro']].forEach(([k,n])=>{
const b=document.createElement('button');b.textContent=n;if(ordem===k)b.className='on';b.onclick=()=>{ordem=k;chips();grade()};l.appendChild(b)});f.appendChild(l)}
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function grade(){let L=D.filter(d=>campos.every(([c])=>!sel[c]||d[c]===sel[c]));
L.sort((a,b)=>ordem==='anuncios'?b.anuncios-a.anuncios:ordem==='destaque'?(b.destaque?1:0)-(a.destaque?1:0)||b.dias_no_ar-a.dias_no_ar:b.dias_no_ar-a.dias_no_ar);
document.getElementById('g').innerHTML=L.map(d=>`<article class="card"><img loading="lazy" src="miniaturas/${d.codigo}.jpg" alt="${esc(d.codigo)}">
<div class="c"><div class="top"><span>${d.codigo}${d.destaque?' <span class="star">★ destaque</span>':''}</span><span>${d.dias_no_ar} dias · ${d.tipo==='video'?'vídeo '+(d.duracao||'?')+'s':'imagem'}</span></div>
<div class="tags"><span class="tag f">${esc(d.formato||'sem classificação')}</span>${d.formato2?'<span class="tag">'+esc(d.formato2)+'</span>':''}<span class="tag">${esc(d.gancho||'')}</span><span class="tag">${esc(d.funil||'')}</span><span class="tag">${esc(d.oferta||'')}</span></div>
${d.angulo?'<div class="ang">'+esc(d.angulo)+'</div>':''}${d.promessa?'<div class="txt">'+esc(d.promessa)+'</div>':''}
${d.texto?'<div class="txt">“'+esc(d.texto.slice(0,240))+'”</div>':''}${d.titulo?'<div class="txt"><b>Título:</b> '+esc(d.titulo)+'</div>':''}
${d.nota?'<div class="txt"><i>'+esc(d.nota)+'</i></div>':''}
<div class="lk"><a href="${esc(d.link)}" target="_blank" rel="noopener">na biblioteca</a>${d.arquivo_organizado?'<a href="'+esc(encodeURI(d.arquivo_organizado))+'" target="_blank">arquivo</a>':''}<span class="sub">${d.anuncios} anúncio(s)</span></div></div></article>`).join('')||'<p>Nenhuma peça com esses filtros.</p>'}
chips();grade();
</script></body></html>'''

if __name__ == '__main__':
    main()
