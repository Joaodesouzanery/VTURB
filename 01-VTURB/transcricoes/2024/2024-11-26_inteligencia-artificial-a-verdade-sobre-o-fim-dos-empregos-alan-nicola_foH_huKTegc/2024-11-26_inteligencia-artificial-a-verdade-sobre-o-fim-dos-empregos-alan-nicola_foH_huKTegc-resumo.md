---
titulo: "Inteligência Artificial: A Verdade Sobre O Fim Dos Empregos | Alan Nicolas - Segredos da Escala #070"
convidado: "Alan Nicolas"
data: 2024-11-26
tags: [resumo, vturb, ia, copy, automacao, atendimento, escala]
fonte: "[[2024-11-26_inteligencia-artificial-a-verdade-sobre-o-fim-dos-empregos-alan-nicola_foH_huKTegc]]"
---
# Resumo: Inteligência Artificial: A Verdade Sobre O Fim Dos Empregos | Alan Nicolas - Segredos da Escala #070

## Tese central
Alan Nicolas (Academia Lendária) defende que a IA generativa já substitui grande parte do trabalho de texto, atendimento e SDR, e que a maioria dos empregos tende a desaparecer, o que exigirá renda básica universal e educação. O que gera resultado hoje é dominar fundamentos (engenharia de prompt, contexto, ETL e RAG) e saber comunicar com a IA; ela potencializa quem já é bom, não cria competência do zero. Ele também detalha como montar uma "esteira" de criativos com IA e discute geopolítica, AGI e riscos.

## Pontos-chave
- Maioria dos empresários que o procura nem sabe o que é possível; vem por medo de ficar para trás. Ele focou nas áreas universais: vendas, marketing e RH (80 a 95% dos processos seletivos da empresa são feitos por IA).
- Texto é a área mais barata para IA; vídeo ainda é caro. Há áreas em que o "token humano" ainda é mais barato que o da IA.
- A empresa dele fatura múltiplos sete dígitos por mês sem copywriter; "os copywriters são IAs", com revisão de alguém que entenda de copy; roteiro bom sai cerca de 80% com IA.
- "Frutas mais baixas": atendimento (chatbot no site, assistente no WhatsApp) e SDR; ETL e RAG reduzem alucinações a quase zero se os dados forem tratados e recuperados corretamente.
- Chatbot segue script; agente se adapta ao estágio da venda (ex.: aplicar SPIN selling). Riscos: alucinação e prompt injection (caso do chatbot da Chevrolet que "vendeu" um carro por US$1); manter o humano no ciclo (human in the loop).
- Cada modelo serve a algo: Claude (da Anthropic) é melhor para copy e texto menos robótico; GPT é mais flexível; Wolfram para cálculo; Gemini com janela enorme de tokens.
- O ChatGPT limita contexto e vetoriza arquivos em pedaços (chunks), então não "lê" um PDF grande inteiro; quem precisa de documento longo deve usar modelos de contexto grande.
- Sonnet 3.5 tende a ser o melhor custo-benefício para escrever copy; Opus serve para raciocínios muito complexos (analogia da bazuca).
- Saída (output) custa mais que entrada (input) na API: alimentar muito texto é barato, gerar muito é caro.
- Fundamentos valem mais que ferramenta: a maioria das ferramentas de IA é um "wrapper" de prompt sobre API; quem sabe pedir não precisa assinar quase nenhuma.
- IA só potencializa: "se és péssimo copywriter, a IA não te faz produzir melhor".
- Visão sobre trabalho: estudos citados apontam 25 a 40% dos empregos substituíveis; ele não contrata mais programador júnior; sugere renda básica universal, educação gratuita e, para o indivíduo, inteligência emocional e pensamento claro.
- Sobre AGI, ele acha que LLMs sozinhas não chegam lá, mas robôs com várias IAs e mais dados aproximam; cita riscos como efeitos colaterais (o exemplo dos clipes de papel).
- Gestão: scorecard semanal com semáforo, reuniões concentradas, só contratar seniores, defesa de que "inteligência não é visão estratégica".

## Frameworks e passo a passo
1. Onde aplicar IA primeiro: atendimento (chatbot/assistente), SDR, RH, textos de marketing; evitar vídeo por custo.
2. Atendimento com IA em lançamento: baixar as conversas do grupo de WhatsApp com perguntas e respostas, usar modelo de contexto grande para extrair pares de pergunta e resposta, treinar o agente com eles (ele substituiu 12 atendentes de um lançamento em cerca de duas horas de preparo).
3. Melhoria contínua do bot: marcar respostas com polegar para cima/baixo ou editar a resposta, salvando na base de dados.
4. Fine-tuning de headlines: coletar as top 100 (ou mais) headlines em planilha, colocar um prompt na coluna, a headline original e o resultado desejado, rodar fine-tuning na plataforma da OpenAI com algumas épocas (ele cita de 5 a 8) para criar uma versão do modelo treinada.
5. Esteira gratuita de criativos: usar Dify (ou Flowise) para montar fluxo visual: entrada com URL do site, web scraping apenas do corpo de texto, pesquisa de ângulos, mecanismos e features, consulta a papers, geração de criativos por estilo de copywriter com exemplos; ele recomenda gerar por partes (headline etc.) e não a copy inteira de uma vez.
6. Versão simples: criar um GPT personalizado (precisa do plano pago), descrever contexto, anexar arquivos curtos e escrever no prompt o contexto do pedido para a busca vetorial achar o material certo.
7. Pesquisa em camadas: Perplexity para pesquisa, Grok para tempo real, Claude/Gemini para documentos longos.
8. Escolha de modelo e custo: input barato e output caro; Opus para extrair ideias de papers e Sonnet para escrever a copy.
9. Experimento de RAG recursivo: pedir três associações a uma palavra e repetir sobre cada resposta para gerar contexto e criatividade.
10. Gestão por scorecard: metas semanais em planilha com verde, amarelo e vermelho; quem está no vermelho chega com plano na reunião seguinte.
11. Para empresas: ter no mínimo uma pessoa de automação, um engenheiro de prompt e alguém de dados.
12. Por onde começar nos estudos: fundamentos, cursos, papers e aprender fazendo.

## Números e exemplos citados
- Alan: mais de R$150 milhões de faturamento acumulado com suas empresas (descrito na abertura); empresa avaliada em centenas de milhões de reais e faturando múltiplos sete dígitos por mês, segundo ele.
- Empresa de clínicas de botox: com SDR de IA, de R$1,3 milhão para R$2,4 milhões por mês, com cerca de R$100 mil em tráfego e 30 a 40 dias de implantação (valores como falados).
- Lançamento: 12 atendentes substituídos por uma IA.
- Clone de um criador de conteúdo: cerca de 1,62 milhão de mensagens e cerca de 8.000 leads, mais de R$1 milhão em vendas, custo estimado de cerca de 1 centavo por mensagem (valores aproximados, ditos de memória).
- Preços de API citados: Haiku US$0,25 por milhão de tokens; Opus US$8 por milhão (saída citada de cerca de 80 em outro momento, a legenda é confusa); Claude com 200 mil tokens; ChatGPT com 32 mil no chat e 128 mil via API; Gemini 1.5 com 2 milhões de tokens.
- Projeto 25 (republicano): 992 páginas, com 20 citações de inteligência artificial.
- Palestras: valores de R$28 mil e R$48 mil citados.
- Equipe: cerca de 45 pessoas hoje (ele estima que seriam umas 200 sem IA); crescendo para cerca de 60 com uma fusão.
- Robô-cão com IA por cerca de US$800 (versão com comando) e humanoide de cerca de US$12.000 (valores incertos).
- Estimativas de substituição de empregos: 25 a 40%; site que mostra por profissão probabilidades de 96% a 99% em 5 anos (analista de dados, telemarketing).
- Hugging Face: cerca de 800 mil modelos.
- Academia Lendária: mais de 40 cursos.

## Ações práticas
- Criar um agente de atendimento com perguntas e respostas reais já respondidas (exportar WhatsApp, extrair pares com Claude/Gemini).
- Manter um humano revisando conversas com polegar para cima/baixo; proteger contra prompt injection e definir limites do bot.
- Montar uma planilha de headlines campeãs e fazer fine-tuning ou, no mínimo, um GPT personalizado com as melhores referências.
- Testar Dify ou Flowise (gratuitos) para montar uma esteira de pesquisa e criativos; usar web scraping só do corpo de texto.
- Usar Claude para escrever copy e Perplexity para pesquisa; Gemini quando precisar de contexto gigante.
- Aprender fundamentos: engenharia de prompt, API, ETL e RAG antes de comprar ferramentas.
- Dar contexto completo ao pedir algo à IA (escrever com clareza também melhora sua comunicação).
- Rodar scorecard semanal com semáforo em vez de reuniões longas.
- Se for contratar, priorizar perfis seniores com visão de negócio e usar IA para operação.
- Desenvolver inteligência emocional, pensamento claro, leitura e vocabulário para se manter relevante.

## Frases marcantes
- "Se tu és um bom copywriter a IA pode fazer com que produzas cinco, dez vezes mais; se és um péssimo copywriter, ela não te vai fazer produzir mais coisa melhor."
- "Se tu sabes fazer prompts tu tens meio que liberdade total."
- "O fundamento é muito mais importante que a ferramenta."
- "Daqui a pouco a IA já não vai precisar de engenharia de prompt."
