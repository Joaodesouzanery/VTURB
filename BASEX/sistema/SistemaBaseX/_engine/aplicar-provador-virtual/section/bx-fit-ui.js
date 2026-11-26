/* ============================================================
   BX Provador Virtual — interface
   ------------------------------------------------------------
   Junta nucleo + dados + silhueta + adaptador de tema numa
   experiencia de PDP. Nao calcula nada: so pergunta, mostra e
   marca a variante.

   Fluxo (copiado da economia de perguntas que a Sizebay validou
   em producao, e do achado da Metail de que 3 campos ja dao
   92-94% e 5 dao 96%):

     1. como voce prefere        -> medir ou estimar
     2a. medir   -> 2 ou 3 circunferencias, com instrucao
     2b. estimar -> altura, peso, idade, formato do corpo
     3. confira suas medidas     -> pode corrigir tudo
     4. resultado                -> tamanho, silhueta, folga em cm

   O passo 3 nao e enfeite. A melhor regressao publicada para
   cintura tem RMSE de 5,41 cm em mulheres, o que da 28,8% de
   chance de cair na faixa certa de 4 cm da EN 13402. Estimativa
   pre-preenche um campo; quem confirma e a pessoa.
   ============================================================ */
(function (global) {
  'use strict';

  var Core = global.BXCore, D = global.BXDados;
  var Silh = global.BXSilhueta, Tema = global.BXTheme;

  var CHAVE = 'bx-provador-perfil';

  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- perfil salvo entre produtos ---------- */

  function lerPerfil() {
    // Navegacao privada e browser com dados de site bloqueados fazem o
    // acessor lancar, nao so devolver vazio. Sem try o provador morre
    // antes de abrir.
    try {
      var s = localStorage.getItem(CHAVE);
      return s ? JSON.parse(s) : null;
    } catch (e) { return null; }
  }

  function salvarPerfil(p) {
    try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch (e) {}
  }

  function limparPerfil() {
    try { localStorage.removeItem(CHAVE); } catch (e) {}
  }

  /* ---------- analytics ---------- */

  function evento(nome, dados) {
    try {
      if (global.dataLayer && global.dataLayer.push) {
        global.dataLayer.push(Object.assign({ event: 'bx_provador_' + nome }, dados || {}));
      }
      if (global.Shopify && global.Shopify.analytics && global.Shopify.analytics.publish) {
        global.Shopify.analytics.publish('bx_provador_' + nome, dados || {});
      }
    } catch (e) {}
  }

  /* ============================================================
     Componente
     ============================================================ */

  function Provador(raiz, cfg) {
    this.raiz = raiz;
    this.cfg = cfg;
    this.estado = { passo: 'inicio', entrada: lerPerfil() || {}, resultado: null };
    this.montar();
  }

  Provador.prototype.montar = function () {
    var self = this;
    this.raiz.innerHTML =
      '<button type="button" class="bxfit-abrir" aria-haspopup="dialog">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8">' +
      '<path d="M4 7h16M4 12h16M4 17h10"/></svg>' +
      '<span>' + esc(this.cfg.textoBotao) + '</span></button>' +
      '<div class="bxfit-modal" hidden role="dialog" aria-modal="true" aria-label="' +
      esc(this.cfg.textoBotao) + '"><div class="bxfit-fundo"></div>' +
      '<div class="bxfit-caixa"><button type="button" class="bxfit-fechar" aria-label="Fechar">&times;</button>' +
      '<div class="bxfit-conteudo"></div></div></div>';

    this.modal = $('.bxfit-modal', this.raiz);
    this.conteudo = $('.bxfit-conteudo', this.raiz);

    $('.bxfit-abrir', this.raiz).addEventListener('click', function () { self.abrir(); });
    $('.bxfit-fechar', this.raiz).addEventListener('click', function () { self.fechar(); });
    $('.bxfit-fundo', this.raiz).addEventListener('click', function () { self.fechar(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !self.modal.hidden) self.fechar();
    });
  };

  Provador.prototype.abrir = function () {
    this.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    this.anterior = document.activeElement;
    // Se ja existe perfil salvo, pula direto pro resultado: quem ja
    // respondeu uma vez nao deve responder de novo a cada produto.
    var e = this.estado.entrada;
    this.ir(e && (e.busto || e.cintura || e.pe || e.altura) ? 'resultado' : 'inicio');
    evento('abriu', { produto: this.cfg.produto });
  };

  Provador.prototype.fechar = function () {
    this.modal.hidden = true;
    document.body.style.overflow = '';
    if (this.anterior && this.anterior.focus) this.anterior.focus();
  };

  Provador.prototype.ir = function (passo) {
    this.estado.passo = passo;
    this.render();
    var foco = this.conteudo.querySelector('input, select, button');
    if (foco) foco.focus();
  };

  /* ---------- telas ---------- */

  Provador.prototype.render = function () {
    var p = this.estado.passo;
    if (p === 'inicio') return this.telaInicio();
    if (p === 'medir') return this.telaMedir();
    if (p === 'estimar') return this.telaEstimar();
    if (p === 'conferir') return this.telaConferir();
    if (p === 'resultado') return this.telaResultado();
  };

  Provador.prototype.telaInicio = function () {
    var self = this;
    var perfil = this.cfg.perfil.id;
    var eCalcado = perfil === 'calcado';

    this.conteudo.innerHTML =
      '<h2 class="bxfit-titulo">' + esc(this.cfg.textoTitulo) + '</h2>' +
      '<p class="bxfit-sub">' + (eCalcado
        ? 'Meça o pé ou diga a sua altura. Leva menos de um minuto.'
        : 'Duas maneiras. A primeira acerta mais.') + '</p>' +
      '<div class="bxfit-escolhas">' +
      '<button type="button" class="bxfit-escolha bxfit-escolha--forte" data-ir="medir">' +
      '<strong>Tenho uma fita métrica</strong>' +
      '<span>' + (eCalcado ? 'Meço o pé numa folha de papel' : 'Meço o corpo agora') + '</span>' +
      '<em>mais preciso</em></button>' +
      '<button type="button" class="bxfit-escolha" data-ir="estimar">' +
      '<strong>Não tenho fita agora</strong>' +
      '<span>Uso altura e peso e você confere depois</span>' +
      '<em>aproximado</em></button></div>' +
      '<p class="bxfit-nota">Nada do que você digitar sai deste navegador. Não enviamos nem guardamos em servidor nenhum.</p>';

    Array.prototype.forEach.call(this.conteudo.querySelectorAll('[data-ir]'), function (b) {
      b.addEventListener('click', function () { self.ir(b.getAttribute('data-ir')); });
    });
  };

  var INSTRUCOES = {
    busto: 'na parte mais cheia do busto, com a fita reta nas costas',
    peito: 'na parte mais larga do peito, por baixo dos braços',
    cintura: 'na parte mais fina, acima do umbigo',
    quadril: 'na parte mais larga do quadril',
    banda: 'logo abaixo do busto, com a fita firme',
    pe: 'pise numa folha, marque o calcanhar e o dedo maior, meça entre as marcas',
    punho: 'na volta do pulso, onde o relógio fica',
    entrepernas: 'do gancho até o osso do tornozelo, em pé',
  };

  Provador.prototype.telaMedir = function () {
    var self = this;
    var campos = this.cfg.perfil.medidas_do_corpo || ['busto', 'cintura', 'quadril'];
    var e = this.estado.entrada;

    this.conteudo.innerHTML =
      '<h2 class="bxfit-titulo">Suas medidas</h2>' +
      '<p class="bxfit-sub">Em centímetros. Se não souber alguma, deixe em branco.</p>' +
      '<div class="bxfit-campos">' +
      campos.map(function (c) {
        return '<label class="bxfit-campo"><span class="bxfit-rotulo">' +
          esc(Silh._nomeBonito(c)) + '</span>' +
          '<input type="number" inputmode="decimal" step="0.5" min="10" max="260" name="' + esc(c) + '" ' +
          'value="' + (e[c] == null ? '' : esc(e[c])) + '" placeholder="cm">' +
          '<small>' + esc(INSTRUCOES[c] || '') + '</small></label>';
      }).join('') +
      '</div>' +
      '<div class="bxfit-erro" hidden></div>' +
      '<div class="bxfit-acoes">' +
      '<button type="button" class="bxfit-secundario" data-ir="inicio">Voltar</button>' +
      '<button type="button" class="bxfit-principal" data-calcular>Ver meu tamanho</button></div>';

    this.ligarAcoes();
  };

  Provador.prototype.telaEstimar = function () {
    var self = this;
    var e = this.estado.entrada;
    var formatos = Object.keys(D.formatos);

    this.conteudo.innerHTML =
      '<h2 class="bxfit-titulo">Sobre você</h2>' +
      '<p class="bxfit-sub">Com isso a gente chuta suas medidas. Você confere na tela seguinte.</p>' +
      '<div class="bxfit-campos bxfit-campos--linha">' +
      '<label class="bxfit-campo"><span class="bxfit-rotulo">Altura</span>' +
      '<input type="number" inputmode="decimal" name="altura" min="60" max="260" step="1" value="' +
      (e.altura == null ? '' : esc(e.altura)) + '" placeholder="cm"><small>em centímetros</small></label>' +
      '<label class="bxfit-campo"><span class="bxfit-rotulo">Peso</span>' +
      '<input type="number" inputmode="decimal" name="peso" min="22" max="300" step="0.5" value="' +
      (e.peso == null ? '' : esc(e.peso)) + '" placeholder="kg"><small>em quilos</small></label>' +
      '<label class="bxfit-campo"><span class="bxfit-rotulo">Idade</span>' +
      '<input type="number" inputmode="numeric" name="idade" min="14" max="110" step="1" value="' +
      (e.idade == null ? '' : esc(e.idade)) + '" placeholder="anos"><small>em anos</small></label>' +
      '</div>' +
      '<fieldset class="bxfit-formato"><legend>O seu corpo se parece mais com</legend>' +
      formatos.map(function (f) {
        return '<label class="bxfit-radio"><input type="radio" name="formato" value="' + esc(f) + '"' +
          (e.formato === f ? ' checked' : '') + '><span>' + esc(D.formatos[f].rotulo) +
          '<small>' + esc(D.formatos[f].regra) + '</small></span></label>';
      }).join('') + '</fieldset>' +
      '<div class="bxfit-erro" hidden></div>' +
      '<div class="bxfit-acoes">' +
      '<button type="button" class="bxfit-secundario" data-ir="inicio">Voltar</button>' +
      '<button type="button" class="bxfit-principal" data-estimar>Continuar</button></div>';

    this.ligarAcoes();
  };

  Provador.prototype.telaConferir = function () {
    var self = this;
    var c = this.estado.corpo || {};
    var est = this.estado.estimadas || [];
    var campos = (this.cfg.perfil.medidas_do_corpo || ['busto', 'cintura', 'quadril'])
      .filter(function (k) { return c[k] != null; });

    this.conteudo.innerHTML =
      '<h2 class="bxfit-titulo">Confira antes de continuar</h2>' +
      '<p class="bxfit-sub">A gente chutou pela sua altura e peso. Chute erra: se você souber a medida de verdade, troque aqui.</p>' +
      '<div class="bxfit-campos">' +
      campos.map(function (k) {
        var e = est.indexOf(k) !== -1;
        return '<label class="bxfit-campo"><span class="bxfit-rotulo">' + esc(Silh._nomeBonito(k)) +
          (e ? ' <em class="bxfit-tag-est">chute</em>' : '') + '</span>' +
          '<input type="number" inputmode="decimal" step="0.5" name="' + esc(k) + '" value="' +
          esc(Math.round(c[k])) + '"><small>' + esc(INSTRUCOES[k] || '') + '</small></label>';
      }).join('') +
      '</div>' +
      '<div class="bxfit-acoes">' +
      '<button type="button" class="bxfit-secundario" data-ir="estimar">Voltar</button>' +
      '<button type="button" class="bxfit-principal" data-calcular>Ver meu tamanho</button></div>';

    this.ligarAcoes();
  };

  Provador.prototype.telaResultado = function () {
    var self = this;
    var r = this.estado.resultado;

    if (!r) { this.calcular(); r = this.estado.resultado; }
    if (!r) return this.ir('inicio');

    if (!r.ok) {
      this.conteudo.innerHTML =
        '<h2 class="bxfit-titulo">Não achamos um tamanho que sirva</h2>' +
        '<p class="bxfit-sub">' + esc(
          r.motivo === 'sem tamanho adequado'
            ? 'Nenhum tamanho desta peça fecha nas suas medidas.'
            : 'Faltou informação para calcular.') + '</p>' +
        (r.detalhe && r.detalhe.length
          ? '<ul class="bxfit-detalhe">' + r.detalhe.map(function (d) {
              return '<li>No maior tamanho, ' + esc(d) + '.</li>';
            }).join('') + '</ul>'
          : '') +
        '<div class="bxfit-acoes"><button type="button" class="bxfit-secundario" data-ir="inicio">Refazer</button></div>';
      this.ligarAcoes();
      evento('sem_tamanho', { produto: this.cfg.produto });
      return;
    }

    var forma = Silh.formaDoPerfil(this.cfg.perfil.id);
    var detalhada = !!this.cfg.escalaDetalhada;
    var conf = { alta: 'Bate bem com as suas medidas.', media: 'Serve, com alguma folga de leitura.', baixa: 'Leia com reserva: faltou medida ou o resultado ficou apertado entre dois tamanhos.' };

    this.conteudo.innerHTML =
      '<div class="bxfit-res">' +
      '<div class="bxfit-res-cabeca">' +
      '<span class="bxfit-res-label">' + (r.tamanhoUnico ? (r.serve ? 'Deve servir' : 'Pode não servir') : 'Seu tamanho') + '</span>' +
      '<strong class="bxfit-res-tam">' + esc(r.tamanho) + '</strong>' +
      (r.motivoAjuste ? '<span class="bxfit-res-ajuste">' + esc(r.motivoAjuste) + '</span>' : '') +
      '<span class="bxfit-res-conf bxfit-conf--' + esc(r.confianca) + '">' + esc(conf[r.confianca] || '') + '</span>' +
      '</div>' +
      '<div class="bxfit-res-corpo">' +
      '<div class="bxfit-res-svg">' + Silh.render(forma, r.regioes, { titulo: 'Caimento por região' }) + '</div>' +
      '<div class="bxfit-res-lista">' +
      '<h3>Como fica em você</h3>' +
      Silh.legenda(r.regioes, { unidade: this.cfg.unidade }) +
      (r.entreTamanhos && r.tambemServe
        ? '<p class="bxfit-entre">Você está entre dois tamanhos. O <strong>' + esc(r.tambemServe) +
          '</strong> também serve, e fica mais folgado.</p>' : '') +
      (r.grade && r.grade.aviso ? '<p class="bxfit-aviso-loja">' + esc(r.grade.aviso) + '</p>' : '') +
      '</div></div>' +
      '<div class="bxfit-acoes bxfit-acoes--res">' +
      '<button type="button" class="bxfit-secundario" data-ir="inicio">Refazer</button>' +
      (r.tamanhoUnico ? '' : '<button type="button" class="bxfit-principal" data-aplicar>Escolher ' + esc(r.tamanho) + '</button>') +
      '</div>' +
      '<button type="button" class="bxfit-limpar" data-limpar>Esquecer minhas medidas</button>' +
      '</div>';

    this.ligarAcoes();
    evento('resultado', {
      produto: this.cfg.produto, tamanho: r.tamanho,
      confianca: r.confianca, entre_tamanhos: !!r.entreTamanhos,
    });
  };

  /* ---------- acoes ---------- */

  Provador.prototype.ligarAcoes = function () {
    var self = this;
    Array.prototype.forEach.call(this.conteudo.querySelectorAll('[data-ir]'), function (b) {
      b.addEventListener('click', function () { self.ir(b.getAttribute('data-ir')); });
    });
    var est = this.conteudo.querySelector('[data-estimar]');
    if (est) est.addEventListener('click', function () { self.estimar(); });
    var calc = this.conteudo.querySelector('[data-calcular]');
    if (calc) calc.addEventListener('click', function () { self.coletar(); self.calcular(); self.ir('resultado'); });
    var ap = this.conteudo.querySelector('[data-aplicar]');
    if (ap) ap.addEventListener('click', function () { self.aplicar(); });
    var lp = this.conteudo.querySelector('[data-limpar]');
    if (lp) lp.addEventListener('click', function () {
      limparPerfil(); self.estado.entrada = {}; self.estado.corpo = null;
      self.estado.resultado = null; self.ir('inicio');
    });
  };

  Provador.prototype.coletar = function () {
    var self = this;
    Array.prototype.forEach.call(this.conteudo.querySelectorAll('input'), function (i) {
      if (i.type === 'radio') { if (i.checked) self.estado.entrada[i.name] = i.value; return; }
      var v = i.value === '' ? null : parseFloat(String(i.value).replace(',', '.'));
      if (v != null && isFinite(v)) self.estado.entrada[i.name] = v;
      else delete self.estado.entrada[i.name];
    });
    salvarPerfil(this.estado.entrada);
  };

  Provador.prototype.erro = function (msg) {
    var box = this.conteudo.querySelector('.bxfit-erro');
    if (!box) return;
    box.hidden = false;
    box.textContent = msg;
  };

  Provador.prototype.estimar = function () {
    this.coletar();
    var e = this.estado.entrada;

    var problemas = Core.validar(e);
    if (problemas.length) {
      var p = problemas[0];
      return this.erro(
        Silh._nomeBonito(p.campo) + ' de ' + p.valor + ' está fora do esperado (' +
        p.esperado[0] + ' a ' + p.esperado[1] + '). Confira se digitou na unidade certa.'
      );
    }
    if (!e.altura || !e.peso) return this.erro('Precisamos da altura e do peso para estimar.');

    e.sexo = this.cfg.sexo || 'f';
    var res = Core.completarCorpo(e, this.cfg.perfil);
    this.estado.corpo = res.corpo;
    this.estado.estimadas = res.estimadas;

    // Se a pessoa declarou o formato do corpo e a estimativa contradiz,
    // o formato manda: ele e observacao dela sobre o proprio corpo, a
    // estimativa e uma media populacional.
    if (e.formato && D.restricaoFormato[e.formato]) {
      var c = this.estado.corpo;
      if (!D.restricaoFormato[e.formato](c.busto, c.cintura, c.quadril)) {
        var ajuste = { pera: [0, 0, 10], trianguloInverso: [10, 0, 0], oval: [0, 8, 0] }[e.formato];
        if (ajuste) {
          c.busto = (c.busto || 0) + ajuste[0];
          c.quadril = (c.quadril || 0) + ajuste[2];
          c.cintura = (c.cintura || 0) + ajuste[1];
        }
      }
    }
    this.ir('conferir');
  };

  Provador.prototype.calcular = function () {
    var e = this.estado.entrada;
    var corpo = this.estado.corpo && Object.keys(this.estado.corpo).length
      ? this.estado.corpo
      : {};

    // medida digitada sempre vence estimativa
    Object.keys(e).forEach(function (k) {
      if (typeof e[k] === 'number') corpo[k] = e[k];
    });
    corpo._estimadas = (this.estado.estimadas || []).filter(function (k) {
      return typeof e[k] !== 'number';
    });

    this.estado.resultado = Core.recomendar(corpo, this.cfg.tabela, this.cfg.perfil, {
      caimento: this.cfg.caimento,
      tecido: this.cfg.tecido,
      preferencia: this.cfg.preferencia,
      disponiveis: this.cfg.disponiveis,
      escalaDetalhada: this.cfg.escalaDetalhada,
      vesteEm: this.cfg.vesteEm,
    });
  };

  Provador.prototype.aplicar = function () {
    var r = this.estado.resultado;
    if (!r || !r.ok) return;
    var o = this.cfg.opcaoTamanho;
    var res = Tema.selecionar(o.nome, o.posicao, o.valores, r.tamanho);
    evento('aplicou', { produto: this.cfg.produto, tamanho: r.tamanho, ok: res.ok, via: res.via });
    if (res.ok) { this.fechar(); }
    else {
      // Nao fingir sucesso: se nao deu pra marcar, dizer o que fazer.
      this.erro('Selecione o tamanho ' + r.tamanho + ' na página. ' +
        (res.motivo === 'esgotado' ? 'Ele está esgotado no momento.' : ''));
    }
  };

  global.BXProvador = Provador;
})(typeof window !== 'undefined' ? window : this);
