---
name: vturb-baixar-transcricoes
description: Baixa/atualiza as transcrições do canal YouTube @vturb, reindexa e envia ao GitHub. Use quando o usuário pedir para atualizar a base de vídeos da VTURB.
---
O YouTube bloqueia IPs de nuvem: o download deve rodar na máquina do usuário.
1. Peça ao usuário para rodar no terminal do repo (venv ativo):
   `python baixar.py --workers 2 --cookies-from-browser chrome && python indexar.py`
   (retoma sozinho; use `--depois AAAAMMDD` para só vídeos novos).
2. Depois: `git add -A && git commit -m "Atualiza transcrições" && git push`.
3. Se aparecer "page needs to be reloaded": `pip install -U --pre "yt-dlp[default]"`.
