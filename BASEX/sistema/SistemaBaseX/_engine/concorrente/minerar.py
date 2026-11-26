#!/usr/bin/env python3
"""Mineração: as lojas do nicho que o aluno escolheu, do repositório e as novas anunciando agora.

    python3 minerar.py --nicho "watch,men's watch,montre homme,herrenuhr" --paises US,GB,DE --saida <pasta>
        [--contexto "closing sale,final pieces"] [--incluir loja.com] [--paginas 4] [--contar 15] [--sem-repositorio]
        [--teto-catalogo 15]

1. Repositório de Nichos da BaseX: as lojas já levantadas que casam com os termos do nicho, com o dossiê
   quando existe (leitor em _engine/acervo-nichos).
2. Biblioteca de anúncios: cada termo do nicho em cada país, só anúncios ativos, pelo coletor sem login.
   --contexto acrescenta buscas de contexto de oferta (encerramento, Black Friday) filtradas pelo nicho.
3. Junta tudo por domínio, lê o catálogo público de cada loja (é Shopify? produtos, preço, riscado, contexto),
   conta os anúncios ativos pelo total que a biblioteca declara e marca os filtros da casa.
4. Grava concorrentes.json e concorrentes.md, com a origem de cada loja (repositório, nova ou as duas).

Retomável: busca já gravada na pasta não roda de novo.
"""
import argparse, concurrent.futures as cf, json, os, re, subprocess, sys, time, urllib.parse as up

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from loja import ler_loja, contexto  # noqa: E402

FORA = r'(^|\.)(facebook|fb|instagram|google|youtube|youtu|apple|tiktok|linktr|skool|whatsapp|wa|bit|amazon|etsy|ebay|shopee|temu|aliexpress|calendly|typeform)\.'
TEMPLATE = re.compile(r'\{\{.*?\}\}')
VAZIAS = {'for', 'men', 'mens', "men's", 'women', 'womens', "women's", 'homme', 'femme', 'herren', 'damen', 'the', 'and', 'with',
          'sale', 'de', 'para', 'pour', 'für', 'fur', 'uomo', 'donna', 'hombre', 'mujer'}
ACERVO = os.path.join(os.path.dirname(AQUI), 'acervo-nichos', 'ler-acervo.mjs')


def coletar(args_extra, saida, log):
    if os.path.exists(saida):
        return json.load(open(saida))
    cmd = ['node', os.path.join(AQUI, 'adlib-pw-paginar.mjs')] + args_extra + ['--saida', saida]
    for tentativa in range(2):  # a biblioteca às vezes cai na carga; uma segunda tentativa resolve quase sempre
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=900, stdin=subprocess.DEVNULL)
        log.write(' '.join(cmd) + '\n' + r.stdout[-1500:] + r.stderr[-500:] + '\n')
        if os.path.exists(saida):
            break
    if not os.path.exists(saida):
        print('  coletor falhou:', (r.stdout + r.stderr).strip().splitlines()[-1:] or '?')
        return None
    return json.load(open(saida))


def dominio(url):
    if not url:
        return None
    h = up.urlparse(url if '//' in url else 'https://' + url).netloc.lower().split(':')[0]
    h = re.sub(r'^(www|m|shop|store|us|uk|eu)\.', '', h)
    return None if not h or re.search(FORA, h + '.') else h


def texto_do(a):
    for t in [a.get('corpo')] + (a.get('card_bodies') or []):
        if t and not TEMPLATE.search(t):
            return re.sub(r'<[^>]+>', ' ', t).strip()
    return ''


def declarado_num(s):
    m = re.search(r'([\d.,]+)\s*(mil|k)?\s*(resultados?|results?)', s or '', re.I)
    if not m:
        return None
    if m.group(2):
        return int(float(m.group(1).replace('.', '').replace(',', '.')) * 1000)
    return int(re.sub(r'[.,]', '', m.group(1)))


def acervo(args):
    if not os.path.exists(ACERVO):
        return None
    r = subprocess.run(['node', ACERVO] + args + ['--json'], capture_output=True, text=True, timeout=120, stdin=subprocess.DEVNULL)
    try:
        return json.loads(r.stdout)
    except Exception:
        return None


def repositorio(termos, log):
    """Lojas do repositório que casam com os termos do nicho, com página e dossiê quando houver."""
    achadas, dossies, nichos = {}, set(), set()
    for t in termos:
        r = acervo(['buscar', t]) or {}
        for l in r.get('lojas') or []:
            d = dominio(l.get('dominio') or '')
            if d:
                achadas.setdefault(d, {'marca': l.get('marca'), 'ads_repositorio': l.get('ads'), 'nicho_repositorio': l.get('nicho')})
                nichos.add(l.get('nicho'))
        for x in r.get('dossies') or []:
            d = dominio(x.get('dominio') or x.get('domain') or '')
            if d:
                dossies.add(d)
    detalhe = {}
    for n in [n for n in nichos if n]:
        for l in acervo(['lojas', n, '--top', '500']) or []:
            d = dominio(l.get('domain') or l.get('primary_url') or '')
            if d in achadas:
                m = re.search(r'view_all_page_id=(\d+)', l.get('ad_library_url') or '')
                detalhe[d] = {'page_id': m.group(1) if m else None, 'pagina': l.get('page_name'), 'apps': l.get('apps') or [],
                              'momento': l.get('momento'), 'print_home': l.get('print_home'), 'print_pdp': l.get('print_pdp')}
    for d in achadas:
        achadas[d].update(detalhe.get(d, {}))
        achadas[d]['dossie'] = d in dossies
    log.write(f'repositório: {len(achadas)} lojas, {len(dossies)} dossiês, nichos {sorted(n for n in nichos if n)}\n')
    return achadas


def falhou_a_leitura(l):
    """Erro de leitura que vale outra tentativa (instabilidade e 429); 401, 403 e 404 são resposta da loja."""
    return bool(l.get('erro')) and not re.search(r'40[134]|Not Found|Name or service|nodename', l['erro'])


def ler_catalogos(doms, ler=ler_loja, teto_min=15, paralelo=6, dizer=print, relogio=time.time):
    """Lê o catálogo de cada domínio e conta o andamento (0355).

    1ª passada em paralelo; quem falhou por limite ou instabilidade é relido um por vez, mas só até `teto_min`:
    o que sobrar vai para a lista de não lidas, em vez de a mineração ficar parada em silêncio (75 min em 04/11/2026).
    Devolve (lidas, nao_lidas, limite): `limite` = domínios que tomaram 429 e não se recuperaram."""
    lidas, n = {}, len(doms)
    with cf.ThreadPoolExecutor(paralelo) as ex:
        futuros = {ex.submit(ler, d): d for d in doms}
        for i, f in enumerate(cf.as_completed(futuros), 1):
            lidas[futuros[f]] = f.result()
            if i % 25 == 0 or i == n:
                dizer(f'  catálogo: {i}/{n} lidos', flush=True)
    pendentes = sorted(d for d, l in lidas.items() if falhou_a_leitura(l))
    if pendentes:
        dizer(f'  {len(pendentes)} falharam (limite ou instabilidade); relendo um por vez, teto de {teto_min:g} min', flush=True)
    ini = relogio()
    for i, d in enumerate(pendentes, 1):
        if relogio() - ini > teto_min * 60:
            dizer(f'  teto de {teto_min:g} min: {len(pendentes) - i + 1} lojas ficam sem releitura (nao_lidas)', flush=True)
            break
        lidas[d] = ler(d)
        dizer(f'  releitura {i}/{len(pendentes)}: {d} {"ok" if not falhou_a_leitura(lidas[d]) else "ainda falha"}', flush=True)
    nao_lidas = sorted(d for d, l in lidas.items() if falhou_a_leitura(l))
    return lidas, nao_lidas, sorted(d for d in nao_lidas if lidas[d].get('limite'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--nicho', required=True, help='o que você vai vender, em termos de busca nas línguas dos países')
    ap.add_argument('--paises', default='US,GB')
    ap.add_argument('--contexto', default='', help='buscas de contexto de oferta, opcionais (closing sale, black friday)')
    ap.add_argument('--palavras', default='', help=argparse.SUPPRESS)  # nome antigo do --contexto
    ap.add_argument('--incluir', default='', help='domínios achados à mão na biblioteca, separados por vírgula')
    ap.add_argument('--paginas', type=int, default=4)
    ap.add_argument('--contar', type=int, default=15)
    ap.add_argument('--sem-repositorio', action='store_true')
    ap.add_argument('--teto-catalogo', type=float, default=15,
                    help='minutos para reler, uma a uma, as lojas que falharam na leitura do catálogo (padrão 15); o resto vai para não lidas')
    ap.add_argument('--max', type=int, default=10,
                    help='lojas que vão para o Mercado (padrão da casa: 10, com cuidado em cada uma); o resto fica na reserva')
    ap.add_argument('--saida', required=True)
    a = ap.parse_args()
    os.makedirs(os.path.join(a.saida, 'buscas'), exist_ok=True)
    log = open(os.path.join(a.saida, 'coleta.log'), 'a')
    termos = [t.strip() for t in a.nicho.split(',') if t.strip()]
    ctx = [p.strip() for p in (a.contexto or a.palavras).split(',') if p.strip()]
    paises = [p.strip().upper() for p in a.paises.split(',') if p.strip()]
    filtro = sorted({w for t in termos for w in re.findall(r"[\wÀ-ÿ']+", t.lower()) if len(w) >= 3 and w not in VAZIAS})

    repo = {} if a.sem_repositorio else repositorio(termos, log)
    if not a.sem_repositorio:
        print(f'repositório: {len(repo)} lojas do nicho' + ('' if os.path.exists(ACERVO) else ' (leitor do acervo não encontrado)'), flush=True)

    paginas = {}
    def somar(x, origem, termo, pais):
        pid = x.get('page_id') or '?'
        g = paginas.setdefault(pid, {'page_id': pid, 'pagina': x.get('pagina'), 'amostra': 0, 'dominios': {},
                                     'termos': set(), 'paises': set(), 'copy': '', 'origem': set()})
        g['amostra'] += 1
        g['termos'].add(termo)
        g['paises'].add(pais)
        g['origem'].add(origem)
        for u in [x.get('destino')] + (x.get('card_links') or []):
            h = dominio(u)
            if h:
                g['dominios'][h] = g['dominios'].get(h, 0) + 1
        if not g['copy']:
            g['copy'] = texto_do(x)[:280]

    for t in termos + ctx:
        for c in paises:
            arq = os.path.join(a.saida, 'buscas', f"{re.sub(r'[^a-z0-9]+', '-', t.lower())}_{c}.json")
            print(f'biblioteca: "{t}" em {c} ...', flush=True)
            d = coletar(['--modo', 'busca', '--q', t, '--pais', c, '--status', 'active', '--paginas', str(a.paginas)], arq, log)
            if not d:
                continue
            print(f'  {len(d["anuncios"])} anúncios (a biblioteca declara {(d.get("declarado") or "?").strip()})')
            for x in d['anuncios']:
                somar(x, 'contexto' if t in ctx else 'biblioteca', t, c)

    # lojas achadas à mão, e as do repositório sem página conhecida: acha a página pela frase exata do domínio
    manuais = [d for d in (dominio(x.strip().lower()) for x in a.incluir.split(',') if x.strip()) if d]
    sem_pagina = [d for d, v in repo.items() if not v.get('page_id')]
    for d in manuais + sem_pagina[:10]:
        arq = os.path.join(a.saida, 'buscas', f"dominio_{re.sub(r'[^a-z0-9]+', '-', d)}.json")
        r = coletar(['--modo', 'busca', '--q', d, '--tipo', 'keyword_exact_phrase', '--pais', 'ALL', '--status', 'active', '--paginas', '1'], arq, log)
        conta = {}
        for x in (r or {}).get('anuncios', []):
            if any(dominio(u) == d for u in [x.get('destino')] + (x.get('card_links') or [])):
                conta[x.get('page_id')] = conta.get(x.get('page_id'), 0) + 1
        if not conta:
            if d in manuais:
                print(f'  nenhum anúncio ativo leva para {d}')
            continue
        pid = max(conta, key=conta.get)
        if d in repo:
            repo[d]['page_id'] = pid
        else:
            nome = next(x.get('pagina') for x in r['anuncios'] if x.get('page_id') == pid)
            g = paginas.setdefault(pid, {'page_id': pid, 'pagina': nome, 'amostra': 0, 'dominios': {}, 'termos': set(),
                                         'paises': set(), 'copy': '', 'origem': set()})
            g['dominios'][d] = g['dominios'].get(d, 0) + 1000
            g['amostra'] += conta[pid]
            g['origem'].add('à mão')

    # uma linha por domínio, juntando as páginas da biblioteca e o repositório
    lojas = {}
    for g in paginas.values():
        if not g['dominios']:
            continue
        d = max(g['dominios'], key=g['dominios'].get)
        l = lojas.setdefault(d, {'dominio': d, 'page_id': g['page_id'], 'pagina': g['pagina'], 'amostra': 0, 'termos': set(),
                                 'paises': set(), 'copy': g['copy'], 'origem': set(), 'outras_paginas': []})
        if l['page_id'] != g['page_id']:
            l['outras_paginas'].append(g['page_id'])
        l['amostra'] += g['amostra']
        l['termos'] |= g['termos']
        l['paises'] |= g['paises']
        l['origem'] |= g['origem']
    for d, v in repo.items():
        l = lojas.setdefault(d, {'dominio': d, 'page_id': v.get('page_id'), 'pagina': v.get('pagina') or v.get('marca'), 'amostra': 0,
                                 'termos': set(), 'paises': set(), 'copy': '', 'origem': set(), 'outras_paginas': []})
        l['origem'].add('repositório')
        l['page_id'] = l['page_id'] or v.get('page_id')
        l['repositorio'] = v

    doms = sorted(lojas)
    print(f'{len(doms)} domínios (repositório + biblioteca). Lendo os catálogos ...', flush=True)
    lidas, nao_lidas, limite = ler_catalogos(doms, teto_min=a.teto_catalogo)

    lista, shopify, cortadas = [], 0, 0
    for d, l in lojas.items():
        lj = lidas.get(d) or {}
        if not lj.get('shopify') or not lj.get('produtos'):
            continue
        shopify += 1
        alvo = ' '.join([l['copy'], lj.get('titulo_home') or '', ' '.join(t for t, _ in lj.get('tipos', [])),
                         ' '.join(c['titulo'] for c in lj.get('colecoes') or [])]).lower()
        # loja do repositório ou incluída à mão já é do nicho; a da biblioteca precisa casar um termo
        if not (l['origem'] & {'repositório', 'à mão'}) and filtro and not any(f in alvo for f in filtro):
            cortadas += 1
            continue
        l.update({'contexto': sorted(set(contexto(l['copy'])) | set(lj.get('contexto_home') or [])),
                  **{k: lj.get(k) for k in ('produtos', 'produtos_teto', 'preco_mediano', 'preco_faixa', 'moeda', 'riscado',
                                             'colecoes', 'mais_vendidos', 'titulo_home', 'tipos')}})
        lista.append(l)
    lista.sort(key=lambda l: (-('repositório' in l['origem']), -l['amostra']))

    alvo = [l for l in lista if l.get('page_id')][:a.contar]
    print(f'{shopify} lojas Shopify; {cortadas} fora do nicho; ficam {len(lista)}. Contando os anúncios ativos de {len(alvo)} ...', flush=True)

    def contar(l):
        arq = os.path.join(a.saida, 'buscas', f"pagina_{l['page_id']}.json")
        for _ in range(2):  # a página às vezes não escreve o total a tempo: apaga e tenta de novo
            d = coletar(['--modo', 'page', '--id', l['page_id'], '--pais', 'ALL', '--status', 'active', '--paginas', '0'], arq, log)
            n = declarado_num(d.get('declarado')) if d else None
            if n is not None:
                return n
            if os.path.exists(arq):
                os.remove(arq)
        return None
    with cf.ThreadPoolExecutor(3) as ex:
        for l, n in zip(alvo, ex.map(contar, alvo)):
            l['anuncios_ativos'] = n

    for l in lista:
        n, p, prod = l.get('anuncios_ativos'), l.get('preco_mediano'), l.get('produtos') or 0
        l['filtros'] = {'anuncios_50_200': None if n is None else 50 <= n <= 200,
                        'preco_49_79': None if p is None else 49 <= p <= 79,
                        'colecao_20_mais': prod >= 20,
                        'contexto_de_oferta': bool(l['contexto'])}
        l['passa'] = sum(1 for v in l['filtros'].values() if v)
        l['biblioteca'] = (f"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&view_all_page_id={l['page_id']}"
                           if l.get('page_id') else None)
        for k in ('termos', 'paises', 'origem'):
            l[k] = sorted(l[k])
    lista.sort(key=lambda l: (-l['passa'], -(l.get('anuncios_ativos') or 0)))
    # padrão da casa (Lucas, 03/11/2026): o Mercado começa com no máximo 10 lojas, cada uma bem olhada; 60 de uma vez ninguém lê
    lista, reserva = lista[:a.max], lista[a.max:]
    json.dump({'gerado_em': time.strftime('%Y-%m-%d %H:%M'), 'nicho': termos, 'contexto': ctx, 'paises': paises, 'filtro': filtro,
               'repositorio': len(repo), 'nao_lidas': nao_lidas, 'limite': limite, 'lojas': lista,
               'reserva': [{k: l.get(k) for k in ('dominio', 'origem', 'passa', 'anuncios_ativos', 'produtos', 'preco_mediano', 'moeda', 'biblioteca')}
                           for l in reserva]},
              open(os.path.join(a.saida, 'concorrentes.json'), 'w'), ensure_ascii=False, indent=1)

    ok = lambda v: '—' if v is None else ('sim' if v else 'não')
    orig = lambda l: ' + '.join(dict.fromkeys(o.replace('biblioteca', 'nova').replace('contexto', 'nova') for o in l['origem']))
    md = [f'# Concorrentes minerados ({time.strftime("%d/%m/%Y")})', '',
          f'Nicho: {", ".join(termos)} · países: {", ".join(paises)}' + (f' · contexto: {", ".join(ctx)}' if ctx else ''), '',
          f'{len(lista) + len(reserva)} lojas Shopify no nicho; aqui as {len(lista)} primeiras pelos filtros: '
          f'{sum(1 for l in lista if "repositório" in l["origem"])} do repositório e '
          f'{sum(1 for l in lista if set(l["origem"]) - {"repositório"})} anunciando agora na biblioteca (loja nas duas conta uma vez). '
          f'Anúncios ativos contados nas {len(alvo)} primeiras; "—" = não contado.', '',
          '| # | Loja | Origem | Anúncios ativos | Produtos | Preço mediano | Riscado | Contexto | 50-200 | 49-79 | Coleção | Biblioteca |',
          '|---|---|---|---|---|---|---|---|---|---|---|---|']
    for i, l in enumerate(lista, 1):
        f = l['filtros']
        dos = ' · dossiê' if (l.get('repositorio') or {}).get('dossie') else ''
        md.append(f"| {i} | [{l['dominio']}](https://{l['dominio']}) | {orig(l)}{dos} | {l.get('anuncios_ativos') or '—'} | "
                  f"{l['produtos']}{'+' if l.get('produtos_teto') else ''} | {l.get('preco_mediano') or '—'} {l.get('moeda') or ''} | "
                  f"{l.get('riscado') or '—'} | {', '.join(l['contexto']) or '—'} | {ok(f['anuncios_50_200'])} | {ok(f['preco_49_79'])} | "
                  f"{ok(f['colecao_20_mais'])} | {'[abrir](' + l['biblioteca'] + ')' if l['biblioteca'] else '—'} |")
    if reserva:
        md += ['', f'Reserva: mais {len(reserva)} lojas do nicho, abaixo das {len(lista)} primeiras pelos filtros '
                   f'({", ".join(l["dominio"] for l in reserva[:12])}{" ..." if len(reserva) > 12 else ""}). Para trazer mais, rode com --max maior.']
    if nao_lidas:
        md += ['', f'Não responderam na leitura do catálogo (conferir à mão ou rodar de novo): {", ".join(nao_lidas)}']
        if limite:
            md += ['', f'Dessas, {len(limite)} tomaram 429 (limite de leitura por loja, não é "não Shopify"): {", ".join(limite)}. Espere e rode de novo.']
    md += ['', 'Filtros da casa: 50 a 200 anúncios ativos, preço mediano entre 49 e 79, loja de coleção (20 produtos ou mais), oferta com contexto.',
           'Loja com mais de 200 anúncios serve para estudar estrutura, não para copiar o volume. "dossiê" = o repositório tem a análise escrita dessa loja.']
    open(os.path.join(a.saida, 'concorrentes.md'), 'w').write('\n'.join(md) + '\n')
    print(f"\nPronto: {os.path.join(a.saida, 'concorrentes.md')}")
    if nao_lidas:
        print(f'  atenção: {len(nao_lidas)} lojas não responderam e ficaram fora: {", ".join(nao_lidas[:8])}')
    for l in lista:
        print(f"  {l['passa']}/4  {l['dominio']:<30} {orig(l):<24} anúncios {l.get('anuncios_ativos') or '—':>5}  produtos {l['produtos']:>4}  preço {l.get('preco_mediano')}")
    if reserva:
        print(f'  + {len(reserva)} na reserva (concorrentes.json, campo reserva)')
    print('  próximo: node _engine/concorrente/previa.mjs "<pasta da operação>" --mercado  (a prévia da home de cada uma)')


if __name__ == '__main__':
    main()
