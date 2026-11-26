#!/usr/bin/env python3
"""Confere o que a máquina precisa para minerar e fazer o raio-x. Sai com 1 se faltar algo obrigatório.

    python3 _engine/concorrente/preflight.py [--instalar]

--instalar roda a instalação do navegador de coleta na pasta do motor (npm, uma vez por máquina).
"""
import os, shutil, subprocess, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
falhou = False


def linha(ok, nome, detalhe=''):
    global falhou
    marca = 'ok  ' if ok == True else ('aviso' if ok is None else 'FALTA')
    if ok is False:
        falhou = True
    print(f'  {marca}  {nome}{"  " + detalhe if detalhe else ""}')


def playwright_ok():
    teste = ("import { createRequire } from 'module';"
             "const bs=[process.env.PLAYWRIGHT_DIR, process.env.HOME+'/.npm-global/node_modules/', '" + AQUI + "/'].filter(Boolean);"
             "for (const b of bs) { try { createRequire(b.endsWith('/')?b:b+'/')('playwright'); console.log('ok'); process.exit(0);} catch {} } process.exit(1);")
    return subprocess.run(['node', '--input-type=module', '-e', teste], capture_output=True).returncode == 0


def navegador_ok():
    cache = os.path.expanduser('~/Library/Caches/ms-playwright') if sys.platform == 'darwin' else (
        os.path.join(os.environ.get('LOCALAPPDATA', ''), 'ms-playwright') if os.name == 'nt' else os.path.expanduser('~/.cache/ms-playwright'))
    return os.path.isdir(cache) and any(d.startswith(('chromium_headless_shell', 'chromium-')) for d in os.listdir(cache))


if '--instalar' in sys.argv:
    print('instalando o navegador de coleta (uma vez por máquina) ...')
    subprocess.run(['npm', 'install', '--no-audit', '--no-fund'], cwd=AQUI, check=False)
    subprocess.run(['npx', 'playwright', 'install', 'chromium-headless-shell'], cwd=AQUI, check=False)

print('Pre-voo · minerar e raio-x')
node = shutil.which('node')
ver = subprocess.run(['node', '-v'], capture_output=True, text=True).stdout.strip() if node else ''
linha(bool(node) and int(ver.lstrip('v').split('.')[0] or 0) >= 18, 'Node 18 ou mais nova', ver or 'instale em nodejs.org')
linha(sys.version_info >= (3, 9), 'Python 3.9 ou mais novo', sys.version.split()[0])
try:
    import PIL  # noqa: F401
    linha(True, 'Pillow (folhas e miniaturas)')
except ImportError:
    linha(False, 'Pillow (folhas e miniaturas)', 'rode: pip3 install --user Pillow')
pw = bool(node) and playwright_ok()
linha(pw, 'Playwright (coletor da biblioteca, sem login)', '' if pw else 'rode: python3 _engine/concorrente/preflight.py --instalar')
nav = navegador_ok()
linha(nav, 'Navegador de coleta instalado', '' if nav else 'rode: python3 _engine/concorrente/preflight.py --instalar')
linha(True if shutil.which('ffmpeg') else None, 'ffmpeg (tira de 3 quadros do vídeo)',
      '' if shutil.which('ffmpeg') else 'sem ele o vídeo aparece pela capa; para instalar: brew install ffmpeg')
print('\nPronto para rodar.' if not falhou else '\nFalta o que está marcado acima. Resolva e rode o pre-voo de novo.')
sys.exit(1 if falhou else 0)
