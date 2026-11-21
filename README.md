# VTURB – base de conhecimento

Transcrições dos vídeos de https://www.youtube.com/@vturb (2022–2026).

```bash
python3 -m venv .venv && source .venv/bin/activate && pip install -U --pre "yt-dlp[default]"
python baixar.py --workers 3 --cookies-from-browser chrome   # baixa (retoma se interromper)
python indexar.py                                            # gera INDEX.md e conhecimento/
```

- `transcricoes/AAAA/AAAA-MM-DD_slug_id/transcricao.md` – uma pasta por vídeo
- `INDEX.md` – lista de todos os vídeos
- `conhecimento/AAAA.md` – transcrições do ano num arquivo só, para anexar em chats/Projects do Claude
- `.claude/skills/` – skills: baixar, consultar e resumir

Sem legenda: `sem_legenda.txt`.
