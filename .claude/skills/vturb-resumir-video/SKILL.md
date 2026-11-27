---
name: vturb-resumir-video
description: Cria <pasta>-resumo.md (pontos-chave, frameworks, números, ações) ao lado de uma transcrição da VTURB. Use quando o usuário pedir resumo de um ou vários vídeos.
---
Para cada `transcricoes/AAAA/<pasta>/<pasta>.md` pedido, escreva `<pasta>-resumo.md` na mesma pasta (nome único para o grafo do Obsidian), com front-matter de tags (tema, convidado, nicho) com: tese central, pontos-chave, frameworks/passos, números e exemplos citados, ações práticas, e frases marcantes. Seja fiel ao texto. Ao final rode `python indexar.py`.
