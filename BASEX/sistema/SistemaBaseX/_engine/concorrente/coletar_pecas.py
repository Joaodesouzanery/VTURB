#!/usr/bin/env python3
"""Raio-X, parte dos criativos: coleta os anúncios de um concorrente, baixa as peças e monta as folhas.

    python3 coletar_pecas.py --page <page_id> --saida <pasta> [--pais ALL] [--status active] [--max 120]
    python3 coletar_pecas.py --dominio loja.com --saida <pasta>      (busca pela frase exata do domínio)

Grava na pasta:
  censo.json        tudo o que a biblioteca devolveu (anúncio, datas, versões, copy, link da mídia)
  _brutos/          os arquivos baixados, um por peça distinta
  miniaturas/       vídeo = tira de 3 quadros (começo, meio, fim); imagem = a arte reduzida
  folhas/           12 peças por folha, com o código, os dias no ar e o tipo embaixo
  pecas.json        uma linha por peça: anúncios que a usam, dias no ar, versões, copy, link público
  lote.json         o que o Claude lê para classificar (ver classificar.md)

O link da mídia que a biblioteca devolve é assinado e vence em horas: a coleta e o download
rodam na mesma passada. Peça igual em vários anúncios vira uma peça só (md5 do arquivo).
"""
import argparse, base64, concurrent.futures as cf, hashlib, json, os, re, shutil, subprocess, sys, time
import urllib.parse as up, urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
TEMPLATE = re.compile(r'\{\{.*?\}\}')
FFMPEG, FFPROBE = shutil.which('ffmpeg'), shutil.which('ffprobe')


def texto_do(a):
    for t in [a.get('corpo')] + (a.get('card_bodies') or []):
        if t and not TEMPLATE.search(t):
            return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', t)).strip()
    return ''


def chave_midia(url):
    """Mesmo arquivo em anúncios diferentes: imagem pelo nome do arquivo, vídeo pelo id do arquivo no efg."""
    q = up.parse_qs(up.urlparse(url).query)
    if 'efg' in q:
        try:
            efg = json.loads(base64.urlsafe_b64decode(q['efg'][0] + '=='))
            if efg.get('xpv_asset_id'):
                return 'v' + str(efg['xpv_asset_id'])
        except Exception:
            pass
    return os.path.basename(up.urlparse(url).path)


def baixar(url, destino):
    if os.path.exists(destino) and os.path.getsize(destino) > 0:
        return destino
    r = urllib.request.Request(url, headers={'User-Agent': UA, 'Referer': 'https://www.facebook.com/'})
    with urllib.request.urlopen(r, timeout=90) as f, open(destino + '.part', 'wb') as o:
        shutil.copyfileobj(f, o)
    os.replace(destino + '.part', destino)
    return destino


def md5(p):
    h = hashlib.md5()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def sondar_video(p):
    if not FFPROBE:
        return None, None
    r = subprocess.run([FFPROBE, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration',
                        '-of', 'json', p], capture_output=True, text=True, stdin=subprocess.DEVNULL)
    try:
        j = json.loads(r.stdout)
        s = j['streams'][0]
        return round(float(j['format']['duration']), 1), f"{s['width']}x{s['height']}"
    except Exception:
        return None, None


def miniatura(peca, origem, capa_url, pasta):
    from PIL import Image
    destino = os.path.join(pasta, f"{peca['codigo']}.jpg")
    if peca['tipo'] == 'imagem':
        im = Image.open(origem).convert('RGB')
        peca['dimensao'] = f'{im.width}x{im.height}'
        im.thumbnail((640, 640))
        im.save(destino, quality=85)
        return destino
    dur = peca.get('duracao')
    if FFMPEG and dur:
        quadros = []
        for i, frac in enumerate((0.08, 0.5, 0.92)):
            q = destino + f'.{i}.jpg'
            subprocess.run([FFMPEG, '-v', 'error', '-y', '-ss', f'{dur * frac:.2f}', '-i', origem, '-frames:v', '1',
                            '-vf', 'scale=-2:400', q], stdin=subprocess.DEVNULL)
            if os.path.exists(q):
                quadros.append(Image.open(q).convert('RGB'))
                os.remove(q)
        if quadros:
            larg = sum(q.width for q in quadros) + 8 * (len(quadros) - 1)
            tira = Image.new('RGB', (larg, 400), (20, 20, 20))
            x = 0
            for q in quadros:
                tira.paste(q, (x, 0))
                x += q.width + 8
            tira.save(destino, quality=85)
            return destino
    if capa_url:  # sem ffmpeg: a capa que a própria biblioteca publica
        baixar(capa_url, destino)
        return destino
    return None


def folhas(pecas, pasta_min, pasta_folhas, por_folha=12):
    from PIL import Image, ImageDraw, ImageFont
    try:
        fonte = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 22)
    except Exception:
        try:
            fonte = ImageFont.load_default(size=22)
        except TypeError:
            fonte = ImageFont.load_default()
    W, H, TX, COLS = 460, 320, 64, 4
    feitas = []
    for n in range(0, len(pecas), por_folha):
        grupo = pecas[n:n + por_folha]
        linhas = (len(grupo) + COLS - 1) // COLS
        fl = Image.new('RGB', (COLS * W, linhas * (H + TX)), (255, 255, 255))
        d = ImageDraw.Draw(fl)
        for i, p in enumerate(grupo):
            x, y = (i % COLS) * W, (i // COLS) * (H + TX)
            mp = os.path.join(pasta_min, f"{p['codigo']}.jpg")
            if os.path.exists(mp):
                im = Image.open(mp).convert('RGB')
                im.thumbnail((W - 12, H - 8))
                fl.paste(im, (x + (W - im.width) // 2, y + 4 + (H - 8 - im.height) // 2))
            tipo = f"vídeo {p.get('duracao') or '?'}s" if p['tipo'] == 'video' else 'imagem'
            d.text((x + 8, y + H + 4), f"{p['codigo']} · {p['dias_no_ar']} dias · {tipo}", fill=(0, 0, 0), font=fonte)
            d.text((x + 8, y + H + 32), f"{p['anuncios']} anúncio(s) · {p['versoes']} versões", fill=(90, 90, 90), font=fonte)
        num = n // por_folha + 1
        caminho = os.path.join(pasta_folhas, f'folha_{num:02d}.jpg')
        fl.save(caminho, quality=82)
        for p in grupo:
            p['folha'] = os.path.basename(caminho)
        feitas.append(caminho)
    return feitas


def numero_declarado(t):
    """'~7.200 resultados' -> 7200; '~1,2 mil' -> 1200; sem número -> None (nunca zero falso)."""
    m = re.search(r'([\d.,]+)\s*(mil|k)?', (t or '').replace('~', ''), re.I)
    if not m:
        return None
    n = m.group(1)
    v = float(n.replace('.', '').replace(',', '.')) if m.group(2) else int(re.sub(r'[.,]', '', n))
    return int(v * 1000) if m.group(2) else v


assert numero_declarado('\n~330 resultados') == 330 and numero_declarado('~7.200 resultados') == 7200
assert numero_declarado('~1,2 mil resultados') == 1200 and numero_declarado(None) is None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--page')
    ap.add_argument('--dominio')
    ap.add_argument('--pais', default='ALL')
    ap.add_argument('--status', default='all', help='all traz também os desligados (o que ele testou e matou); só os ativos são baixados')
    ap.add_argument('--max', type=int, default=120, help='teto de peças distintas, das mais antigas no ar para as mais novas')
    ap.add_argument('--paginas', type=int, default=60)
    ap.add_argument('--paginas-ativos', type=int, default=150,
                    help='a coleta só de ativos, à parte: com status all e teto de páginas, os ativos contados eram só os da amostra (Cross & Crown: 21 contra ~330, 04/11/2026)')
    ap.add_argument('--saida', required=True)
    a = ap.parse_args()
    if not (a.page or a.dominio):
        sys.exit('informe --page <page_id> ou --dominio <loja.com>')
    for sub in ('_brutos', 'miniaturas', 'folhas'):
        os.makedirs(os.path.join(a.saida, sub), exist_ok=True)

    censo = os.path.join(a.saida, 'censo.json')
    if not os.path.exists(censo):
        alvo = ['--modo', 'page', '--id', a.page] if a.page else ['--modo', 'busca', '--q', a.dominio, '--tipo', 'keyword_exact_phrase']
        cmd = ['node', os.path.join(AQUI, 'adlib-pw-paginar.mjs')] + alvo + ['--pais', a.pais, '--status', a.status,
                                                                             '--paginas', str(a.paginas), '--saida', censo]
        print('coletando a biblioteca ...', flush=True)
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800, stdin=subprocess.DEVNULL)
        print('\n'.join(l for l in r.stdout.splitlines() if l.startswith(('DECLARADO', 'paginas', '!!!'))))
        if not os.path.exists(censo):
            sys.exit('a coleta não gravou o censo:\n' + (r.stdout + r.stderr)[-1500:])
    c = json.load(open(censo))
    # os ativos vêm de uma coleta própria (status active): na coleta all ordenada por impressão, o teto corta a maioria deles
    censo_at = os.path.join(a.saida, 'censo_ativos.json')
    if a.status == 'all' and not os.path.exists(censo_at):
        alvo = ['--modo', 'page', '--id', a.page] if a.page else ['--modo', 'busca', '--q', a.dominio, '--tipo', 'keyword_exact_phrase']
        print('coletando só os ativos ...', flush=True)
        r = subprocess.run(['node', os.path.join(AQUI, 'adlib-pw-paginar.mjs')] + alvo + ['--pais', a.pais, '--status', 'active',
                           '--paginas', str(a.paginas_ativos), '--saida', censo_at], capture_output=True, text=True, timeout=3600, stdin=subprocess.DEVNULL)
        print('\n'.join(l for l in r.stdout.splitlines() if l.startswith(('DECLARADO', 'paginas', '!!!'))))
    ativos_declarados = None
    if os.path.exists(censo_at):
        ca = json.load(open(censo_at))
        lids = {x.get('lid') for x in ca['anuncios']}
        c = {**c, 'anuncios': [{**x, 'ativo': True} for x in ca['anuncios']] + [x for x in c['anuncios'] if x.get('ativo') is not True and x.get('lid') not in lids]}
        ativos_declarados = numero_declarado(ca.get('declarado'))
    agora = time.time()
    anuncios, todos = [], []
    for x in c['anuncios']:
        if a.page and str(x.get('page_id')) not in (a.page, ''):
            continue  # a página de um anúncio colado em outra conta não entra
        url = x.get('hd') or x.get('sd') or (x.get('imgs') or [None])[0]
        tipo = 'video' if (x.get('hd') or x.get('sd')) else 'imagem'
        try:
            ini = int(float(x['inicio']))
            fim = int(float(x['fim'])) if x.get('fim') and x.get('ativo') is not True else int(agora)
            vida = max(0, (fim - ini) // 86400)
        except Exception:
            ini, vida = None, 0
        todos.append({'ativo': x.get('ativo') is True, 'tipo': tipo, 'inicio': ini, 'vida': vida, 'texto': texto_do(x)[:200],
                      'titulo': x.get('titulo') if x.get('titulo') and not TEMPLATE.search(x['titulo']) else ''})
        if not url or (a.status == 'all' and x.get('ativo') is not True):
            continue  # link de anúncio desligado devolve 403: só o ativo é baixado
        dias = vida
        anuncios.append({**x, 'url': url, 'tipo': tipo, 'dias': dias, 'chave': chave_midia(url)})
    sem_midia = sum(1 for t in todos if t['ativo']) - len(anuncios)
    # o cemitério: o que ele testou e desligou, e quanto tempo cada tipo sobrevive
    import statistics as st
    viv, mort = [t for t in todos if t['ativo']], [t for t in todos if not t['ativo']]
    inicios = [t['inicio'] for t in todos if t['inicio']]
    cemiterio = {'total': len(todos), 'ativos': ativos_declarados if ativos_declarados is not None else len(viv),
                 'ativos_coletados': len(viv), 'ativos_fonte': 'declarado pela biblioteca, só ativos' if ativos_declarados is not None else 'contados na coleta',
                 'desligados': len(mort),
                 'conta_desde': time.strftime('%Y-%m-%d', time.gmtime(min(inicios))) if inicios else None,
                 'conta_dias': int((agora - min(inicios)) // 86400) if inicios else None,
                 'por_tipo': {tp: {'total': sum(1 for t in todos if t['tipo'] == tp), 'ativos': sum(1 for t in viv if t['tipo'] == tp),
                                   'vida_mediana_desligados': st.median([t['vida'] for t in mort if t['tipo'] == tp]) if any(t['tipo'] == tp for t in mort) else None}
                              for tp in ('video', 'imagem')},
                 'vida_mediana_desligados': st.median([t['vida'] for t in mort]) if mort else None,
                 'copies_desligadas': [], 'titulos': []}
    vivos_txt = {t['texto'] for t in viv}
    cont = {}
    for t in mort:
        if t['texto'] and t['texto'] not in vivos_txt:
            cont.setdefault(t['texto'], []).append(t['vida'])
    cemiterio['copies_desligadas'] = [{'texto': k, 'anuncios': len(v), 'vida_mediana': st.median(v)}
                                      for k, v in sorted(cont.items(), key=lambda kv: -len(kv[1]))[:6]]
    tit = {}
    for t in todos:
        if t['titulo']:
            g = tit.setdefault(t['titulo'], [0, 0])
            g[0] += 1
            g[1] += t['ativo']
    cemiterio['titulos'] = [{'titulo': k, 'anuncios': v[0], 'ativos': v[1]} for k, v in sorted(tit.items(), key=lambda kv: -kv[1][0])[:8]]
    anuncios.sort(key=lambda x: -x['dias'])

    unicos = {}
    for x in anuncios:
        unicos.setdefault(x['chave'], []).append(x)
    escolhidos = list(unicos.items())[:a.max]
    print(f"{len(c['anuncios'])} anúncios no censo ({cemiterio['ativos']} ativos, {cemiterio['desligados']} desligados) · {len(unicos)} arquivos distintos ativos · baixando {len(escolhidos)} ...", flush=True)

    def um(item):
        chave, grupo = item
        x = grupo[0]
        ext = '.mp4' if x['tipo'] == 'video' else '.jpg'
        nome = hashlib.md5(chave.encode()).hexdigest()[:12] + ext
        for g in grupo:  # o link assinado de um anúncio pode ter vencido e o do outro não
            try:
                return chave, baixar(g['url'], os.path.join(a.saida, '_brutos', nome))
            except Exception as e:
                erro = str(e)[:80]
        return chave, 'ERRO ' + erro
    with cf.ThreadPoolExecutor(8) as ex:
        arquivos = dict(ex.map(um, escolhidos))
    falhas = [k for k, v in arquivos.items() if v.startswith('ERRO')]

    por_md5 = {}
    for chave, grupo in escolhidos:
        arq = arquivos.get(chave, '')
        if arq.startswith('ERRO') or not os.path.exists(arq):
            continue
        h = md5(arq)
        if h in por_md5:  # mesma peça vinda por outro arquivo
            por_md5[h]['grupo'] += grupo
            os.remove(arq) if arq != por_md5[h]['arquivo'] else None
        else:
            por_md5[h] = {'arquivo': arq, 'grupo': list(grupo)}

    pecas = []
    for h, v in por_md5.items():
        g = v['grupo']
        x = max(g, key=lambda y: y['dias'])
        texto = next((texto_do(y) for y in g if texto_do(y)), '')
        pecas.append({'tipo': x['tipo'], 'arquivo': os.path.relpath(v['arquivo'], a.saida), 'md5': h,
                      'dias_no_ar': x['dias'], 'inicio': time.strftime('%Y-%m-%d', time.gmtime(int(float(x['inicio'])))) if x.get('inicio') else None,
                      'anuncios': len(g), 'versoes': sum(int(y.get('versoes') or 1) for y in g),
                      'ativo': any(y.get('ativo') is True for y in g),
                      'texto': texto, 'titulo': next((y.get('titulo') for y in g if y.get('titulo') and not TEMPLATE.search(y['titulo'])), ''),
                      'cta': x.get('cta'), 'destino': x.get('destino'), 'formato_meta': x.get('formato'),
                      'plataformas': x.get('plataformas'), 'pagina': x.get('pagina'),
                      'link': f"https://www.facebook.com/ads/library/?id={x['lid']}", 'lids': [y['lid'] for y in g],
                      'capa': x.get('capa')})
    pecas.sort(key=lambda p: (-p['dias_no_ar'], -p['anuncios']))
    # coleta repetida: a peça que já existia mantém o código, para a classificação feita não se embaralhar
    antigos = {x['md5']: x['codigo'] for x in (json.load(open(os.path.join(a.saida, 'pecas.json'))) if os.path.exists(os.path.join(a.saida, 'pecas.json')) else []) if x.get('md5')}
    prox = max([int(c[1:]) for c in antigos.values()] or [0]) + 1
    for p in pecas:
        if p['md5'] in antigos:
            p['codigo'] = antigos[p['md5']]
        else:
            p['codigo'] = f'P{prox:03d}'
            prox += 1
    pecas.sort(key=lambda p: p['codigo'])
    for p in pecas:
        if p['tipo'] == 'video':
            p['duracao'], p['dimensao'] = sondar_video(os.path.join(a.saida, p['arquivo']))
    print(f'{len(pecas)} peças distintas. Montando miniaturas e folhas ...', flush=True)
    with cf.ThreadPoolExecutor(6) as ex:
        list(ex.map(lambda p: miniatura(p, os.path.join(a.saida, p['arquivo']), p.get('capa'), os.path.join(a.saida, 'miniaturas')), pecas))
    fs = folhas(pecas, os.path.join(a.saida, 'miniaturas'), os.path.join(a.saida, 'folhas'))

    json.dump(pecas, open(os.path.join(a.saida, 'pecas.json'), 'w'), ensure_ascii=False, indent=1)
    lote = [{'codigo': p['codigo'], 'folha': p['folha'], 'tipo': p['tipo'], 'dias_no_ar': p['dias_no_ar'],
             'duracao': p.get('duracao'), 'anuncios': p['anuncios'], 'texto': p['texto'][:500], 'titulo': p['titulo'],
             'cta': p['cta']} for p in pecas]
    json.dump(lote, open(os.path.join(a.saida, 'lote.json'), 'w'), ensure_ascii=False, indent=1)
    vids = sum(1 for p in pecas if p['tipo'] == 'video')
    resumo = {'declarado': (c.get('declarado') or '').strip(), 'motivo_fim': c.get('motivo_fim'), 'cemiterio': cemiterio,
              'anuncios_no_censo': len(c['anuncios']), 'sem_midia': sem_midia, 'arquivos_distintos': len(unicos),
              'baixados': len(escolhidos) - len(falhas), 'falhas_download': len(falhas), 'pecas': len(pecas),
              'videos': vids, 'imagens': len(pecas) - vids, 'folhas': len(fs),
              'cortado_no_teto': len(unicos) > a.max, 'pagina': next((p['pagina'] for p in pecas if p.get('pagina')), None)}
    json.dump(resumo, open(os.path.join(a.saida, 'coleta.json'), 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(resumo, ensure_ascii=False))
    if resumo['cortado_no_teto']:
        print(f'aviso: {len(unicos)} arquivos distintos e o teto é {a.max}; ficaram as {a.max} peças mais antigas no ar.')
    if str(resumo['motivo_fim']).startswith(('teto', 'erro')):
        print('aviso: a coleta parou antes do fim da biblioteca (', resumo['motivo_fim'], '): rode de novo com --paginas maior.')


if __name__ == '__main__':
    main()
