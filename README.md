# VTURB – transcrições do YouTube

Baixa as transcrições dos vídeos de https://www.youtube.com/@vturb (2022–2026) em paralelo.

```bash
python3 -m venv .venv && source .venv/bin/activate && pip install -U yt-dlp
python baixar.py --limit 3   # teste
python baixar.py             # completo (retoma de onde parou)
```

Saída: `transcricoes/AAAA-MM-DD - titulo [id].txt`; vídeos sem legenda em `sem_legenda.txt`.
Opções: `--workers 8`, `--depois 20220101`, `--antes 20261231`, `--cookies-from-browser chrome`.
