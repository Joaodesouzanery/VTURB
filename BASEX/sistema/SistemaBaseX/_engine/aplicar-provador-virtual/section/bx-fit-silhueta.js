/* ============================================================
   BX Provador Virtual — silhueta com regioes de caimento
   ------------------------------------------------------------
   Desenha um contorno ABSTRATO (sem rosto, sem tom de pele, sem
   proporcao realista) e pinta cada regiao pelo nivel de caimento.

   Por que abstrato, e nao um avatar parecido com a pessoa:
   estudo do Journal of Marketing Research (Iowa State, 2023, seis
   experimentos, 8.000+ clientes) mediu que provador com avatar
   realista AUMENTA venda em quem tem IMC baixo e DIMINUI em quem
   tem IMC alto, junto com queda de autoestima e da avaliacao do
   produto. A recomendacao dos proprios autores e criar distancia
   entre a pessoa e a imagem. Um contorno neutro faz exatamente
   isso. Nao e escolha estetica, e escolha de conversao.

   Convencao de cor: azul sobra, vermelho aperta. E a mesma do
   CLO3D e do Browzwear, que ja treinaram o olho do mercado.
   Inverter faria o comprador ler ao contrario.
   ============================================================ */
(function (global) {
  'use strict';

  var S = {};

  /* -3 aperta .......... 0 ideal .......... +3 sobra
     Cores escolhidas para manter contraste de texto legivel por cima
     e para nao depender de matiz sozinha (o rotulo escrito acompanha,
     senao quem nao distingue vermelho de verde fica sem informacao). */
  S.CORES = {
    '-3': { fill: '#C0392B', texto: '#FFFFFF', nome: 'aperta muito' },
    '-2': { fill: '#D9534F', texto: '#FFFFFF', nome: 'aperta' },
    '-1': { fill: '#E0A030', texto: '#26210F', nome: 'justo' },
    '0':  { fill: '#2F855A', texto: '#FFFFFF', nome: 'ideal' },
    '1':  { fill: '#5B8DB8', texto: '#FFFFFF', nome: 'sobra um pouco' },
    '2':  { fill: '#3C6E9F', texto: '#FFFFFF', nome: 'sobra' },
    '3':  { fill: '#2C5580', texto: '#FFFFFF', nome: 'sobra muito' },
  };

  S.NEUTRO = { fill: '#E3E0D9', texto: '#4A4740', nome: 'sem dado' };

  S.cor = function (nivel) {
    if (nivel == null) return S.NEUTRO;
    return S.CORES[String(nivel)] || S.NEUTRO;
  };

  /* ============================================================
     Formas. Cada silhueta e uma lista de regioes com um path.
     viewBox fixo 0 0 200 380 para o corpo, para as regioes
     casarem entre os perfis.
     ============================================================ */

  /* Silhueta montada com formas simples em vez de um unico path
     comprido. Path longo escrito a mao quebra facil: a primeira
     versao renderizou uma cunha no lugar de um corpo, e so o teste
     visual pegou. Formas separadas sao conferiveis uma a uma. */

  var CABECA = 'M100 12a20 20 0 1 0 0.01 0z';

  /* Tronco em coordenadas ABSOLUTAS e espelhadas em x=100. A versao
     anterior usava curvas relativas e saiu torta: um lado estufava e
     o outro nao. Simetria escrita a mao so se confere olhando, e foi
     o teste visual que pegou. */
  var TRONCO =
    'M100 44' +
    'C118 44 136 52 142 76' +
    'C146 94 136 110 132 128' +
    'C130 146 140 162 144 180' +
    'C146 194 144 204 142 212' +
    'L58 212' +
    'C56 204 54 194 56 180' +
    'C60 162 70 146 68 128' +
    'C64 110 54 94 58 76' +
    'C64 52 82 44 100 44Z';

  var PERNAS = 'M62 208h34v156H66zM104 208h34l-4 156h-30z';

  var PE =
    'M70 12c26 0 44 21 46 50c2 27-4 52-6 78c-2 31-2 63-4 96' +
    'c-1 22-14 46-36 46s-35-24-36-46c-2-33-2-65-4-96' +
    'c-2-26-8-51-6-78C26 33 44 12 70 12z';

  var PULSO = 'M14 62h192a16 16 0 0 1 16 16v48a16 16 0 0 1-16 16H14a16 16 0 0 1-16-16V78a16 16 0 0 1 16-16z';

  var BUSTO_CX = 'M24 24h152a18 18 0 0 1 18 18v112a18 18 0 0 1-18 18H24a18 18 0 0 1-18-18V42a18 18 0 0 1 18-18z';

  /* As faixas de regiao sao mais largas que o corpo de proposito:
     quem apara a borda e o clipPath, entao a cor acompanha a curva
     do tronco sem precisar de um path por regiao. */
  var L = 30, W = 140;
  function faixa(y, h) { return 'M' + L + ' ' + y + 'h' + W + 'v' + h + 'H' + L + 'z'; }

  S.formas = {
    superior: {
      viewBox: '0 0 200 224',
      base: [CABECA, TRONCO],
      clip: [TRONCO],
      regioes: [
        { id: 'ombro',   rotulo: 'Ombro',   path: faixa(44, 24) },
        { id: 'busto',   rotulo: 'Busto',   path: faixa(68, 42) },
        { id: 'cintura', rotulo: 'Cintura', path: faixa(110, 38) },
        { id: 'quadril', rotulo: 'Quadril', path: faixa(148, 64) },
      ],
    },
    inferior: {
      viewBox: '0 0 200 376',
      base: [CABECA, TRONCO, PERNAS],
      clip: [TRONCO, PERNAS],
      regioes: [
        { id: 'cintura',     rotulo: 'Cintura',     path: faixa(110, 38) },
        { id: 'quadril',     rotulo: 'Quadril',     path: faixa(148, 60) },
        { id: 'coxa',        rotulo: 'Coxa',        path: faixa(208, 76) },
        { id: 'entrepernas', rotulo: 'Comprimento', path: faixa(284, 84) },
      ],
    },
    corpo: {
      viewBox: '0 0 200 376',
      base: [CABECA, TRONCO, PERNAS],
      clip: [TRONCO, PERNAS],
      regioes: [
        { id: 'ombro',   rotulo: 'Ombro',   path: faixa(44, 24) },
        { id: 'busto',   rotulo: 'Busto',   path: faixa(68, 42) },
        { id: 'cintura', rotulo: 'Cintura', path: faixa(110, 38) },
        { id: 'quadril', rotulo: 'Quadril', path: faixa(148, 60) },
        { id: 'coxa',    rotulo: 'Coxa',    path: faixa(208, 80) },
      ],
    },
    sutia: {
      viewBox: '0 0 200 196',
      base: [BUSTO_CX], clip: [BUSTO_CX],
      regioes: [
        { id: 'busto', rotulo: 'Taca',  path: 'M0 24h200v78H0z' },
        { id: 'banda', rotulo: 'Banda', path: 'M0 102h200v70H0z' },
      ],
    },
    pe: {
      viewBox: '0 0 140 300',
      base: [PE], clip: [PE],
      regioes: [
        { id: 'pe',      rotulo: 'Comprimento', path: 'M0 12h140v226H0z' },
        { id: 'largura', rotulo: 'Largura',     path: 'M0 88h140v58H0z' },
      ],
    },
    pulso: {
      viewBox: '0 0 220 200',
      base: [PULSO], clip: [PULSO],
      regioes: [
        { id: 'caixa', rotulo: 'Caixa',    path: 'M76 40h68v120H76z' },
        { id: 'punho', rotulo: 'Pulseira', path: 'M0 60h76v80H0z' },
      ],
    },
  };

  /* ============================================================
     Render
     ============================================================ */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /**
   * @param {string} forma      chave de S.formas
   * @param {Array}  regioes    saida de Core.recomendar().regioes
   * @param {object} op         { unidade:'cm'|'in', titulo, mostrarNumero }
   * @returns {string} SVG
   */
  S.render = function (forma, regioes, op) {
    op = op || {};
    var f = S.formas[forma] || S.formas.superior;

    var porId = {};
    (regioes || []).forEach(function (r) {
      // a chave da tabela pode ser a da peca; o desenho usa a do corpo
      porId[r.regiaoCorpo || r.regiao] = r;
      porId[r.regiao] = porId[r.regiao] || r;
    });

    var partes = f.regioes.map(function (reg) {
      var dado = porId[reg.id];
      var c = S.cor(dado ? dado.nivel : null);
      var titulo = reg.rotulo + ': ' + (dado ? c.nome : 'sem medida');
      return (
        '<path d="' + reg.path + '" fill="' + c.fill + '" fill-opacity="' +
        (dado ? '0.92' : '0.38') + '" class="bxfit-reg" data-reg="' + esc(reg.id) + '">' +
        '<title>' + esc(titulo) + '</title></path>'
      );
    });

    var base = [].concat(f.base);
    var clip = [].concat(f.clip || f.base);
    var idClip = 'bxfit-clip-' + forma;
    var d = function (arr, attrs) {
      return arr.map(function (p) { return '<path d="' + p + '" ' + attrs + '/>'; }).join('');
    };

    return (
      '<svg viewBox="' + f.viewBox + '" class="bxfit-svg" role="img" ' +
      'aria-label="' + esc(op.titulo || 'Mapa de caimento por regiao do corpo') + '" ' +
      'xmlns="http://www.w3.org/2000/svg">' +
      '<defs><clipPath id="' + idClip + '">' + d(clip, '') + '</clipPath></defs>' +
      d(base, 'fill="#F2F0EB"') +
      '<g clip-path="url(#' + idClip + ')">' + partes.join('') + '</g>' +
      d(base, 'fill="none" stroke="#4A4740" stroke-width="2.5" stroke-linejoin="round"') +
      '</svg>'
    );
  };

  /**
   * Lista textual ao lado do desenho.
   *
   * A cor sozinha nao pode carregar a informacao: quem nao distingue
   * vermelho de verde ficaria sem nada. E, como a section calcula folga
   * em centimetro e nao simula tecido, o numero aparece junto. Mostrar a
   * cor sem o numero sugeriria uma simulacao que nao existe.
   */
  S.legenda = function (regioes, op) {
    op = op || {};
    if (!regioes || !regioes.length) return '';
    var linhas = regioes.map(function (r) {
      var c = S.cor(r.nivel);
      var num = '';
      if (op.mostrarNumero !== false && r.folga != null) {
        var v = op.unidade === 'in' ? (r.folga / 2.54).toFixed(1) + '"' : r.folga.toFixed(1) + ' cm';
        num = '<span class="bxfit-num">' + esc((r.folga > 0 ? '+' : '') + v) + '</span>';
      }
      return (
        '<li class="bxfit-linha">' +
        '<span class="bxfit-bolinha" style="background:' + c.fill + '"></span>' +
        '<span class="bxfit-reg-nome">' + esc(nomeBonito(r.regiaoCorpo || r.regiao)) + '</span>' +
        '<span class="bxfit-rot">' + esc(r.rotulo || c.nome) + '</span>' +
        num +
        (r.estimada ? '<span class="bxfit-est" title="medida estimada a partir da sua altura e peso">estimada</span>' : '') +
        '</li>'
      );
    });
    return '<ul class="bxfit-legenda">' + linhas.join('') + '</ul>';
  };

  var NOMES = {
    busto: 'Busto', peito: 'Peito', cintura: 'Cintura', quadril: 'Quadril',
    ombro: 'Ombro', coxa: 'Coxa', entrepernas: 'Comprimento', comprimento: 'Comprimento',
    pe: 'Pe', largura: 'Largura', punho: 'Pulso', caixa: 'Caixa', banda: 'Banda',
    manga: 'Manga', braco: 'Braco', pescoco: 'Pescoco',
  };

  function nomeBonito(k) {
    return NOMES[k] || String(k).charAt(0).toUpperCase() + String(k).slice(1);
  }

  S._nomeBonito = nomeBonito;

  /** escolhe a silhueta a partir do perfil do produto */
  S.formaDoPerfil = function (perfilId) {
    return (
      {
        legging: 'inferior', calca: 'inferior', short: 'inferior', saia: 'inferior',
        superior: 'superior', top: 'superior', camisa: 'superior', jaqueta: 'superior',
        vestido: 'corpo', macacao: 'corpo', generico: 'superior',
        sutia: 'sutia', calcado: 'pe', relogio: 'pulso',
      }[perfilId] || 'superior'
    );
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = S;
  global.BXSilhueta = S;
})(typeof window !== 'undefined' ? window : globalThis);
