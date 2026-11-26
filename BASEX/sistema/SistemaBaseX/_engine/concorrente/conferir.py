#!/usr/bin/env python3
"""Conferência de fim do raio-x: lista as referências sem página de produto e, se pedido, espera a loja liberar e refaz (0365).

    python3 conferir.py "<pasta da operação>"                      só lista; sai com código 1 se faltar alguma
    python3 conferir.py "<pasta da operação>" --esperar 6          espera até 6 h: relê a loja, tira a prévia e lista o que sobrou
        [--intervalo 15]                                           minutos entre as voltas (padrão 15)

Falta página de produto quando o loja.json não tem pdp.link (429 no "mais vendidos", loja que não foi lida) ou quando
o pdp.link existe e a prévia pdp_celular.jpg não saiu. Não gera a Central nem republica: depois de zerar a lista,
rode central.py e publique. Rode antes do central.py; com --esperar, em segundo plano.
"""
import json, os, shutil, subprocess, sys, time, urllib.error, urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'


def faltas(raiox):
    """{domínio: motivo} das referências sem página de produto utilizável."""
    out = {}
    for d in sorted(os.listdir(raiox)) if os.path.isdir(raiox) else []:
        pasta = os.path.join(raiox, d)
        if not os.path.isdir(pasta):
            continue
        try:
            loja = json.load(open(os.path.join(pasta, 'loja.json')))
        except (OSError, ValueError):
            out[d] = 'sem loja.json (loja não lida)'
            continue
        pdp = loja.get('pdp') or {}
        if not pdp.get('link'):
            out[d] = 'limite de leitura (429)' if loja.get('limite') else (pdp.get('erro') or 'sem produto principal')[:90]
        elif not os.path.exists(os.path.join(pasta, 'previa', 'pdp_celular.jpg')):
            out[d] = 'tem o link do produto, falta a prévia (previa.mjs)'
    return out


def responde(d):
    """True se o 'mais vendidos' da loja responde 200 (um pedido por loja)."""
    url = f'https://{d}/collections/all/products.json?sort_by=best-selling&limit=1'
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=20) as f:
            return f.status == 200
    except (urllib.error.URLError, TimeoutError, ConnectionError):
        return False


def reler(d, pasta):
    """Roda o loja.py num arquivo novo; só troca o loja.json se veio o produto principal (guarda o antigo)."""
    novo = os.path.join(pasta, 'loja.novo.json')
    subprocess.run([sys.executable, os.path.join(AQUI, 'loja.py'), d, '--saida', novo], capture_output=True, timeout=600)
    try:
        ok = bool((json.load(open(novo)).get('pdp') or {}).get('link'))
    except (OSError, ValueError):
        ok = False
    if ok:
        atual = os.path.join(pasta, 'loja.json')
        if os.path.exists(atual):
            shutil.copy2(atual, os.path.join(pasta, 'loja.antes-conferir-' + time.strftime('%Y-%m-%d') + '.json'))
        os.replace(novo, atual)
    elif os.path.exists(novo):
        os.remove(novo)
    return ok


def previa(op, doms):
    subprocess.run(['node', os.path.join(AQUI, 'previa.mjs'), op, *doms], timeout=1800)


def conferir(op, horas=0, intervalo=15, sondar=responde, reler_loja=reler, tirar_previa=previa, dormir=time.sleep, agora=time.time):
    raiox = os.path.join(op, '02 Raio-X')
    pend = faltas(raiox)
    print(f'referências sem página de produto: {len(pend)}')
    for d, m in pend.items():
        print(f'  {d}: {m}')
    fim = agora() + horas * 3600
    while pend and agora() < fim:
        for d in list(pend):
            pasta = os.path.join(raiox, d)
            if os.path.exists(os.path.join(pasta, 'loja.json')) and 'prévia' in pend[d]:
                continue  # só falta a prévia: tira no fim da volta
            if sondar(d):
                if reler_loja(d, pasta):
                    print(f'  {d}: produto principal lido')
                else:
                    print(f'  {d}: respondeu, mas o loja.py não achou o produto principal')
                dormir(30)
        tentar = [d for d in faltas(raiox) if os.path.exists(os.path.join(raiox, d, 'loja.json'))
                  and (json.load(open(os.path.join(raiox, d, 'loja.json'))).get('pdp') or {}).get('link')]
        if tentar:
            tirar_previa(op, tentar)
        pend = faltas(raiox)
        if pend and agora() < fim:
            print(f'esperando {intervalo} min; faltam {sorted(pend)}', flush=True)
            dormir(intervalo * 60)
    if horas:
        print(f'sobraram {len(pend)}: {sorted(pend)}' if pend else 'todas as referências têm página de produto e prévia')
    return pend


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    a = sys.argv
    val = lambda k, p: float(a[a.index(k) + 1]) if k in a else p
    sobra = conferir(os.path.abspath(a[1]), val('--esperar', 0), val('--intervalo', 15))
    sys.exit(1 if sobra else 0)
