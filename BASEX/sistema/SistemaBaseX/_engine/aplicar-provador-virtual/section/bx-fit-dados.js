/* ============================================================
   BX Provador Virtual — tabelas de referencia
   ------------------------------------------------------------
   So numero. Nenhuma logica. Trocar um valor aqui muda o
   comportamento do provador sem tocar no calculo.

   REGRA DE HONESTIDADE: cada bloco declara a origem.
   [NORMA]     publicado e verificavel (EN 13402, ISO 9407, paper)
   [INDUSTRIA] pratica consolidada de modelagem, multiplas fontes
   [NOSSO]     calibragem nossa, sem lastro externo

   O que e [NOSSO] nunca deve ser citado como se fosse norma.
   ============================================================ */
(function (global) {
  'use strict';

  var D = {};

  /* ============================================================
     1. FOLGA (ease) por regiao e por caimento, em centimetros
     ------------------------------------------------------------
     [INDUSTRIA] Identidade: folga = circunferencia da peca menos
     circunferencia do corpo. A folga total e a soma da folga de
     uso (minimo fisiologico) com a folga de estilo.

     A pontuacao roda DIRETO em centimetro contra estas faixas,
     que sao absolutas e publicadas. Nao existe normalizacao por
     um "span" arbitrario: esse span seria parametro livre nosso
     disfarcado de achado, e o resultado inteiro penderia dele.

     Formato: [min, max, tolAperto, tolSobra]
     ============================================================ */

  D.folga = {
    /* [INDUSTRIA] busto de blusa, vestido, camisa e top:
       justo 0-7,5 | ajustado 7,5-10 | semi 10-12,5 | solto 12,5-20 | oversized >20
       quadril de saia e calca:
       justo <=6,4 | ajustado 7,6-10 | semi 10-12,7 | solto 12,7-20 | oversized >20
       cintura: ajustado 2,5-5 | solto 7,6-15 */
    generico: {
      justo:    { busto: [2, 7.5, 3, 5],    cintura: [0, 2.5, 2.5, 5],  quadril: [2, 6.4, 3, 5],    ombro: [0, 1.5, 1.5, 2.5], coxa: [1, 4, 2, 4] },
      ajustado: { busto: [7.5, 10, 3.8, 6], cintura: [2.5, 5, 2.5, 6],  quadril: [7.6, 10, 3.8, 6], ombro: [0, 2, 1.5, 3],     coxa: [2, 5, 2, 5] },
      regular:  { busto: [10, 12.5, 3.8, 8], cintura: [5, 7.6, 3.8, 8], quadril: [10, 12.7, 3.8, 8], ombro: [0.5, 3, 2, 4],    coxa: [3, 7, 3, 6] },
      solto:    { busto: [12.5, 20, 5, 12], cintura: [7.6, 15, 5, 14],  quadril: [12.7, 20, 5, 14], ombro: [1, 5, 2, 6],       coxa: [5, 12, 4, 10] },
      oversized:{ busto: [20, 32, 6, 16],   cintura: [15, 28, 6, 18],   quadril: [20, 32, 6, 18],   ombro: [3, 9, 3, 8],       coxa: [10, 20, 5, 14] },
    },

    /* [INDUSTRIA] camisa masculina medida no torax:
       extra-slim 9 | slim 12 | regular 16 | solta 20 */
    camisaMasculina: {
      justo:    { peito: [7, 10, 3, 4],   cintura: [4, 9, 4, 8] },
      ajustado: { peito: [10, 13, 3, 5],  cintura: [8, 14, 4, 9] },
      regular:  { peito: [14, 18, 4, 6],  cintura: [12, 20, 5, 10] },
      solto:    { peito: [18, 24, 5, 8],  cintura: [18, 28, 6, 12] },
    },

    /* [INDUSTRIA] jaqueta e casaco pedem mais folga que blusa,
       porque vestem por cima de outra peca.
       jaqueta ajustado 9,5-10,8 | semi 11,1-13,7 | solto 14,9-25,4
       casaco  ajustado 9,5-11   | semi 11-15    | solto 15-25,4 */
    jaqueta: {
      ajustado: { busto: [9.5, 10.8, 3, 5],  peito: [9.5, 10.8, 3, 5] },
      regular:  { busto: [11.1, 13.7, 3, 6], peito: [11.1, 13.7, 3, 6] },
      solto:    { busto: [14.9, 25.4, 4, 12], peito: [14.9, 25.4, 4, 12] },
    },
    casaco: {
      ajustado: { busto: [9.5, 11, 3, 5],   peito: [9.5, 11, 3, 5] },
      regular:  { busto: [11, 15, 3, 7],    peito: [11, 15, 3, 7] },
      solto:    { busto: [15, 25.4, 4, 12], peito: [15, 25.4, 4, 12] },
    },

    /* [INDUSTRIA] calca e saia de tecido plano. A ancora e o QUADRIL,
       nao a cintura: quadril apertado nao sobe, cintura sobra se ajusta.
       justo <=6,4 | ajustado 7,6-10 | semi 10-12,7 | solto 12,7-20
       Entrepernas e comprimento, entao a faixa e estreita dos dois lados:
       calca curta demais aparece tanto quanto calca arrastando. */
    calca: {
      justo:    { cintura: [0, 2.5, 2.5, 5],  quadril: [2, 6.4, 3, 5],    coxa: [2, 5, 2, 4],  entrepernas: [-1, 1, 3, 3] },
      ajustado: { cintura: [1, 3.8, 2.5, 6],  quadril: [6.4, 9, 3, 6],    coxa: [4, 7, 2, 5],  entrepernas: [-1, 2, 3, 4] },
      regular:  { cintura: [2, 5, 3, 7],      quadril: [8, 11, 3.8, 8],   coxa: [6, 10, 3, 6], entrepernas: [-1, 3, 3, 5] },
      solto:    { cintura: [4, 8, 3.8, 10],   quadril: [11, 18, 4, 12],   coxa: [9, 16, 4, 10], entrepernas: [-1, 4, 3, 6] },
    },

    /* [INDUSTRIA] malha de compressao trabalha com folga NEGATIVA.
       Alvos: 10% segunda pele | 15% inicio de compressao | 20% legging.
       Convertidos para cm sobre circunferencias tipicas. Teto pratico
       de uso diario: 2,5 a 7,6 cm de negativa total. */
    legging: {
      justo:    { cintura: [-9, -5, 4, 4],  quadril: [-11, -6, 5, 4], coxa: [-7, -3, 3, 3] },
      ajustado: { cintura: [-6, -2.5, 4, 5], quadril: [-8, -3, 5, 5], coxa: [-5, -2, 3, 4] },
      regular:  { cintura: [-3, 0, 4, 6],   quadril: [-4, 0, 5, 6],   coxa: [-3, 0, 3, 5] },
      solto:    { cintura: [0, 4, 4, 8],    quadril: [0, 5, 5, 8],    coxa: [0, 4, 3, 7] },
    },

    /* [INDUSTRIA] sutia pelo metodo moderno, de banda FIRME.
       A banda sustenta cerca de 80% do peso, entao ela e menor que o
       torax e estica no corpo: folga negativa de 2 a 6 cm. A taca vem
       da diferenca busto menos subtoracico, e por isso a folga de busto
       fica perto de zero. Usar as faixas de blusa aqui (7,5 a 10 cm de
       folga no busto) recomendaria sempre uma taca grande demais e uma
       banda frouxa, que e exatamente o erro mais comum de sutia.

       ATENCAO: isto e casamento por folga, nao a conta de banda e taca.
       Para tabela que so publica letra (75B, 80C) sem centimetro, o
       caminho certo e a conta em D.sutia, que ainda nao esta ligada ao
       recomendador. Enquanto nao estiver, sutia exige tabela com banda
       e busto em centimetro. */
    sutia: {
      justo:    { banda: [-6, -3, 3, 3], busto: [-2, 1, 3, 3] },
      ajustado: { banda: [-5, -2, 3, 3], busto: [-1, 2, 3, 3] },
      regular:  { banda: [-4, -1, 3, 4], busto: [0, 3, 3, 4] },
      solto:    { banda: [-2, 1, 3, 5],  busto: [1, 5, 3, 5] },
    },

    /* [NORMA] calcado: folga de comprimento.
       ISO 9407 (Mondopoint) exige no minimo 5 mm.
       Birkenstock orienta pe + 10 mm para achar a palmilha. */
    calcado: {
      justo:    { pe: [0.5, 0.9, 0.3, 0.5] },
      ajustado: { pe: [0.7, 1.1, 0.3, 0.6] },
      regular:  { pe: [0.8, 1.3, 0.3, 0.8] },
      solto:    { pe: [1.2, 1.8, 0.4, 1.0] },
    },

    relogio: { regular: { punho: [1.0, 2.5, 1.0, 2.0] } },
  };

  /* [NORMA + INDUSTRIA] folga de USO minima: abaixo disso a peca
     nao veste em tecido plano, qualquer que seja o estilo. */
  D.folgaMinima = {
    busto: 6.4, peito: 6.4, cintura: 2.5, quadril: 5.1,
    punho: 2.5, braco: 2.0, coxa: 2.0,
  };

  D.caimentoPadrao = {
    generico: 'regular', legging: 'ajustado', calcado: 'regular', calca: 'regular',
    sutia: 'ajustado', relogio: 'regular', jaqueta: 'regular',
    casaco: 'regular', camisaMasculina: 'regular',
  };

  /* ============================================================
     2. TECIDO — classes de estiramento
     ------------------------------------------------------------
     [INDUSTRIA] Medicao: marque 10 cm no sentido transversal e
     estique ao maximo confortavel.
       estiramento% = (esticado - 10) / 10 * 100

     Classes: 0-10 nao-stretch | 10-25 baixo | 25-50 moderado |
     50-75 alto | 75-100 muito alto | >100 super stretch.

     REGRA DE SEGURANCA: a folga negativa aplicada nunca pode
     passar do estiramento do proprio tecido, e o corpo nao deve
     consumir mais que ~50% do estiramento disponivel, senao a
     peca nao recupera a forma.

     NAO EXISTE DEFAULT. Sem o lojista declarar a classe, o
     provador cai para casamento de faixa e nao aplica piso de
     folga minima. Assumir "plano" em silencio reprovaria todo
     tamanho de qualquer camiseta de viscolycra, e malha e a
     maior parte de um catalogo de dropshipping.
     ============================================================ */

  D.tecido = {
    plano:      { estiramento: 5,   negativaMax: 0,    label: 'sem elasticidade' },
    poucoElast: { estiramento: 18,  negativaMax: 2.0,  label: 'pouco elastico' },
    malha:      { estiramento: 38,  negativaMax: 5.0,  label: 'malha' },
    elastica:   { estiramento: 62,  negativaMax: 8.0,  label: 'bem elastica' },
    compressao: { estiramento: 110, negativaMax: 14.0, label: 'compressao' },
  };

  /* Perfis cuja faixa de folga JA nasce negativa porque a peca e feita
     pra ficar menor que o corpo. Neles o ajuste por elasticidade nao se
     aplica: somar o estiramento do tecido por cima da negativa embutida
     conta a mesma folga duas vezes e o provador passa a aceitar um
     tamanho abaixo do que devia. Foi assim que um sutia 70B apareceu
     com a banda "larga" num torax de 74 cm, quando a banda de 70 nesse
     torax e justamente o alvo. */
  D.negativaEmbutida = { legging: true, sutia: true };

  /* deslocamento em cm aplicado a faixa de folga, por classe */
  D.elasticidade = {
    plano: 0, poucoElast: 2, malha: 5, elastica: 8, compressao: 14,
    /* apelidos antigos, mantidos para nao quebrar configuracao existente */
    nenhuma: 0, pouca: 2, media: 5, alta: 8,
  };

  /* ============================================================
     3. GRADE — quanto vale subir um tamanho
     ------------------------------------------------------------
     [NORMA] EN 13402: passo de 4 cm em busto, cintura e quadril.
     [INDUSTRIA] tech pack: mulher +3,8 cm por tamanho ate XL e
     +5 cm acima de XL; homem +5 cm e +6,3 acima de XL.

     Serve para o desempate: se o deficit for menor que METADE do
     passo da grade, subir de tamanho piora em vez de resolver.

     NAO embutimos a tabela MCO brasileira: ela e metodo comercial
     de modelagem, nao dado publico, e as normas ABNT NBR 16933 e
     16060 sao pagas e nao foram obtidas. Usar EN 13402, que esta
     verificada, evita distribuir material de terceiro sem licenca.
     ============================================================ */

  D.passoGrade = {
    en13402: 4.0,
    mulherLetra: 3.8, mulherLetraPlus: 5.0,
    homemLetra: 5.0,  homemLetraPlus: 6.3,
    comprimento: 2.5, ombro: 1.9, manga: 1.9, cava: 1.3, gola: 0.6,
    calcaCintura: 3.8, calcaQuadril: 3.8, calcaCoxa: 2.5,
  };

  /* [NORMA] EN 13402-3: circunferencia em faixa de 4 cm, tolerancia
     +/- 2 cm. Estatura em faixa de 8 cm, tolerancia +/- 4 cm. */
  D.tolerancia = { circunferencia: 2.0, estatura: 4.0, faixaCircunferencia: 4.0 };

  /* ============================================================
     4. NUMERACAO a partir do busto  [INDUSTRIA]
        IT = busto/2 | FR = busto/2 - 4 | EU/DE = busto/2 - 6
        UK = EU - 28 | US = EU - 32 | BR ~= EU + 2
     ============================================================ */

  D.numeracao = {
    IT: function (busto) { return busto / 2; },
    FR: function (busto) { return busto / 2 - 4; },
    EU: function (busto) { return busto / 2 - 6; },
    UK: function (busto) { return busto / 2 - 6 - 28; },
    US: function (busto) { return busto / 2 - 6 - 32; },
    BR: function (busto) { return busto / 2 - 6 + 2; },
  };

  /* ============================================================
     5. ESTIMATIVA DE CORPO a partir de altura e peso
     ------------------------------------------------------------
     LEIA ISTO ANTES DE CONFIAR NO RESULTADO.

     [NORMA] So a CINTURA tem regressao publicada com coeficientes
     abertos: Bozeman 2012, sobre o NHANES III. Para BUSTO e
     QUADRIL nao existe equacao publica a partir de altura e peso.

     E o numero que decide o desenho do produto: com o RMSE de
     5,41 cm das mulheres, a chance da estimativa cair na faixa
     certa de 4 cm da EN 13402 e de 28,8%. Nos homens, 37,9%.
     Ou seja, o MELHOR modelo publicado, com altura e peso
     MEDIDOS, erra o tamanho em cerca de duas de cada tres
     mulheres. Com peso auto-declarado piora: mulher com IMC
     entre 35 e 40 cai para ~23,5%.

     Consequencia de projeto, nao opiniao: estimar corpo a partir
     de altura e peso NAO sustenta sozinho uma recomendacao. A
     estimativa serve para PRE-PREENCHER um campo que a pessoa
     confirma ou corrige, exatamente como a Sizebay faz no passo
     "confira suas medidas". Toda medida estimada e marcada como
     estimada na tela.
     ============================================================ */

  D.imc = function (pesoKg, alturaCm) {
    var m = alturaCm / 100;
    return m > 0 ? pesoKg / (m * m) : null;
  };

  /* [NORMA] vies de auto-declaracao de peso, por faixa de IMC.
     Magro superestima, obeso subestima. Em kg/m2. */
  D.viesAutoRelato = function (imc) {
    if (imc == null) return 0;
    if (imc < 18.5) return 0.538;
    if (imc < 25) return 0;
    if (imc < 30) return -0.588;
    if (imc < 35) return -1.018;
    if (imc < 40) return -1.604;
    return -2.258;
  };

  D.estimativa = {
    f: {
      /* [NORMA] Bozeman 2012, mulheres (n=2.395), cintura em cm.
         Os termos de raca nao foram significativos e ficam de fora.
         O termo de idade so entra a partir dos 35 anos. */
      cintura: function (c) {
        var imc = D.imc(c.peso, c.altura);
        if (imc == null) return null;
        imc += D.viesAutoRelato(imc);
        var idade = c.idade == null ? 35 : c.idade;
        var v = 28.81919 + 2.218007 * imc;
        if (idade >= 35) v += -3.688953 + 0.125975 * idade;
        return v;
      },
      /* [NOSSO] Sem equacao publicada para busto e quadril, derivamos
         da cintura usando a razao mediana da populacao. E aproximacao
         grosseira e existe apenas para pre-preencher o campo. */
      quadril: function (c) {
        var w = D.estimativa.f.cintura(c);
        return w == null ? null : w * 1.28;
      },
      busto: function (c) {
        var w = D.estimativa.f.cintura(c);
        return w == null ? null : w * 1.21;
      },
      /* [INDUSTRIA] regra de bolso, variacao individual de 5 a 10% */
      entrepernas: function (c) {
        return c.altura ? c.altura * 0.4275 : null;
      },
    },
    m: {
      /* [NORMA] Bozeman 2012, homens (n=2.246) */
      cintura: function (c) {
        var imc = D.imc(c.peso, c.altura);
        if (imc == null) return null;
        imc += D.viesAutoRelato(imc);
        var idade = c.idade == null ? 40 : c.idade;
        return 22.61306 + 2.520738 * imc + 0.1583812 * idade;
      },
      /* [INDUSTRIA] drop masculino padrao (cintura menos torax) = -12 cm */
      peito: function (c) {
        var w = D.estimativa.m.cintura(c);
        return w == null ? null : w + 12;
      },
      quadril: function (c) {
        var w = D.estimativa.m.cintura(c);
        return w == null ? null : w * 1.05;
      },
      entrepernas: function (c) {
        return c.altura ? c.altura * 0.4275 : null;
      },
    },
  };

  /* [NORMA] erro esperado de cada estimativa, em cm. Alimenta a
     confianca: medida estimada nunca produz confianca alta. */
  D.erroEstimativa = { cintura: 5.41, quadril: 7.0, busto: 7.0, peito: 6.0, entrepernas: 4.0 };

  /* probabilidade de a estimativa cair na faixa certa de 4 cm */
  D.chanceFaixa = function (rmse) {
    var x = D.tolerancia.circunferencia / (rmse * Math.SQRT2);
    /* aproximacao de erf com erro < 1,5e-7 (Abramowitz e Stegun) */
    var t = 1 / (1 + 0.3275911 * Math.abs(x));
    var y =
      1 -
      ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
        0.254829592) *
        t *
        Math.exp(-x * x);
    return x >= 0 ? y : -y;
  };

  /* ============================================================
     6. FORMATO DO CORPO — FFIT (NC State / SizeUSA, ~6.000 mulheres)
     ------------------------------------------------------------
     [NORMA] Limiares originais em polegada, convertidos:
     1"=2,54 | 2"=5,08 | 3,6"=9,14 | 7"=17,78 | 9"=22,86 | 10"=25,40

     O formato NAO melhora a estimativa por altura e peso. Ele faz
     o oposto, e mais util: RESTRINGE as medidas possiveis. Por isso
     entra como validacao da estimativa, nao como entrada dela.
     ============================================================ */

  D.formatos = {
    ampulheta:        { rotulo: 'Ampulheta',           regra: 'busto e quadril proximos, cintura bem marcada' },
    pera:             { rotulo: 'Pera ou triangulo',   regra: 'quadril maior que o busto' },
    trianguloInverso: { rotulo: 'Triangulo invertido', regra: 'busto maior que o quadril' },
    retangulo:        { rotulo: 'Retangulo',           regra: 'busto, cintura e quadril proximos' },
    oval:             { rotulo: 'Oval',                regra: 'cintura maior que quadril e busto' },
  };

  /* [NORMA] FFIT modificado (Sokolowski 2020, corrige plus size).
     Entradas em cm. */
  /**
   * Simplificacao de 5 formas das 9 do FFIT.
   *
   * O FFIT completo separa ampulheta superior, inferior, colher e
   * diamante. Cinco opcoes ja e o teto do que se pergunta numa PDP sem
   * cansar, entao ampulheta superior e inferior colapsam em pera ou
   * triangulo invertido conforme o lado dominante.
   *
   * As regras sao avaliadas da mais especifica para a mais geral e
   * cobrem o espaco inteiro: nao existe corpo que caia fora. A versao
   * anterior deixava buraco (quadril bem maior que o busto E cintura
   * muito marcada nao casava com nada e caia em retangulo), o que
   * classificava uma pera classica como retangulo.
   */
  D.classificarFormato = function (busto, cintura, quadril) {
    if (busto == null || cintura == null || quadril == null) return null;
    var P = 9.14;    // 3,6 polegadas: diferenca que ja se enxerga
    var U = 2.54;    // 1 polegada: busto e quadril praticamente iguais
    var N = 22.86;   // 9 polegadas: cintura marcada no busto
    var M = 25.4;    // 10 polegadas: cintura marcada no quadril

    // 1. cintura e a maior medida
    if (cintura >= quadril && cintura >= busto) return 'oval';
    // 2. busto e quadril quase iguais E cintura bem marcada
    if (Math.abs(busto - quadril) <= U && (busto - cintura >= N || quadril - cintura >= M)) {
      return 'ampulheta';
    }
    // 3. quadril claramente maior
    if (quadril - busto >= P) return 'pera';
    // 4. busto claramente maior
    if (busto - quadril >= P) return 'trianguloInverso';
    // 5. o resto
    return 'retangulo';
  };

  /* restricoes que o formato impoe, para conferir a estimativa */
  D.restricaoFormato = {
    pera:             function (b, c, q) { return q >= b + 9.14; },
    trianguloInverso: function (b, c, q) { return b >= q + 9.14; },
    retangulo:        function (b, c, q) { return Math.abs(b - q) < 9.14; },
    ampulheta:        function (b, c, q) { return Math.abs(b - q) <= 2.54 && (b - c >= 22.86 || q - c >= 25.4); },
    oval:             function (b, c, q) { return c >= q && c >= b; },
  };

  /* ============================================================
     7. SUTIA  [INDUSTRIA]
     ------------------------------------------------------------
     Metodo moderno, de banda justa. O metodo legado de somar 4
     polegadas ao subtoracico fica de fora de proposito: produz
     banda frouxa e taca pequena, e e a causa mais comum de sutia
     mal recomendado.

     ATENCAO: a taca sai de busto menos SUBTORACICO, nunca de
     busto menos BANDA. A banda ja e o subtoracico arredondado,
     entao usar banda injeta ate 2,5 cm de erro justo na conta
     que deveria ser a mais precisa do formulario.
     ============================================================ */

  D.sutia = {
    tacaCm: [
      { ate: 11, letra: 'A' }, { ate: 13, letra: 'B' }, { ate: 15, letra: 'C' },
      { ate: 17, letra: 'D' }, { ate: 19, letra: 'E' }, { ate: 21, letra: 'F' },
      { ate: 23, letra: 'G' }, { ate: 25, letra: 'H' },
    ],
    passoTacaCm: 2,
    bandaEu: function (subtoracicoCm) {
      var b = Math.round(subtoracicoCm / 5) * 5;
      return Math.min(110, Math.max(60, b));
    },
    bandaEuParaUs: function (eu) { return (eu + 10) / 2.5; },
    bandaUsParaEu: function (us) { return 2.5 * us - 10; },
    letraPorSistema: {
      EU: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      UK: ['A', 'B', 'C', 'D', 'DD', 'E', 'F', 'FF'],
      US: ['A', 'B', 'C', 'D', 'DD', 'DDD', 'G', 'H'],
    },
    passoBandaEu: 5,
    /* banda -1 passo => taca +1 letra. Mesmo volume de taca. */
    toleranciaBandaCm: 2.5,
    /* [NOSSO] top de biquini de amarrar tolera mais na banda */
    toleranciaBandaAjustavelCm: 5.0,
  };

  /* ============================================================
     8. CALCADO  [NORMA]
     ============================================================ */

  D.calcadoTab = {
    mondopointPasso: 5,
    pontoParis: 0.667,
    barleycorn: 0.847,
    euDoPe: function (peCm) { return (peCm + 2 * 0.667) / 0.667; },
    peDoEu: function (eu) { return eu * 0.667 - 2 * 0.667; },
    brParaEu: function (br) { return br + 1; },
    birkenstock: {
      35: 22.5, 36: 23.0, 37: 24.0, 38: 24.5, 39: 25.0, 40: 26.0,
      41: 26.5, 42: 27.0, 43: 28.0, 44: 28.5, 45: 29.0, 46: 30.0,
    },
    folgaBirkenstockCm: 1.0,
    folgaMinimaCm: 0.5,
    passoLarguraCm: 0.32,
    larguras: ['4A', '2A', 'B', 'D', '2E', '4E', '6E'],
  };

  /* ============================================================
     9. RELOGIO e ANEL  [INDUSTRIA]
     ============================================================ */

  D.relogio = {
    caixaPorPulso: [
      { ate: 15.2, caixa: [34, 36] }, { ate: 16.5, caixa: [36, 38] },
      { ate: 17.8, caixa: [38, 40] }, { ate: 19.1, caixa: [40, 42] },
      { ate: 99, caixa: [42, 46] },
    ],
    ocupacaoIdeal: [0.6, 0.75],
    razaoPulseira: 0.5,
    mediaPulsoCm: { m: [17.8, 18.4], f: [15.2, 16.5] },
    mmPorElo: [2, 3],
    mmPorFuroFecho: 2,
    pulseiraFemininaMm: [165, 180],
  };

  D.anel = {
    euDaCircunferencia: function (mm) { return mm; },
    brDaCircunferencia: function (mm) { return Math.round(mm - 40); },
    circunferenciaDoDiametro: function (mm) { return mm * Math.PI; },
    passoUsMm: 2.55,
    ancora: [
      { us: 5, diametro: 15.7, circunferencia: 49.3, uk: 'J1/2', eu: 49, br: 9 },
      { us: 6, diametro: 16.5, circunferencia: 51.8, uk: 'L1/2', eu: 52, br: 12 },
      { us: 7, diametro: 17.3, circunferencia: 54.3, uk: 'N1/2', eu: 54, br: 14 },
      { us: 8, diametro: 18.1, circunferencia: 56.9, uk: 'P1/2', eu: 57, br: 17 },
      { us: 9, diametro: 19.0, circunferencia: 59.7, uk: 'R1/2', eu: 60, br: 20 },
      { us: 10, diametro: 20.0, circunferencia: 62.8, uk: 'U', eu: 63, br: 23 },
    ],
  };

  /* ============================================================
     10. DESEMPATE e PESOS
     ------------------------------------------------------------
     [NOSSO] Os pesos sao calibragem nossa, nao numero de norma.
     Regiao que nao cede pesa mais: ombro apertado condena a peca,
     cintura folgada nao. Estao expostos como setting justamente
     porque sao decisao de produto, nao constante escondida.
     ============================================================ */

  D.pesos = {
    generico: { busto: 1.4, peito: 1.4, ombro: 1.5, cintura: 1.0, quadril: 1.1, coxa: 0.8, comprimento: 0.5 },
    legging: { quadril: 1.5, cintura: 1.2, coxa: 1.0, entrepernas: 0.6 },
    calca: { quadril: 1.5, cintura: 1.3, coxa: 1.0, entrepernas: 0.7 },
    calcado: { pe: 2.0, comprimento: 2.0, largura: 0.8 },
    sutia: { banda: 1.6, busto: 1.4 },
    relogio: { punho: 1.5, caixa: 1.0 },
    camisaMasculina: { peito: 1.5, pescoco: 1.4, cintura: 0.9, manga: 0.7 },
  };

  /* [INDUSTRIA] quando duas medidas apontam tamanhos diferentes */
  D.desempate = {
    legging: { manda: 'quadril' },
    calca: { manda: 'quadril' },
    generico: { manda: 'busto' },
    calcado: { manda: 'pe' },
    camisaMasculina: { manda: 'peito' },
    sutia: { manda: 'banda' },
  };

  global.BXDados = D;
  if (typeof module !== 'undefined' && module.exports) module.exports = D;
})(typeof window !== 'undefined' ? window : globalThis);
