# VTURB · Base de conhecimento (segundo cérebro)

Repositório privado com tudo organizado em quatro áreas. Pode ser aberto no **Obsidian** (abra a pasta como vault) e consultado pelo Claude (skills em `.claude/skills/`).

```
01-VTURB/        Canal do YouTube @vturb (2023–2026)
  transcricoes/AAAA/<vídeo>/   transcrição + resumo (todos os 177 vídeos) por vídeo
  temas/  convidados/          páginas-hub com [[links]] (alimentam o grafo)
  conhecimento/AAAA.md         transcrições do ano num arquivo só (para anexar em chats)
  INDEX.md  glossario.md  sem_legenda.txt
02-BASEX/        Curso/sistema BaseX (e-commerce internacional)
  originais/   playbooks/   texto/   sistema/SistemaBaseX/ (vault do Obsidian)
03-ECOM/         Página ECOM completa (PDF + texto)
04-MARKETING/    Casos e playbooks de marketing com IA
ferramentas/     baixar.py (YouTube) e indexar.py (índices e grafo)
.claude/skills/  Skills: vturb-conhecimento, vturb-resumir-video, vturb-baixar-transcricoes,
                 basex-conhecimento, marketing-conhecimento
```

Comece por: [01-VTURB/INDEX.md](01-VTURB/INDEX.md) · [02-BASEX/INDEX.md](02-BASEX/INDEX.md) · [03-ECOM/INDEX.md](03-ECOM/INDEX.md) · [04-MARKETING/README.md](04-MARKETING/README.md)

## Atualizar os vídeos (rodar no Mac, na raiz do repositório)
```bash
python3 -m venv .venv && source .venv/bin/activate && pip install -U --pre "yt-dlp[default]"
python ferramentas/baixar.py --workers 2 --cookies-from-browser chrome   # baixa só o que falta
python ferramentas/baixar.py --descricoes --cookies-from-browser chrome  # (uma vez) descrição/links/capítulos
python ferramentas/indexar.py                                            # índices, temas e convidados
```
O YouTube limita a taxa (erro 429): o script pausa sozinho e retoma. Vídeos sem legenda ficam em `01-VTURB/sem_legenda.txt`.

## Obsidian
- **Tudo junto:** abra a pasta do repositório como vault. As cores do grafo já vêm em `.obsidian/graph.json`.
- **Só o sistema BaseX:** abra `02-BASEX/sistema/SistemaBaseX` como vault (é o que o curso recomenda).

## Pendências
`MIRO DESING.pdf` (a enviar) · `doc-instagram.html` (original vazio) · 4 vídeos sem legenda no YouTube · cerca de 40 vídeos têm a transcrição cortada no fim (limite da legenda do YouTube; os resumos avisam).
