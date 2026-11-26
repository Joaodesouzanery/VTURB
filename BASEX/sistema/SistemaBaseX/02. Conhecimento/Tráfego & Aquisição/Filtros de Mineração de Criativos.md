---
tipo: conhecimento
area: trafego-pago
tags: [mineracao, spy, facebook-ads-library, criativos, dropshipping, ecommerce, filtros]
atualizado: 2026-06-13
status: ativo
---

# Filtros de Mineração de Criativos — Como Achar Player Médio (e Não Rolex)

> Conhecimento de referência para a skill `minerar-criativos-fb` e para qualquer agente que faça spy de criativos.
> Filosofia: o player médio que escalou organicamente ensina mais que qualquer marca enterprise. Ele resolveu o problema de pouco budget, sem brand awareness, com criativo afiado. É o que você quer modelar.

---

## 1. Eixos de filtragem

Todo bom filtro de mineração combina 4 eixos:

| Eixo | O que mede | Por que importa |
|---|---|---|
| **Tamanho do anunciante** | Quantos ads ativos a página tem | Separa player médio de gigante |
| **Sobrevivência do criativo** | Quantos dias rodando | Anúncio que dura = ROI positivo |
| **Sinal de scaling** | Variações ativas do mesmo conceito | Player sério itera, amador não |
| **Qualidade da operação** | Tem site? Verificado? Placements múltiplos? | Filtra dropship lixo |

---

## 2. Tamanho do anunciante (anúncios ativos)

O número de ads ativos simultâneos é o melhor proxy de tamanho.

| Categoria | Ads ativos | Exemplo | Vale espionar? |
|---|---|---|---|
| **Solo / testando** | 1-4 | Loja que acabou de subir 1ª campanha | Não. Não tem dado. |
| **Pequeno escalando** | 5-20 | Player com BM nova, começando a escalar | **SIM**. Ouro. |
| **Médio operando** | 20-150 | Operação madura, agência cuidando | **SIM**. Ouro absoluto. |
| **Grande / brand** | 150-500 | Marca consolidada, multi-país | Talvez. Pode ser referência de copy. |
| **Enterprise** | 500+ | Nike, Rolex, Sephora, Coca-Cola | Não. Briefing gigante, criativo institucional, budget infinito. |

**Default da skill:** `5-150 ads ativos` (categorias pequeno + médio).

**Ajuste por nicho:**
- Nicho amplo (moda, beleza, casa): manter default
- Nicho nichado (mineralogia, pets exóticos): expandir pra `2-200`
- Nicho saturado (suplemento, emagrecimento): apertar pra `5-80`

---

## 3. Sobrevivência do criativo (tempo de atividade)

Anúncio que continua rodando = está dando retorno. Anúncio que sumiu = não escalou.

| Dias ativo | Interpretação | Vale modelar? |
|---|---|---|
| < 7 dias | Acabou de subir, sem dado | Talvez. Pode ser teste promissor (lane TENDÊNCIAS). |
| 7-21 dias | Validou hook inicial | Sim, com cautela. |
| 21-60 dias | Passou na fadiga inicial, achou audiência | **Sim. Sweet spot.** |
| 60-180 dias | Vencedor confirmado, já escalou | **Sim. Modelo de copy ouro.** |
| 180+ dias | Veterano. Pode estar otimizado demais pra audiência velha | Sim, mas atenção: pode não funcionar pra audiência fria moderna. |

**Default da skill:** ≥ 30 dias (corta lixo, mantém validados).

**Detecção de variações:** se o anúncio reiniciou contagem (data de criação recente mas pagina tem histórico no mesmo conceito), considerar o conceito visual como "veterano" mesmo que o ad ID seja novo.

---

## 4. Sinal de scaling (variações ativas)

Player sério não roda um criativo, roda 5-15 variações da mesma ideia central (testando hook, edição, hold time, thumbnail, copy).

| Variações ativas do mesmo conceito | Interpretação |
|---|---|
| 1 | Teste solo. Ignorar. |
| 2 | Iterando. Não validou ainda. |
| 3-5 | **Scaling ativo. Sinal forte.** |
| 6-15 | **Vencedor já provado, indo full throttle.** |
| 15+ | Pode ser bot/dropshipper de catálogo. Avaliar. |

**Default da skill:** ≥ 3 variações.

**Como detectar variações:** mesmo dominio + mesmo angle central no copy (hash de N-grams das primeiras 50 palavras) + thumbnails similares (perceptual hash).

---

## 5. Qualidade da operação (sinais negativos a evitar)

Filtros de rejeição automática:

| Sinal | Por que rejeitar |
|---|---|
| **Página sem domínio próprio no link** | Loja Instagram-only ou WhatsApp-only. Não dá pra estudar funil completo. |
| **Página verificada azul (blue badge)** | Brand enterprise. Não é o player ideal pra modelar. |
| **Link vai pra plataforma genérica (linktree, beacons)** | Operação amadora ou afiliado. |
| **Idioma do ad != idioma do país** | Importação direta sem localização. Não serve pra estudo de mercado local. |
| **Página criada há menos de 3 meses** | Pode ser conta queimada / golpe / dropship lixo. |
| **Sem CNPJ/legal disclosure quando obrigatório** | Operação cinza. Vai cair, não vale estudar. |

---

## 6. Sinais positivos (bônus no score)

| Sinal | Bônus | Por quê |
|---|---|---|
| **Vídeo de produto** | +15 | Vídeo escala melhor que imagem em ecom. |
| **Placements múltiplos (FB+IG+Stories+Reels)** | +15 | Confiança alta no criativo, não está restringindo. |
| **Domínio próprio com SSL** | +15 | Operação séria. |
| **Múltiplos países simultâneos (3+)** | +20 | Oferta validada cross-mercado. |
| **Página entre 5-150 ads** | +10 | Sweet spot de tamanho. |
| **Tempo ativo > 60 dias** | +10 | Vencedor confirmado. |
| **CTA específico no copy (não genérico)** | +5 | Copywriter sério por trás. |

---

## 7. Listas negras por nicho (gigantes a excluir)

Lista global de marcas enterprise pra excluir automaticamente. Cada nicho tem seu próprio arquivo em `_engine/minerar-criativos-fb/blacklists/{nicho}.json`.

### Relógios
- Rolex, Omega, Audemars Piguet, Patek Philippe, Hublot, TAG Heuer, Cartier, Breitling, IWC, Tudor, Longines, Tissot, Fossil, Casio, Citizen, Seiko (corporate), Daniel Wellington (gigante), MVMT

### Cosmético / skincare
- L'Oréal, Maybelline, Estée Lauder, MAC, NYX, Sephora, Boticário (BR), Natura (BR), Eudora (BR), Avon, Mary Kay, Nivea, Garnier, Olay, Neutrogena, Cetaphil, La Roche-Posay, Vichy

### Suplemento / saúde
- Optimum Nutrition, GNC, Vitamin Shoppe, Centrum, Bayer, Pfizer, Herbalife, Amway, Probiotica (BR), Growth Supplements (BR), Max Titanium (BR), Integralmédica (BR)

### Moda / vestuário
- Nike, Adidas, Puma, Under Armour, Zara, H&M, SHEIN (gigante), Uniqlo, Gap, Levi's, Calvin Klein, Tommy Hilfiger, Lacoste, Renner (BR), C&A (BR), Riachuelo (BR), Hering (BR)

### Pet
- PetSmart, Chewy, Petco, Petz (BR), Cobasi (BR), Royal Canin, Pedigree, Whiskas, Purina, Hill's Science Diet, Premier Pet

### Casa / decoração
- IKEA, Wayfair, West Elm, Pottery Barn, Tok&Stok (BR), Etna (BR), Mobly (BR), Madeira Madeira (BR), Westwing

### Eletrônicos
- Apple, Samsung, Sony, LG, Xiaomi (corporate), Dell, HP, Lenovo, ASUS, Microsoft, Google, Amazon (devices), JBL, Bose

### Pet / brinquedo infantil
- LEGO, Mattel, Hasbro, Fisher-Price, Disney, Pampers, Huggies

**Como manter a lista:** quando uma marca nova entrar com 500+ ads, a skill pergunta ao usuário se adiciona. Decisão fica registrada e dura pra sempre.

---

## 8. Score final (fórmula da skill)

```
base_score =
  (min(dias_ativo, 90) / 90) * 25          // antiguidade — cap aos 90 dias
  + (min(variacoes_ativas, 10) / 10) * 20  // scaling — cap em 10 variações
  + (placements.length / 5) * 15           // placements
  + (formato === 'video' ? 15 : 5)         // formato
  + (tem_dominio_proprio ? 15 : 0)         // qualidade operação
  + (ads_pagina >= 5 && ads_pagina <= 150 ? 10 : 0)  // sweet spot
  + (paises_simultaneos >= 3 ? 20 : 0)     // bônus multi-mercado

penalidades:
  - ads_pagina > 500           → -50  (gigante)
  - pagina_verified_azul       → -50  (enterprise)
  - dias_ativo < 7             → -30  (sem dado)
  - sem_dominio_proprio        → -20  (operação fraca)
  - idioma != pais             → -15  (importação direta)
  - na_blacklist               → -100 (excluir do top)
```

**Lanes do Miro:**
- VENCEDORES: score ≥ 75
- PROMISSORES: 50 ≤ score < 75
- TENDÊNCIAS: score ≥ 30 E dias_ativo entre 7 e 21 (criativos novos com sinal)

---

## 9. Anti-patterns na mineração

| Erro comum | Por que é ruim | Como evitar |
|---|---|---|
| Filtrar só por "muitos ads ativos" | Pega Rolex e ignora player médio | Combinar com cap superior (≤ 150) |
| Aceitar qualquer ad com 1+ dia | 90% do scrape é lixo de teste único | Exigir ≥ 30 dias OU ≥ 3 variações |
| Não excluir blue badge | Importa criativo institucional pra dropshipper | Sempre filtrar verified |
| Aceitar idioma diferente do país | Importação direta polui o estudo | Validar `ad.language === pais.idioma_oficial` |
| Modelar 1 criativo isolado | Pode ser sorte | Sempre modelar conceito com 3+ variações |
| Ignorar variações de imagem/vídeo | Player sério rotaciona thumbnail toda semana | Considerar variação de hook visual como sinal forte |

---

## 10. Re-execução incremental

Quando rodar a mesma mineração 7 dias depois:

- 🆕 = novo criativo que apareceu (player começou nova campanha)
- ❌ = sumiu da biblioteca (player parou de escalar esse criativo)
- ⬆️ = score subiu ≥ 10 pontos (criativo escalando ainda mais)
- ⬇️ = score caiu ≥ 10 pontos (perdendo tração)

**Insight de velocidade:** se um player adiciona ≥ 5 variações novas por semana = está em ramp-up. Acompanhar de perto.

---

*Conhecimento criado em 2026-06-13. Baseado em prática de spy de criativos em ecommerce/dropshipping multi-mercado. Atualizar quando descobrir novos sinais de escalada ou novas gigantes pra blacklist.*
