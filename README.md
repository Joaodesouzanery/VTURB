# VTURB – base de conhecimento

Transcrições dos vídeos de https://www.youtube.com/@vturb (2022–2026).

```bash
python3 -m venv .venv && source .venv/bin/activate && pip install -U --pre "yt-dlp[default]"
python baixar.py --workers 2 --cookies-from-browser chrome   # baixa (retoma se interromper)
python indexar.py                                            # gera INDEX.md e conhecimento/
```

- `transcricoes/AAAA/AAAA-MM-DD_slug_id/transcricao.md` – uma pasta por vídeo
- `INDEX.md` – lista de todos os vídeos
- `conhecimento/AAAA.md` – transcrições do ano num arquivo só, para anexar em chats/Projects do Claude
- `MARKETING/` – casos e playbooks de marketing com IA
- `BASEX/` – material do curso/sistema (originais, texto e vault do Obsidian)
- `.claude/skills/` – skills: baixar, consultar, resumir e marketing

Sem legenda: `sem_legenda.txt`.

O YouTube limita a taxa (HTTP 429): o script pausa sozinho e retoma. Pode levar 15–60 min; se sobrar erro, rode o mesmo comando de novo.
