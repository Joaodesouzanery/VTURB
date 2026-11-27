/* ============================================================
   BX Provador Virtual — nucleo de calculo
   ------------------------------------------------------------
   Puro. Nao toca no DOM, nao le a pagina, nao faz rede.
   Entra medida, sai recomendacao. Da pra rodar no node e testar.

   Principio: a recomendacao e sempre a comparacao entre uma
   MEDIDA DO CORPO e uma MEDIDA DA PECA, regiao por regiao.
   A diferenca entre as duas e a FOLGA. Cada tipo de caimento
   tem uma faixa de folga aceitavel. O tamanho recomendado e o
   que poe mais regioes dentro da faixa.

   Tudo que e numero de industria (faixas de folga, elasticidade,
   estimativa de corpo, conversao de grade) mora em bx-fit-dados.js,
   nunca aqui. Assim da pra corrigir a tabela sem mexer na logica.
   ============================================================ */
(function (global) {
  'use strict';

  var D = global.BXDados || {};
  var Core = {};

  /* ================= 1. unidades ================= */

  var POL = 2.54;

  Core.paraCm = function (v, unidade) {
    if (v == null || v === '') return null;
    var n = Core.numero(v);
    if (n == null) return null;
    return unidade === 'in' || unidade === 'pol' ? n * POL : n;
  };

  Core.cmParaPol = function (cm) {
    return cm == null ? null : cm / POL;
  };

  /**
   * Pe-e-polegada para cm. Loja americana publica altura como 5'7" e ate
   * como faixa 5'1"-5'5". Sem isso o parser le 5.1 e joga a compradora
   * pro menor tamanho da grade, sempre. Achado num teste em loja real.
   */
  Core.pesPolegadas = function (v) {
    var m = String(v).match(
      /(\d+)\s*(?:'|ft|feet|pes?)\s*(\d+(?:[.,]\d+)?)?\s*(?:"|''|in|pol)?/i
    );
    if (!m) return null;
    var pes = parseFloat(m[1]);
    var pol = m[2] ? parseFloat(String(m[2]).replace(',', '.')) : 0;
    if (!isFinite(pes) || pes < 3 || pes > 8) return null;
    return (pes * 12 + pol) * POL;
  };

  /** aceita "72", "72,5", "28 in", "71-76", "5'7\"", "5'1\"-5'5\"" */
  Core.numero = function (v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (v == null) return null;
    var s = String(v).trim();

    // pes-e-polegada vem antes de tudo: "5'1\"-5'5\"" tem hifen no meio e
    // seria lido como a faixa numerica 5 a 5 se caisse na regra de faixa.
    if (/\d\s*(?:'|ft\b|feet\b)/i.test(s)) {
      var partes = s.split(/\s*[-–]\s*(?=\d)/);
      var convs = partes
        .map(function (p) { return Core.pesPolegadas(p); })
        .filter(function (n) { return n != null; });
      if (convs.length) {
        return convs.reduce(function (a, b) { return a + b; }, 0) / convs.length;
      }
    }

    // Polegada em fracao: loja americana escreve 8 3/4" e 9 5/8".
    // Sem isso o parser le 8 e o sapato encolhe tres quartos de polegada.
    var fr = Core.fracao(s);
    if (fr != null) return fr;

    s = s.replace(',', '.');
    var faixa = s.match(/^(-?\d+(?:\.\d+)?)\s*[-–a]\s*(-?\d+(?:\.\d+)?)/i);
    if (faixa) return (parseFloat(faixa[1]) + parseFloat(faixa[2])) / 2;
    var m2 = s.match(/-?\d+(?:\.\d+)?/);
    return m2 ? parseFloat(m2[0]) : null;
  };

  /**
   * "8 3/4" -> 8.75 | "3/4" -> 0.75 | "8 3/4 - 9" -> 8.875 (media).
   * Devolve null quando nao ha fracao, pra nao atrapalhar o caminho normal.
   */
  Core.fracao = function (v) {
    var s = String(v).replace(/["”“]/g, ' ');
    if (s.indexOf('/') === -1) return null;
    var partes = s.split(/\s*[-–]\s*(?=\d)/);
    var vals = [];
    partes.forEach(function (p) {
      var m = p.match(/(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)/);
      if (m) {
        var den = parseFloat(m[3]);
        if (!den) return;
        vals.push((m[1] ? parseFloat(m[1]) : 0) + parseFloat(m[2]) / den);
      } else {
        var n = p.match(/\d+(?:\.\d+)?/);
        if (n) vals.push(parseFloat(n[0]));
      }
    });
    if (!vals.length) return null;
    return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  };

  /** "68-72" -> {min:68, max:72}; "70" -> {min:70, max:70} */
  Core.faixa = function (v) {
    if (v == null || v === '') return null;
    var s0 = String(v).trim();

    if (/\d\s*(?:'|ft\b|feet\b)/i.test(s0)) {
      var ps = s0.split(/\s*[-–]\s*(?=\d)/)
        .map(function (p) { return Core.pesPolegadas(p); })
        .filter(function (n) { return n != null; });
      if (ps.length) {
        return { min: Math.min.apply(null, ps), max: Math.max.apply(null, ps) };
      }
    }

    if (s0.indexOf('/') !== -1) {
      var fs = s0.split(/\s*[-–]\s*(?=\d)/)
        .map(function (x) { return Core.fracao(x); })
        .filter(function (n) { return n != null; });
      if (fs.length) {
        return { min: Math.min.apply(null, fs), max: Math.max.apply(null, fs) };
      }
    }

    var s = s0.replace(',', '.');
    var m = s.match(/(-?\d+(?:\.\d+)?)\s*[-–a]\s*(-?\d+(?:\.\d+)?)/i);
    if (m) {
      var a = parseFloat(m[1]), b = parseFloat(m[2]);
      return { min: Math.min(a, b), max: Math.max(a, b) };
    }
    var n = Core.numero(s);
    return n == null ? null : { min: n, max: n };
  };

  /* ================= 2. tabela de medidas ================= */

  /**
   * Normaliza a tabela que o lojista cadastrou.
   *
   * A armadilha que mais aparece: medida DEITADA (flat, o produto na mesa,
   * de um lado ao outro) e METADE da circunferencia. Quem cadastra 52 de
   * busto deitado esta dizendo 104 de circunferencia. Tratar os dois como
   * a mesma coisa erra o tamanho em dois numeros inteiros, sempre pra menos.
   *
   * @param {object} bruto  { tipo:'peca'|'corpo', unidade:'cm'|'in',
   *                          medicao:'circunferencia'|'deitada',
   *                          tamanhos:[{ tamanho:'M', busto:52, cintura:44 }] }
   * @returns {object} { tipo, tamanhos:[{tamanho, medidas:{busto:{min,max}}}] }
   */
  Core.normalizarTabela = function (bruto) {
    if (!bruto || !bruto.tamanhos || !bruto.tamanhos.length) return null;
    var un = bruto.unidade === 'in' || bruto.unidade === 'pol' ? 'in' : 'cm';
    var dobra = bruto.medicao === 'deitada' || bruto.medicao === 'flat';
    var tipo = bruto.tipo === 'corpo' ? 'corpo' : 'peca';

    var tamanhos = bruto.tamanhos
      .map(function (linha) {
        var medidas = {};
        Object.keys(linha).forEach(function (k) {
          if (k === 'tamanho' || k === 'size' || k === 'label') return;
          var f = Core.faixa(linha[k]);
          if (!f) return;
          var mult = (un === 'in' ? POL : 1) * (dobra && ehCircular(k) ? 2 : 1);
          medidas[chave(k)] = { min: f.min * mult, max: f.max * mult };
        });
        var rot = linha.rotulos && linha.rotulos.length
          ? linha.rotulos
          : String(linha.tamanho || '').split(/\s*[\/|]\s*/).map(function (x) {
              return x.trim();
            }).filter(Boolean);
        return {
          tamanho: String(linha.tamanho || linha.size || linha.label || '').trim(),
          // "4 / S" e um tamanho so escrito em dois sistemas. Guardar os
          // dois deixa o casamento com a variante da loja funcionar tanto
          // se a loja rotula por numero quanto se rotula por letra.
          rotulos: rot,
          medidas: medidas,
        };
      })
      .filter(function (t) {
        return t.tamanho && Object.keys(t.medidas).length;
      });

    return tamanhos.length ? { tipo: tipo, tamanhos: tamanhos } : null;
  };

  /* medidas que sao volta completa no corpo (dobram quando vem deitadas) */
  var CIRCULARES = [
    'busto', 'peito', 'torax', 'cintura', 'quadril', 'coxa', 'braco',
    'punho', 'pescoco', 'panturrilha', 'gancho', 'banda',
  ];
  /* medidas que sao comprimento (nunca dobram) */
  var LINEARES = [
    'comprimento', 'ombro', 'manga', 'entrepernas', 'altura', 'largura',
    'pe', 'caixa', 'espessura', 'alca', 'profundidade',
  ];

  function chave(k) {
    return String(k)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
  }

  function ehCircular(k) {
    var c = chave(k);
    for (var i = 0; i < LINEARES.length; i++) {
      if (c.indexOf(LINEARES[i]) !== -1) return false;
    }
    for (var j = 0; j < CIRCULARES.length; j++) {
      if (c.indexOf(CIRCULARES[j]) !== -1) return true;
    }
    return false; // na duvida, nao dobra: errar pra menos e menos danoso
  }

  Core._chave = chave;
  Core._ehCircular = ehCircular;

  /* ================= 3. corpo ================= */

  /**
   * Completa as medidas do corpo que o comprador nao informou, a partir do
   * que ele informou (altura, peso, idade, sexo, formato). Nunca sobrescreve
   * medida declarada: o numero que a pessoa mediu vale mais que estimativa.
   *
   * As equacoes vem de BXDados.estimativa. Se nao houver equacao para uma
   * medida, ela fica ausente, e o calculo simplesmente ignora aquela regiao
   * em vez de inventar. Regiao inventada e pior que regiao faltando.
   */
  Core.completarCorpo = function (entrada, perfil) {
    var corpo = {};
    Object.keys(entrada || {}).forEach(function (k) {
      var n = Core.numero(entrada[k]);
      if (n != null) corpo[chave(k)] = n;
    });

    var eq = (D.estimativa || {})[corpo.sexo || (entrada && entrada.sexo) || 'f'];
    if (!eq) return { corpo: corpo, estimadas: [] };

    var estimadas = [];
    var precisa = (perfil && perfil.medidas_do_corpo) || Object.keys(eq);

    precisa.forEach(function (m) {
      var c = chave(m);
      if (corpo[c] != null) return;
      var f = eq[c];
      if (typeof f !== 'function') return;
      var v = f(corpo);
      if (v != null && isFinite(v)) {
        corpo[c] = v;
        estimadas.push(c);
      }
    });

    return { corpo: corpo, estimadas: estimadas };
  };

  /* ================= 4. folga e nota ================= */

  /**
   * Nota de 0 a 1 para uma folga, dada a faixa desejada.
   * 1 dentro da faixa; cai suave pra fora, e cai mais rapido quando aperta
   * do que quando sobra, porque peca apertada volta e peca folgada fica.
   */
  Core.notaFolga = function (folga, faixa) {
    if (!faixa) return null;
    var min = faixa[0], max = faixa[1];
    if (folga >= min && folga <= max) return 1;
    var falta = folga < min ? min - folga : folga - max;
    var tol = folga < min ? (faixa[2] || 4) : (faixa[3] || 8);
    var n = 1 - falta / tol;
    return n < 0 ? 0 : n;
  };

  /* ----- escala de caimento -----
     Tres referencias de mercado, reconciliadas:
       Sizebay   : inteiro -2..+2, 5 rotulos (APERTADO..FOLGADO), 7 com is3dFeel
       Fit Finder: ordinal -3..+3 (very_tight .. very_loose)
       True Fit  : 0..7 por ponto de medida, com 3-4 = ideal
     Usamos -3..+3 internamente (o mais granular) e exibimos 5 rotulos por
     padrao, 7 quando o lojista liga a escala detalhada. Nenhum deles mostra
     porcentagem de confianca ao comprador, e nos tambem nao vamos mostrar. */

  Core.ROTULOS5 = ['apertado', 'justo', 'ideal', 'largo', 'folgado'];
  Core.ROTULOS7 = [
    'apertado', 'justo', 'levemente justo', 'ideal',
    'levemente folgado', 'largo', 'folgado',
  ];

  /**
   * Converte a folga em cm no inteiro -3..+3.
   * 0 = dentro da faixa ideal. Negativo aperta, positivo sobra.
   */
  Core.escala = function (folga, faixa) {
    if (!faixa) return null;
    var min = faixa[0], max = faixa[1];
    var tolAperto = faixa[2] || 4, tolSobra = faixa[3] || 8;
    if (folga >= min && folga <= max) return 0;
    if (folga < min) {
      var falta = min - folga;
      if (falta <= tolAperto / 2) return -1;
      if (falta <= tolAperto) return -2;
      return -3;
    }
    var sobra = folga - max;
    if (sobra <= tolSobra / 2) return 1;
    if (sobra <= tolSobra) return 2;
    return 3;
  };

  /** rotulo humano a partir do inteiro -3..+3 */
  Core.rotulo = function (n, detalhada) {
    if (n == null) return null;
    if (detalhada) return Core.ROTULOS7[Math.max(0, Math.min(6, n + 3))];
    // na escala de 5, -3 e -2 colapsam em "apertado" e +2/+3 em "folgado"
    var mapa = { '-3': 0, '-2': 0, '-1': 1, 0: 2, 1: 3, 2: 4, 3: 4 };
    return Core.ROTULOS5[mapa[String(n)]];
  };

  /** compat: rotulo direto da folga */
  Core.rotuloFolga = function (folga, faixa, detalhada) {
    return Core.rotulo(Core.escala(folga, faixa), detalhada);
  };

  /**
   * Preferencia de caimento declarada pelo comprador, ordinal -3..+3
   * (very_tight .. very_loose no Fit Finder). Desloca a faixa alvo:
   * quem gosta de roupa larga tem a faixa empurrada pra cima.
   */
  Core.aplicarPreferencia = function (faixa, pref) {
    if (!faixa || !pref) return faixa;
    var passo = ((faixa[1] - faixa[0]) || 2) * 0.5;
    var d = pref * passo;
    return [faixa[0] + d, faixa[1] + d, faixa[2], faixa[3]];
  };

  /**
   * Elasticidade: malha com elastano tolera folga negativa. Sem isso,
   * legging de compressao seria sempre reprovada em todo tamanho.
   */
  Core.ajustarPorElasticidade = function (faixa, elasticidade) {
    var g = (D.elasticidade || {})[elasticidade];
    if (!g || !faixa) return faixa;
    return [faixa[0] - g, faixa[1] - g * 0.5, faixa[2], faixa[3]];
  };

  /**
   * Faixas de validacao, iguais as que a API do True Fit aceita.
   * Fora disso o dado e erro de digitacao, e calcular em cima dele
   * produz recomendacao confiante e errada.
   */
  Core.LIMITES = {
    altura: [60, 260],   // cm
    peso: [22, 500],     // kg
    idade: [2, 125],     // anos
    busto: [50, 200], cintura: [40, 200], quadril: [50, 220],
    punho: [10, 25], pe: [15, 40],
  };

  Core.validar = function (entrada) {
    var erros = [];
    Object.keys(entrada || {}).forEach(function (k) {
      var lim = Core.LIMITES[chave(k)];
      if (!lim) return;
      var v = Core.numero(entrada[k]);
      if (v == null) return;
      if (v < lim[0] || v > lim[1]) {
        erros.push({ campo: chave(k), valor: v, esperado: lim });
      }
    });
    return erros;
  };


  /**
   * Ordena os tamanhos pela MEDIDA DOMINANTE da propria tabela, nunca
   * pela ordem em que o lojista digitou as variantes.
   *
   * No Shopify a ordem dos option values e a que a pessoa digitou, e
   * "M, P, G, GG" ou uma ordem alfabetica vinda de importador sao comuns.
   * Como a sugestao de tamanho vizinho ("acima" e "abaixo") e a regra de
   * meio-passo dependem da ordem, confiar na ordem digitada troca o
   * vizinho de cima pelo de baixo em silencio.
   *
   * Devolve tambem se a grade e monotonica. Grade nao monotonica (linha
   * duplicada, cabecalho repetido no meio, tamanho repetido) desliga a
   * sugestao de vizinho e vira aviso pro lojista, em vez de recomendacao
   * errada com cara de certa.
   */
  Core.ordenarGrade = function (tamanhos, dominante) {
    if (!tamanhos || tamanhos.length < 2) {
      return { tamanhos: tamanhos || [], monotonica: true, dominante: dominante || null };
    }
    var chaveDom = dominante;
    if (!chaveDom) {
      var cont = {};
      tamanhos.forEach(function (t) {
        Object.keys(t.medidas || {}).forEach(function (k) {
          cont[k] = (cont[k] || 0) + 1;
        });
      });
      // a dominante e a medida presente em mais tamanhos; empate vai pra
      // primeira em ordem alfabetica, so pra ser deterministico
      chaveDom = Object.keys(cont).sort(function (a, b) {
        return cont[b] - cont[a] || (a < b ? -1 : 1);
      })[0];
    }
    if (!chaveDom) return { tamanhos: tamanhos, monotonica: true, dominante: null };

    var comValor = tamanhos.map(function (t, i) {
      var m = t.medidas[chaveDom];
      return { t: t, i: i, v: m ? (m.min + m.max) / 2 : null };
    });
    if (comValor.some(function (x) { return x.v == null; })) {
      return { tamanhos: tamanhos, monotonica: false, dominante: chaveDom, motivo: 'tamanho sem a medida dominante' };
    }

    var ord = comValor.slice().sort(function (a, b) { return a.v - b.v || a.i - b.i; });

    var mono = true;
    for (var k = 1; k < ord.length; k++) {
      if (ord[k].v <= ord[k - 1].v) { mono = false; break; }
    }

    return {
      tamanhos: ord.map(function (x) { return x.t; }),
      monotonica: mono,
      dominante: chaveDom,
      motivo: mono ? null : 'dois tamanhos com a mesma medida ou medida que nao cresce',
    };
  };

  /* ================= 5. recomendacao ================= */

  /**
   * @param {object} corpo   medidas do corpo em cm
   * @param {object} tabela  saida de normalizarTabela
   * @param {object} perfil  perfil do produto
   * @param {object} opcoes  { caimento, elasticidade, preferencia:-3..+3,
   *                           disponiveis:[], escalaDetalhada:bool,
   *                           vesteEm:'pequeno'|'grande'|null }
   *
   * Saida no formato que o mercado consolidou (True Fit): melhor tamanho
   * mais o de cima e o de baixo, e um mapa de caimento por regiao.
   */
  Core.recomendar = function (corpo, tabela, perfil, opcoes) {
    opcoes = opcoes || {};
    if (!tabela || !tabela.tamanhos.length) {
      return { ok: false, motivo: 'sem tabela de medidas' };
    }

    var perfilId = (perfil && perfil.id) || 'generico';
    var caimento =
      opcoes.caimento ||
      (perfil && perfil.caimento_padrao) ||
      (D.caimentoPadrao || {})[perfilId] ||
      'regular';
    var faixasPerfil = (D.folga || {})[perfilId] || (D.folga || {}).generico || {};
    var faixas = faixasPerfil[caimento] || {};
    var pesos = (perfil && perfil.pesos) || (D.pesos || {})[perfilId] || (D.pesos || {}).generico || {};

    var grade = Core.ordenarGrade(
      tabela.tamanhos,
      (D.desempate || {})[perfilId] && (D.desempate || {})[perfilId].manda
    );

    var avaliados = grade.tamanhos
      .filter(function (t) {
        if (!opcoes.disponiveis || !opcoes.disponiveis.length) return true;
        var meus = [t.tamanho].concat(t.rotulos || []).map(function (x) {
          return String(x).trim().toLowerCase();
        });
        return opcoes.disponiveis.some(function (d) {
          return meus.indexOf(String(d).trim().toLowerCase()) !== -1;
        });
      })
      .map(function (t) {
        var regioes = [];
        var soma = 0, pesoTotal = 0, pior = 0;

        var mapa = (perfil && perfil.mapa) || {};
        Object.keys(t.medidas).forEach(function (reg) {
          // A tabela da loja e o corpo raramente usam a mesma palavra: a
          // tabela de um sapato diz "comprimento" (da palmilha) e o corpo
          // diz "pe". Sem essa ponte o calculo nao acha regiao em comum e
          // devolve "sem dados" numa tabela que estava perfeita.
          var regCorpo = mapa[reg] || reg;
          var doCorpo = corpo[regCorpo];
          if (doCorpo == null) return;

          var m = t.medidas[reg];
          var daPeca = (m.min + m.max) / 2;
          var valor, alvo;

          if (tabela.tipo === 'corpo') {
            // A tabela ja diz "este tamanho serve em quem tem X".
            // A folga do molde ja esta embutida: compara direto, e a faixa
            // aceitavel e a propria faixa publicada pela loja.
            valor = doCorpo;
            alvo = [m.min, m.max, 4, 4];
          } else {
            valor = daPeca - doCorpo;
            // a faixa de folga tambem e indexada pela regiao do CORPO
            // (a tabela de calcado diz "comprimento", a faixa diz "pe")
            var base = faixas[reg] || faixas[regCorpo];
            // Sem classe de tecido declarada nao aplicamos deslocamento
            // nenhum E nao aplicamos o piso de folga minima mais abaixo.
            // Assumir "plano" em silencio reprovaria todo tamanho de uma
            // camiseta de viscolycra, e malha e a maior parte do catalogo.
            //
            // Perfil com folga negativa embutida (legging, sutia) tambem
            // nao recebe o deslocamento: a negativa ja esta na faixa, e
            // somar o estiramento por cima conta a mesma folga duas vezes.
            var embutida = (D.negativaEmbutida || {})[perfilId];
            alvo = opcoes.tecido && !embutida
              ? Core.ajustarPorElasticidade(base, opcoes.tecido)
              : base;
            alvo = Core.aplicarPreferencia(alvo, opcoes.preferencia);
          }
          if (!alvo) return;

          var n = Core.escala(valor, alvo);
          if (n == null) return;

          // Piso fisiologico: em tecido plano declarado, folga abaixo do
          // minimo de uso significa que a peca simplesmente nao fecha,
          // por mais que a media geral do tamanho pareca boa.
          var impossivel = false;
          if (opcoes.tecido === 'plano' && tabela.tipo !== 'corpo') {
            var piso = (D.folgaMinima || {})[regCorpo];
            if (piso != null && valor < piso) impossivel = true;
          }

          var p = pesos[reg] == null ? (pesos[regCorpo] == null ? 1 : pesos[regCorpo]) : pesos[reg];
          // nota 1 no ideal, caindo com o afastamento; regiao onde a peca
          // nao fecha nao pontua nada, por melhor que seja a media do tamanho
          var nota = impossivel ? 0 : 1 - Math.abs(n) / 3;
          var estimada = (corpo._estimadas || []).indexOf(regCorpo) !== -1;
          soma += nota * p;
          pesoTotal += p;
          if (Math.abs(n) > Math.abs(pior)) pior = n;

          regioes.push({
            regiao: reg,
            regiaoCorpo: regCorpo,
            corpo: arred(doCorpo),
            peca: arred(daPeca),
            folga: tabela.tipo === 'corpo' ? null : arred(valor),
            nivel: n,
            rotulo: Core.rotulo(n, opcoes.escalaDetalhada),
            estimada: estimada,
            impossivel: impossivel,
          });
        });

        return {
          tamanho: t.tamanho,
          rotulos: t.rotulos || [],
          nota: pesoTotal ? soma / pesoTotal : 0,
          pior: pior,
          regioes: regioes,
          comparadas: regioes.length,
          serve: !regioes.some(function (r) { return r.impossivel; }),
          temEstimada: regioes.some(function (r) { return r.estimada; }),
        };
      })
      .filter(function (a) {
        return a.comparadas > 0;
      });

    if (!avaliados.length) {
      return { ok: false, motivo: 'nenhuma regiao em comum entre corpo e tabela' };
    }

    // Tamanho unico: nao existe recomendacao a fazer, existe uma resposta
    // binaria. Pontuar uma grade de um item so e teatro.
    if (avaliados.length === 1) {
      var u = avaliados[0];
      return {
        ok: true,
        tamanhoUnico: true,
        tamanho: u.tamanho,
        serve: u.serve && Math.abs(u.pior) <= 2,
        regioes: u.regioes,
        nivelGeral: u.pior,
        confianca: u.temEstimada ? 'baixa' : Core.confianca(u, [u], perfil && perfil.minRegioes),
        grade: { monotonica: true, dominante: grade.dominante },
      };
    }

    // Nenhum tamanho fecha: dizer isso, com o numero, e melhor que
    // empurrar o "menos pior" como se fosse recomendacao.
    var servem = avaliados.filter(function (a) { return a.serve; });
    if (!servem.length) {
      var maior = avaliados.slice().sort(function (a, b) { return b.nota - a.nota; })[0];
      var falta = (maior.regioes || [])
        .filter(function (r) { return r.impossivel; })
        .map(function (r) {
          return r.regiao + ' ' + Math.abs(r.folga || 0).toFixed(1) + ' cm mais justo que voce';
        });
      return {
        ok: false,
        motivo: 'sem tamanho adequado',
        detalhe: falta,
        maisProximo: maior.tamanho,
        regioes: maior.regioes,
      };
    }

    var ordem = servem.slice().sort(function (a, b) {
      // Desempata pela PIOR regiao: um tamanho com media boa mas ombro
      // impossivel nao pode ganhar de um equilibrado. Ombro nao cede.
      return b.nota - a.nota || Math.abs(a.pior) - Math.abs(b.pior);
    });

    var melhor = ordem[0];
    var iMelhor = avaliados.indexOf(melhor);
    // Vizinho so faz sentido em grade que cresce. Se a tabela repete
    // tamanho ou nao cresce, nao ha "o de cima": some a sugestao e o
    // lojista recebe o aviso, em vez de uma seta apontando pro lado errado.
    var abaixo = grade.monotonica ? avaliados[iMelhor - 1] || null : null;
    var acima = grade.monotonica ? avaliados[iMelhor + 1] || null : null;
    var segundo = ordem[1] || null;

    // Aviso por artigo. A Zalando publicou (KDD 2021) que este aviso simples,
    // sem nenhum dado pessoal, reduziu devolucao mais que o recomendador
    // personalizado inteiro. Efeito colateral medido: pedidos com dois
    // tamanhos sobem 11,1% com "veste pequeno" e 19,0% com "veste grande".
    var sugerido = melhor.tamanho;
    var motivoAjuste = null;
    if (opcoes.vesteEm === 'pequeno' && acima) {
      sugerido = acima.tamanho;
      motivoAjuste = 'esta peca veste menor que o normal';
    } else if (opcoes.vesteEm === 'grande' && abaixo) {
      sugerido = abaixo.tamanho;
      motivoAjuste = 'esta peca veste maior que o normal';
    }

    return {
      ok: true,
      tamanho: sugerido,
      calculado: melhor.tamanho,
      motivoAjuste: motivoAjuste,
      nivelGeral: melhor.pior,
      regioes: melhor.regioes,
      tambemServe: segundo && segundo.nota >= 0.66 ? segundo.tamanho : null,
      acima: acima ? acima.tamanho : null,
      abaixo: abaixo ? abaixo.tamanho : null,
      entreTamanhos: !!(segundo && Math.abs(melhor.nota - segundo.nota) < 0.08),
      confianca: Core.confianca(melhor, ordem, perfil && perfil.minRegioes),
      grade: {
        monotonica: grade.monotonica,
        dominante: grade.dominante,
        aviso: grade.monotonica ? null : 'a tabela desta loja nao cresce de tamanho em tamanho: ' + grade.motivo,
      },
      todos: avaliados.map(function (a) {
        return { tamanho: a.tamanho, nota: arred(a.nota, 2), pior: a.pior, serve: a.serve };
      }),
    };
  };

  /**
   * Confianca interna, em palavra e nunca em porcentagem: nem Sizebay nem
   * Fit Finder mostram score ao comprador, e um numero inventado passaria
   * uma precisao que a estimativa de corpo nao tem.
   */
  Core.confianca = function (melhor, ordem, minRegioes) {
    var segundo = ordem[1];
    var margem = segundo ? melhor.nota - segundo.nota : 1;
    // Quantas regioes bastam depende do produto. Calcado decide com UMA
    // medida (comprimento do pe) e exigir duas condenava todo calcado a
    // confianca baixa. Roupa precisa de duas ou mais.
    var min = minRegioes || 2;
    if (melhor.nota < 0.55 || melhor.comparadas < min) return 'baixa';
    // Medida estimada a partir de altura e peso tem RMSE de ~5,4 cm em
    // mulheres, o que da 28,8% de chance de cair na faixa certa de 4 cm
    // da EN 13402. Um resultado apoiado nisso nunca pode se apresentar
    // como confianca alta, por melhor que a media pareca.
    if (melhor.temEstimada) return margem < 0.08 ? 'baixa' : 'media';
    if (margem < 0.08) return 'media';
    if (melhor.nota >= 0.85 && melhor.comparadas >= min + 1) return 'alta';
    return 'media';
  };

  function arred(n, casas) {
    if (n == null) return null;
    var f = Math.pow(10, casas == null ? 1 : casas);
    return Math.round(n * f) / f;
  }

  Core._arred = arred;

  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
  global.BXCore = Core;
})(typeof window !== 'undefined' ? window : globalThis);
