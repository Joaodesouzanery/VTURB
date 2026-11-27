#!/usr/bin/env python3
"""Central da operação: uma página com abas que junta tudo o que a operação já produziu.

    python3 central.py "<pasta da operação>"

Lê a pasta da operação (a mesma convenção das skills 136, 137 e 138):
  01 Mineração/concorrentes.json                 aba Mercado
  02 Raio-X/<domínio>/{resumo,pecas,loja,coleta}.json   abas Referências, Banco, Produtos e Site
  02 Raio-X/<domínio>/catalogo.json + produtos_folhas/  coleções, miniaturas e CSV (catalogo.py)
  02 Raio-X/<domínio>/previa/                    a prévia do site (previa.mjs)
  03 Marca/marca.json (+ imagens/)               abas A marca e Criativos
Grava na raiz da pasta:
  Central.html            a central inteira (abre sem internet, a não ser pelas fontes e fotos das lojas)
  Apresentação da marca.html   só a aba A marca, para mandar para alguém
  central_arquivos/       as miniaturas e imagens que a página usa
  central_publicar.json   os arquivos para publicar a Central como artefato, em lotes (index.html, central_arquivos, midia)

Voto do Mercado (0358): 01 Mineração/votos.json = {"usar": [...], "descartar": [...], "do_pedido": [...]}. Com o arquivo, só
loja marcada Usar (ou trazida pelo dono no pedido, "do_pedido") ganha seção de referência; as outras saem com aviso RECUSADA.
Para gravar a partir do botão Copiar as escolhas:
    python3 central.py "<pasta>" --votos "Usar: a.com, b.com | Descartar: c.com" [--do-pedido d.com,e.com]
shortcut: sem votos.json só avisa (operação antiga não quebra); depois que todo fluxo gravar o voto, trocar o aviso por erro.

Aba sem dado não some: mostra o que entra ali e qual skill preenche. Rodar de novo depois de cada etapa.
"""
import glob, html, json, os, re, shutil, statistics, sys, time

E = html.escape
MAX_MERCADO = 10          # o mesmo teto do --max do minerar.py


def carregar(p):
    try:
        return json.load(open(p))
    except Exception:
        return None


def lum(hexa):
    h = (hexa or '#000000').lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contraste(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return round((la + 0.05) / (lb + 0.05), 2)


def baixar_foto(url, dst):
    if os.path.exists(dst):
        return True
    import urllib.request
    url += ('&' if '?' in url else '?') + 'width=300&format=jpg'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        dados = urllib.request.urlopen(req, timeout=20).read()
    except Exception as e:
        print(f'  foto não baixou ({e}): {url[:90]}')
        return False
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    open(dst, 'wb').write(dados)
    if dados[:3] != b'\xff\xd8\xff':  # o CDN ignora format=jpg em PNG com transparência: converte para o tipo bater com o .jpg
        try:
            from PIL import Image
            Image.open(dst).convert('RGB').save(dst, 'JPEG', quality=85)
        except Exception:
            import subprocess
            subprocess.run(['sips', '-s', 'format', 'jpeg', dst, '--out', dst], capture_output=True)
    return True


_YUNET = None
def cabecas(src):
    """Caixas (y0, y1, x0, x1) em fração da imagem de cada cabeça, com o cabelo (rosto do YuNet esticado para cima).
    None quando não dá para medir (sem OpenCV ou sem o modelo); [] quando a foto não tem rosto."""
    global _YUNET
    try:
        import cv2
        if _YUNET is None:
            f = os.path.expanduser('~/.basex/modelos/face_detection_yunet_2023mar.onnx')
            if not os.path.exists(f):
                import urllib.request
                os.makedirs(os.path.dirname(f), exist_ok=True)
                urllib.request.urlretrieve('https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/'
                                           'face_detection_yunet_2023mar.onnx', f)
            _YUNET = cv2.FaceDetectorYN.create(f, '', (320, 320), 0.8)
        im = cv2.imread(src); h, w = im.shape[:2]; _YUNET.setInputSize((w, h)); _, r = _YUNET.detect(im)
    except Exception as e:
        print('aviso: sem detector de rosto para o banner (' + str(e)[:80] + '); posição do texto não conferida')
        return None
    return [(max(0, (y - .6 * fh) / h), (y + fh * 1.15) / h, (x - .3 * fw) / w, (x + fw * 1.3) / w)
            for x, y, fw, fh in ((float(a[0]), float(a[1]), float(a[2]), float(a[3])) for a in (r if r is not None else []))]


# área que o texto ocupa, em fração da imagem (medida no navegador a 375 e 1440 de largura, com folga)
TXT_M = {'topo': (0, .40), 'baixo': (.60, 1)}
TXT_D = {'esquerda': (0, .45), 'direita': (.55, 1)}


def lugar_do_texto(b, src_d, src_m):
    """O texto nunca cobre cabeça: escolhe topo/baixo no celular e esquerda/direita no computador pelo rosto medido.
    Sem lugar livre, marca o banner para gerar de novo com mais espaço."""
    cruza = lambda a, z: a[0] < z[1] and z[0] < a[1]
    if src_m:
        cs = cabecas(src_m)
        if cs is not None:
            ok = [k for k in ('topo', 'baixo') if not any(cruza((c[0], c[1]), TXT_M[k]) for c in cs)]
            pref = b.get('lado_mobile') or 'topo'
            b['pos_mobile'] = pref if pref in ok else (ok[0] if ok else pref)
            if not ok:
                b['aviso'] = 'celular: a cabeça ocupa o topo e o pé da foto; gerar de novo com a cabeça no meio e espaço livre em cima'
    if src_d:
        cs = cabecas(src_d)
        if cs is not None:
            ok = [k for k in ('esquerda', 'direita') if not any(cruza((c[2], c[3]), TXT_D[k]) for c in cs)]
            pref = b.get('lado') or 'esquerda'
            b['lado'] = pref if pref in ok else (ok[0] if ok else pref)
            if not ok:
                b['aviso'] = (b.get('aviso', '') + ' · ' if b.get('aviso') else '') + 'computador: sem lado livre da cabeça para o texto'


def copiar(src, dst):
    if src and os.path.exists(src):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if not os.path.exists(dst) or os.path.getmtime(src) > os.path.getmtime(dst):
            shutil.copy2(src, dst)
        return True
    return False


PS_COLS, PS_LIN, PS_W, PS_H = 8, 10, 400, 300


def folhas_de_pecas(caminhos, pasta):
    """Miniaturas das peças juntas em folhas de 8x10 (4:3, contidas): uma loja de 80 peças vira 1 arquivo em vez de 80.
    O artefato tem teto de 511 arquivos e com 7 lojas as miniaturas soltas ocupavam 408 (04/11/2026).
    Devolve, por peça, (nome da folha relativo a central_arquivos, [coluna, linha, linhas da folha]) ou ('', None)."""
    from PIL import Image
    for velho in glob.glob(os.path.join(pasta, 'P[0-9]*.jpg')) + glob.glob(os.path.join(pasta, 'pecas_*.jpg')):
        os.remove(velho)
    por = PS_COLS * PS_LIN
    saida = [('', None)] * len(caminhos)
    validos = [(i, c) for i, c in enumerate(caminhos) if os.path.exists(c)]
    for k in range(0, len(validos), por):
        bloco = validos[k:k + por]
        lin = -(-len(bloco) // PS_COLS)
        folha = Image.new('RGB', (PS_COLS * PS_W, lin * PS_H), (237, 239, 231))
        nome = f'pecas_{k // por:02d}.jpg'
        for j, (i, c) in enumerate(bloco):
            im = Image.open(c).convert('RGB')
            im.thumbnail((PS_W, PS_H))
            folha.paste(im, ((j % PS_COLS) * PS_W + (PS_W - im.width) // 2, (j // PS_COLS) * PS_H + (PS_H - im.height) // 2))
            saida[i] = (f'{os.path.basename(pasta)}/{nome}', [j % PS_COLS, j // PS_COLS, lin])
        os.makedirs(pasta, exist_ok=True)
        folha.save(os.path.join(pasta, nome), quality=80, optimize=True)
    return saida


def norm_dom(x):
    return re.sub(r'^(https?://)?(www\.)?', '', (x or '').strip().lower()).split('/')[0]


def ler_votos(texto):
    """Texto do botão Copiar as escolhas ("Usar: a.com, b.com" / "Descartar: nenhuma") -> {'usar': [...], 'descartar': [...]}."""
    v = {'usar': [], 'descartar': []}
    for linha in (texto or '').splitlines():
        m = re.match(r'\s*(usar|descartar)\s*:\s*(.*)', linha, re.I)
        if m:
            v[m.group(1).lower()] += [norm_dom(x) for x in re.split(r'[,;\s]+', m.group(2))
                                      if x and x.lower() not in ('nenhuma', 'nenhum', '—', '-')]
    return v


def referencia_liberada(dom, votos):
    """None = sem votos.json (não confere); True/False = loja marcada Usar ou trazida pelo dono / não."""
    if votos is None:
        return None
    return norm_dom(dom) in {norm_dom(x) for x in (votos.get('usar') or []) + (votos.get('do_pedido') or [])}


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    OP = os.path.abspath(sys.argv[1])
    arg = lambda k: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else None
    arq_votos = os.path.join(OP, '01 Mineração', 'votos.json')
    if arg('--votos') is not None:
        v = ler_votos(arg('--votos').replace('\\n', '\n').replace(' | ', '\n'))
        v['do_pedido'] = sorted({norm_dom(x) for x in (arg('--do-pedido') or '').split(',') if x.strip()}
                                | set((carregar(arq_votos) or {}).get('do_pedido') or []))
        os.makedirs(os.path.dirname(arq_votos), exist_ok=True)
        json.dump(v, open(arq_votos, 'w'), ensure_ascii=False, indent=1)
        print(f"votos gravados: usar {len(v['usar'])}, descartar {len(v['descartar'])}, do pedido {len(v['do_pedido'])}")
    votos = carregar(arq_votos)
    recusadas = []
    ARQ = os.path.join(OP, 'central_arquivos')
    os.makedirs(ARQ, exist_ok=True)
    nome_op = os.path.basename(OP)

    mineracao = carregar(os.path.join(OP, '01 Mineração', 'concorrentes.json'))
    if mineracao:
        # padrão da casa (03/11/2026): o Mercado mostra no máximo 10 lojas; mineração antiga com mais passa o resto para a reserva
        if len(mineracao.get('lojas') or []) > MAX_MERCADO:
            mineracao['reserva'] = mineracao['lojas'][MAX_MERCADO:] + (mineracao.get('reserva') or [])
            mineracao['lojas'] = mineracao['lojas'][:MAX_MERCADO]
        for l in mineracao['lojas']:
            if copiar(os.path.join(OP, '01 Mineração', 'previa', l['dominio'] + '.jpg'), os.path.join(ARQ, 'mercado', l['dominio'] + '.jpg')):
                l['previa'] = f"central_arquivos/mercado/{l['dominio']}.jpg"
    refs = []
    for pasta in sorted(glob.glob(os.path.join(OP, '02 Raio-X', '*'))):
        pecas = carregar(os.path.join(pasta, 'pecas.json'))
        # loja aprovada sem anúncio achado (blenin, 04/11/2026) entra pelo catálogo: os produtos dela aparecem mesmo assim
        if not os.path.isdir(pasta) or not (pecas or os.path.exists(os.path.join(pasta, 'catalogo.json'))):
            continue
        pecas = pecas or []
        dom = os.path.basename(pasta)
        if referencia_liberada(dom, votos) is False:  # referência sem voto Usar não ganha seção (0358)
            recusadas.append(dom)
            continue
        for velho in glob.glob(os.path.join(ARQ, dom, 'P[0-9]*.jpg')):
            os.remove(velho)  # miniatura de peça que saiu da coleta ficaria no artefato e gastaria o teto de arquivos
        resumo = carregar(os.path.join(pasta, 'resumo.json')) or {}
        coleta = carregar(os.path.join(pasta, 'coleta.json')) or {}
        loja = carregar(os.path.join(pasta, 'loja.json')) or resumo.get('loja') or {}
        lista = []
        folha_pecas = folhas_de_pecas([os.path.join(pasta, 'miniaturas', p['codigo'] + '.jpg') for p in pecas], os.path.join(ARQ, dom))
        for p, (mini, sp) in zip(pecas, folha_pecas):
            arq = p.get('arquivo_organizado') or p.get('arquivo')
            src = os.path.join(pasta, arq) if arq and os.path.exists(os.path.join(pasta, arq)) else None
            lista.append({k: p.get(k) for k in ('codigo', 'tipo', 'duracao', 'dias_no_ar', 'anuncios', 'versoes', 'formato', 'formato2',
                                                 'gancho', 'funil', 'oferta', 'motivo_desconto', 'angulo', 'dor', 'promessa', 'texto_tela',
                                                 'pessoa', 'idioma', 'destaque', 'nota', 'link', 'titulo', 'cta')}
                         | {'mini': 'central_arquivos/' + mini if mini else '', 'sp': sp, 'arquivo': f'02 Raio-X/{dom}/{arq}' if arq else None, 'loja': dom, '_src': src})
        previa = {}
        for nome in ('home', 'home_celular', 'pdp_celular'):
            if copiar(os.path.join(pasta, 'previa', nome + '.jpg'), os.path.join(ARQ, dom, 'previa', nome + '.jpg')):
                previa[nome] = f'central_arquivos/{dom}/previa/{nome}.jpg'
        # foto dos mais vendidos: o artefato não carrega imagem de outro site, então vai baixada junto (CDN de imagem, não o products.json)
        for i, m in enumerate(loja.get('mais_vendidos') or [], 1):
            if m.get('foto', '').startswith('http'):
                rel = f'{dom}/mais_vendidos/{i:02d}.jpg'
                if baixar_foto(m['foto'], os.path.join(ARQ, rel)):
                    m['foto_local'] = 'central_arquivos/' + rel
        produtos = None
        cat = carregar(os.path.join(pasta, 'catalogo.json'))
        if cat:
            folhas = []
            for f in sorted(glob.glob(os.path.join(pasta, 'produtos_folhas', 'folha_*.jpg'))):
                copiar(f, os.path.join(ARQ, dom, 'produtos_folhas', os.path.basename(f)))
                folhas.append(f'central_arquivos/{dom}/produtos_folhas/{os.path.basename(f)}')
            # as linhas do CSV vão num .js à parte, carregado só no clique: a página fica leve com catálogo de mil produtos,
            # e <script src> abre tanto no arquivo local quanto no artefato (fetch de arquivo local o navegador recusa)
            os.makedirs(os.path.join(ARQ, dom), exist_ok=True)
            with open(os.path.join(ARQ, dom, 'catalogo.js'), 'w', encoding='utf-8') as fh:
                fh.write('window.CATALOGO=window.CATALOGO||{};window.CATALOGO[' + json.dumps(dom) + ']='
                         + json.dumps({'cabecalho': cat['cabecalho'], 'csv': [p['csv'] for p in cat['produtos']]}, ensure_ascii=False)
                         .replace('</', '<\\/') + ';')
            produtos = {'n': cat['n'], 'moeda': cat.get('moeda'), 'lido': cat.get('coletado_em'), 'folhas': folhas,
                        'itens': [{k: p.get(k) for k in ('t', 'h', 'preco', 'de', 's')} for p in cat['produtos']],
                        # "Todos os produtos" sempre na frente: com a loja limitando a leitura das coleções, é ela que mostra as fotos
                        'colecoes': [{'h': 'all', 't': 'Todos os produtos', 'n': cat['n'], 'i': list(range(cat['n']))}]
                                    + [{k: c[k] for k in ('h', 't', 'n', 'i')} for c in cat['colecoes'] if c['n'] < cat['n']],
                        'colecoes_faltaram': len(cat.get('colecoes_faltaram') or [])}
        cu = (carregar(os.path.join(pasta, 'censo_ativos.json')) or carregar(os.path.join(pasta, 'censo.json')) or {}).get('url') or ''
        refs.append({'page_id': (re.search(r'view_all_page_id=(\d+)', cu) or [None, None])[1], 'dominio': dom, 'sid': re.sub(r'[^a-z0-9]+', '-', dom.lower()).strip('-'),
                     'nome': resumo.get('pagina') or coleta.get('pagina') or dom, 'resumo': resumo, 'coleta': coleta,
                     'loja': loja, 'pecas': lista, 'classificadas': sum(1 for p in lista if p.get('formato')),
                     'texto': next((p.get('texto') for p in pecas if p.get('texto')), ''), 'previa': previa, 'produtos': produtos})

    for d in recusadas:
        print(f'  RECUSADA: {d} não está como Usar no Mercado nem veio no pedido do dono; sem seção na Central (votos.json)')
    if votos is None and mineracao and refs:
        print('  aviso: sem 01 Mineração/votos.json, o voto Usar das referências não foi conferido (grave com --votos "<texto do Copiar as escolhas>")')

    # o artefato tem teto (256 MB e 511 arquivos por versão): entram primeiro os destaques e as peças há mais tempo no ar;
    # shortcut: o resto baixa pela biblioteca de anúncios; com mais de ~4 lojas, comprimir os vídeos antes de subir o teto
    TETO_MIDIA, TETO_ARQ = 180e6, 19 * 2 ** 20
    usado, midias = 0, []
    # teto de arquivos: o que a página já usa (miniaturas, folhas, prévias) vem antes; os vídeos e imagens para baixar ocupam o resto
    vagas = 500 - sum(len(fs) for _, _, fs in os.walk(ARQ)) - 1
    for p in sorted((p for r in refs for p in r['pecas'] if p['_src']),
                    key=lambda p: (not p.get('destaque'), -(p.get('dias_no_ar') or 0))):
        t = os.path.getsize(p['_src'])
        if t <= TETO_ARQ and usado + t <= TETO_MIDIA and len(midias) < vagas:
            ext = os.path.splitext(p['_src'])[1].lower()
            p['midia'] = f"midia/{p['loja']}/{p['codigo']}{ext}"
            # criativos/ é hardlink do _brutos, e a publicação recusa arquivo com mais de um link (03/11/2026): vai uma cópia
            copia = os.path.join(OP, 'central_midia', p['loja'], p['codigo'] + ext)
            copiar(p['_src'], copia)
            midias.append({'as': p['midia'], 'path': copia})
            usado += t
    for r in refs:
        for p in r['pecas']:
            p.pop('_src', None)

    # debriefing do nicho, escrito pelo Claude depois do raio-x: fragmento HTML que vira a aba Debriefing
    deb_arq = os.path.join(OP, '00 Debriefing', 'debriefing.html')
    debriefing = open(deb_arq).read() if os.path.exists(deb_arq) else ''
    marca = carregar(os.path.join(OP, '03 Marca', 'marca.json'))
    if marca:
        base = os.path.join(OP, '03 Marca')
        def img(rel):
            if not rel:
                return None
            src = rel if os.path.isabs(rel) else os.path.join(base, rel)
            dst = os.path.join(ARQ, 'marca', os.path.basename(src))
            return 'central_arquivos/marca/' + os.path.basename(src) if copiar(src, dst) else None
        # o Lucas nunca pediu proibição de storytelling (05/11/2026, "para tudo"): item de "nunca escrever" ou de
        # "tom evita" que proíbe atelier, feito à mão e afins sai da marca, com aviso
        STORY = re.compile(r'atelier|workshop|handmade|hand-made|feito à mão|feito a mão|artisan|artesan|craft|made by hand|tailored in|designed in', re.I)
        for dono, campo in ((marca.get('copy') or {}, 'nunca_escrever'), (marca.get('tom') or {}, 'evita')):
            fora = [x for x in dono.get(campo) or [] if isinstance(x, str) and STORY.search(x)]
            if fora:
                dono[campo] = [x for x in dono[campo] if x not in fora]
                print('aviso: tirei de', campo, 'proibição de storytelling que o dono não pediu:', ' | '.join(f[:60] for f in fora))
        ide = marca.setdefault('identidade', {})
        for k in ('logo', 'monograma', 'favicon'):
            ide[k + '_img'] = img(ide.get(k))
        if marca.get('fundador'):
            marca['fundador']['rosto_img'] = img(marca['fundador'].get('rosto'))
        for b in marca.get('banners') or []:
            b['desktop_img'], b['mobile_img'] = img(b.get('desktop')), img(b.get('mobile'))
            ab = lambda r: r if not r or os.path.isabs(r) else os.path.join(base, r)
            lugar_do_texto(b, ab(b.get('desktop')), ab(b.get('mobile')))
            if b.get('aviso'): print('aviso banner', b.get('titulo'), ':', b['aviso'])
        for c in ide.get('cores') or []:
            c['contraste_branco'] = contraste(c['hex'], '#FFFFFF')
            c['contraste_preto'] = contraste(c['hex'], '#0A0A0A')
        # referência citada no plano: pasta:PNNN -> miniatura e link
        idx = {f"{r['dominio']}:{p['codigo']}": p for r in refs for p in r['pecas']}
        for ag in marca.get('angulos') or []:
            ag['refs'] = [{'k': k, 'mini': idx[k]['mini'], 'sp': idx[k].get('sp'), 'link': idx[k]['link']} for k in ag.get('referencias') or [] if k in idx]
            ag['sem_ref'] = [k for k in ag.get('referencias') or [] if k not in idx]

    # o que se repete entre as referências: padrão em duas ou mais, hipótese em uma
    padroes = []
    if len(refs) >= 2:
        def topo(r, campo, n=2):
            ag = (r['resumo'].get('agregados') or {}).get(campo) or []
            return [l['valor'] for l in ag[:n]]
        conta = {}
        for r in refs:
            itens = set()
            itens |= {('Formato que mais roda', v) for v in topo(r, 'formato')}
            itens |= {('Gancho que mais roda', v) for v in topo(r, 'gancho', 1)}
            itens |= {('Oferta', v) for v in topo(r, 'oferta', 1)}
            itens |= {('Motivo do desconto', m) for m, _ in (r['resumo'].get('copy') or {}).get('motivos') or []}
            itens |= {('Elemento na página do produto', s) for s in ((r['loja'].get('pdp') or {}).get('sinais') or {})}
            itens |= {('App', a) for a in r['loja'].get('apps') or []}
            itens |= {('Contexto na home', c) for c in r['loja'].get('contexto_home') or []}
            for i in itens:
                conta.setdefault(i, []).append(r['nome'])
        padroes = sorted(({'tipo': t, 'valor': v, 'lojas': ls} for (t, v), ls in conta.items() if len(ls) >= 2),
                         key=lambda x: (x['tipo'], -len(x['lojas'])))

    etapas = [
        {'nome': 'Mineração', 'skill': '/minerar-concorrentes', 'feito': bool(mineracao)},
        {'nome': 'Raio-X', 'skill': '/raio-x-concorrente', 'feito': any(r['classificadas'] for r in refs)},
        {'nome': 'A nova marca', 'skill': '/apresentar-nova-marca', 'feito': bool(marca)},
        {'nome': 'Produção', 'skill': 'site, criativos e Instagram', 'feito': False},
    ]
    dados = {'op': nome_op, 'gerado': time.strftime('%d/%m/%Y %H:%M'), 'mineracao': mineracao, 'refs': refs, 'marca': marca,
             'padroes': padroes, 'etapas': etapas, 'debriefing': debriefing}
    # tradução: todo texto que veio da loja (copy, título, arte, produto) ganha "ver em português" na página.
    # traducoes.json = {original: português}; o que falta vai para traducoes_pendentes.json e o Claude traduz.
    CHAVES = {'texto', 'titulo', 'texto_tela', 'titulo_link', 'titulo_home', 'copy', 'corpo', 'produto', 'nome_produto'}
    achados = set()
    def varrer(o, k=None):
        if isinstance(o, dict):
            for kk, v in o.items():
                varrer(v, kk)
        elif isinstance(o, list):
            for v in o:
                varrer(v, k)
        elif isinstance(o, str) and k in CHAVES and len(o.strip()) >= 3 and not o.startswith(('http', '/', 'central_')):
            achados.add(o.strip())
    varrer({k: v for k, v in dados.items() if k not in ('marca', 'debriefing')})
    tr_arq = os.path.join(OP, 'traducoes.json')
    tr = carregar(tr_arq) or {}
    pend = sorted(t for t in achados if t not in tr)
    json.dump(pend, open(os.path.join(OP, 'traducoes_pendentes.json'), 'w'), ensure_ascii=False, indent=1)
    dados['tr'] = {k: v for k, v in tr.items() if k in achados and v and v.strip() != k}
    js = json.dumps(dados, ensure_ascii=False).replace('</', '<\\/')
    titulo = (marca or {}).get('nome') or nome_op
    pagina = MOLDE.replace('__TITULO__', E(f'Central · {titulo}')).replace('__DADOS__', js).replace('__SO_MARCA__', 'false')
    open(os.path.join(OP, 'Central.html'), 'w').write(pagina)
    if marca:
        open(os.path.join(OP, 'Apresentação da marca.html'), 'w').write(
            MOLDE.replace('__TITULO__', E(f'{titulo} · apresentação da marca')).replace('__DADOS__', js).replace('__SO_MARCA__', 'true'))
    publicar = lotes_artefato(OP, ARQ, midias)
    json.dump({'titulo': f'Central · {titulo}', 'capacidade': 'downloads', **publicar},
              open(os.path.join(OP, 'central_publicar.json'), 'w'), ensure_ascii=False, indent=1)
    n = sum(len(r['pecas']) for r in refs)
    print(f"tradução: {len(dados['tr'])} textos com português, {len(pend)} pendentes (traducoes_pendentes.json)")
    print(f"ok: {os.path.join(OP, 'Central.html')}\n  mercado: {len((mineracao or {}).get('lojas') or [])} lojas · referências: {len(refs)} "
          f"· banco: {n} peças ({sum(r['classificadas'] for r in refs)} classificadas) · marca: {'sim' if marca else 'ainda não'} · padrões: {len(padroes)}")
    for r in refs:
        if r['classificadas'] < len(r['pecas']):
            print(f"  aviso: {r['dominio']} tem {len(r['pecas']) - r['classificadas']} peças sem classificação (siga o classificar.md e rode o organizar.py)")
    for ag in (marca or {}).get('angulos') or []:
        if ag.get('sem_ref'):
            print(f"  aviso: referência que não existe no raio-x: {', '.join(ag['sem_ref'])}")
    fora = sum(1 for r in refs for p in r['pecas'] if not p.get('midia'))
    print(f"  artefato: {publicar['arquivos']} arquivos, {publicar['mb']} MB em {len(publicar['lotes'])} lote(s) · "
          f"{n - fora} criativos para baixar dentro dele{f', {fora} pela biblioteca' if fora else ''} (central_publicar.json)")
    if publicar['arquivos'] > 500:
        print('  aviso: perto do teto de 511 arquivos do artefato; publique em mais de uma Central ou tire lojas do raio-x')


def lotes_artefato(OP, ARQ, midias, mb_lote=60e6, por_lote=250):
    """Arquivos do artefato em lotes que cabem numa publicação (64 MB e 256 arquivos por chamada)."""
    arquivos = [{'as': 'index.html', 'path': os.path.join(OP, 'Central.html')}]
    for raiz, _, nomes in os.walk(ARQ):
        for n in sorted(nomes):
            full = os.path.join(raiz, n)
            arquivos.append({'as': 'central_arquivos/' + os.path.relpath(full, ARQ).replace(os.sep, '/'), 'path': full})
    arquivos += midias
    lotes, atual, tam = [], [], 0
    for a in arquivos:
        t = os.path.getsize(a['path'])
        if atual and (tam + t > mb_lote or len(atual) >= por_lote):
            lotes.append(atual); atual, tam = [], 0
        atual.append(a); tam += t
    if atual:
        lotes.append(atual)
    return {'lotes': lotes, 'arquivos': len(arquivos), 'mb': round(sum(os.path.getsize(a['path']) for a in arquivos) / 1e6, 1)}


MOLDE = r'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>__TITULO__</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{--ground:#FAFAF8;--surface:#FFFFFF;--surface-2:#F2F4EE;--ink:#0A0A0A;--ink-soft:#2E312C;--muted:#555956;--line:#E0E3D8;--accent:#5F6905;--solid:#BACD0B;--wash:#F3F6E0;--edge:#D3DE8A}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--ground:#0A0A0A;--surface:#1C1C1C;--surface-2:#242520;--ink:#F4F7EF;--ink-soft:#DCE0D6;--muted:#A3A89E;--line:#2E302A;--accent:#BACD0B;--wash:#1F2408;--edge:#3A4210}}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--ground);color:var(--ink);font:15px/1.55 Inter,system-ui,sans-serif}
a{color:var(--accent)}h1,h2,h3{font-family:Fraunces,Georgia,serif;font-weight:600;letter-spacing:-.01em}
header.topo{padding:28px 16px 0;max-width:1240px;margin:auto}header.topo h1{font-size:clamp(28px,5vw,44px);margin:0}header.topo p{color:var(--muted);margin:4px 0 0;font:13px 'IBM Plex Mono',monospace}
nav.abas{position:sticky;top:0;z-index:5;background:var(--ground);border-bottom:1px solid var(--line)}nav.abas div{max-width:1240px;margin:auto;padding:0 16px;display:flex;gap:2px;overflow-x:auto}
nav.abas button{font:500 14px Inter,sans-serif;border:0;background:none;color:var(--muted);padding:12px 12px;cursor:pointer;white-space:nowrap;border-bottom:2px solid transparent}
nav.abas button.on{color:var(--ink);border-bottom-color:var(--solid)}nav.abas button small{font:11px 'IBM Plex Mono',monospace;color:var(--muted);margin-left:4px}
main{max-width:1320px;margin:auto;padding:8px 16px 64px}.aba{display:none}.aba.on{display:grid;grid-template-columns:220px minmax(0,1fr);gap:32px}.aba.sem-trilha.on{display:block}
/* trilha: as seções da aba à esquerda, numeradas e com o grupo "Por loja", como na Central da casa */
.trad{font-size:12.5px;margin:4px 0 8px;color:var(--ink)}.trad summary{cursor:pointer;color:var(--muted,#6b6b6b);font-size:12px;list-style:revert}.trad>div{background:var(--surface-2);border-radius:6px;padding:6px 9px;margin-top:4px}
.trilha{position:sticky;top:50px;align-self:start;max-height:calc(100vh - 60px);overflow:auto;padding:22px 0 16px;font-size:13.5px}
.trilha .tt{font:500 11px 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);margin:0 0 4px 10px}.trilha .ds{font:12px 'IBM Plex Mono',monospace;color:var(--muted);margin:0 0 10px 10px}
.trilha .g{font:500 10.5px 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:14px 0 4px 10px}
.trilha a{display:flex;gap:8px;padding:5px 10px;border-left:2px solid transparent;color:var(--ink-soft);text-decoration:none;line-height:1.35}.trilha a .n{font:12px 'IBM Plex Mono',monospace;color:var(--accent);min-width:18px}
.trilha a:hover,.trilha a.on{border-left-color:var(--solid);color:var(--ink);background:var(--surface-2)}
@media (max-width:999px){.aba.on{display:block}.trilha{position:static;display:flex;flex-wrap:wrap;gap:6px;max-height:none;padding:14px 0 0}.trilha .tt,.trilha .ds,.trilha .g{display:none}.trilha a{border:1px solid var(--line);border-radius:999px;padding:3px 10px}}
section{padding:22px 0;border-bottom:1px solid var(--line);scroll-margin-top:54px}section:last-child{border-bottom:0}
h2{font-size:28px;margin:0 0 4px}h3{font-size:21px;margin:18px 0 6px}.sub{color:var(--muted);margin:0 0 14px;max-width:820px}.eyebrow{font:500 11px 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--accent)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin:12px 0}.kpi{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px 14px}.kpi b{display:block;font:600 24px Fraunces,serif}.kpi span{color:var(--muted);font-size:13px}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}.caixa{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px 16px}.caixa h4{margin:0 0 6px;font:600 12px 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.caixa p{margin:4px 0}.caixa ul{margin:4px 0;padding-left:18px}.vazio{background:var(--surface-2);border:1px dashed var(--line);border-radius:10px;padding:18px;color:var(--muted)}.vazio code{color:var(--ink)}
.tab{overflow-x:auto;border:1px solid var(--line);border-radius:10px;background:var(--surface)}table{border-collapse:collapse;width:100%;font-size:13.5px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{font:500 12px 'IBM Plex Mono',monospace;color:var(--muted);background:var(--surface-2);white-space:nowrap}tr:last-child td{border-bottom:0}
.sim{color:var(--accent);font-weight:600}.nao{color:var(--muted)}.chip{display:inline-block;font-size:12px;background:var(--surface-2);border-radius:4px;padding:1px 7px;margin:0 4px 4px 0}.chip.f{background:var(--wash);color:var(--accent);font-weight:600}
.barra{display:grid;grid-template-columns:150px 1fr 70px;gap:10px;align-items:center;font-size:13px;margin:4px 0}.barra i{display:block;height:9px;background:var(--solid);border-radius:2px}
.fluxo{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:14px 0}.passo{border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:var(--surface)}.passo.ok{border-color:var(--edge);background:var(--wash)}.passo b{display:block}.passo span{font:12px 'IBM Plex Mono',monospace;color:var(--muted)}
.filtros{display:flex;flex-direction:column;gap:6px;margin:10px 0}.linha{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.linha b{font:12px 'IBM Plex Mono',monospace;color:var(--muted);min-width:64px}
.linha button{font:13px Inter,sans-serif;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:3px 10px;cursor:pointer}.linha button.on{background:var(--solid);color:#0A0A0A;border-color:var(--solid)}
.galeria{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}.peca{background:var(--surface);border:1px solid var(--line);border-radius:10px;overflow:hidden;display:flex;flex-direction:column}
.peca img,.peca .ps{width:100%;aspect-ratio:4/3;object-fit:contain;background-color:var(--surface-2);display:block;background-repeat:no-repeat}.mini .ps{width:120px;aspect-ratio:4/3;border-radius:6px;display:block;background-color:var(--surface-2);background-repeat:no-repeat}.ps.ref{display:inline-block;width:56px;aspect-ratio:4/3;border-radius:4px;background-repeat:no-repeat;vertical-align:middle;margin:2px}.peca .c{padding:9px 11px;display:flex;flex-direction:column;gap:4px;font-size:13px}.peca .t{display:flex;justify-content:space-between;font:12px 'IBM Plex Mono',monospace;color:var(--muted)}
.mini{display:flex;flex-wrap:wrap;gap:8px}.mini a{width:120px;font-size:12px;text-decoration:none;color:var(--ink)}.mini img{width:120px;height:120px;object-fit:cover;border-radius:6px;background:var(--surface-2);display:block}
.prod{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}.prod a{text-decoration:none;color:var(--ink);font-size:13px}.prod img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;background:var(--surface-2)}
.citacao{border-left:3px solid var(--solid);padding:4px 0 4px 14px;color:var(--ink-soft);white-space:pre-wrap}.tarefa{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--line)}.tarefa input{margin-top:4px}.tarefa code{font-size:12px}
/* aba A marca: a paleta é a da marca apresentada */
.marca{--m-dest:#0A0A0A;--m-on:#fff;--m-faixa:#F4F4F2;font-family:var(--m-texto,Inter),system-ui,sans-serif}.marca h2,.marca h3,.marca .esp{font-family:var(--m-titulo,Fraunces),Georgia,serif}
.marca .capa{background:var(--m-dest);color:var(--m-on);border-radius:14px;padding:44px 28px;margin:14px 0}.marca .capa h2{font-size:clamp(36px,7vw,72px);line-height:1;margin:0 0 10px;color:var(--m-on)}.marca .capa p{font-size:18px;max-width:640px;margin:0 0 12px}
.marca .ficha{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin-top:16px}.marca .ficha div{background:rgba(255,255,255,.1);border-radius:8px;padding:8px 10px;font-size:13px}.marca .ficha b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;opacity:.75}
.sws{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}.sw{border-radius:10px;border:1px solid var(--line);overflow:hidden;background:var(--surface)}.sw div{height:90px}.sw p{margin:0;padding:8px 10px;font-size:12.5px}.sw code{font-size:12px}
.marca .esp{font-size:44px;margin:4px 0}.banners{display:grid;gap:16px}.banner{display:grid;grid-template-columns:3fr 1fr;gap:10px;align-items:start}.banner img{width:100%;border-radius:8px;display:block}.bn{position:relative;container-type:inline-size;overflow:hidden;border-radius:8px}.bn img{border-radius:0!important}.bn::before{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(0,0,0,.6),rgba(0,0,0,.2) 42%,transparent 62%)}.bn-d.dir::before{background:linear-gradient(270deg,rgba(0,0,0,.6),rgba(0,0,0,.2) 42%,transparent 62%)}.bn-m.baixo::before{background:linear-gradient(0deg,rgba(0,0,0,.65),rgba(0,0,0,.15) 40%,transparent 58%)}.bn-m.baixo .bn-t{top:auto;bottom:9cqw}.bn-m:not(.baixo)::before{background:linear-gradient(180deg,rgba(0,0,0,.6),rgba(0,0,0,.15) 40%,transparent 58%)}.bn-t{position:absolute;color:#fff;display:flex;flex-direction:column;align-items:flex-start;gap:1.3cqw;text-shadow:0 1px 8px rgba(0,0,0,.35)}.bn-d .bn-t{left:5cqw;top:50%;transform:translateY(-50%);max-width:36cqw}.bn-d.dir .bn-t{left:auto;right:5cqw}.bn-m .bn-t{left:7cqw;right:7cqw;top:8cqw;align-items:center;text-align:center;gap:3cqw}.bn-e{font-family:var(--m-texto,Inter),sans-serif;font-weight:600;font-size:1.15cqw;letter-spacing:.16em;text-transform:uppercase}.bn-h{font-family:var(--m-titulo,Fraunces),Georgia,serif;font-weight:400;font-size:3.7cqw;line-height:1.05}.bn-s{font-family:var(--m-texto,Inter),sans-serif;font-size:1.35cqw;line-height:1.45;opacity:.92}.bn-b{font-family:var(--m-texto,Inter),sans-serif;background:#fff;color:#1a1a1a;text-shadow:none;font-weight:600;font-size:1cqw;letter-spacing:.12em;text-transform:uppercase;padding:1.1cqw 2.4cqw;margin-top:.6cqw}.bn-d .bn-e{font-size:max(8px,1.15cqw)}.bn-d .bn-h{font-size:max(15px,3.7cqw)}.bn-d .bn-b{font-size:max(8px,1cqw);padding:max(5px,1.1cqw) max(10px,2.4cqw)}@container (max-width:640px){.bn-d .bn-s{display:none}.bn-d .bn-t{max-width:38cqw}}.bn-m .bn-e{font-size:3.2cqw}.bn-m .bn-h{font-size:9cqw}.bn-m .bn-s{display:none}.bn-m .bn-b{font-size:3.2cqw;padding:3cqw 6cqw}.banner .falta{background:var(--surface-2);border:1px dashed var(--line);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:12px;min-height:90px;text-align:center;padding:8px}
.mat td.on{background:var(--m-dest,var(--solid));color:var(--m-on,#0A0A0A);text-align:center;font-weight:600;border:3px solid var(--surface)}.mat img{width:46px;height:46px;object-fit:cover;border-radius:4px;margin:0 4px 4px 0}
.acoes{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;font-size:13px;margin:6px 0}
.bt{font:600 13px Inter,sans-serif;border:1px solid var(--solid);background:var(--solid);color:#0A0A0A;border-radius:7px;padding:6px 11px;cursor:pointer;text-decoration:none;display:inline-block;line-height:1.3}.bt.sec{background:var(--surface);color:var(--ink);border-color:var(--line)}.bt[disabled]{opacity:.6;cursor:progress}
.bt:focus-visible,.trilha a:focus-visible,nav.abas button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.previas{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin:8px 0 14px}.previas figure{margin:0}.previas img{width:100%;height:320px;object-fit:cover;object-position:top;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);display:block}.previas figcaption{font:12px 'IBM Plex Mono',monospace;color:var(--muted);margin-top:4px}
.rolagem{max-height:620px;overflow:auto;border:1px solid var(--line);border-radius:8px;background:var(--surface-2)}.rolagem img{width:100%;height:auto!important;object-fit:initial!important;border:0!important;border-radius:0!important}
.peca details{font-size:12.5px}.peca summary{cursor:pointer;color:var(--accent);font-weight:600}.peca dl{display:grid;grid-template-columns:105px 1fr;gap:3px 8px;margin:6px 0 0}.peca dt{color:var(--muted)}.peca dd{margin:0}.chip.fu{background:var(--ink);color:var(--ground)}
.pm{display:inline-block;flex:none;border-radius:6px;background-color:#fff;background-repeat:no-repeat;border:1px solid var(--line)}
.colecoes{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-top:10px}.colecao{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px}.colecao[hidden]{display:none}.colecao.aberta{grid-column:1/-1}
.colecao .strip{display:flex;gap:4px;overflow:hidden}.colecao .meta{font:12px 'IBM Plex Mono',monospace;color:var(--muted)}
.prods{display:grid;grid-template-columns:repeat(auto-fill,minmax(124px,1fr));gap:10px}.prods[hidden]{display:none}.prods a{font-size:12px;color:var(--ink);text-decoration:none;display:flex;flex-direction:column;gap:3px}.prods s{color:var(--muted)}
input.busca{font:14px Inter,sans-serif;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);width:min(380px,100%)}
.vt{padding:3px 9px;font-size:12px}.vt.on[data-v="usar"]{background:var(--solid);border-color:var(--solid);color:#0A0A0A}.vt.on[data-v="descartar"]{background:var(--ink);border-color:var(--ink);color:var(--ground)}td.dec{white-space:nowrap}.vt.on[data-v="aprovado"]{background:var(--solid);border-color:var(--solid);color:#0A0A0A}.vt.on[data-v="ajustes"]{background:#e0a83a;border-color:#e0a83a;color:#0A0A0A}.vt.on[data-v="descartado"]{background:var(--ink);border-color:var(--ink);color:var(--ground)}
tr.descartada td{opacity:.4}.peca[data-voto=descartado]>img,.peca[data-voto=descartado] .c>:not(.votob){opacity:.4}.peca[data-voto=aprovado]{outline:2px solid #b5d334}.peca[data-voto=ajustes]{outline:2px solid #e0a83a}.votob{margin-top:6px}tr.descartada td.dec{opacity:1}
.metricas{display:flex;flex-wrap:wrap;gap:6px 18px}.metricas div{display:grid}.metricas b{font:600 16px 'IBM Plex Mono',monospace}.metricas span{font-size:11.5px;color:var(--muted)}
.lms{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px}.lm{background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden;display:grid;grid-template-columns:130px 1fr}.lm[hidden]{display:none}
.lm-img{display:flex;align-items:center;justify-content:center;background:var(--surface-2);border-right:1px solid var(--line);color:var(--muted);font:11px 'IBM Plex Mono',monospace;text-align:center;text-decoration:none;max-height:300px;overflow:hidden}.lm-img img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.lm-c{padding:12px 14px;display:flex;flex-direction:column;gap:8px;font-size:13px}.lm .t{display:flex;flex-direction:column;gap:2px}.lm .t span{font:12px 'IBM Plex Mono',monospace;color:var(--muted)}.lm-c p{margin:0}
.lm.descartada .lm-img,.lm.descartada .lm-c>:not(.acoes){opacity:.4}@media(max-width:640px){.lm{grid-template-columns:96px 1fr}}
.toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:var(--ink);color:var(--ground);padding:9px 14px;border-radius:8px;font-size:14px;display:none;z-index:9;max-width:calc(100% - 32px)}.toast.on{display:block}
@media (max-width:640px){h2{font-size:24px}.barra{grid-template-columns:100px 1fr 54px}.banner{grid-template-columns:1fr}.marca .capa{padding:28px 18px}.previas{grid-template-columns:1fr}.previas img{height:260px}}
@media print{nav.abas,.filtros,.trilha{display:none}.aba{display:block!important}}
</style></head><body>
<header class="topo"><div class="eyebrow">Central da operação</div><h1 id="titulo"></h1><p id="sub"></p></header>
<nav class="abas"><div id="abas"></div></nav><main id="main"></main><div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>
const D=__DADOS__, SO_MARCA=__SO_MARCA__;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const desent=s=>{const x=document.createElement('textarea');x.innerHTML=String(s??'');return x.value};
const num=x=>x==null?'—':(Number.isInteger(+x)?String(x):(+x).toFixed(1));
const pct=(a,b)=>b?`${a}/${b} (${Math.round(100*a/b)}%)`:'—';
// aba vazia mostra o que vai entrar ali: é o molde que o aluno vê antes de rodar o fluxo
const vazio=(o,skill,itens)=>`<div class="vazio">${o} Rode <code>${skill}</code> e depois <code>python3 _engine/concorrente/central.py</code> de novo.${itens&&itens.length?`<p style="margin:12px 0 4px;color:var(--ink)"><b>O que entra aqui</b></p><ul>${itens.map(i=>`<li>${i}</li>`).join('')}</ul>`:''}</div>`;
// curto e grupo alimentam a trilha da esquerda
const sec=(id,eye,tit,sub,corpo,curto,grupo)=>`<section id="${id}" data-t="${esc(curto||tit)}" data-g="${esc(grupo||'')}"><div class="eyebrow">${eye}</div><h2>${tit}</h2>${sub?`<p class="sub">${sub}</p>`:''}${corpo}</section>`;
const M=D.marca, R=D.refs, MN=D.mineracao;
const din=x=>x==null?'':(+x).toFixed(2);
// no artefato o download passa pela capacidade downloads; no arquivo local, pelo link de download do navegador
const ART=!!(window.claude&&typeof window.claude.use==='function');
let DL=null;if(ART){try{window.claude.use('downloads').then(d=>{DL=d}).catch(()=>{})}catch(e){}}
function aviso(t){const x=document.getElementById('toast');x.textContent=t;x.classList.add('on');clearTimeout(aviso.t);aviso.t=setTimeout(()=>x.classList.remove('on'),4500)}
async function salvar(nome,gerar,b){const t0=b.textContent;b.disabled=true;b.textContent='preparando…';
 try{const blob=await gerar();
  if(ART){if(!DL)DL=await window.claude.use('downloads');if(!DL)throw{code:'unavailable'};await DL.save({filename:nome,data:blob})}
  else{const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=nome;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000)}}
 catch(e){if(!e||e.code!=='declined')aviso('Não deu para baixar agora. Tente de novo em instantes.')}
 finally{b.disabled=false;b.textContent=t0}}
const bib=r=>r.page_id?`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=${r.page_id}`:`https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${encodeURIComponent('"'+r.dominio+'"')}&search_type=keyword_exact_phrase&media_type=all`;
const arqNome=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'arquivo';
// miniatura do produto: um quadro da folha de 10 x 10 que o catalogo.py monta (artefato não carrega foto de outro site)
function fotoP(d,cls){if(!d.mini)return `<span class="ps ${cls||''}"></span>`;const sp=d.sp;if(!sp)return `<img class="${cls||''}" loading="lazy" src="${esc(d.mini)}" alt="">`;const[c,l,n]=sp;
 return `<span class="ps ${cls||''}" role="img" aria-label="Peça ${esc(d.codigo||d.k||'')}" style="background-image:url('${esc(d.mini)}');background-size:${PSC*100}% ${n*100}%;background-position:${c/(PSC-1)*100}% ${n>1?l/(n-1)*100:0}%"></span>`}
const PSC=8;
function thumb(r,i,lado){const it=r.produtos&&r.produtos.itens[i];if(!it||!it.s)return `<span class="pm" style="width:${lado}px;height:${lado}px"></span>`;const[f,c,l]=it.s;
 return `<span class="pm" role="img" aria-label="${esc(it.t)}" style="width:${lado}px;height:${lado}px;background-image:url('${esc(r.produtos.folhas[f])}');background-size:${10*lado}px auto;background-position:-${c*lado}px -${l*lado}px"></span>`}
function catalogoJs(dom){return new Promise((ok,erro)=>{const C=window.CATALOGO||{};if(C[dom])return ok(C[dom]);const s=document.createElement('script');s.src='central_arquivos/'+dom+'/catalogo.js';s.onload=()=>ok((window.CATALOGO||{})[dom]);s.onerror=()=>erro(new Error('catalogo'));document.head.appendChild(s)})}
async function csvDe(r,idx){const c=await catalogoJs(r.dominio);const ls=idx?idx.map(i=>c.csv[i]):c.csv;return new Blob([c.cabecalho+'\r\n'+ls.join('')],{type:'text/csv'})}
function precoFaixa(r,idx){const ps=idx.map(i=>r.produtos.itens[i].preco).filter(x=>x!=null);if(!ps.length)return '';const a=Math.min(...ps),b=Math.max(...ps);return a===b?din(a):`${din(a)} a ${din(b)}`}
function previas(r,grande){const pv=r.previa||{};const L=[['home','Home no computador'],['home_celular','Home no celular'],['pdp_celular','Produto principal no celular']].filter(([k])=>pv[k]);
 if(!L.length)return `<div class="vazio">A prévia do site entra aqui: rode <code>node _engine/concorrente/previa.mjs "&lt;pasta da operação&gt;"</code> e o central.py de novo.</div>`;
 return `<div class="previas">${L.map(([k,n])=>`<figure>${grande?`<div class="rolagem"><img loading="lazy" src="${esc(pv[k])}" alt="${esc(n)} da ${esc(r.nome)}"></div>`:`<a href="#sit-${r.sid}" title="Abrir a prévia inteira"><img loading="lazy" src="${esc(pv[k])}" alt="${esc(n)} da ${esc(r.nome)}"></a>`}<figcaption>${n}</figcaption></figure>`).join('')}</div>`}
const linksLoja=(r,menos)=>`<p class="acoes"><a class="bt sec" href="https://${esc(r.dominio)}" target="_blank" rel="noopener">Abrir a loja</a><a class="bt sec" href="${esc(bib(r))}" target="_blank" rel="noopener">Biblioteca de anúncios</a>${[['ref','Raio-X'],['ban','Criativos'],['pro','Produtos'],['sit','Site']].filter(x=>x[0]!==menos).map(([k,n])=>`<a href="#${k}-${r.sid}">${n} desta loja</a>`).join('')}</p>`;
document.getElementById('titulo').textContent=(M&&M.nome)||D.op;
document.getElementById('sub').textContent=`${D.op} · atualizada em ${D.gerado}`;

function inicio(){
  const fl=D.etapas.map((e,i)=>`<div class="passo ${e.feito?'ok':''}"><span>${i+1} · ${e.feito?'feito':'a fazer'}</span><b>${esc(e.nome)}</b><span>${esc(e.skill)}</span></div>`).join('');
  const nP=R.reduce((s,r)=>s+r.pecas.length,0);
  const k=[[MN?MN.lojas.length:0,'lojas no mercado'],[R.length,'concorrentes no raio-x'],[nP,'peças no banco'],[M&&M.angulos?M.angulos.length:0,'ângulos no plano']];
  const mapa=[['Mercado','as lojas do nicho: do repositório e as que estão anunciando agora'],['Referências','cada concorrente medido: anúncios, desligados, copy, loja, o que se repete'],['Banco','todos os criativos dos concorrentes, por formato, gancho, funil e oferta, com a leitura de cada peça e o botão de baixar'],['Produtos','os mais vendidos e todas as coleções de cada referência, com foto, link da coleção original e CSV para importar na Shopify'],['Site','a prévia de cada referência e como elas vendem: home, página de produto, apps'],['A marca','a apresentação da nova marca, parte por parte'],['Criativos','o plano do primeiro lote: ângulo × formato, com referência e copy'],['Tráfego','o primeiro teste e o que fazer com o resultado'],['Tasks','o que falta, em ordem, com o comando de cada passo']];
  const prox=D.etapas.find(e=>!e.feito);
  return sec('ini','Início','A operação em uma página',`Tudo o que a operação decidir e produzir mora aqui. As abas se enchem na ordem do fluxo: mineração, raio-x, nova marca e produção.`,
   `<div class="fluxo">${fl}</div><div class="cards">${k.map(x=>`<div class="kpi"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('')}</div>
   ${prox?`<div class="caixa"><h4>Próximo passo</h4><p><b>${esc(prox.nome)}</b>: rode <code>${esc(prox.skill)}</code>.</p></div>`:''}
   <h3>O que cada aba guarda</h3><div class="tab"><table><tbody>${mapa.map(m=>`<tr><th>${m[0]}</th><td>${m[1]}</td></tr>`).join('')}</tbody></table></div>`);
}

function mercado(){
  if(!MN) return sec('mer','Mercado','O mercado','',vazio('A mineração ainda não rodou.','/minerar-concorrentes',['Até 10 lojas do nicho, as melhores pelos filtros da casa: do Repositório de Nichos e as novas que estão anunciando agora','Para cada uma: a prévia da home, anúncios ativos, produtos, preço mediano, riscado, contexto e os quatro filtros','Os botões Usar e Descartar: as que você marcar como Usar vão para o raio-x']),'O mercado');
  const no=new Set(R.map(r=>r.dominio));
  const orig=l=>(l.origem||[]).map(o=>o==='biblioteca'||o==='contexto'?'nova':o).filter((v,j,a)=>a.indexOf(v)===j).join(' + ');
  const fil=l=>{const f=l.filtros||{};return [['anuncios_50_200','50 a 200 anúncios'],['preco_49_79','preço de 49 a 79'],['colecao_20_mais','20 produtos ou mais'],['contexto_de_oferta','oferta com contexto']]
   .map(([k,n])=>`<span class="chip ${f[k]?'f':''}">${f[k]==null?'— ':f[k]?'✓ ':'✗ '}${n}</span>`).join('')};
  const votos=d=>`<button class="bt sec vt" type="button" data-merc="${esc(d)}" data-v="usar">Usar</button><button class="bt sec vt" type="button" data-merc="${esc(d)}" data-v="descartar">Descartar</button>`;
  // padrão da casa: no máximo 10 lojas no Mercado, cada uma com a home à vista para decidir
  const cartoes=MN.lojas.map((l,i)=>`<article class="lm" data-dom="${esc(l.dominio)}">
   <a class="lm-img" href="https://${esc(l.dominio)}" target="_blank" rel="noopener">${l.previa?`<img loading="lazy" src="${esc(l.previa)}" alt="Home da ${esc(l.dominio)} no celular">`:'<span>prévia da home<br>previa.mjs --mercado</span>'}</a>
   <div class="lm-c"><div class="t"><b>${i+1}. ${esc(l.dominio)}</b><span>${esc(orig(l))}${l.repositorio&&l.repositorio.dossie?' · dossiê':''}${no.has(l.dominio)?' · no raio-x':''}</span></div>
    <div class="metricas"><div><b>${l.anuncios_ativos??'—'}</b><span>anúncios ativos</span></div><div><b>${l.produtos??'—'}${l.produtos_teto?'+':''}</b><span>produtos</span></div><div><b>${l.preco_mediano??'—'}</b><span>preço mediano ${esc(l.moeda||'')}</span></div><div><b>${esc(l.riscado||'—')}</b><span>com riscado</span></div></div>
    <div>${fil(l)}</div>
    ${(l.contexto||[]).length?`<p class="nao">Contexto: ${esc(l.contexto.join(', '))}</p>`:''}${l.titulo_home?`<p class="nao">${esc(desent(l.titulo_home))}</p>`:''}
    <div class="acoes">${votos(l.dominio)}<a href="https://${esc(l.dominio)}" target="_blank" rel="noopener">Abrir a loja</a>${l.biblioteca?`<a href="${esc(l.biblioteca)}" target="_blank" rel="noopener">Biblioteca</a>`:''}</div></div></article>`).join('');
  const RES=MN.reserva||[];
  const reserva=RES.length?`<details class="caixa" style="margin-top:14px"><summary><b>Reserva: mais ${RES.length} lojas do nicho</b>, abaixo das ${MN.lojas.length} primeiras pelos filtros</summary>
   <div class="tab" style="margin-top:10px"><table><thead><tr><th>Loja</th><th>Decisão</th><th>Filtros</th><th>Anúncios ativos</th><th>Produtos</th><th>Preço mediano</th><th></th></tr></thead><tbody>${RES.map(l=>`<tr data-dom="${esc(l.dominio)}"><td><a href="https://${esc(l.dominio)}" target="_blank" rel="noopener">${esc(l.dominio)}</a></td><td class="dec">${votos(l.dominio)}</td><td>${l.passa??'—'}/4</td><td>${l.anuncios_ativos??'—'}</td><td>${l.produtos??'—'}</td><td>${l.preco_mediano??'—'} ${esc(l.moeda||'')}</td><td>${l.biblioteca?`<a href="${esc(l.biblioteca)}" target="_blank" rel="noopener">biblioteca</a>`:''}</td></tr>`).join('')}</tbody></table></div></details>`:'';
  const nRepo=MN.lojas.filter(l=>(l.origem||[]).includes('repositório')).length;
  return sec('mer','Mercado','As lojas do nicho',`Nicho: ${esc(MN.nicho.join(', '))} · países: ${esc(MN.paises.join(', '))}${MN.contexto&&MN.contexto.length?' · contexto: '+esc(MN.contexto.join(', ')):''} · ${esc(MN.gerado_em)}`,
   `<div class="cards"><div class="kpi"><b>${MN.lojas.length}</b><span>lojas para escolher</span></div><div class="kpi"><b>${nRepo}</b><span>do repositório</span></div><div class="kpi"><b>${MN.lojas.length-nRepo}</b><span>novas, anunciando agora</span></div><div class="kpi"><b>${MN.lojas.filter(l=>l.passa>=3).length}</b><span>passam em 3 ou 4 filtros</span></div></div>
   <div class="caixa" style="margin-bottom:12px"><h4>A sua escolha</h4><p>Olhe a home de cada loja e marque <b>Usar</b> ou <b>Descartar</b>. Depois peça ao Claude: <code>faz o raio-x das lojas que eu marquei como usar</code>.</p><div class="linha" id="mer-filtro"></div></div>
   <div class="lms">${cartoes}</div>${reserva}
   <p class="sub" style="margin-top:12px">Filtros da casa: 50 a 200 anúncios ativos, preço mediano de 49 a 79, loja de coleção (20 produtos ou mais), oferta com contexto. Com mais de 200 anúncios a loja serve para estudar estrutura, não para copiar o volume.</p>`);
}
function barras(ag,total){return (ag||[]).map(l=>`<div class="barra"><span>${esc(l.valor)}</span><i style="width:${Math.max(l.pct,2)}%"></i><b>${l.pecas}/${total}</b></div>`).join('')}

// fonte do número de anúncios ativos (0360): total que a biblioteca declara x contagem dentro da amostra com teto
const ATIVO_DECL=c=>/declarado/.test(c.ativos_fonte||'');
const fonteAtivos=c=>c.ativos==null?'não medido':ATIVO_DECL(c)?'total declarado pela biblioteca':c.ativos_fonte?'contados na amostra da coleta ('+(c.ativos_coletados??'?')+'), pode ser menos que o total':'fonte do número não registrada';
function referencias(){
  if(!R.length) return sec('ref','Referências','Os concorrentes','',vazio('Nenhum raio-x ainda.','/raio-x-concorrente',['O mapa dos concorrentes: anúncios ativos e desligados, idade da conta, peças, vídeo, formato que domina, oferta, preço e apps','O que se repete entre as referências: em duas é padrão, em uma é hipótese','Uma seção por loja: a prévia do site, o que ela faz de certo, os ângulos que mantém no ar, o que testou e desligou, a copy no ar e a loja']),'Os concorrentes');
  const t=R.map(r=>{const s=r.resumo,c=r.coleta.cemiterio||{},lj=r.loja||{};const f=(s.agregados||{}).formato||[];const vid=r.pecas.filter(p=>p.tipo==='video').length;
   return `<tr><td><a href="#ref-${r.sid}">${esc(r.nome)}</a></td><td title="${esc(fonteAtivos(c))}">${c.ativos??'—'}${c.ativos!=null&&!ATIVO_DECL(c)?'*':''}</td><td>${c.desligados??'—'}</td><td>${c.conta_dias?c.conta_dias+' dias':'—'}</td><td>${r.pecas.length}</td><td>${pct(vid,r.pecas.length)}</td><td>${f[0]?esc(f[0].valor)+' ('+f[0].pct+'%)':'—'}</td><td>${esc(((s.agregados||{}).oferta||[])[0]?.valor||'—')}</td><td>${(s.copy||{}).corpos_distintos??'—'}</td><td>${lj.produtos??'—'}</td><td>${lj.preco_mediano??'—'} ${esc(lj.moeda||'')}</td><td>${esc((lj.apps||[]).join(', ')||'—')}</td></tr>`}).join('');
  let h=sec('ref-mapa','Referências','O mapa dos concorrentes','Cada linha é um raio-x. Ativos é o total que a biblioteca declara para a página; com * é o que caiu na amostra da coleta, e pode ser menos (passe o mouse para ver a fonte). Desligados são os anúncios que a biblioteca ainda mostra (fora da União Europeia, só os que rodaram lá).',
   `<div class="tab"><table><thead><tr><th>Concorrente</th><th>Ativos</th><th>Desligados</th><th>Conta</th><th>Peças</th><th>Vídeo</th><th>Formato que domina</th><th>Oferta</th><th>Corpos de copy</th><th>Produtos</th><th>Preço mediano</th><th>Apps</th></tr></thead><tbody>${t}</tbody></table></div>`);
  if(D.padroes.length){const g={};D.padroes.forEach(p=>(g[p.tipo]=g[p.tipo]||[]).push(p));
   h+=sec('ref-padrao','Referências','O que se repete','Achado em uma operação é hipótese; em duas ou mais, padrão. Estes aparecem em pelo menos duas referências.',
    `<div class="grid2">${Object.entries(g).map(([k,v])=>`<div class="caixa"><h4>${esc(k)}</h4><ul>${v.map(p=>`<li><b>${esc(p.valor)}</b> · ${p.lojas.length} de ${R.length}: ${esc(p.lojas.join(', '))}</li>`).join('')}</ul></div>`).join('')}</div>`);}
  R.forEach(r=>{const s=r.resumo,c=r.coleta.cemiterio||{},lj=r.loja||{},cp=s.copy||{};const ag=s.agregados||{};
   const ang={};r.pecas.forEach(p=>{if(p.angulo){const a=ang[p.angulo]=ang[p.angulo]||{n:0,max:0};a.n++;a.max=Math.max(a.max,p.dias_no_ar)}});
   const angs=Object.entries(ang).sort((a,b)=>b[1].n-a[1].n).slice(0,10);
   const dest=r.pecas.filter(p=>p.destaque);
   const pdp=(lj.pdp||{}).sinais||{};
   const pt=c.por_tipo||{};
   h+=sec('ref-'+r.sid,'Raio-X · por loja',esc(r.nome),`<a href="https://${esc(r.dominio)}" target="_blank" rel="noopener">${esc(r.dominio)}</a>${r.classificadas<r.pecas.length?` · ${r.pecas.length-r.classificadas} peças ainda sem classificação`:''}`,
    `${linksLoja(r,'ref')}${previas(r,false)}<div class="cards"><div class="kpi"><b>${c.ativos??'—'}${c.ativos!=null&&!ATIVO_DECL(c)?'*':''}</b><span>anúncios ativos<br><small>${esc(fonteAtivos(c))}</small></span></div><div class="kpi"><b>${c.desligados??'—'}</b><span>desligados</span></div><div class="kpi"><b>${c.conta_dias??'—'}</b><span>dias de conta${c.conta_desde?' (desde '+esc(c.conta_desde)+')':''}</span></div><div class="kpi"><b>${r.pecas.length}</b><span>peças distintas no ar</span></div><div class="kpi"><b>${num(s.mediana_dias)}</b><span>mediana de dias no ar</span></div><div class="kpi"><b>${cp.corpos_distintos??'—'}</b><span>corpo(s) de anúncio</span></div></div>
    <div class="grid2"><div class="caixa"><h4>Formatos</h4>${barras(ag.formato,s.pecas)||'<p class="nao">sem classificação</p>'}</div><div class="caixa"><h4>Ganchos e funil</h4>${barras(ag.gancho,s.pecas)}${barras(ag.funil,s.pecas)}</div></div>
    <h3>O que ela faz de certo</h3>${dest.length?`<div class="mini">${dest.map(p=>`<a href="${esc(p.link)}" target="_blank" rel="noopener">${fotoP(p)}<b>${esc(p.codigo)}</b> · ${p.dias_no_ar} dias · ${esc(p.formato||'')}<br><span class="nao">${esc(p.nota||p.angulo||'')}</span></a>`).join('')}</div>`:'<p class="nao">Sem destaques marcados.</p>'}
    <h3>Os ângulos que ela mantém no ar</h3><div class="tab"><table><thead><tr><th>Ângulo</th><th>Peças</th><th>Mais antiga no ar</th></tr></thead><tbody>${angs.map(([a,v])=>`<tr><td>${esc(a)}</td><td>${v.n}</td><td>${v.max} dias</td></tr>`).join('')||'<tr><td colspan="3">sem classificação</td></tr>'}</tbody></table></div>
    <h3>O que ela testou e desligou</h3><div class="grid2"><div class="caixa"><h4>Quanto cada tipo vive</h4><p>Vídeo: ${pt.video?pct(pt.video.ativos,pt.video.total)+' ainda no ar · desligado vive '+num(pt.video.vida_mediana_desligados)+' dias':'—'}</p><p>Imagem: ${pt.imagem?pct(pt.imagem.ativos,pt.imagem.total)+' ainda no ar · desligada vive '+num(pt.imagem.vida_mediana_desligados)+' dias':'—'}</p></div>
     <div class="caixa"><h4>Títulos do link</h4><ul>${(c.titulos||[]).map(t=>`<li>${esc(t.titulo)} · ${t.ativos}/${t.anuncios} no ar</li>`).join('')||'<li class="nao">—</li>'}</ul></div></div>
    ${(c.copies_desligadas||[]).length?`<div class="caixa" style="margin-top:12px"><h4>Copies que ela desligou</h4>${c.copies_desligadas.map(x=>`<p class="citacao">${esc(x.texto)}</p><p class="nao">${x.anuncios} anúncio(s), viveram ${num(x.vida_mediana)} dias</p>`).join('')}</div>`:''}
    <h3>A copy que está no ar</h3><div class="grid2"><div class="caixa"><h4>Corpo do anúncio</h4><p class="citacao">${esc(r.texto||'—')}</p></div><div class="caixa"><h4>A régua</h4>
     <p>Preço ou percentual na primeira linha: ${cp.preco_1a_linha?pct(...cp.preco_1a_linha):'—'}</p><p>Oferta no título do link: ${cp.titulo_com_oferta?pct(...cp.titulo_com_oferta):'—'}</p><p>Desconto com motivo: ${cp.desconto_com_motivo?pct(...cp.desconto_com_motivo):'—'}${(cp.motivos||[]).length?' ('+esc(cp.motivos.map(m=>m[0]).join(', '))+')':''}</p><p>Template no ar: ${cp.template_no_ar?pct(...cp.template_no_ar):'—'}</p><p>Botões: ${esc((cp.ctas||[]).map(c=>c[0]+' ('+c[1]+')').join(', ')||'—')}</p></div></div>
    <h3>A loja</h3><div class="grid2"><div class="caixa"><h4>Catálogo</h4><p>${lj.produtos??'—'}${lj.produtos_teto?'+':''} produtos · preço mediano ${lj.preco_mediano??'—'} ${esc(lj.moeda||'')}${lj.preco_faixa?' (de '+lj.preco_faixa[0]+' a '+lj.preco_faixa[1]+')':''}</p><p>Variantes com riscado: ${esc(lj.riscado||'—')}</p><p>Idiomas: ${esc((lj.idiomas||[]).join(', ')||'—')} · contexto na home: ${esc((lj.contexto_home||[]).join(', ')||'—')}</p>${lj.barra_anuncio?`<p>Barra de anúncio: <b>${esc(lj.barra_anuncio)}</b></p>`:''}</div>
     <div class="caixa"><h4>Coleções</h4><p>${(lj.colecoes||[]).slice(0,18).map(c=>`<span class="chip">${esc(c.titulo)} · ${c.produtos}</span>`).join('')||'—'}</p><p><a href="#pro-${r.sid}">Ver as coleções com foto e CSV</a></p></div></div>`,r.nome,'Por loja');
  });
  return h;
}

// voto do Banco de referência: Aprovado ou Descartado (Ajustes só no banco de criativos prontos); fica no navegador (Central pública não tem banco de dados), o Copiar leva para o chat
const BV_OP=[['aprovado','Aprovado'],['descartado','Descartado']];
const BV=(()=>{try{return JSON.parse(localStorage.getItem('central-'+D.op+'-banco')||'{}')}catch(e){return{}}})();
const pid=d=>d.loja+':'+d.codigo;
function pintaBV(id){document.querySelectorAll('[data-peca="'+CSS.escape(id)+'"]').forEach(el=>{el.dataset.voto=BV[id]||'';el.querySelectorAll('button[data-bv]').forEach(b=>b.classList.toggle('on',b.dataset.v===BV[id]))})}
// com banco (Cloudflare, ou artefato que declara db) o voto do Banco vale em toda conta e aparelho; sem banco, fica no navegador
let BDB=null;const bk=id=>id.replace(/[^a-zA-Z0-9_.-]/g,'_');
function votoBanco(id,v){if(BV[id]===v)delete BV[id];else BV[id]=v;try{localStorage.setItem('central-'+D.op+'-banco',JSON.stringify(BV))}catch(e){}
 pintaBV(id);if(window.gradeBanco)window.gradeBanco(true);
 if(BDB){const r=BDB.doc('banco/'+bk(id));(BV[id]?r.set({peca:id,voto:BV[id],em:new Date().toISOString()}):r.delete()).catch(()=>aviso('Não deu para guardar o voto. Tente de novo.'))}}
if(ART){try{window.claude.use('db').then(db=>{if(!db)return;BDB=db;db.collection('banco').onSnapshot(s=>{const novo={};s.docs.forEach(x=>{const d=x.data();if(d&&d.peca&&d.voto)novo[d.peca]=d.voto});
 const antes=Object.keys(BV);Object.keys(BV).forEach(k=>delete BV[k]);Object.assign(BV,novo);new Set([...antes,...Object.keys(novo)]).forEach(pintaBV);if(window.gradeBanco)window.gradeBanco(true)},()=>{})}).catch(()=>{})}catch(e){}}
function copiarBanco(){const P=PECAS(),g=k=>P.filter(d=>BV[pid(d)]===k).map(d=>d.lojaNome+' '+d.codigo).join(', ')||'nenhuma';
 const t=BV_OP.map(([k,n])=>n+': '+g(k)).join('\n');navigator.clipboard.writeText('Banco de criativos\n'+t).then(()=>aviso('Copiado. Cole no chat do Claude.'),()=>aviso(t))}
function cartao(d){
  const ext=(d.midia||d.arquivo||'').match(/\.[a-z0-9]+$/i);const nome=`${arqNome(d.lojaNome)}-${d.codigo}${ext?ext[0].toLowerCase():''}`;
  // no artefato só baixa o que coube nele (central_publicar.json); o resto baixa pela biblioteca de anúncios
  const baixar=ART?(d.midia?`<button class="bt" type="button" data-midia="${esc(d.midia)}" data-nome="${esc(nome)}">Baixar criativo</button>`:`<a class="bt sec" href="${esc(d.link)}" target="_blank" rel="noopener">Baixar pela biblioteca</a>`)
   :(d.arquivo?`<a class="bt" href="${esc(encodeURI(d.arquivo))}" download="${esc(nome)}">Baixar criativo</a>`:'');
  const leit=[['Ângulo',d.angulo],['Dor',d.dor],['Promessa',d.promessa],['Oferta',d.oferta],['Motivo do desconto',d.motivo_desconto],['Pessoa',d.pessoa],['Idioma',d.idioma],['Texto na arte',d.texto_tela],['Título do link',d.titulo],['Botão',d.cta],['Anúncios',d.anuncios?d.anuncios+(d.versoes>1?` · ${d.versoes} versões`:''):''],['Segundo formato',d.formato2]].filter(x=>x[1]);
  const id=pid(d),vt=BV[id]||'';
  return `<article class="peca" data-peca="${esc(id)}" data-voto="${vt}">${fotoP(d)}<div class="c">
   <div class="t"><span>${esc(d.lojaNome)} · ${esc(d.codigo)}${d.destaque?' ★':''}</span><span>${d.dias_no_ar} dias · ${d.tipo==='video'?'vídeo '+num(d.duracao)+'s':'imagem'}</span></div>
   <div><span class="chip f">${esc(d.formato||'sem classificação')}</span>${d.gancho?'<span class="chip">'+esc(d.gancho)+'</span>':''}${d.funil?'<span class="chip fu">'+esc(d.funil)+'</span>':''}</div>
   ${d.angulo?'<b>'+esc(d.angulo)+'</b>':''}${d.texto_tela?'<span class="nao">“'+esc(d.texto_tela)+'”</span>':''}${d.nota?'<i>'+esc(d.nota)+'</i>':''}
   ${leit.length?`<details><summary>Leitura completa</summary><dl>${leit.map(x=>`<dt>${x[0]}</dt><dd>${esc(x[1])}</dd>`).join('')}</dl></details>`:''}
   <div class="acoes">${baixar}<a href="${esc(d.link)}" target="_blank" rel="noopener">Ver na biblioteca</a></div>
   <div class="acoes votob">${BV_OP.map(([k,n])=>`<button class="bt sec vt${vt===k?' on':''}" type="button" data-bv="${esc(id)}" data-v="${k}">${n}</button>`).join('')}</div></div></article>`}
const PECAS=()=>R.flatMap(r=>r.pecas.map(p=>({...p,lojaNome:r.nome})));
function banco(){
  const P=PECAS();
  if(!P.length) return sec('ban','Banco','O banco de criativos','',vazio('Sem peças ainda.','/raio-x-concorrente',['Todos os criativos dos concorrentes, com filtro por loja, formato, gancho, funil (topo, meio e fundo), oferta, motivo do desconto, pessoa e tipo (imagem ou vídeo)','Uma seção por loja: o censo da conta (ativos, desligados, idade, vídeo) e as peças da mais antiga no ar para a mais nova','Em cada peça: a leitura completa (ângulo, dor, promessa, texto na arte, título e botão) e o botão Baixar criativo']),'O banco de criativos');
  let h=sec('ban','Banco','O banco de criativos dos concorrentes',`${P.length} peças de ${R.length} concorrente(s), todas ativas na biblioteca. Dias no ar é o sinal público de que a peça vende. Criativo de concorrente é referência: o que vai para a sua loja é o modelo, refeito com a sua marca.`,
   `<div class="filtros" id="bf"></div><div class="galeria" id="bg"></div>`,'Todos os criativos');
  R.forEach(r=>{const c=r.coleta.cemiterio||{},ag=(r.resumo||{}).agregados||{},vid=r.pecas.filter(p=>p.tipo==='video').length;
   const lede=[c.ativos!=null?`${c.ativos} anúncios ativos`:'',c.desligados!=null?`${c.desligados} desligados`:'',c.conta_dias?`conta de ${c.conta_dias} dias`:'',`${pct(vid,r.pecas.length)} em vídeo`,(ag.formato||[])[0]?`formato que domina: ${ag.formato[0].valor}`:'',((ag.oferta||[])[0]||{}).valor?`oferta: ${ag.oferta[0].valor}`:''].filter(Boolean).join(' · ');
   const L=r.pecas.map(p=>({...p,lojaNome:r.nome})).sort((a,b)=>(b.dias_no_ar||0)-(a.dias_no_ar||0));
   h+=sec('ban-'+r.sid,'Banco · por loja',`${esc(r.nome)} · ${r.pecas.length} peças`,esc(lede),linksLoja(r,'ban')+`<div class="galeria">${L.map(cartao).join('')}</div>`,`${r.nome}, ${r.pecas.length} peças`,'Por loja')});
  return h;
}
function montarBanco(){
  const P=PECAS();const box=document.getElementById('bf');if(!box)return;
  const campos=[['lojaNome','Loja'],['formato','Formato'],['gancho','Gancho'],['funil','Funil'],['oferta','Oferta'],['motivo_desconto','Motivo'],['pessoa','Pessoa'],['tipo','Tipo']];const sel={};let ordem='dias',dec='todas';
  function chips(){box.innerHTML='';for(const[c,n]of campos){const vs={};P.forEach(d=>{if(d[c])vs[d[c]]=(vs[d[c]]||0)+1});if(Object.keys(vs).length<2&&c!=='formato')continue;
   const l=document.createElement('div');l.className='linha';l.innerHTML='<b>'+n+'</b>';Object.entries(vs).sort((a,b)=>b[1]-a[1]).forEach(([v,k])=>{const b=document.createElement('button');b.textContent=v+' '+k;if(sel[c]===v)b.className='on';b.onclick=()=>{sel[c]=sel[c]===v?null:v;chips();grade()};l.appendChild(b)});box.appendChild(l)}
   const l=document.createElement('div');l.className='linha';l.innerHTML='<b>Ordem</b>';[['dias','mais antigas no ar'],['destaque','destaques primeiro'],['anuncios','mais anúncios']].forEach(([k,n])=>{const b=document.createElement('button');b.textContent=n;if(ordem===k)b.className='on';b.onclick=()=>{ordem=k;chips();grade()};l.appendChild(b)});box.appendChild(l);
   const lv=document.createElement('div');lv.className='linha';lv.innerHTML='<b>Decisão</b>';const nv=k=>P.filter(d=>(BV[pid(d)]||'sem')===k).length;
   [['todas','Todas',P.length],...BV_OP.map(([k,n])=>[k,n==='Aprovado'?'Aprovados':n==='Descartado'?'Descartados':n,nv(k)]),['sem','Sem voto',nv('sem')]].forEach(([k,n,c])=>{const b=document.createElement('button');b.textContent=n+' '+c;if(dec===k)b.className='on';b.onclick=()=>{dec=k;chips();grade()};lv.appendChild(b)});
   const cp=document.createElement('button');cp.textContent='Copiar as escolhas';cp.onclick=copiarBanco;lv.appendChild(cp);box.appendChild(lv)}
  window.gradeBanco=soContar=>{chips();if(dec!=='todas'||!soContar)grade()};
  function grade(){let L=P.filter(d=>campos.every(([c])=>!sel[c]||d[c]===sel[c])&&(dec==='todas'||(BV[pid(d)]||'sem')===dec));L.sort((a,b)=>ordem==='anuncios'?b.anuncios-a.anuncios:ordem==='destaque'?((b.destaque?1:0)-(a.destaque?1:0))||b.dias_no_ar-a.dias_no_ar:b.dias_no_ar-a.dias_no_ar);
   document.getElementById('bg').innerHTML=L.map(cartao).join('')||'<p>Nenhuma peça com esses filtros.</p>'}
  chips();grade();
}

function produtos(){
  if(!R.length) return sec('pro','Produtos','Os produtos das referências','',vazio('Os produtos saem do raio-x.','/raio-x-concorrente',['Uma seção por loja: os mais vendidos e todas as coleções, com a miniatura de cada produto','Em cada coleção: ver os produtos, abrir a coleção na loja original e baixar o CSV dela','Baixar o catálogo inteiro da loja em CSV, no formato de importação da Shopify']),'Produtos');
  const lin=R.map(r=>{const p=r.produtos,lj=r.loja||{};return `<tr><td><a href="#pro-${r.sid}">${esc(r.nome)}</a></td><td>${p?p.n:(lj.produtos??'—')}</td><td>${p?p.colecoes.length:((lj.colecoes||[]).length||'—')}</td><td>${lj.preco_mediano??'—'} ${esc(lj.moeda||'')}</td><td>${lj.preco_faixa?esc(lj.preco_faixa[0]+' a '+lj.preco_faixa[1]):'—'}</td><td>${esc(lj.riscado||'—')}</td></tr>`}).join('');
  const col=M&&M.colecoes&&M.colecoes.length?`<h3>As coleções da nova marca</h3><div class="tab"><table><thead><tr><th>Coleção</th><th>Categoria</th><th>Preço</th><th>Equivalente na referência</th></tr></thead><tbody>${M.colecoes.map(c=>`<tr><td><b>${esc(c.nome)}</b></td><td>${esc(c.categoria||'')}</td><td>${esc(c.preco||'')}</td><td>${esc(c.equivalente||'')}</td></tr>`).join('')}</tbody></table></div>`:'';
  let h=sec('pro','Produtos','O que vende nas referências','Os preços da mesma coleção precisam ser parecidos, porque o lance do anúncio é um só para a coleção inteira. O CSV sai no formato de importação da Shopify: troque marca, preço e fotos antes de publicar.',
   `<div class="tab"><table><thead><tr><th>Loja</th><th>Produtos</th><th>Coleções</th><th>Preço mediano</th><th>Faixa</th><th>Riscado</th></tr></thead><tbody>${lin}</tbody></table></div>${col}`,'Visão geral');
  R.forEach(r=>{const p=r.produtos,lj=r.loja||{};
   const sub=p?`${p.n} produtos · ${p.colecoes.length} coleções · preço mediano ${lj.preco_mediano??'—'} ${esc(p.moeda||lj.moeda||'')} · catálogo lido em ${esc(p.lido||'')}`:`${lj.produtos??'—'} produtos · preço mediano ${lj.preco_mediano??'—'} ${esc(lj.moeda||'')}`;
   h+=sec('pro-'+r.sid,'Produtos · por loja',esc(r.nome),sub,produtosLoja(r),r.nome,'Por loja')});
  return h;
}
function produtosLoja(r){
  const p=r.produtos,lj=r.loja||{},mv=lj.mais_vendidos||[];
  const idx=p?Object.fromEntries(p.itens.map((x,i)=>[x.h,i])):{};const hDe=l=>((l||'').match(/\/products\/([^/?#]+)/)||[])[1];
  const maisV=mv.length?`<h3>Os mais vendidos</h3><p class="sub">Pela ordem pública da loja.</p><div class="prods">${mv.map((m,i)=>{const k=idx[hDe(m.link)];
    const foto=p&&k!=null?thumb(r,k,124):((m.foto_local||(m.foto&&!ART))?`<img loading="lazy" src="${esc(m.foto_local||m.foto)}" alt="" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px">`:`<span class="pm" style="width:124px;height:124px"></span>`);
    return `<a href="${esc(m.link)}" target="_blank" rel="noopener">${foto}<b>${i+1}. ${esc(m.titulo)}</b><span>${esc(m.preco)}${m.riscado?` <s>${esc(m.riscado)}</s>`:''}</span></a>`}).join('')}</div>`:'';
  if(!p) return linksLoja(r,'pro')+maisV+vazio('O catálogo inteiro, com as coleções e o CSV, ainda não foi lido.','python3 _engine/concorrente/catalogo.py "&lt;pasta da operação&gt;"');
  const cols=p.colecoes.map((c,ci)=>`<div class="colecao" data-busca="${esc((c.t+' '+c.h).toLowerCase())}"><div class="strip">${c.i.slice(0,6).map(i=>thumb(r,i,58)).join('')}</div>
    <b>${esc(c.t)}</b><span class="meta">${c.n} produtos · ${precoFaixa(r,c.i)} ${esc(p.moeda||'')}</span>
    <div class="acoes"><button class="bt sec" type="button" data-ver="${r.sid}:${ci}">Ver produtos</button><a href="https://${esc(r.dominio)}/collections/${esc(encodeURIComponent(c.h))}" target="_blank" rel="noopener">Abrir na loja</a><button class="bt" type="button" data-csv="${r.sid}:${ci}">Baixar CSV</button></div><div class="prods" hidden></div></div>`).join('');
  return linksLoja(r,'pro')+`<p class="acoes"><button class="bt" type="button" data-csv="${r.sid}:todos">Baixar CSV de todos os produtos (${p.n})</button></p>`+maisV+
   `<h3>As ${p.colecoes.length} coleções</h3>${p.colecoes_faltaram?`<p class="sub">${p.colecoes_faltaram} coleções da loja ainda não foram lidas: os produtos delas estão em Todos os produtos.</p>`:''}<input class="busca" type="search" id="busca-${r.sid}" data-loja="${r.sid}" placeholder="Procurar coleção (ex.: women, linen, sale)" aria-label="Procurar coleção na ${esc(r.nome)}"><div class="colecoes" id="cols-${r.sid}">${cols}</div>`;
}
function verColecao(b){const[sid,ci]=b.dataset.ver.split(':');const r=R.find(x=>x.sid===sid);const c=r.produtos.colecoes[+ci];const box=b.closest('.colecao'),g=box.querySelector('.prods');
  if(!g.hidden){g.hidden=true;box.classList.remove('aberta');b.textContent='Ver produtos';return}
  if(!g.dataset.ok){g.innerHTML=c.i.map(i=>{const it=r.produtos.itens[i];return `<a href="https://${esc(r.dominio)}/products/${esc(encodeURIComponent(it.h))}" target="_blank" rel="noopener">${thumb(r,i,124)}<span>${esc(it.t)}</span><span>${din(it.preco)}${it.de&&it.de>it.preco?` <s>${din(it.de)}</s>`:''}</span></a>`}).join('');g.dataset.ok='1'}
  g.hidden=false;box.classList.add('aberta');b.textContent='Fechar produtos'}
function baixarCsv(b){const[sid,ci]=b.dataset.csv.split(':');const r=R.find(x=>x.sid===sid);const c=ci==='todos'?null:r.produtos.colecoes[+ci];
  salvar(`${arqNome(r.nome)}-${c?arqNome(c.t):'todos-os-produtos'}.csv`,()=>csvDe(r,c?c.i:null),b)}

function site(){
  if(!R.length) return sec('sit','Site','Referência de site','',vazio('A leitura do site sai do raio-x.','/raio-x-concorrente',['A prévia de cada referência: a home no computador e no celular, e a página do produto principal no celular','O que a página do produto de cada uma tem: avaliações, urgência, frete grátis, garantia, leve mais, tabela de medidas, pagamentos','O que a sua loja copia primeiro, e a home de cada uma, seção por seção']),'Referência de site');
  const nomes=['avaliações','urgência','frete grátis','garantia','leve mais','tabela de medidas','pagamentos'];
  const m=nomes.map(n=>`<tr><th>${n}</th>${R.map(r=>{const s=((r.loja.pdp||{}).sinais||{})[n];return `<td>${s?'<span class="sim">sim</span><br><span class="nao">“'+esc(s.slice(0,90))+'”</span>':'<span class="nao">—</span>'}</td>`}).join('')}</tr>`).join('');
  const usa=nomes.filter(n=>R.filter(r=>((r.loja.pdp||{}).sinais||{})[n]).length>=Math.min(2,R.length));
  let h=sec('sit','Site','Como as referências vendem no site','Lido na home e na página do produto principal mais vendido de cada uma.',
   `<h3>A página do produto</h3><div class="tab"><table><thead><tr><th>Elemento</th>${R.map(r=>`<th>${esc(r.nome)}<br><a href="${esc((r.loja.pdp||{}).link||'#')}" target="_blank" rel="noopener">${esc((r.loja.pdp||{}).produto||'página')}</a></th>`).join('')}</tr></thead><tbody>${m}</tbody></table></div>
   <div class="caixa" style="margin-top:12px"><h4>O que a sua loja copia primeiro</h4><p>${usa.length?usa.map(u=>`<span class="chip f">${u}</span>`).join(''):'nenhum elemento aparece em mais de uma referência'}</p><p class="nao">O resto do site segue o roteiro de montagem da loja (Bloco 7): marca, catálogo, vender no mundo, oferta testada no carrinho e revisão antes de rodar.</p></div>`,'A página do produto, lado a lado');
  R.forEach(r=>{const lj=r.loja||{},pdp=lj.pdp||{},sn=pdp.sinais||{};
   h+=sec('sit-'+r.sid,'Site · por loja',esc(r.nome),`<a href="https://${esc(r.dominio)}" target="_blank" rel="noopener">${esc(r.dominio)}</a>${pdp.link?` · produto principal: <a href="${esc(pdp.link)}" target="_blank" rel="noopener">${esc(pdp.produto||'página')}</a>`:''} · role cada prévia para ver a página inteira`,
    linksLoja(r,'sit')+previas(r,true)+`<div class="grid2"><div class="caixa"><h4>A home, de cima para baixo</h4>${lj.barra_anuncio?`<p>Barra: <b>${esc(lj.barra_anuncio)}</b></p>`:''}<ol>${(lj.home_titulos||[]).map(t=>`<li>${esc(t)}</li>`).join('')}</ol><p class="nao">Apps: ${esc((lj.apps||[]).join(', ')||'—')} · idiomas: ${esc((lj.idiomas||[]).join(', ')||'—')}</p></div>
    <div class="caixa"><h4>A página do produto</h4><ul>${nomes.map(n=>`<li>${sn[n]?`<span class="sim">${n}</span> <span class="nao">“${esc(sn[n].slice(0,80))}”</span>`:`<span class="nao">${n}: não tem</span>`}</li>`).join('')}</ul></div></div>`,r.nome,'Por loja')});
  return h;
}

function marcaAba(){
  if(!M) return sec('mar','A marca','A nova marca','',vazio('A marca ainda não foi decidida.','/apresentar-nova-marca'));
  const I=M.identidade||{},cores=I.cores||[];const dest=(cores.find(c=>/destaque|bot/i.test(c.uso||''))||cores[0]||{hex:'#0A0A0A'}).hex;
  const on=c=>(c.contraste_preto>=c.contraste_branco?'#0A0A0A':'#FFFFFF');
  const cd=cores.find(c=>c.hex===dest)||{contraste_preto:1,contraste_branco:21};
  // dentro da aba, o destaque é a cor da marca; como texto, só se passar contraste 4,5 no branco
  const st=`--m-dest:${dest};--m-on:${on(cd)};--solid:${dest};--edge:${dest};--accent:${cd.contraste_branco>=4.5?dest:'#0A0A0A'};--m-titulo:'${esc(I.fonte_titulo||'Fraunces')}';--m-texto:'${esc(I.fonte_texto||'Inter')}'`;
  const F=M.fundador,P=M.persona||{},T=M.tom||{},O=M.oferta||{};
  const ficha=[['Nome',M.nome],['Domínio',M.dominio],['Mercado',M.mercado],['Catálogo',M.catalogo],['Produto principal',(M.produto||{}).heroi||M.produto_heroi],['Direção',M.direcao]].filter(x=>x[1]);
  let h=`<div class="capa"><h2>${esc(M.nome)}</h2><p>${esc(M.slogan||M.promessa||'')}</p>${M.resumo?`<p style="font-size:15px;opacity:.85">${esc(M.resumo)}</p>`:''}<div class="ficha">${ficha.map(x=>`<div><b>${x[0]}</b>${esc(x[1])}</div>`).join('')}</div></div>`;
  if(M.posicionamento||M.diferenca) h+=`<section><div class="eyebrow">Posicionamento</div><h2>Por que esta marca, e não a deles</h2>${M.posicionamento?`<p style="font-size:20px;max-width:860px" class="esp">${esc(M.posicionamento)}</p>`:''}${(M.diferenca||[]).map(d=>`<p class="citacao">${esc(d)}</p>`).join('')}</section>`;
  if(F) h+=`<section><div class="eyebrow">O fundador</div><h2>${esc(F.nome||'Quem assina a marca')}</h2><div class="grid2">${F.rosto_img?`<img src="${esc(F.rosto_img)}" alt="" style="width:100%;max-width:420px;border-radius:12px">`:`<div class="vazio">O rosto do fundador entra aqui (gere três opções e escolha uma: ele vira a referência de toda peça futura).</div>`}<div><p>${esc(F.bio_curta||'')}</p>${F.por_que?`<p class="nao">${esc(F.por_que)}</p>`:''}</div></div></section>`;
  if(M.biografia) h+=`<section><div class="eyebrow">Storytelling</div><h2>A página Sobre, pronta para colar</h2><p class="sub">É a biografia canônica: todo número e todo fato dela bate igual no rodapé, no e-mail, nos anúncios e nas redes.</p><div class="caixa"><h3 style="margin-top:0">${esc(M.biografia.titulo||'')}</h3><p class="citacao">${esc(M.biografia.texto||'')}</p>${M.biografia.assinatura?`<p><i>${esc(M.biografia.assinatura)}</i></p>`:''}</div></section>`;
  h+=`<section><div class="eyebrow">Para quem</div><h2>Quem compra, e o que dói</h2><div class="grid2"><div class="caixa"><h4>Para quem</h4><p>${esc(P.quem||'')}</p><p class="nao">${esc(P.momento||'')}</p>${(P.camadas||[]).length?`<ul>${P.camadas.map(c=>`<li>${esc(c)}</li>`).join('')}</ul>`:''}</div>
   <div class="caixa"><h4>A dor</h4><p><b>Primária:</b> ${esc(P.dor_primaria||'')}</p>${(P.e_dai||[]).map(x=>`<p><span class="nao">E daí?</span> ${esc(x)}</p>`).join('')}<p><b>Final:</b> ${esc(P.dor_final||'')}</p></div>
   <div class="caixa"><h4>O desejo</h4><p>${esc(P.desejo||'')}</p></div><div class="caixa"><h4>Nas palavras de quem compra</h4>${(P.palavras||[]).map(x=>`<p class="citacao">${esc(x)}</p>`).join('')}</div></div></section>`;
  if(T.usa||T.e) h+=`<section><div class="eyebrow">Tom de voz</div><h2>Como a marca fala</h2><div class="grid2"><div class="caixa"><h4>Usa</h4><ul>${(T.usa||T.e||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${T.vocab_usa?`<p class="nao">Vocabulário: ${esc(T.vocab_usa.join(', '))}</p>`:''}</div><div class="caixa"><h4>Evita</h4><ul>${(T.evita||T.nao_e||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${T.vocab_evita?`<p class="nao">Vocabulário: ${esc(T.vocab_evita.join(', '))}</p>`:''}</div></div>${(T.antes_depois||[]).length?`<div class="tab" style="margin-top:12px"><table><thead><tr><th>Antes</th><th>Depois</th></tr></thead><tbody>${T.antes_depois.map(x=>`<tr><td class="nao">${esc(x[0])}</td><td>${esc(x[1])}</td></tr>`).join('')}</tbody></table></div>`:''}</section>`;
  if(M.colecoes) h+=`<section><div class="eyebrow">Coleções</div><h2>Os nomes de coleção</h2><div class="tab"><table><thead><tr><th>Nome</th><th>Categoria</th><th>Preço</th><th>Equivalente na referência</th></tr></thead><tbody>${M.colecoes.map(c=>`<tr><td><b class="esp" style="font-size:18px">${esc(c.nome)}</b></td><td>${esc(c.categoria||'')}</td><td>${esc(c.preco||'')}</td><td>${esc(c.equivalente||'')}</td></tr>`).join('')}</tbody></table></div></section>`;
  if(O.contexto||O.nome) h+=`<section><div class="eyebrow">A oferta</div><h2>${esc(O.nome||O.contexto)}</h2><div class="grid2"><div class="caixa">${O.texto?`<p class="citacao">${esc(O.texto)}</p>`:''}</div><div class="caixa"><h4>Mecânica</h4><p><b>Contexto:</b> ${esc(O.contexto||'')}</p><p><b>Desconto:</b> ${esc(O.mecanica||'')}</p>${O.duracao?`<p><b>Duração:</b> ${esc(O.duracao)}</p>`:''}<p><b>Motivo declarado:</b> ${esc(O.motivo||'')}</p>${O.titulo_link?`<p><b>Título do link:</b> ${esc(O.titulo_link)}</p>`:''}</div></div></section>`;
  const logos=[['Logo',I.logo_img],['Monograma',I.monograma_img],['Favicon',I.favicon_img]];
  h+=`<section><div class="eyebrow">Identidade</div><h2>Logo, paleta e tipografia</h2><div class="grid2">${logos.map(l=>l[1]?`<div class="caixa"><h4>${l[0]}</h4><img src="${esc(l[1])}" alt="" style="max-width:100%;max-height:160px;${l[0]==='Logo'?'background:#fff;padding:18px;border-radius:8px':''}"></div>`:`<div class="vazio">${l[0]}: gere com <code>/logo-favicon-e-simbolo</code> e grave em <code>03 Marca/imagens/</code>.</div>`).join('')}</div>
   <h3>A paleta, medida sobre o branco</h3><p class="sub">Fundo branco e texto preto são a base do tema. A cor da marca entra como destaque, e só vira texto se passar contraste 4,5.</p><div class="sws">${cores.map(c=>`<div class="sw"><div style="background:${esc(c.hex)}"></div><p><b>${esc(c.nome||'')}</b> <code>${esc(c.hex)}</code><br>${esc(c.uso||'')}<br><span class="${c.contraste_branco>=4.5?'sim':'nao'}">sobre branco ${String(c.contraste_branco).replace('.',',')}${c.contraste_branco>=4.5?' · pode ser texto':' · só fundo ou detalhe'}</span></p></div>`).join('')}</div>
   <h3>Tipografia</h3><div class="grid2"><div class="caixa"><h4>Títulos · ${esc(I.fonte_titulo||'')}</h4><p class="esp">${esc(M.nome)}</p><p class="nao">${esc(I.uso_titulo||'Título, nome de coleção e logo.')}</p></div><div class="caixa"><h4>Texto · ${esc(I.fonte_texto||'')}</h4><p>${esc((M.produto||{}).heroi||M.promessa||'')}</p><p class="nao">${esc(I.uso_texto||'Corpo, descrição, menu e preço.')}</p></div></div></section>`;
  if(M.banners&&M.banners.length) h+=`<section><div class="eyebrow">Banners</div><h2>Os banners da loja</h2><p class="sub">Computador 3000 × 1000 e celular 1080 × 1600, redesenhado nativo em cada medida. A imagem sai sem texto; o texto por cima é HTML, a sugestão que vai nos campos do tema.</p><div class="banners">${M.banners.map((b,i)=>{const t=b.texto||{};const tx=`<div class="bn-t">${t.eyebrow?`<span class="bn-e">${esc(t.eyebrow)}</span>`:''}<strong class="bn-h">${esc(t.titulo||b.titulo||'')}</strong>${t.sub?`<span class="bn-s">${esc(t.sub)}</span>`:''}<span class="bn-b">${esc(t.botao||'Shop now')}</span></div>`;return `<div><h3>${i+1} · ${esc(b.titulo||'')}</h3><p class="nao">${esc(b.onde||'')}${b.referencia?' · referência: '+esc(b.referencia):''}</p><p>${esc(b.cena||'')}</p>${b.aviso?`<p class="nao">⚠ ${esc(b.aviso)}</p>`:''}<div class="banner">${b.desktop_img?`<div class="bn bn-d${b.lado==='direita'?' dir':''}"><img src="${esc(b.desktop_img)}" alt="">${tx}</div>`:'<div class="falta">computador 3000 × 1000<br>a gerar com /banners-da-loja</div>'}${b.mobile_img?`<div class="bn bn-m${b.pos_mobile==='baixo'?' baixo':''}"><img src="${esc(b.mobile_img)}" alt="">${tx}</div>`:'<div class="falta">celular 1080 × 1600</div>'}</div></div>`}).join('')}</div></section>`;
  if(M.pendencias&&M.pendencias.length) h+=`<section><div class="eyebrow">Pendências</div><h2>O que fica pendente</h2><ul>${M.pendencias.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`;
  return `<div class="marca" style="${st}">${h}</div>`;
}

function criativos(){
  if(!M||!M.angulos) return sec('cri','Criativos','O plano de criativos','',vazio('O plano nasce na apresentação da marca.','/apresentar-nova-marca'));
  const fm=[];M.angulos.forEach(a=>(a.formatos||[]).forEach(f=>{if(!fm.includes(f))fm.push(f)}));let total=0;
  const linhas=M.angulos.map(a=>`<tr><th>${esc(a.angulo)}<br><span class="nao">${esc(a.gancho||'')}</span></th>${fm.map(f=>(a.formatos||[]).includes(f)?(total+=3,'<td class="on">3</td>'):'<td></td>').join('')}<td>${(a.refs||[]).map(r=>`<a href="${esc(r.link)}" target="_blank" rel="noopener">${fotoP(r,'ref')}</a>`).join('')}</td></tr>`).join('');
  const lote=[];M.angulos.forEach(a=>(a.formatos||[]).forEach(f=>{for(let i=1;i<=3;i++)lote.push({a:a.angulo,f,g:a.gancho,r:(a.refs||[])[0]})}));
  const C=M.copy||{};
  return sec('cri','Criativos','O plano do primeiro lote',`Cada ângulo em vários formatos, três peças por combinação: ${total} peças. O mesmo ângulo em formatos diferentes alcança gente diferente, e peças com a mesma intenção competem entre si.`,
   `<div class="tab"><table class="mat"><thead><tr><th>Ângulo</th>${fm.map(f=>`<th>${esc(f)}</th>`).join('')}<th>Referência</th></tr></thead><tbody>${linhas}</tbody></table></div>
   <h3>O lote, peça por peça</h3><div class="tab"><table><thead><tr><th>#</th><th>Ângulo</th><th>Formato</th><th>Gancho</th><th>Modelo</th></tr></thead><tbody>${lote.map((x,i)=>`<tr><td>L${String(i+1).padStart(2,'0')}</td><td>${esc(x.a)}</td><td>${esc(x.f)}</td><td>${esc(x.g||'')}</td><td>${x.r?esc(x.r.k):'—'}</td></tr>`).join('')}</tbody></table></div>
   <h3>Copy de anúncio</h3><div class="grid2"><div class="caixa"><h4>Primeira linha</h4><ul>${(C.primeiras_linhas||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p class="nao">Sem preço nem percentual na primeira linha.</p></div><div class="caixa"><h4>Título do link</h4><ul>${(C.titulos_link||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p class="nao">O título carrega a oferta.</p></div><div class="caixa"><h4>A marca nunca escreve</h4><ul>${(C.nunca_escrever||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></div>
   <p class="sub" style="margin-top:12px">Produção: <code>/briefing-criativos</code> para o roteiro, <code>/gerar-imagem-gpt-chrome</code> para a imagem com a sua marca, <code>/copy-anuncios</code> para os textos.</p>`);
}

function trafego(){
  const r=[['Primeiro lançamento','Uma campanha, um conjunto só, com criativo dinâmico e pelo menos 3 anúncios por formato encontrado no lote.'],
   ['Lance','Comece pelo CPA máximo que a margem aguenta. Não gastou: suba 20%. Não gastou de novo: suba 50%. Não gastou nem assim: troque o criativo.'],
   ['Leitura','Não gastou: é o criativo, na maioria das vezes. Gastou e parou: é o site ou a oferta. Vende sem lucro: microajustes no funil.'],
   ['Volume','Pelo menos 20 criativos novos por semana. Lote de teste em conjunto novo, de 5 a 14 anúncios.'],
   ['Validou','O criativo que validou ganha um conjunto só com variações dele, para outro público, idade ou país.']];
  return sec('tra','Tráfego','O primeiro teste','O desenho de teste da casa, do jeito que entra na primeira campanha. O registro de cada teste é escrito aqui embaixo, à mão, até a conta estar conectada.',
   `<div class="tab"><table><tbody>${r.map(x=>`<tr><th>${x[0]}</th><td>${x[1]}</td></tr>`).join('')}</tbody></table></div>
   <h3>O registro</h3><div class="tab"><table><thead><tr><th>Data</th><th>Conjunto</th><th>Criativos</th><th>Gasto</th><th>Vendas</th><th>CPA</th><th>Decisão</th></tr></thead><tbody><tr><td colspan="7" class="nao">Anote aqui cada teste. Peça ao Claude para preencher a partir do relatório da conta.</td></tr></tbody></table></div>`);
}

function tasks(){
  const g=[['Mineração',[['Rodar a mineração do nicho','/minerar-concorrentes'],['Escolher 3 lojas para o raio-x','aba Mercado']]],
   ['Raio-X',[['Raio-x das 3 lojas, com os criativos classificados','/raio-x-concorrente'],['Ler as cinco perguntas com o dono','aba Referências']]],
   ['A nova marca',[['Decidir nome, para quem, coleções, preço e oferta','/apresentar-nova-marca'],['Logo, monograma e favicon','/logo-favicon-e-simbolo'],['Os banners nas duas medidas','/banners-da-loja']]],
   ['Site',[['Conta, tema e Claude ligado na loja','roteiro do Bloco 7'],['Marca na loja','/colocar-a-marca-na-loja'],['Catálogo importado','/clonar-loja e /editar-produtos'],['Vender no mundo','/shopify-worldwide-setup'],['Oferta testada no carrinho','/aplicar-carrinho'],['Revisão antes de rodar','/revisao-completa-loja e /qa-funcional-compra']]],
   ['Criativos',[['Briefing do lote','/briefing-criativos'],['Imagens com a sua marca','/gerar-imagem-gpt-chrome'],['Textos do anúncio','/copy-anuncios']]],
   ['Instagram',[['Perfil da loja','/perfil-loja-instagram'],['Primeiros posts','/posts-feed-ppar']]],
   ['Tráfego',[['Pixel conferido','/auditar-pixel'],['Primeiro teste no ar','aba Tráfego']]]];
  let n=0;const auto={'Mineração':D.etapas[0].feito,'Raio-X':D.etapas[1].feito,'A nova marca':D.etapas[2].feito};
  return sec('tas','Tasks','O que falta, em ordem','Marque o que já fez. A marcação fica guardada neste navegador.',g.map(([k,v])=>`<h3>${k}</h3>${v.map(t=>{const id='t'+(n++);return `<label class="tarefa"><input type="checkbox" data-id="${id}" ${auto[k]&&t===v[0]?'checked disabled':''}><span>${esc(t[0])}<br><code>${esc(t[1])}</code></span></label>`}).join('')}`).join(''));
}

function debriefingAba(){
  if(!D.debriefing) return sec('deb','Debriefing','Debriefing do nicho','',vazio('O debriefing sai depois do raio-x.','/raio-x-concorrente',['A leitura do nicho: o que as referências fazem igual, o que cada uma faz diferente e o que a sua operação copia primeiro']),'Debriefing do nicho');
  return sec('deb','Debriefing','Debriefing do nicho','',D.debriefing,'Debriefing do nicho');
}
const ABAS=SO_MARCA?[['mar','A marca',marcaAba]]:[['ini','Início',inicio],['deb','Debriefing',debriefingAba],['mer','Mercado',mercado],['ref','Referências',referencias],['ban','Banco',banco],['pro','Produtos',produtos],['sit','Site',site],['mar','A marca',marcaAba],['cri','Criativos',criativos],['tra','Tráfego',trafego],['tas','Tasks',tasks]];
const main=document.getElementById('main'),nav=document.getElementById('abas');
const TR=D.tr||{};
function traduzir(raiz){if(!raiz.querySelectorAll)return;[raiz,...raiz.querySelectorAll('*')].forEach(el=>{
  if(el.children.length||el.dataset.tr||el.closest('.trad'))return;const t=(el.textContent||'').trim(),pt=TR[t];if(!pt)return;
  el.dataset.tr='1';const b=document.createElement('details');b.className='trad';b.innerHTML=`<summary>ver em português</summary><div>${esc(pt)}</div>`;
  if(el.closest('option,select,button,summary,title,nav,svg'))return;if(/^(TD|TH|LI|DD|DT)$/.test(el.tagName))el.appendChild(b);else el.after(b)})}
new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>n.nodeType===1&&traduzir(n)))).observe(main,{childList:true,subtree:true});
const DESC={ini:'a operação em uma página',deb:'a leitura do nicho',mer:'as lojas do nicho',ref:'cada concorrente medido',ban:'os criativos dos concorrentes',pro:'coleções, fotos e CSV',sit:'como as referências vendem',mar:'a nova marca',cri:'o plano do primeiro lote',tra:'o primeiro teste',tas:'o que falta, em ordem'};
ABAS.forEach(([id,nome,f])=>{const d=document.createElement('div');d.className='aba';d.id='aba-'+id;
 d.innerHTML=`<nav class="trilha" aria-label="Seções da aba ${esc(nome)}"></nav><div class="corpo">${f()}</div>`;main.appendChild(d);
 // a trilha nasce das seções da própria aba: aba com uma seção só não precisa dela
 const ss=[...d.querySelectorAll('.corpo section[id]')],tr=d.querySelector('.trilha');
 if(ss.length<2){d.classList.add('sem-trilha');tr.remove()}
 else{let g='',k=0;tr.innerHTML=`<div class="tt">${esc(nome)}</div><div class="ds">${esc(DESC[id]||'')}</div>`+ss.map(s=>{const gr=s.dataset.g||'';const cab=gr&&gr!==g?`<div class="g">${esc(gr)}</div>`:'';g=gr;
  return cab+`<a href="#${s.id}"><span class="n">${String(++k).padStart(2,'0')}</span>${esc(s.dataset.t||'')}</a>`}).join('')}
 const b=document.createElement('button');b.textContent=nome;b.onclick=()=>abrir(id);b.dataset.id=id;nav.appendChild(b)});
if(SO_MARCA)nav.parentElement.style.display='none';
const CHAVE='central-'+D.op;
function abrir(id,ficar){document.querySelectorAll('.aba').forEach(a=>a.classList.toggle('on',a.id==='aba-'+id));document.querySelectorAll('nav.abas button').forEach(b=>b.classList.toggle('on',b.dataset.id===id));try{history.replaceState(null,'','#'+id);localStorage.setItem(CHAVE+'-aba',id)}catch(e){}if(!ficar)window.scrollTo(0,0)}
// o endereço aceita a aba (#ban) ou uma seção dela (#ban-loja-com): link direto para conferir uma loja
function irPara(h){if(!h)return false;if(ABAS.some(a=>a[0]===h)){abrir(h);return true}const el=document.getElementById(h),aba=el&&el.closest('.aba');if(!aba)return false;
 abrir(aba.id.slice(4),true);try{history.replaceState(null,'','#'+h)}catch(e){}setTimeout(()=>el.scrollIntoView({block:'start'}),0);return true}
montarBanco();
// escolha do Mercado: no artefato fica no banco dele (coleção mercado, que o Claude lê antes do raio-x); no arquivo local, no navegador
const VOTOS={};let MDB=null,FILTRO_M='todas';
function pintarMercado(){const linhas=[...document.querySelectorAll('#aba-mer [data-dom]')];if(!linhas.length)return;
 linhas.forEach(tr=>{const v=VOTOS[tr.dataset.dom];tr.classList.toggle('descartada',v==='descartar');tr.querySelectorAll('button[data-merc]').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  tr.hidden=FILTRO_M!=='todas'&&(FILTRO_M==='sem'?!!v:v!==FILTRO_M)});
 const n=k=>linhas.filter(tr=>VOTOS[tr.dataset.dom]===k).length,u=n('usar'),d=n('descartar');
 document.getElementById('mer-filtro').innerHTML='<b>Mostrar</b>'+[['todas','Todas',linhas.length],['usar','Usar',u],['descartar','Descartadas',d],['sem','Sem decisão',linhas.length-u-d]]
  .map(([k,t,c])=>`<button type="button" data-mfiltro="${k}" class="${FILTRO_M===k?'on':''}">${t} ${c}</button>`).join('')+'<button type="button" data-mcopiar="1">Copiar as escolhas</button>'}
async function votar(dom,v){const novo=VOTOS[dom]===v?null:v;if(novo)VOTOS[dom]=novo;else delete VOTOS[dom];pintarMercado();
 try{if(MDB){const ref=MDB.doc('mercado/'+dom);if(novo)await ref.set({dominio:dom,decisao:novo,em:new Date().toISOString()});else await ref.delete()}
  else localStorage.setItem(CHAVE+'-mercado',JSON.stringify(VOTOS))}catch(e){aviso('Não deu para guardar a escolha. Tente de novo.')}}
if(ART){try{window.claude.use('db').then(db=>{if(!db)return;MDB=db;db.collection('mercado').onSnapshot(s=>{for(const k in VOTOS)delete VOTOS[k];
 s.docs.forEach(x=>{const b=x.data();if(b&&b.decisao)VOTOS[x.id]=b.decisao});pintarMercado()},()=>{})}).catch(()=>{})}catch(e){}}
// artefato público não tem banco: o voto fica no navegador e precisa ser relido mesmo com ART
try{if(!MDB)Object.assign(VOTOS,JSON.parse(localStorage.getItem(CHAVE+'-mercado')||'{}'))}catch(e){}
pintarMercado();
let ini=(location.hash||'').slice(1);try{ini=ini||localStorage.getItem(CHAVE+'-aba')}catch(e){}
if(!irPara(ini))abrir(ABAS[0][0]);
window.addEventListener('hashchange',()=>irPara(location.hash.slice(1)));
document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(a){if(irPara(a.getAttribute('href').slice(1)))e.preventDefault();return}
 const m=e.target.closest('button[data-midia]');if(m){salvar(m.dataset.nome,()=>fetch(m.dataset.midia).then(x=>{if(!x.ok)throw new Error(x.status);return x.blob()}),m);return}
 const bv=e.target.closest('button[data-bv]');if(bv){votoBanco(bv.dataset.bv,bv.dataset.v);return}
 const mv=e.target.closest('button[data-merc]');if(mv){votar(mv.dataset.merc,mv.dataset.v);return}
 const mf=e.target.closest('button[data-mfiltro]');if(mf){FILTRO_M=mf.dataset.mfiltro;pintarMercado();return}
 if(e.target.closest('button[data-mcopiar]')){const g=k=>Object.keys(VOTOS).filter(d=>VOTOS[d]===k).join(', ')||'nenhuma';
  const t=`Usar: ${g('usar')}\nDescartar: ${g('descartar')}`;navigator.clipboard.writeText(t).then(()=>aviso('Copiado. Cole no chat do Claude.'),()=>aviso(t));return}
 const v=e.target.closest('button[data-ver]');if(v){verColecao(v);return}
 const c=e.target.closest('button[data-csv]');if(c)baixarCsv(c)});
document.addEventListener('input',e=>{const i=e.target.closest('input.busca');if(!i)return;const q=i.value.trim().toLowerCase();
 document.querySelectorAll('#cols-'+i.dataset.loja+' .colecao').forEach(c=>{c.hidden=!!q&&!c.dataset.busca.includes(q)})});
document.querySelectorAll('.tarefa input:not([disabled])').forEach(c=>{try{c.checked=localStorage.getItem(CHAVE+'-'+c.dataset.id)==='1'}catch(e){}c.onchange=()=>{try{localStorage.setItem(CHAVE+'-'+c.dataset.id,c.checked?'1':'0')}catch(e){}}});
if('IntersectionObserver' in window){const io=new IntersectionObserver(es=>es.forEach(en=>{if(!en.isIntersecting)return;const a=document.querySelector(`.aba.on .trilha a[href="#${en.target.id}"]`);
 if(a){a.parentElement.querySelectorAll('a.on').forEach(x=>x.classList.remove('on'));a.classList.add('on')}}),{rootMargin:'-20% 0px -70% 0px'});
 document.querySelectorAll('.corpo section[id]').forEach(s=>io.observe(s))}
</script></body></html>'''

if __name__ == '__main__':
    main()
