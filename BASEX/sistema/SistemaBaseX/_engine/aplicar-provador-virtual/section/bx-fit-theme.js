/* ============================================================
   BX Provador Virtual — adaptador de tema
   ------------------------------------------------------------
   Unica parte do provador que toca no DOM do tema da loja.
   Objetivo: descobrir o seletor de tamanho e marcar um valor
   nele de um jeito que o tema entenda, sem conhecer o tema.

   Validado contra o markup real de Dawn 15.5, Shrine PRO 1.3.3
   e Vex TT 6.2. Nao depende de JS interno do tema (o do Shrine
   e ofuscado, entao qualquer API interna esta fora de questao).

   Ancora universal: todo tema Shopify tem
   form[action*="/cart/add"] e os controles de opcao carregam
   form="product-form-{id}" ou vivem dentro desse form.
   ============================================================ */
(function (global) {
  'use strict';

  var BXTheme = {};

  /* ---------- utilidades ---------- */

  function norm(s) {
    return String(s == null ? '' : s)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function visivel(el) {
    if (!el) return false;
    if (el.type === 'radio') {
      // radio de swatch costuma ser visualmente escondido, mas o label aparece.
      return !!(el.offsetParent || (el.labels && el.labels.length));
    }
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  /**
   * Texto visivel de um elemento, sem o ruido que os temas escondem para
   * leitor de tela. Shrine cola <span class="visually-hidden">Esgotado</span>
   * grudado no numero, entao "38" vira "38Esgotado" e nenhum casamento por
   * texto funciona. Remover o no e mais confiavel que tentar limpar a string.
   */
  function limpo(el) {
    if (!el) return '';
    var c = el.cloneNode(true);
    Array.prototype.forEach.call(
      c.querySelectorAll(
        '.visually-hidden, .visualy-hidden, .sr-only, .screen-reader-text, [hidden], [aria-hidden="true"]'
      ),
      function (n) {
        n.parentNode.removeChild(n);
      }
    );
    return c.textContent || '';
  }

  /**
   * Texto que o comprador enxerga para um controle.
   * Necessario porque nem todo tema poe o tamanho no atributo value.
   * O Vex TT, no caminho de dropdown, usa value="{option_value.id}",
   * um id numerico. Ali o unico jeito de saber que aquele radio e o "M"
   * e ler o label. Ignorar isso faz o provador marcar o tamanho errado
   * em silencio, que e pior do que nao marcar nada.
   */
  function textoDoControle(el) {
    if (!el) return '';
    if (el.tagName === 'OPTION') return limpo(el);
    var t = '';
    if (el.labels && el.labels.length) {
      t = Array.prototype.map
        .call(el.labels, function (l) {
          return limpo(l);
        })
        .join(' ');
    }
    if (!t && el.id) {
      var l2 = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (l2) t = limpo(l2);
    }
    if (!t) {
      var l3 = el.closest('label');
      if (l3) t = limpo(l3);
    }
    if (!t && el.nextElementSibling) t = limpo(el.nextElementSibling);
    return String(t).replace(/\s+/g, ' ').trim();
  }

  /** o controle representa este valor? confere value e, se falhar, o label. */
  function casaValor(el, alvoNorm) {
    if (norm(el.value) === alvoNorm) return true;
    return norm(textoDoControle(el)) === alvoNorm;
  }

  BXTheme._texto = textoDoControle;
  BXTheme._casa = casaValor;

  /* ---------- 1. achar o formulario do produto ---------- */

  /**
   * ARMADILHA: nunca use form.id aqui.
   * HTMLFormElement tem named getter: como todo formulario de produto da
   * Shopify carrega <input name="id"> (o id da variante), form.id devolve
   * esse INPUT, nao a string do atributo id. Usar form.id faz o seletor
   * [form="..."] virar "[object HTMLInputElement]" e o provador simplesmente
   * nao acha o seletor de tamanho em nenhuma loja de verdade.
   */
  function idDoForm(f) {
    return f ? f.getAttribute('id') : null;
  }
  BXTheme._idDoForm = idDoForm;

  BXTheme.acharForm = function (raiz) {
    var doc = raiz || document;
    var cands = Array.prototype.slice.call(
      doc.querySelectorAll('form[action*="/cart/add"]')
    );
    if (!cands.length) return null;
    // Prefere o form que tem seletor de opcao dentro ou apontando pra ele.
    for (var i = 0; i < cands.length; i++) {
      var f = cands[i];
      var fid = idDoForm(f);
      if (fid && doc.querySelector('[form="' + CSS.escape(fid) + '"]')) return f;
      if (f.querySelector('input[type="radio"], select')) return f;
    }
    return cands[0];
  };

  /* ---------- 2. achar os controles de uma opcao ---------- */

  /**
   * Devolve todos os controles que representam a opcao `nomeOpcao`.
   * Estrategias em ordem de confianca, da mais especifica pra mais frouxa.
   *
   * @param {string} nomeOpcao  nome exato vindo do Liquid (ex: "Tamanho")
   * @param {number} posicao    option.position do Liquid (1..3)
   * @param {string[]} valores  valores validos da opcao, vindos do Liquid
   */
  BXTheme.acharControles = function (nomeOpcao, posicao, valores) {
    var form = BXTheme.acharForm();
    var escopo = form || document;
    var formId = idDoForm(form);
    var alvo = norm(nomeOpcao);
    var achados = [];

    function coleta(lista, via) {
      var arr = Array.prototype.slice.call(lista);
      if (arr.length) achados.push({ via: via, els: arr });
    }

    // Busca tanto dentro do form quanto em elementos com form="<id>",
    // porque Dawn e Shrine deixam o variant-picker FORA do <form>.
    function busca(raiz, sel) {
      try {
        return Array.prototype.slice.call(raiz.querySelectorAll(sel));
      } catch (e) {
        // seletor invalido em algum navegador antigo: nao derruba o provador
        return [];
      }
    }

    function q(sel) {
      var a = busca(escopo, sel);
      function junta(lista) {
        lista.forEach(function (el) {
          if (a.indexOf(el) === -1) a.push(el);
        });
      }
      // Dawn e Shrine deixam o variant-picker FORA do <form>, ligado pelo
      // atributo form="{id}". O atributo tem que vir DEPOIS do seletor de
      // tipo, senao o CSS e invalido e o querySelectorAll lanca excecao.
      if (formId) {
        var f = '[form="' + CSS.escape(formId) + '"]';
        junta(busca(document, sel + f));
        junta(busca(document, f + ' ' + sel));
      }
      // wrappers conhecidos, soltos na pagina
      busca(
        document,
        'variant-selects, variant-radios, variant-picker, .product-form__input, [data-variant-picker]'
      ).forEach(function (w) {
        junta(busca(w, sel));
      });
      return a;
    }

    // (a) Dawn 15+: data-option-name no proprio input/option
    coleta(
      q('[data-option-name]').filter(function (el) {
        return norm(el.getAttribute('data-option-name')) === alvo;
      }),
      'data-option-name'
    );

    // (b) select nomeado options[Nome] (Dawn dropdown)
    coleta(
      q('select').filter(function (el) {
        var n = el.getAttribute('name') || '';
        return norm(n) === 'options[' + alvo + ']' || norm(n).indexOf(alvo) === 0;
      }),
      'select[name]'
    );

    // (c) radios cujo name comeca com o nome da opcao
    //     Dawn: name="Tamanho-2"   Shrine: name="Tamanho"
    coleta(
      q('input[type="radio"]').filter(function (el) {
        var n = norm(el.getAttribute('name') || '');
        return n === alvo || n.indexOf(alvo + '-') === 0 || n.indexOf(alvo) === 0;
      }),
      'radio[name]'
    );

    // (d) Vex TT e parentes: data-option-position no input
    if (posicao) {
      coleta(
        q('[data-option-position="' + posicao + '"]'),
        'data-option-position'
      );
      // (d2) Vex dropdown: name="{form_id}-option{position}"
      coleta(
        q('input[type="radio"]').filter(function (el) {
          return new RegExp('-option' + posicao + '$').test(
            el.getAttribute('name') || ''
          );
        }),
        'radio[name -optionN]'
      );
      // (d3) id no padrao "{sectionId}-{position}-{index}" (Dawn, Shrine)
      coleta(
        q('input[type="radio"]').filter(function (el) {
          return new RegExp('-' + posicao + '-\\d+$').test(el.id || '');
        }),
        'radio[id posicao]'
      );
    }

    // (e) ultimo recurso: agrupa por name e aceita o grupo cujo conjunto
    //     de rotulos visiveis bate exatamente com os valores do Liquid.
    //     Casa por texto tambem, porque tema que usa id numerico no value
    //     (Vex) nunca bateria so por value.
    if (valores && valores.length) {
      var porNome = {};
      q('input[type="radio"]').forEach(function (el) {
        var n = el.getAttribute('name') || '';
        (porNome[n] = porNome[n] || []).push(el);
      });
      Object.keys(porNome).forEach(function (n) {
        var rotulos = porNome[n].map(function (e) {
          return norm(e.value) || norm(textoDoControle(e));
        });
        var porTexto = porNome[n].map(function (e) {
          return norm(textoDoControle(e));
        });
        var bate = valores.filter(function (v) {
          var nv = norm(v);
          return rotulos.indexOf(nv) !== -1 || porTexto.indexOf(nv) !== -1;
        }).length;
        if (bate === valores.length && porNome[n].length === valores.length) {
          coleta(porNome[n], 'radio[rotulos batem]');
        }
      });
    }

    return achados;
  };

  /* ---------- 3. marcar um valor ---------- */

  /**
   * Marca `valor` no seletor da opcao. Devolve {ok, via} pra podermos
   * logar honestamente quando nao deu, em vez de fingir que deu.
   */
  BXTheme.selecionar = function (nomeOpcao, posicao, valores, valor) {
    var grupos = BXTheme.acharControles(nomeOpcao, posicao, valores);
    var alvo = norm(valor);

    for (var g = 0; g < grupos.length; g++) {
      var via = grupos[g].via;
      var els = grupos[g].els;

      // select: seta value e dispara change
      var sel = els.filter(function (e) {
        return e.tagName === 'SELECT';
      })[0];
      if (sel) {
        var opt = Array.prototype.slice.call(sel.options).filter(function (o) {
          return casaValor(o, alvo);
        })[0];
        if (opt && !opt.disabled) {
          sel.value = opt.value;
          disparar(sel);
          return { ok: true, via: via + ' (select)', marcado: textoDoControle(opt) || opt.value };
        }
      }

      // <option> solto (o data-option-name do Dawn cai aqui)
      var optSolto = els.filter(function (e) {
        return e.tagName === 'OPTION' && casaValor(e, alvo);
      })[0];
      if (optSolto && optSolto.parentElement) {
        var pai = optSolto.parentElement;
        pai.value = optSolto.value;
        disparar(pai);
        return { ok: true, via: via + ' (option)', marcado: textoDoControle(optSolto) || optSolto.value };
      }

      // radio: click() e melhor que .checked porque dispara input+change
      // e acorda handler preso ao label.
      var radio = els.filter(function (e) {
        return e.type === 'radio' && casaValor(e, alvo);
      })[0];
      if (radio) {
        if (radio.disabled) return { ok: false, via: via, motivo: 'esgotado' };
        if (radio.checked) return { ok: true, via: via + ' (ja marcado)', marcado: textoDoControle(radio) || radio.value };
        try {
          radio.click();
        } catch (e) {
          radio.checked = true;
        }
        if (!radio.checked) radio.checked = true;
        disparar(radio);
        return { ok: true, via: via + ' (radio)', marcado: textoDoControle(radio) || radio.value };
      }
    }

    return { ok: false, motivo: 'controle nao encontrado' };
  };

  function disparar(el) {
    ['input', 'change'].forEach(function (t) {
      el.dispatchEvent(new Event(t, { bubbles: true }));
    });
    // Alguns temas escutam no custom element, nao no input.
    var w = el.closest(
      'variant-selects, variant-radios, variant-picker, [data-variant-picker]'
    );
    if (w && w !== el) {
      w.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /* ---------- 4. onde ancorar o botao ---------- */

  /**
   * Acha o melhor ponto pra inserir o link "descubra seu tamanho":
   * logo abaixo do grupo de tamanho. Se nao achar, devolve null e a
   * section se renderiza no lugar onde foi posicionada no tema.
   */
  BXTheme.acharAncora = function (nomeOpcao, posicao, valores) {
    var grupos = BXTheme.acharControles(nomeOpcao, posicao, valores);
    if (!grupos.length) return null;
    var el = grupos[0].els[0];
    if (!el) return null;
    var box = el.closest(
      'fieldset, .product-form__input, .product-form__input__type, variant-selects > *, [data-variant-picker] > *'
    );
    return box || el.parentElement;
  };

  /* ---------- 5. diagnostico ---------- */

  BXTheme.diagnostico = function (nomeOpcao, posicao, valores) {
    var form = BXTheme.acharForm();
    var grupos = BXTheme.acharControles(nomeOpcao, posicao, valores);
    return {
      form: form ? idDoForm(form) || '(sem id)' : null,
      grupos: grupos.map(function (g) {
        return {
          via: g.via,
          n: g.els.length,
          valores: g.els.map(function (e) {
            return e.value;
          }),
          visiveis: g.els.filter(visivel).length,
        };
      }),
    };
  };

  global.BXTheme = BXTheme;
})(typeof window !== 'undefined' ? window : this);
