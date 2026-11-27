# VTURB – base de conhecimento

Transcrições dos vídeos de https://www.youtube.com/@vturb (2022–2026).

```bash
python3 -m venv .venv && source .venv/bin/activate && pip install -U --pre "yt-dlp[default]"
python baixar.py --workers 2 --cookies-from-browser chrome   # baixa (retoma se interromper)
python baixar.py --descricoes --cookies-from-browser chrome  # (uma vez) adiciona descrição/links/capítulos de cada vídeo
python indexar.py                                            # gera INDEX.md, conhecimento/, temas/ e convidados/
```

- `transcricoes/AAAA/AAAA-MM-DD_slug_id/transcricao.md` – uma pasta por vídeo
- `INDEX.md` – lista de todos os vídeos
- `conhecimento/AAAA.md` – transcrições do ano num arquivo só, para anexar em chats/Projects do Claude
- `MARKETING/` – casos e playbooks de marketing com IA
- `BASEX/` – material do curso/sistema (originais, playbooks, texto e vault do Obsidian); `ECOM/` – página ECOM completa
- `.claude/skills/` – skills: baixar, consultar, resumir e marketing

Sem legenda: `sem_legenda.txt`.

O YouTube limita a taxa (HTTP 429): o script pausa sozinho e retoma. Pode levar 15–60 min; se sobrar erro, rode o mesmo comando de novo.

## Grafo no Obsidian
Abra esta pasta como vault (*Open folder as vault*). `temas/` e `convidados/` são páginas-hub com `[[links]]` para cada vídeo; `INDEX.md` liga tudo. Cada vídeo tem nome de arquivo único. Para o grafo só do sistema, abra `BASEX/sistema/SistemaBaseX` como vault.
