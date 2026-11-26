#!/usr/bin/env python3
"""Lê uma loja Shopify pelo que ela publica: catálogo, preço, riscado, mais vendidos e contexto da oferta.

    python3 loja.py <dominio> [--saida loja.json]

Sem senha, sem acesso: só /products.json, /collections.json e a home. Loja que não é Shopify
volta com shopify=false e o resto vazio.
"""
import json, re, statistics, sys, time, urllib.error, urllib.request

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
# palavra na home ou no anúncio que diz qual é o contexto da oferta
CONTEXTOS = {
    'encerramento': r'closing|store closing|we.?re closing|final (sale|pieces|days|collection)|liquidat|last chance|everything must go|clearance|ausverkauf|liquidaci|fermeture|chiusura',
    'black friday': r'black ?friday|cyber monday',
    'desconto': r'\d{2}\s?% ?off|sale|rabatt|soldes|sconto|rebajas',
}
NAO_PRODUTO = r'gift.?card|shipping|insurance|protection|tip|donation|seguro|frete'
APPS = {'Loox': r'loox', 'Judge.me': r'judge\.?me', 'Klaviyo': r'klaviyo', 'Vitals': r'vitals', 'PageFly': r'pagefly', 'GemPages': r'gempages',
        'Okendo': r'okendo', 'Yotpo': r'yotpo', 'Stamped': r'stamped\.io', 'Trustpilot': r'trustpilot', 'Rebuy': r'rebuyengine',
        'AfterSell': r'aftersell', 'Kaching Bundles': r'kaching', 'Zipify': r'zipify', 'Tidio': r'tidio', 'Gorgias': r'gorgias',
        'Klarna': r'klarna', 'Afterpay': r'afterpay', 'Weglot': r'weglot', 'Langify': r'langify', 'Hextom': r'hextom',
        'TikTok pixel': r'analytics\.tiktok\.com', 'Google Ads': r'googleadservices|gtag/js\?id=AW-', 'Pinterest tag': r'pintrk'}
PDP_SINAIS = {'avaliações': r'(\d[\d,.]*)\s*(?:reviews|avalia|bewertung|avis|recensioni)',
              'urgência': r'only \d+ left|hurry|selling fast|ends in|countdown|timer|last chance|final hours',
              'frete grátis': r'free (?:worldwide )?shipping|frete gr|kostenloser versand|livraison gratuite',
              'garantia': r'warranty|money.?back|guarantee|garantia|garantie',
              'leve mais': r'buy \d|\d for \d|bundle|save \d+\s?%|quantity break|kit',
              'tabela de medidas': r'size (?:guide|chart)|tabela de medidas|größentabelle|guide des tailles',
              'pagamentos': r'paypal|apple.?pay|google.?pay|klarna|afterpay|shop.?pay'}


def pegar(url, t=15, tentativas=3):
    # 429, 5xx e timeout passam com espera; 404 e 401 são resposta, não falha
    for i in range(tentativas):
        try:
            r = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
            with urllib.request.urlopen(r, timeout=t) as f:
                return f.read().decode('utf-8', 'replace')
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503, 504) or i == tentativas - 1:
                raise
            if e.code == 429:  # a loja limita leitura seguida: espera mais antes da próxima
                time.sleep(6 * (i + 1))
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if i == tentativas - 1:
                raise
        time.sleep(2 * (i + 1))


def contexto(texto):
    t = (texto or '').lower()
    return [k for k, p in CONTEXTOS.items() if re.search(p, t)]


def ler_loja(dominio, paginas=4, pdp=False):  # pdp=True só no raio-x: a mineração não precisa e lê dezenas de lojas
    d = re.sub(r'^https?://', '', dominio).strip('/').split('/')[0]
    out = {'dominio': d, 'shopify': False}
    produtos = []
    try:
        for p in range(1, paginas + 1):
            lote = json.loads(pegar(f'https://{d}/products.json?limit=250&page={p}'))['products']
            produtos += lote
            if len(lote) < 250:
                break
    except Exception as e:
        out['erro'] = str(e)[:120]
        if '429' in out['erro']:  # limite de leitura não é veredito: "não é Shopify" ficaria gravado como fato (0355)
            out['shopify'], out['limite'] = None, True
        return out
    out['shopify'] = True
    reais = [x for x in produtos if not re.search(NAO_PRODUTO, x.get('handle', '') + ' ' + x.get('title', ''), re.I)]
    precos, riscadas, variantes = [], 0, 0
    for x in reais:
        vs = x.get('variants') or []
        if vs:
            try:
                if float(vs[0]['price']) > 0:  # brinde a 0,00 não é preço de venda
                    precos.append(float(vs[0]['price']))
            except Exception:
                pass
        for v in vs:
            variantes += 1
            try:
                if v.get('compare_at_price') and float(v['compare_at_price']) > float(v['price']):
                    riscadas += 1
            except Exception:
                pass
    out['produtos'] = len(reais)
    out['produtos_teto'] = len(produtos) >= 250 * paginas  # leu até o teto: o catálogo pode ser maior
    out['preco_mediano'] = round(statistics.median(precos), 2) if precos else None
    out['preco_faixa'] = [round(min(precos), 2), round(max(precos), 2)] if precos else None
    out['riscado'] = f'{riscadas}/{variantes}'
    tipos = {}
    for x in reais:
        k = (x.get('product_type') or '').strip() or '(sem tipo)'
        tipos[k] = tipos.get(k, 0) + 1
    out['tipos'] = sorted(tipos.items(), key=lambda kv: -kv[1])[:8]
    try:
        cols = json.loads(pegar(f'https://{d}/collections.json?limit=250'))['collections']
        # coleção vazia é sobra de importação, não estrutura da loja
        out['colecoes'] = [{'titulo': c['title'], 'handle': c['handle'], 'produtos': c.get('products_count')}
                           for c in cols if c.get('products_count')][:40]
    except Exception:
        out['colecoes'] = []
    try:
        best = json.loads(pegar(f'https://{d}/collections/all/products.json?sort_by=best-selling&limit=30'))['products']
        vistos, top = set(), []
        for x in best:
            if re.search(NAO_PRODUTO, x['handle'] + ' ' + x['title'], re.I) or x['title'] in vistos:
                continue
            vistos.add(x['title'])
            vs = x.get('variants') or [{}]
            top.append({'titulo': x['title'], 'preco': vs[0].get('price'), 'riscado': vs[0].get('compare_at_price'),
                        'link': f"https://{d}/products/{x['handle']}",
                        'foto': (x.get('images') or [{}])[0].get('src')})
            if len(top) == 10:
                break
        out['mais_vendidos'] = top
    except Exception:
        out['mais_vendidos'] = []
    # a página do mais vendido: o que ela usa para vender
    # o produto principal mais vendido (acessório barato na frente do ranking não conta)
    piso = (out.get('preco_mediano') or 0) * 0.6
    principal = next((m for m in out.get('mais_vendidos') or [] if float(m.get('preco') or 0) >= piso), None)
    if principal and pdp:
        try:
            time.sleep(2)
            pdp = pegar(principal['link'], tentativas=4)
            txt = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', re.sub(r'(?s)<(script|style)[^>]*>.*?</\1>', ' ', pdp)))
            sinais = {}
            for nome, p in PDP_SINAIS.items():
                m = re.search(p, txt, re.I)
                if m:
                    sinais[nome] = txt[max(0, m.start() - 40):m.end() + 40].strip()
            out['pdp'] = {'link': principal['link'], 'produto': principal['titulo'], 'sinais': sinais}
        except Exception as e:
            out['pdp'] = {'erro': str(e)[:80]}
    elif pdp:  # sem mais vendidos (429 na leitura) não há produto principal: fica registrado, senão a aba Site sai sem página de produto e calada (05/11/2026)
        out['pdp'] = {'erro': 'sem mais vendidos para escolher o produto principal; rodar o loja.py de novo quando a loja liberar a leitura'}
    try:
        home = pegar(f'https://{d}/')
        m = re.search(r'Shopify\.currency\s*=\s*\{"active":"([A-Z]{3})"', home) or re.search(r'"currency":"([A-Z]{3})"', home)
        out['moeda'] = m.group(1) if m else None
        texto = re.sub(r'<[^>]+>', ' ', re.sub(r'(?s)<(script|style)[^>]*>.*?</\1>', ' ', home))
        out['contexto_home'] = contexto(texto)
        t = re.search(r'<title>(.*?)</title>', home, re.S)
        out['titulo_home'] = re.sub(r'\s+', ' ', t.group(1)).strip()[:120] if t else None
        out['apps'] = [n for n, p in APPS.items() if re.search(p, home, re.I)]
        out['idiomas'] = sorted(set(re.findall(r'hreflang="([a-z]{2})(?:-[A-Za-z]{2})?"', home)) - {'x'})
        # as seções da home, pela ordem dos títulos que o tema escreve
        titulos = [re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', h)).strip() for h in re.findall(r'(?s)<h[12][^>]*>(.*?)</h[12]>', home)]
        out['home_titulos'] = [h for h in dict.fromkeys(titulos) if 2 < len(h) < 90][:14]
        barra = re.search(r'(?s)class="[^"]*announcement[^"]*"[^>]*>(.*?)</(?:div|p|a|section)>', home)
        out['barra_anuncio'] = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', barra.group(1))).strip()[:160] if barra else None
    except Exception:
        out['moeda'], out['contexto_home'] = None, []
    return out


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    r = ler_loja(sys.argv[1], pdp=True)
    saida = sys.argv[sys.argv.index('--saida') + 1] if '--saida' in sys.argv else None
    txt = json.dumps(r, ensure_ascii=False, indent=1)
    if saida:
        open(saida, 'w').write(txt)
    print(txt[:3000])
