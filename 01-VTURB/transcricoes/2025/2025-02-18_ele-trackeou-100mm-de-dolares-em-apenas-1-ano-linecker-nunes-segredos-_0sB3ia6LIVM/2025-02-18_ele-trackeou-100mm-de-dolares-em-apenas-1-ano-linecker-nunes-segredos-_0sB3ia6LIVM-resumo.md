---
titulo: "Ele Trackeou +100MM De Dólares Em Apenas 1 Ano | Linecker Nunes - Segredos da Escala #082"
convidado: "Linecker Nunes"
data: 2025-02-18
tags: [resumo, vturb, trackeamento, trafego-pago, meta-ads, escala, infoproduto]
fonte: "[[2025-02-18_ele-trackeou-100mm-de-dolares-em-apenas-1-ano-linecker-nunes-segredos-_0sB3ia6LIVM]]"
---
# Resumo: Ele Trackeou +100MM De Dólares Em Apenas 1 Ano | Linecker Nunes - Segredos da Escala #082

## Tese central
Quem escala tráfego pago dependendo só do Pixel do Facebook opera parcialmente cego: as conversões chegam erradas e com atraso, e isso leva a pausar campanhas boas e manter ruins. A solução é subir por degraus (UTM, API de conversões, Tracker) até ter dados em tempo real, enviados de volta às plataformas e guardados em base própria. Linecker, que presta serviço de trackeamento para grandes operações de direct response, defende o Hashtrack como Tracker preferido e vende a configuração e leitura como serviço.

## Pontos-chave
- Só com o Pixel, segundo ele, cerca de 25% a 30% das comissões não chegam ao gestor; ele considera até esse número otimista e diz que o erro de 20% é alto demais para quem investe pesado.
- As únicas métricas confiáveis na plataforma de anúncios são as de topo (cliques, visualizações) e o custo; conversão e CPA dependem da conversão marcada e portanto falham.
- O trackeamento serve tanto para colocar dinheiro onde funciona quanto para tirar de onde não funciona (posicionamentos, versões de sistema operacional, dispositivos que gastam e não retornam).
- Exemplo clássico: otimizar à meia-noite pausa campanhas cujas conversões ainda não chegaram ao Facebook; por isso o dado em tempo real importa.
- Nível 1 é UTM junto com Google Analytics (gratuito, barreira de entrada baixa). Para ele o salto maior é sair do zero para a UTM, e depois da UTM para um Tracker.
- Problema da UTM: ela se perde (é só parâmetro de URL), não alimenta o Facebook/Google e deixa a plataforma sem saber das conversões.
- Google precisa de conversões acontecendo para entender o padrão (conversão nova "fica crua"), por isso validar no YouTube/Google é mais difícil e mais caro, embora depois escale muito; o Facebook já tem público comprador pelo Pixel e e-mail como parâmetro de atribuição.
- API de conversões devolve as conversões às plataformas (Facebook, Google, Taboola etc.) por requisição HTTP; usa fbclid/fbp/fbc. Defeito: delay (de duas a três horas, segundo ele), que pode ser decisivo para quem investe de R$ 100 a R$ 1.000+ por dia.
- Mundo ideal: UTM/tempo real mais API de conversões, e é isso que o Tracker junta.
- Mais dados devolvidos ao Facebook tornam a otimização mais precisa e tendem a baixar o CPA; 50 conversões seria o mínimo padrão para o Facebook identificar o comprador, com retornos decrescentes depois.
- O Tracker traz o click ID (chave que condensa IP, user agent, dispositivo, localização, campanha, fbclid), permitindo ver o funil inteiro: página, pré-lander, lander, checkout, conversão, até o provedor de internet; permite filtrar tráfego de bots e da biblioteca de anúncios.
- Compara Hashtrack com UTMify e Nemo: Hashtrack seria mais preciso, mais barato e melhor no meio do funil; contras: UX feia, configuração difícil, sem integração nativa com plataformas brasileiras, automação como adicional caro e falta de aplicativo.
- Segundo ele, o passo seguinte ao Tracker é guardar os dados em banco próprio (Postgres, BigQuery) para consultas e dashboards, tratando o Tracker como meio e não fim; sugere Supabase gratuito em vez de planilhas, com a ressalva de não cair em excesso de análise.
- O anfitrião menciona que o VTURB tem contingência tripla de servidores e entrega o vídeo direto, sem passar pelo backend, e que integra com Braip, Kiwify e CartPanda.

## Frameworks e passo a passo
- Escada do trackeamento: (1) Pixel puro; (2) UTM + Google Analytics; (3) API de conversões (incluindo servidor GTM via Stape com data layer); (4) Tracker que unifica tudo.
- Como usar UTM: colocar o Pixel do Google Analytics no site, montar links com parâmetros UTM mais parâmetros dinâmicos da plataforma (nome de campanha etc.), manter os parâmetros na URL até o checkout, ler o relatório na plataforma de pagamento e voltar à fonte de tráfego para escalar o melhor. O botão do player do VTURB já repassa os parâmetros; sem ele é preciso um código na página seguinte.
- Automação opcional com Make ou n8n, planilha/banco e dashboard no Looker Studio.
- Ordem de configuração do Hashtrack (de baixo para cima): domínio, lander, offer source, offer, traffic channel e campanha; para Google, usar o link da própria lander (link de redirect do Tracker não pode ser usado) com o modelo de acompanhamento.
- Cuidados: não migrar as páginas rodando para dentro do Tracker ao criar a conta (sem click ID a pessoa não passa para a próxima página); trocar o link do checkout pelo do Tracker; split/teste A/B feito dentro dele (por exemplo 80/20 ou 50/50).
- Pós-Tracker: guardar dados (cliques, dispositivo, hora, tempo até converter) em banco ou CRM, para não perder o histórico quando uma conta cai.

## Números e exemplos citados
- Sua carteira: operação que investe R$ 1 milhão por dia; o maior investimento diário que ele viu foi R$ 1,4 milhão; clientes com R$ 100.000 por dia são tratados como "os mais fraquinhos".
- Título do vídeo: mais de 100 milhões de dólares trackeados em um ano.
- Pixel: perda de 25% a 30% das comissões; a UTM e o Tracker passam a valer a partir de cerca de R$ 2.000 por dia de investimento (R$ 60.000/mês), com recomendação mais firme entre R$ 2.000 e R$ 5.000 por dia.
- Hashtrack: cerca de US$ 50 no plano básico (aproximadamente R$ 900, segundo ele); plano da Nemo mais caro (R$ 1.200 citado) entregaria menos; automação como adicional caro; cupom de 25% por 3 meses e teste gratuito de 14 dias.
- Hashtrack já saiu do ar duas vezes em três anos, por duas a três horas cada.
- Cliente de PPC (pay per call) nos EUA que roda US$ 1 milhão por mês; comissão quando a ligação passa de 45 segundos.
- Stape: servidor de cerca de US$ 30 a 50, variando com os eventos.
- Tempo de configuração do Hashtrack: duas a três horas para ele; outra pessoa levaria alguns meses.
- VTURB: cerca de 15% da base de clientes e cerca de 30% do faturamento são internacionais; há cliente com plano de 10 milhões de plays por mês e relatos de clientes de plano enterprise do Hashtrack pagando US$ 10.000 (pelo que ouviu).
- Exemplo do ROI de ferramenta: pagar R$ 500 a mais para ganhar R$ 5.000 de faturamento.

## Ações práticas
- Se você só usa Pixel, passe a usar UTM com Google Analytics como primeiro passo gratuito.
- Preencha os parâmetros UTM com os dinâmicos da plataforma para não digitar nada manualmente.
- Ative a API de conversões para devolver vendas ao Facebook/Google, sabendo do delay.
- Ao investir a partir de R$ 2.000 a R$ 5.000 por dia, avalie um Tracker (Hashtrack ou outro decente).
- Ao configurar um Tracker, crie a conta com páginas novas de teste e só depois troque o link do checkout.
- Defina antes quais métricas quer analisar e entenda a lógica do funil; dado errado é pior que não ter dado.
- Guarde os dados de cliques e conversões em banco próprio (Supabase, BigQuery) ou CRM.
- Não compare números entre ferramentas diferentes como se fossem idênticos; elas medem de formas diferentes.
- Para Google Ads, use o link da lander e o modelo de acompanhamento em vez do link de redirect.

## Frases marcantes
- "Um bom traqueamento não salva uma cópia ruim nem um mau tráfego; ele só vai mostrar que está ruim."
- "Pior do que não ter as métricas é otimizar com base em dados errados."
- "Trackeamento é sobre o quanto vais poupar também."
