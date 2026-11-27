#!/usr/bin/env python3
"""Catálogo inteiro de cada referência para a aba Produtos da Central: coleções, miniaturas e CSV da Shopify.

    python3 _engine/concorrente/catalogo.py "<pasta da operação>" [domínio ...]
    python3 _engine/concorrente/catalogo.py --teste

Sem domínio, lê todas as pastas de 02 Raio-X. Para cada loja grava em 02 Raio-X/<domínio>/:
  catalogo.json      produtos, coleções com os produtos de cada uma e as linhas do CSV no formato de importação da Shopify
  produtos_folhas/   as miniaturas dos produtos em folhas de 10 x 10, para a Central mostrar a foto sem depender da loja
                     (artefato não carrega imagem de outro site)
Lê /products.json e /collections.json públicos, 250 por página, até vir página vazia, e /collections/<handle>/products.json
para saber o que está em cada coleção. Só lê o que qualquer visitante vê. Depois, rode o central.py de novo.
"""
import concurrent.futures as cf, csv, glob, io, json, os, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
POR_PAGINA, MAX_PAGINAS = 250, 80          # 20 mil itens por lista: acima disso é laço, não catálogo
PULAR = {'all', 'frontpage'}               # "all" é o catálogo inteiro (tem botão próprio); frontpage é a vitrine da home
LADO, COLUNAS = 160, 10                    # miniatura de 160 px, folha de 10 x 10

CABECALHO = ['Handle', 'Title', 'Body (HTML)', 'Vendor', 'Type', 'Tags', 'Published',
             'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value', 'Option3 Name', 'Option3 Value',
             'Variant SKU', 'Variant Grams', 'Variant Inventory Policy', 'Variant Fulfillment Service',
             'Variant Price', 'Variant Compare At Price', 'Variant Requires Shipping', 'Variant Taxable',
             'Image Src', 'Image Position', 'Status']


def get(url, tentativas=6, binario=False):
    for t in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*' if binario else 'application/json'})
            with urllib.request.urlopen(req, timeout=30) as r:
                dados = r.read()
            return dados if binario else json.loads(dados.decode('utf-8', 'replace'))
        except urllib.error.HTTPError as e:
            if e.code in (429, 430, 503) and t < tentativas - 1:
                # espera o que a loja declara (Retry-After), com teto: 5 s fixos caíam dentro da janela de 60 s (0355)
                try:
                    espera = int(e.headers.get('Retry-After') or 0)
                except ValueError:
                    espera = 0
                time.sleep(min(max(espera, 5 * (t + 1)), 120) + 2); continue
            raise RuntimeError(f'{url} -> HTTP {e.code}')
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            if t < tentativas - 1:
                time.sleep(3); continue
            raise RuntimeError(f'{url} -> {e}')


def paginar(base, chave):
    itens = []
    for p in range(1, MAX_PAGINAS + 1):
        lote = get(f'{base}{"&" if "?" in base else "?"}limit={POR_PAGINA}&page={p}').get(chave, [])
        if not lote:
            return itens
        itens += lote
        time.sleep(1.5)
    raise RuntimeError(f'{base}: mais de {MAX_PAGINAS} páginas, parei para não entrar em laço')


def linhas_csv(p):
    """Linhas do produto no formato de importação da Shopify: a 1a leva título e corpo, as outras variantes e imagens."""
    nomes = [o.get('name', '') for o in p.get('options') or []] + ['', '', '']
    imgs = [i.get('src', '').split('?')[0] for i in p.get('images') or []]
    tags = p.get('tags') or []
    tags = ', '.join(tags) if isinstance(tags, list) else str(tags)
    linhas = []
    for n, v in enumerate(p.get('variants') or [{}]):
        primeira = n == 0
        linhas.append({
            'Handle': p['handle'],
            'Title': p.get('title', '') if primeira else '',
            'Body (HTML)': (p.get('body_html') or '') if primeira else '',
            'Vendor': p.get('vendor', '') if primeira else '',
            'Type': p.get('product_type', '') if primeira else '',
            'Tags': tags if primeira else '',
            'Published': 'TRUE' if primeira else '',
            'Option1 Name': nomes[0] if primeira else '', 'Option1 Value': v.get('option1') or '',
            'Option2 Name': nomes[1] if primeira else '', 'Option2 Value': v.get('option2') or '',
            'Option3 Name': nomes[2] if primeira else '', 'Option3 Value': v.get('option3') or '',
            'Variant SKU': v.get('sku') or '', 'Variant Grams': v.get('grams') or 0,
            'Variant Inventory Policy': 'deny', 'Variant Fulfillment Service': 'manual',
            'Variant Price': v.get('price') or '', 'Variant Compare At Price': v.get('compare_at_price') or '',
            'Variant Requires Shipping': 'TRUE', 'Variant Taxable': 'TRUE',
            'Image Src': imgs[n] if n < len(imgs) else '', 'Image Position': n + 1 if n < len(imgs) else '',
            'Status': 'active' if primeira else '',
        })
    for n in range(len(linhas), len(imgs)):            # imagem que sobra vira linha só de imagem
        linhas.append({'Handle': p['handle'], 'Image Src': imgs[n], 'Image Position': n + 1})
    buf = io.StringIO()
    csv.DictWriter(buf, fieldnames=CABECALHO, lineterminator='\r\n', extrasaction='ignore').writerows(linhas)
    return buf.getvalue()


def menor(vs, campo):
    vals = [float(v[campo]) for v in vs if v.get(campo) not in (None, '', '0.00', '0')]
    return min(vals) if vals else None


def resumo(p):
    vs = p.get('variants') or []
    return {'h': p['handle'], 't': p.get('title', ''), 'tipo': p.get('product_type', ''), 'preco': menor(vs, 'price'),
            'de': menor(vs, 'compare_at_price'), 'nv': len(vs), 'img': ((p.get('images') or [{}])[0]).get('src'),
            'csv': linhas_csv(p)}


def coletar(dominio):
    base = f'https://{dominio}'
    produtos = paginar(f'{base}/products.json', 'products')
    if not produtos:
        raise RuntimeError(f'{dominio}: /products.json veio vazio')
    try:
        moeda = get(f'{base}/cart.js').get('currency')
    except RuntimeError:
        moeda = None
    idx = {p['handle']: i for i, p in enumerate(produtos)}
    colecoes, faltaram = [], []
    try:
        lista = paginar(f'{base}/collections.json', 'collections')
    except RuntimeError as e:
        lista, faltaram = [], ['(lista de coleções: ' + str(e)[-40:] + ')']
    for c in lista:
        if c['handle'] in PULAR or not c.get('products_count'):
            continue
        if faltaram:  # a loja já limitou: não insiste nas outras, o catálogo sai com os produtos e as coleções lidas
            faltaram.append(c['handle']); continue
        # handle com acento ou ™ (caso old-money.com, 03/11/2026) quebra o urllib sem o quote
        try:
            hs = [p['handle'] for p in paginar(f'{base}/collections/{urllib.parse.quote(c["handle"])}/products.json', 'products')]
        except RuntimeError:
            faltaram.append(c['handle']); continue
        i = sorted({idx[h] for h in hs if h in idx})
        if i:
            colecoes.append({'h': c['handle'], 't': c.get('title', c['handle']), 'n': len(i), 'i': i})
    colecoes.sort(key=lambda c: -c['n'])
    return {'dominio': dominio, 'moeda': moeda, 'coletado_em': datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M UTC'),
            'n': len(produtos), 'colecoes_faltaram': faltaram, 'cabecalho': ','.join(CABECALHO), 'colecoes': colecoes, 'produtos': [resumo(p) for p in produtos]}


def mini_url(src):
    return src + ('&' if '?' in src else '?') + 'width=240'


def folhas(produtos, pasta, baixar=lambda u: get(u, binario=True)):
    """Miniaturas em folhas de COLUNAS x COLUNAS; cada produto ganha s = [folha, coluna, linha]. Foto que não baixa fica sem s."""
    from PIL import Image
    os.makedirs(pasta, exist_ok=True)
    for f in glob.glob(os.path.join(pasta, 'folha_*.jpg')):
        os.remove(f)                                    # folha velha com outra ordem trocaria a foto do produto

    def uma(p):
        try:
            im = Image.open(io.BytesIO(baixar(mini_url(p['img'])))).convert('RGBA')
        except Exception:
            return None
        fundo = Image.new('RGBA', im.size, (255, 255, 255, 255))
        im = Image.alpha_composite(fundo, im).convert('RGB')
        im.thumbnail((LADO, LADO))
        quadro = Image.new('RGB', (LADO, LADO), (255, 255, 255))
        quadro.paste(im, ((LADO - im.width) // 2, (LADO - im.height) // 2))
        return quadro

    com_foto = [p for p in produtos if p.get('img')]
    with cf.ThreadPoolExecutor(8) as ex:
        quadros = list(ex.map(uma, com_foto))
    ok = [(p, q) for p, q in zip(com_foto, quadros) if q]
    por_folha = COLUNAS * COLUNAS
    for k in range(0, len(ok), por_folha):
        bloco = ok[k:k + por_folha]
        linhas = -(-len(bloco) // COLUNAS)
        folha = Image.new('RGB', (COLUNAS * LADO, linhas * LADO), (255, 255, 255))
        for j, (p, q) in enumerate(bloco):
            folha.paste(q, ((j % COLUNAS) * LADO, (j // COLUNAS) * LADO))
            p['s'] = [k // por_folha, j % COLUNAS, j // COLUNAS]
        folha.save(os.path.join(pasta, f'folha_{k // por_folha:02d}.jpg'), quality=72, optimize=True)
    return len(ok)


def teste():
    p = {'handle': 'linen-shirt', 'title': 'Linen Shirt, "Capri"', 'body_html': '<p>Linho\nleve</p>', 'vendor': 'X',
         'product_type': 'Shirts', 'tags': ['linen', 'summer'], 'options': [{'name': 'Color'}, {'name': 'Size'}],
         'images': [{'src': 'https://cdn.shopify.com/a.jpg?v=1'}, {'src': 'https://cdn.shopify.com/b.jpg'},
                    {'src': 'https://cdn.shopify.com/c.jpg'}],
         'variants': [{'option1': 'Navy', 'option2': 'S', 'price': '64.99', 'compare_at_price': '100.00', 'grams': 0},
                      {'option1': 'Navy', 'option2': 'M', 'price': '59.99', 'compare_at_price': None}]}
    linhas = list(csv.DictReader(io.StringIO(','.join(CABECALHO) + '\r\n' + linhas_csv(p))))
    assert len(linhas) == 3, linhas                     # 2 variantes + 1 imagem que sobra
    assert linhas[0]['Title'] == 'Linen Shirt, "Capri"' and linhas[0]['Body (HTML)'] == '<p>Linho\nleve</p>'
    assert linhas[1]['Title'] == '' and linhas[1]['Body (HTML)'] == '' and linhas[1]['Option2 Value'] == 'M'
    assert linhas[0]['Image Src'] == 'https://cdn.shopify.com/a.jpg' and linhas[2]['Image Position'] == '3'
    assert linhas[0]['Tags'] == 'linen, summer' and linhas[0]['Variant Compare At Price'] == '100.00'
    r = resumo(p)
    assert (r['preco'], r['de'], r['nv']) == (59.99, 100.0, 2) and mini_url(r['img']).endswith('?v=1&width=240')
    import tempfile
    from PIL import Image
    png = io.BytesIO(); Image.new('RGBA', (300, 200), (10, 20, 30, 0)).save(png, 'PNG')
    prods = [{'img': f'u{i}'} for i in range(102)] + [{'img': 'quebrada'}, {}]
    with tempfile.TemporaryDirectory() as d:
        n = folhas(prods, d, baixar=lambda u: b'x' if 'quebrada' in u else png.getvalue())
        assert n == 102 and prods[0]['s'] == [0, 0, 0] and prods[101]['s'] == [1, 1, 0]
        assert 's' not in prods[102] and 's' not in prods[103]
        assert Image.open(os.path.join(d, 'folha_01.jpg')).size == (COLUNAS * LADO, LADO)
        assert Image.open(os.path.join(d, 'folha_00.jpg')).getpixel((5, 5)) == (255, 255, 255)   # transparente vira branco
    print('catalogo.py: autoteste ok')


def main():
    if '--teste' in sys.argv:
        return teste()
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    op = os.path.abspath(sys.argv[1])
    doms = sys.argv[2:] or [os.path.basename(p) for p in sorted(glob.glob(os.path.join(op, '02 Raio-X', '*'))) if os.path.isdir(p)]
    for dom in doms:
        dom = dom.lower().replace('https://', '').replace('http://', '').strip('/')
        pasta = os.path.join(op, '02 Raio-X', dom)
        os.makedirs(pasta, exist_ok=True)
        try:
            dados = coletar(dom)
        except RuntimeError as e:
            print(f'{dom}: não consegui ler o catálogo ({e}); as outras lojas seguem')
            continue
        n_fotos = folhas(dados['produtos'], os.path.join(pasta, 'produtos_folhas'))
        for p in dados['produtos']:
            p.pop('img', None)
        with open(os.path.join(pasta, 'catalogo.json'), 'w', encoding='utf-8') as f:
            json.dump(dados, f, ensure_ascii=False, separators=(',', ':'))
        print(f"{dom}: {dados['n']} produtos, {len(dados['colecoes'])} coleções, {n_fotos} miniaturas, moeda {dados['moeda']}" + (f" · {len(dados['colecoes_faltaram'])} coleções não lidas (limite da loja)" if dados['colecoes_faltaram'] else ''))


if __name__ == '__main__':
    main()
