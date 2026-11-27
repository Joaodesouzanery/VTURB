# Playbook: anúncios com IA (do CSV à publicação)

1. **Exportar dados**: CSV da plataforma (CTR, conversões, gasto por anúncio).
2. **Diagnosticar**: pedir ao Claude os anúncios fracos e por quê.
3. **Contexto fixo**: criar skills com tom de voz, ofertas/claims permitidos e regras da plataforma (limites de caracteres).
4. **Gerar copy**: comando único (ex.: `/rsa`) ou agentes separados para headline (≤30 caracteres no Google RSA) e descrição (≤90).
5. **Revisar à mão** cada headline (promessa, tom, diferenciação, compliance).
6. **Produzir criativos**: plugin/automação no Figma que troca textos de templates a partir de planilha.
7. **Exportar CSV** pronto para upload.
8. **Medir e registrar**: planilha de experimentos (hipótese, variação, resultado, aprendizado) alimentada de volta no passo 3.

Cruze com os vídeos VTURB sobre criativos e copy (`01-VTURB/transcricoes/`) usando a skill `marketing-conhecimento`.
