# Anthropic – Growth Marketing com Claude

Fonte primária: [How Anthropic's Growth Marketing team cut ad creation time from 30 minutes to 30 seconds with Claude Code](https://claude.com/blog/how-anthropic-uses-claude-marketing) (26/01/2026).

## Confirmado na fonte primária
- Pessoa: Austin Lau, growth marketer da Anthropic, que nunca tinha programado e construiu as ferramentas com Claude Code. A fonte não informa o tamanho do time.
- **Anúncios Google (RSA):** comando próprio `/rsa`. O Claude Code pede dados da campanha, copies existentes e palavras-chave; cruza com Agent Skills criadas por ele (tom de voz da marca, precisão do produto, boas práticas de RSA); ele refina em conversa, revisa cada headline à mão e exporta um **CSV pronto para upload** com 15 headlines e 4 descrições por anúncio.
- **Plugin do Figma:** feito com Claude Code em cerca de 45 min a 1 h; cola headlines de uma planilha do Google e gera dezenas de variações de anúncio com um clique, economizando perto de 30 min a cada atualização grande em vários formatos. O primeiro protótipo "mal funcionava"; ele apontou o Claude Code para a documentação da API do Figma.
- **Resultado:** "de 30 minutos por anúncio para 30 segundos"; mais experimentos de copy e iteração mais rápida.
- Outros times de marketing citados no post: Influencer 100+ h/mês; Customer Marketing case studies em 30 min (antes 2,5 h), 10 h/semana; Digital Marketing produtividade 5x ano a ano; Product Marketing 5–10 h por lançamento; Partner Marketing 40% menos tempo de preparação de feiras.

## Informado pelo usuário (NÃO encontrado na fonte primária)
Texto recebido do usuário, ainda sem fonte verificada:
- Growth marketing inteiro conduzido por uma pessoa não técnica por **10 meses**, cobrindo paid search, paid social, app store, email e SEO.
- Fluxo inicial: exportar CSV das plataformas de anúncios (CTR, conversões, investimento), enviar ao Claude, identificar campanhas fracas e gerar novas copies para substituí-las.
- **Dois subagentes**: um só para headlines (até 30 caracteres) e outro só para descrições (até 90 caracteres), gerando centenas de combinações.
- Integração com a **API do Meta Ads** para perguntar ao Claude quais anúncios convertem melhor e onde o orçamento é desperdiçado.
- **Sistema de memória de experimentos** (hipóteses, testes, resultados) que refina as próximas variações.
- Tempo de criação de anúncios de **2 horas para ~15 minutos**; até 100 variações em segundos.

Observação: o fluxo do post oficial é parecido (CSV, copy por IA, Figma, revisão), mas subagentes, Meta Ads API, memória de experimentos, 10 meses e os limites de 30/90 caracteres **não aparecem** lá. Tratar como não confirmado até achar a fonte (o limite de 30 caracteres para headline e 90 para descrição é o limite real do Google Ads RSA, mas isso não prova que foi dito neste caso).

## Como aplicar
Ver [playbook](../playbooks/anuncios-com-ia.md).
