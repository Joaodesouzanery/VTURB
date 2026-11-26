/* ============================================================
   BX Provador Virtual — inicializacao
   ------------------------------------------------------------
   Le a configuracao que o Liquid deixou na pagina, normaliza a
   tabela de medidas, ancora o botao perto do seletor de tamanho
   e sobe o componente.

   Reage a shopify:section:load, senao o provador some quando o
   lojista mexe na section dentro do editor de tema.
   ============================================================ */
(function () {
  'use strict';

  var PERFIS = {
    generico:        { id: 'generico',        medidas_do_corpo: ['busto', 'cintura', 'quadril'], minRegioes: 2 },
    camisaMasculina: { id: 'camisaMasculina', medidas_do_corpo: ['peito', 'cintura', 'pescoco'], minRegioes: 2,
                       mapa: { torax: 'peito', chest: 'peito' } },
    jaqueta:         { id: 'jaqueta',         medidas_do_corpo: ['busto', 'peito', 'cintura'],   minRegioes: 1 },
    casaco:          { id: 'casaco',          medidas_do_corpo: ['busto', 'peito', 'cintura'],   minRegioes: 1 },
    calca:           { id: 'calca',           medidas_do_corpo: ['cintura', 'quadril', 'coxa', 'entrepernas'], minRegioes: 2,
                       mapa: { gancho: 'entrepernas', comprimento: 'entrepernas' } },
    saia:            { id: 'calca',            medidas_do_corpo: ['cintura', 'quadril'],                        minRegioes: 2 },
    legging:         { id: 'legging',         medidas_do_corpo: ['cintura', 'quadril', 'coxa'],  minRegioes: 2 },
    sutia:           { id: 'sutia',           medidas_do_corpo: ['banda', 'busto'],              minRegioes: 2 },
    calcado:         { id: 'calcado',         medidas_do_corpo: ['pe'],                          minRegioes: 1,
                       mapa: { comprimento: 'pe', palmilha: 'pe' } },
    relogio:         { id: 'relogio',         medidas_do_corpo: ['punho'],                       minRegioes: 1,
                       mapa: { caixa: 'punho' } },
  };

  function iniciar(raiz) {
    if (!raiz || raiz.__bxPronto) return;
    var tag = raiz.querySelector('[data-bx-config]');
    if (!tag) return;

    var cfg;
    try { cfg = JSON.parse(tag.textContent); } catch (e) { return; }

    var bruta = cfg.tabela;
    if (typeof bruta === 'string') {
      try { bruta = JSON.parse(bruta); } catch (e) { bruta = null; }
    }
    var tabela = bruta ? window.BXCore.normalizarTabela(bruta) : null;
    // Sem tabela normalizavel o provador nao aparece. Um botao que abre
    // e nao consegue responder e pior que botao nenhum.
    if (!tabela || !tabela.tamanhos.length) return;

    cfg.tabela = tabela;
    cfg.perfil = PERFIS[cfg.perfilId] || PERFIS.generico;
    cfg.preferencia = 0;

    var slot = raiz.querySelector('.bxfit-slot');
    new window.BXProvador(slot, cfg);
    raiz.__bxPronto = true;

    // Encosta o botao no seletor de tamanho, se o tema tiver um.
    // Se nao achar, a section fica onde o lojista a posicionou, que
    // e um lugar valido, so menos conveniente.
    if (cfg.ancorar) {
      try {
        var o = cfg.opcaoTamanho;
        var ancora = window.BXTheme.acharAncora(o.nome, o.posicao, o.valores);
        if (ancora && ancora.parentNode && !ancora.contains(raiz)) {
          ancora.parentNode.insertBefore(raiz, ancora.nextSibling);
        }
      } catch (e) {}
    }
  }

  function varrer() {
    var todos = document.querySelectorAll('[data-bx-provador]');
    Array.prototype.forEach.call(todos, iniciar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', varrer);
  } else {
    varrer();
  }

  document.addEventListener('shopify:section:load', function (e) {
    var alvo = e.target && e.target.querySelector
      ? e.target.querySelector('[data-bx-provador]')
      : null;
    if (alvo) { alvo.__bxPronto = false; iniciar(alvo); }
  });
})();
