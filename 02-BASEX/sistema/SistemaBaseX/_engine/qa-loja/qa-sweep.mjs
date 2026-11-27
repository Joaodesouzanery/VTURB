#!/usr/bin/env node
/**
 * qa-sweep.mjs — Gate A do [[gate-entrega-site-tema]] (Clone Wave 8, 23/09/2026).
 *
 * Renderiza 1 de cada tipo de template (PDP, colecao, home, carrinho) em
 * mobile 390 + desktop 1280 e ASSERTA invariantes duros. Qualquer falha = BLOQUEIA
 * a entrega ("pronto" so depois de sweep verde).
 *
 * Nasceu do clone um clone de loja: 4 bugs mobile chegaram ao o dono da loja (galeria 1fr blowout,
 * badge de review na borda, cross-sell cobrindo itens, reviews sem foto) porque a
 * verificacao mobile ao vivo foi pulada. Este sweep pega todos por medicao, sem olho.
 *
 * DOIS modos de uso:
 *  1) Via Playwright MCP (default do agente): `node qa-sweep.mjs --plan ...` imprime
 *     as URLs de preview + a funcao assertPage() pra colar em browser_evaluate.
 *  2) Standalone: `node qa-sweep.mjs --run ...` usa o pacote `playwright` se instalado
 *     (npm i -D playwright), senao explica como rodar via MCP.
 *
 * NUNCA aprovar por print a olho — a MEDIDA (getBoundingClientRect/getComputedStyle)
 * e a prova. Preview do draft: `?preview_theme_id=<id>` (headless com perfil temporario, Chrome do
 * sistema ou Chromium do Playwright: navegador.mjs; nao mexe no Chrome do usuario).
 */
import { carregarPlaywright, abrirNavegador } from './navegador.mjs';

// 375 = iPhone SE/mini (onde a galeria estoura primeiro); 1024 = notebook pequeno
// (faixa 990-1064 em que o header ax-* estourou numa loja, 25/09/2026).
const VIEWPORTS = [
  { name: 'mobile-sm', width: 375, height: 667 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'laptop-sm', width: 1024, height: 768 },
  { name: 'desktop', width: 1280, height: 900 },
];

// ---- Funcao que roda NO NAVEGADOR (via browser_evaluate ou page.evaluate). ----
// Retorna { pass, failures[], avisos[], metrics }. Colar como corpo de browser_evaluate.
// failures[] reprovam a pagina; avisos[] aparecem no relatorio e NAO reprovam (checagem nova sem
// falso positivo medido entra como aviso). E async desde 16/10/2026 (rola a pagina e le os contadores
// duas vezes): page.evaluate, browser_evaluate e Runtime.evaluate(awaitPromise) esperam a Promise.
async function assertPage() {
  // 0) Pre-condicoes (15/10/2026, lojas de teste): sem elas a medida e do bloqueio ou do cache,
  //    nao do tema. Devolvem pass:false com a causa nomeada, e o executor repete em vez de medir.
  //    BLOQUEIO_DA_LOJA: o headless recebeu o desafio de bot da loja (429), nao a pagina.
  if (/^\s*(verifying your connection|um momento|just a moment|checking your browser|confirme que)/i.test(document.title || '')) {
    return { pass: false, blocked: true, failures: ['BLOQUEIO_DA_LOJA: "' + document.title + '" (desafio de bot, nao e medida do tema: esperar ~2 min e repetir)'], metrics: {} };
  }
  //    LIQUID_ERROR (16/10/2026, obs. 0065): erro do motor de template impresso na pagina reprova sempre, e vem antes
  //    das medidas porque a medida que ele derruba aponta para o lugar errado. Caso real (16/10/2026): colecao verde
  //    nas 4 combinacoes com 8x "Liquid error (snippets/... line 72): Could not find asset snippets/icon-close.liquid",
  //    e duas colecoes reprovadas so por OVERFLOW_H, cuja causa era o texto de um "Liquid syntax error" no cartao.
  //    Le o texto visivel E o HTML sem <script>/<style> (erro dentro de elemento escondido tambem conta).
  const reLiquid = /Liquid (?:syntax )?error[^\n<"]{0,140}/gi;
  const liqVis = ((document.body && document.body.innerText) || '').match(reLiquid) || [];
  const liqHtml = ((document.body && document.body.innerHTML) || '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').match(reLiquid) || [];
  const liqMsgs = [...new Set([...liqVis, ...liqHtml].map((m) => m.replace(/\s+/g, ' ').trim()))];
  const falhaLiquid = liqMsgs.length ? 'LIQUID_ERROR(' + Math.max(liqVis.length, liqHtml.length) + '): ' + liqMsgs.slice(0, 3).join(' | ') : null;
  //    CSS_NAO_CARREGADO: asset de tema com <link> no HTML e ainda sem regras (recem-gravado, ainda nao servido).
  const cssPendente = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .filter((l) => {
      if (l.disabled || !/\/(cdn\/shop\/t\/\d+|t\/\d+)\/assets\//.test(l.href)) return false;
      if (!l.sheet) return true;                      // ainda carregando
      try { return l.sheet.cssRules.length === 0; }   // carregou vazio (404 da versao nova do asset)
      catch (e) { return false; }                     // outra origem: nao da para ler, nao bloqueia
    })
    .map((l) => l.href.split('?')[0].split('/').pop());
  if (cssPendente.length) {
    return { pass: false, cssPending: cssPendente, failures: ['CSS_NAO_CARREGADO(' + cssPendente.length + '): ' + cssPendente.slice(0, 4).join(', ') + ' (recarregar e repetir antes de medir)', ...(falhaLiquid ? [falhaLiquid] : [])], metrics: {} };
  }

  const vw = window.innerWidth;
  const failures = falhaLiquid ? [falhaLiquid] : [];
  const de = document.documentElement;

  // 1) Zero overflow horizontal da pagina (pega o grid `1fr` blowout).
  if (de.scrollWidth > de.clientWidth + 2) {
    failures.push('OVERFLOW_H: scrollWidth ' + de.scrollWidth + ' > clientWidth ' + de.clientWidth);
  }

  // 2) Nenhum elemento visivel mais largo que o viewport (a causa raiz do "esticando").
  const wide = [];
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > vw + 4 && r.height > 4) {
      const cs = getComputedStyle(el);
      // ancestral (fora html/body) que recorta dentro da tela = intencional
      // (marquee de anuncio, carrossel). Sem isso o track do marquee vira falso positivo.
      let a = el.parentElement, clipped = false;
      while (a && a !== document.body) {
        const acs = getComputedStyle(a);
        if (acs.overflowX !== 'visible' && a.getBoundingClientRect().width <= vw + 4) { clipped = true; break; }
        a = a.parentElement;
      }
      if (cs.overflowX === 'visible' && !clipped) {
        wide.push((el.tagName + '.' + String(el.className || '').split(' ')[0]).slice(0, 40) + '=' + Math.round(r.width) + 'px');
      }
    }
  });
  if (wide.length) failures.push('WIDE_ELEMENTS(' + wide.length + '): ' + wide.slice(0, 5).join(', '));

  // 3) Galeria da PDP cabe no container (nao 2-3x). Cobre varios prefixos de tema.
  const stage = document.querySelector('.product__media, .gallery-stage, [class*="gallery__stage"], .product-media');
  if (stage) {
    const sw = Math.round(stage.getBoundingClientRect().width);
    const cw = Math.round((stage.parentElement || stage).getBoundingClientRect().width);
    if (sw > vw + 4) failures.push('GALLERY_OVERFLOW: stage ' + sw + 'px > viewport ' + vw);
  }

  // 4) Reviews: cada card tem foto (se a section existir) e nada estoura o card.
  const cards = document.querySelectorAll('.bv-vrev__card, [class*="review"][class*="card"], .mrev__card');
  let noPhoto = 0, badgeOverflow = 0;
  cards.forEach((c) => {
    if (!c.querySelector('img')) noPhoto++;
    c.querySelectorAll('*').forEach((el) => {
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX === 'visible') badgeOverflow++;
    });
  });
  if (cards.length && noPhoto > 0) failures.push('REVIEWS_NO_PHOTO: ' + noPhoto + '/' + cards.length + ' cards sem foto');
  if (badgeOverflow > 0) failures.push('REVIEW_BADGE_OVERFLOW: ' + badgeOverflow + ' elementos estourando o card');

  // 5) Sem area morta lateral (conteudo espremido).
  const main = document.querySelector('main, #MainContent, .content-for-layout');
  if (main) {
    const ratio = main.getBoundingClientRect().width / vw;
    if (ratio < 0.8) failures.push('AREA_MORTA: main/janela=' + ratio.toFixed(2) + ' (<0.8)');
  }

  // 6) Imagens otimizadas (peso e resolucao) — pega o "site pesado":
  //    imagem servida em resolucao CHEIA (sem transform ?width=) num slot pequeno.
  //    A CDN da Shopify ja serve webp; o peso vem da RESOLUCAO, nao do formato.
  let imgWeightKB = 0, noWidth = 0; const oversized = [];
  // Original servido no tamanho do slot nao e 'full-res num slot pequeno': o srcset do Dawn traz o
  // proprio original como candidato (image_url sem width). Caso uma loja 08/10/2026: galeria da PDP com
  // original de 800px num slot de 728px, 37-67KB, contada como IMG_SEM_WIDTH. So conta se estiver grande.
  const shown = new Map();
  document.querySelectorAll('img').forEach((i) => { if (i.currentSrc) shown.set(i.currentSrc.replace(/^https?:/, ''), i); });
  performance.getEntriesByType('resource').forEach((r) => {
    if (r.initiatorType === 'img' || /\.(webp|jpg|jpeg|png|avif)(\?|$)/i.test(r.name)) {
      imgWeightKB += (r.transferSize || r.encodedBodySize || 0) / 1024;
      // SVG e vetor: nao tem resolucao e o CDN ignora &width= (falso positivo nos icones de pagamento/garantia, uma loja 28/09/2026)
      // Sufixo legado de tamanho (_480x, _480x640) tambem e imagem reduzida: o video_tag da Shopify
      // (image_size: '480x') so gera esse formato. Falso positivo medido na uma loja 08/10/2026: poster
      // _480x = 480px contra 720px do original.
      // uma loja 14/10/2026: sufixo so de altura (_x320, logo pre-carregada) tambem e tamanho legado, e arquivo abaixo
      // de 30 KB nao e 'resolucao cheia' (miniatura de video 23 KB, logo do banner de cookies 2 KB): o alvo da regra e peso.
      if (/cdn\/shop|cdn\.shopify/.test(r.name) && !/[?&]width=/.test(r.name) && !/_\d*x\d*\.(jpe?g|png|webp|gif)(\?|$)/i.test(r.name) && !/\.svg(\?|$)/i.test(r.name) && ((r.transferSize || r.encodedBodySize || 0) / 1024) >= 30) {
        const im = shown.get(r.name.replace(/^https?:/, ''));
        if (!(im && im.naturalWidth && im.naturalWidth <= im.getBoundingClientRect().width * 2.5)) noWidth++;
      }
    }
  });
  // Imagem por imagem (16/10/2026, uma loja): o limiar so por contagem (> 2 por pagina) deixava passar UMA imagem
  // com qualquer razao (foto da gaveta a 2,38x com 40/40 verde, banner de 3000px num slot de 300px). Agora:
  // a lista de toda imagem acima de 2,5x e a maior razao vao em metrics mesmo quando a pagina passa; uma imagem
  // acima de 4x reprova sozinha; a tolerancia de ate duas vale so na faixa 2,5x a 4x.
  // Razao = pixel natural por pixel exibido do CONTEUDO: object-fit:cover recorta (conta o eixo que preenche),
  // contain encolhe (conta o eixo que limita). SVG nao tem resolucao (mesmo motivo do IMG_SEM_WIDTH).
  // Imagem de app de pop-up (obs. 0114, uma loja 19/10/2026): a foto do formulario do Klaviyo (img.needsclick, configurada
  // no editor do Klaviyo, fora do tema) reprovava so a primeira medida de cada contexto novo, que e quando o pop-up abre.
  // Fica fora da reprovacao e do imgMaxRatio e vira o aviso APP_IMG_OVERSIZED com o app nomeado.
  // shortcut: marcadores de 5 apps de pop-up; acrescentar o de outro app quando ele aparecer no relatorio.
  const APPS_POPUP = [['Klaviyo', '.needsclick, [class*="kl-private"], [class*="klaviyo"]'], ['Privy', '[class*="privy"], [id*="privy"]'], ['Omnisend', '[class*="omnisend"]'], ['Justuno', '[class*="justuno"], [id*="justuno"]'], ['Wisepops', '[class*="wisepops"]']];
  const appOversized = [];
  let imgMaxRatio = 0;
  document.querySelectorAll('img').forEach((i) => {
    const b = i.getBoundingClientRect(), d = b.width, h = b.height, n = i.naturalWidth, nh = i.naturalHeight;
    if (!(d > 4 && n)) return;
    if (/\.svg(\?|#|$)|^data:image\/svg/i.test(i.currentSrc || i.src || '')) return;
    const fit = getComputedStyle(i).objectFit;
    let r = n / d;
    if (h > 4 && nh) {
      if (fit === 'cover') r = Math.min(n / d, nh / h);
      else if (fit === 'contain' || fit === 'scale-down') r = Math.max(n / d, nh / h);
    }
    const app = APPS_POPUP.find(([, s]) => i.closest(s));
    const txt = ((i.className || '').split(' ')[0] || 'img') + ' ' + Math.round(n) + '>' + Math.round(d) + 'px ' + r.toFixed(2) + 'x';
    if (app) { if (r > 2.5) appOversized.push(app[0] + ': ' + txt); return; }
    if (r > imgMaxRatio) imgMaxRatio = r;
    if (r > 2.5) oversized.push({ r, txt });
  });
  oversized.sort((a, b) => b.r - a.r);
  const acima4 = oversized.filter((o) => o.r > 4).length;
  const weightCap = vw <= 500 ? 4500 : 9000; // KB: mobile 4.5MB, desktop 9MB
  if (imgWeightKB > weightCap) failures.push('IMG_WEIGHT: ' + Math.round(imgWeightKB) + 'KB > cap ' + weightCap + 'KB (img sem &width= em resolucao cheia?)');
  if (acima4 || oversized.length > 2) failures.push('IMG_OVERSIZED(' + oversized.length + '): ' + oversized.slice(0, 4).map((o) => o.txt).join(', ') + (acima4 ? ' (' + acima4 + ' acima de 4x: reprova sozinha' : ' (mais de 2 entre 2,5x e 4x') + '; falta &width= no <img>/srcset)');
  if (noWidth > 3) failures.push('IMG_SEM_WIDTH: ' + noWidth + ' imgs cdn sem &width= (full-res)');

  // 7) Zoom do iOS: campo com font-size < 16px faz o Safari do iPhone ampliar a
  //    pagina ao tocar, e ela fica "com zoom" e cortada. Conta INCLUSIVE opacity:0
  //    (select nativo invisivel por cima de botao custom, ex.: seletor de pais do
  //    rodape): o toque dispara o zoom igual. Caso de uma loja, 25/09/2026.
  //    Obs.: o WebKit desktop do Playwright ignora font-size em <select> (mede 13px
  //    sempre); medir em Chromium.
  if (vw < 990) {
    const tiny = [...document.querySelectorAll('select, textarea, input:not([type=radio]):not([type=checkbox]):not([type=hidden]):not([type=submit]):not([type=button])')]
      .filter((e) => e.getBoundingClientRect().width > 0 && parseFloat(getComputedStyle(e).fontSize) < 16)
      .map((e) => (e.name || e.id || e.tagName) + '=' + getComputedStyle(e).fontSize);
    if (tiny.length) failures.push('IOS_ZOOM_INPUT<16px(' + tiny.length + '): ' + tiny.slice(0, 4).join(', '));
  }

  const avisos = [];
  if (appOversized.length) avisos.push('APP_IMG_OVERSIZED(' + appOversized.length + '): ' + appOversized.slice(0, 4).join(', ') + ' (imagem do app de pop-up, fora do tema: nao reprova; corrigir no editor do app)');
  const visivel = (e, opac) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && (!e.checkVisibility || e.checkVisibility({ checkOpacity: opac !== false, checkVisibilityCSS: true })); };
  const rotulo = (e) => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : '');

  // 8) Gaveta VAZIA (16/10/2026, uma loja): a gaveta so era medida com item; a vazia saiu com o cabecalho no pe,
  //    dois X e "Subtotal" a mostra nas 4 gavetas com 40/40 verde. Mede quando a gaveta esta ABERTA e o
  //    /cart.js (JSON) diz 0 itens: reprova com mais de um botao de fechar visivel, .drawer__heading visivel,
  //    texto de subtotal visivel ou a mensagem de carrinho vazio escondida. Gaveta nao reconhecida, fechada ou
  //    /cart.js sem JSON: metrics.gavetaVazia = null (o runner registra o aviso GAVETA_VAZIA_NAO_MEDIDA).
  let gavetaVazia = null, gavetaAberta = false;
  const raizG = document.querySelector('cart-drawer') || document.querySelector('#CartDrawer, #cart-drawer, .cart-drawer');
  if (raizG) {
    const painel = raizG.querySelector('.drawer__inner') || raizG;
    const pr = painel.getBoundingClientRect();
    gavetaAberta = visivel(painel, false) && pr.left < vw - 10 && pr.right > 10 && pr.top < innerHeight && pr.bottom > 0;
    let itens = null;
    if (gavetaAberta) {
      try { const t = await (await fetch('/cart.js', { headers: { Accept: 'application/json' } })).text(); if (/^\s*\{/.test(t)) itens = JSON.parse(t).item_count; } catch (e) { itens = null; }
    }
    if (gavetaAberta && itens === 0) {
      const fechar = [...raizG.querySelectorAll('button, a, [role="button"]')].filter((e) => visivel(e) && /close|fechar|schlie|cerrar|chiudi|fermer|sluit|zamknij|lukk/i.test((e.getAttribute('aria-label') || '') + ' ' + (typeof e.className === 'string' ? e.className : '') + ' ' + (e.getAttribute('name') || ''))).length;
      const titulo = [...raizG.querySelectorAll('.drawer__heading')].filter((e) => visivel(e)).length;
      const subtotal = [...raizG.querySelectorAll('*')].some((e) => e.children.length === 0 && /subtotal|sous-total|zwischensumme|subtotale|totale parziale/i.test(e.textContent || '') && visivel(e));
      const msg = [...raizG.querySelectorAll('.cart__empty-text, .drawer__inner-empty, [class*="empty"]')].some((e) => /\S/.test(e.textContent || '') && visivel(e));
      gavetaVazia = { fechar, titulo, subtotal, msg };
      const ruim = [];
      if (fechar > 1) ruim.push(fechar + ' botoes de fechar visiveis');
      if (titulo) ruim.push('.drawer__heading visivel');
      if (subtotal) ruim.push('subtotal visivel');
      if (!msg) ruim.push('mensagem de carrinho vazio nao visivel');
      if (ruim.length) failures.push('GAVETA_VAZIA: ' + ruim.join(', '));
      if (!fechar) avisos.push('GAVETA_VAZIA_SEM_FECHAR: nenhum botao de fechar reconhecido (aria-label/classe) na gaveta vazia');
    }
  }

  // 9) AVISOS de layout e conteudo (16/10/2026). Entram como aviso porque ainda nao tem falso positivo medido
  //    num corpus: aparecem em avisos[] e no placar, NAO reprovam. Promover a reprovacao so com os tres numeros
  //    medidos (acertos, quantos sao defeito, normalizacao do resto).
  // 9a) Botao de compra dos cards da mesma linha alinhado (<= 2px). Titulo que quebra em 2-3 linhas empurra o
  //     botao; cada card isolado esta certo, o defeito e relativo entre irmaos (uma loja, colecao, 15/10/2026).
  const SEL_CARD = '.product-card-wrapper, .card-wrapper, .product-card, .product-item, .grid-product, [class*="product-card"]';
  const SEL_COMPRA = 'button[type="submit"], button[name="add"], .quick-add__submit, [class*="add-to-cart" i], [class*="addtocart" i]';
  const cardsP = [...document.querySelectorAll(SEL_CARD)].filter((c) => !(c.parentElement && c.parentElement.closest(SEL_CARD)) && visivel(c, false));
  const linhas = [];
  const descentrados = [];
  cardsP.forEach((c) => {
    const bs = [...c.querySelectorAll(SEL_COMPRA + ', .button, .btn')].filter((b) => visivel(b, false) && (b.matches(SEL_COMPRA) || /add|cart|buy|bag|choose|select|option|comprar|adicionar|ajouter|hinzuf|aggiungi|toevoegen|warenkorb/i.test(b.textContent || '')));
    const b = bs[bs.length - 1];
    if (!b) return;
    const t = c.getBoundingClientRect().top + scrollY, bt = b.getBoundingClientRect().top + scrollY;
    let l = linhas.find((x) => Math.abs(x.t - t) <= 2);
    if (!l) linhas.push(l = { t, bt: [] });
    l.bt.push(Math.round(bt));
    const ab = b.getBoundingClientRect(), svg = b.querySelector('svg');
    if (svg && !(b.textContent || '').trim() && ab.width < 60 && Math.abs(ab.width - ab.height) <= 4) {
      const sb = svg.getBoundingClientRect();
      if (Math.abs((ab.top + ab.bottom) / 2 - (sb.top + sb.bottom) / 2) > 3 || Math.abs((ab.left + ab.right) / 2 - (sb.left + sb.right) / 2) > 3) descentrados.push(rotulo(b));
    }
  });
  const desal = linhas.filter((l) => l.bt.length > 1 && Math.max(...l.bt) - Math.min(...l.bt) > 2);
  if (desal.length) avisos.push('CARD_BTN_DESALINHADO(' + desal.length + ' linha(s)): ' + desal.slice(0, 3).map((l) => 'linha y=' + Math.round(l.t) + ' botoes em ' + l.bt.join(',')).join(' ; '));
  if (descentrados.length) avisos.push('BTN_ICONE_FORA_DO_CENTRO(' + descentrados.length + '): ' + [...new Set(descentrados)].slice(0, 3).join(', '));

  // 9b) PDP: nota/estrelas perto do titulo dentro de a[href] com cursor:pointer (o padrao da casa e
  //     <a href="#reviews">). Caso real (15/10/2026): nota TrustScore sem cara de clicavel com Gate A verde.
  //     Widget com role="button" e cursor:pointer que rola ate as avaliacoes tambem e clicavel: no corpus de
  //     16/10/2026 (94 paginas, 17 lojas) foram os 12 acertos da regra so com a[href], todos falsos.
  const mProd = location.pathname.match(/\/products\/([^/?#]+)/);
  if (mProd) {
    const tit = ['.product__title h1', '.product__title', 'h1.product-title', '.product-single__title', 'main h1', 'h1'].map((s) => document.querySelector(s)).find((e) => e && visivel(e, false));
    if (tit) {
      const tr = tit.getBoundingClientRect();
      const box = tit.closest('.product__info-container, .product__info-wrapper, .product-single__meta, [class*="product__info"], [class*="product-info"]') || (tit.parentElement && tit.parentElement.parentElement) || document.body;
      const ehNota = (e) => /★|☆|trustscore|\b[0-5][.,]\d\s*(\/\s*5|out of 5|stars?|estrelas?|sterne|étoiles|stelle)|\(\s*\d+\s*(reviews?|avalia|bewertung|avis|recensioni|reseñas|opiniones)/i.test(e.textContent || '') || /(^|[\s_-])(rating|stars?|jdgm-prev-badge|loox-rating|trustpilot|yotpo|okendo|stamped)(?=$|[\s_-])/i.test(typeof e.className === 'string' ? e.className : '');
      const cands = [...box.querySelectorAll('*')].filter((e) => {
        if (tit.contains(e) || e.children.length > 8 || !ehNota(e) || !visivel(e, false)) return false;
        const r = e.getBoundingClientRect();
        return r.height < 80 && r.top - tr.bottom <= 160 && tr.top - r.bottom <= 160;
      });
      const folhas = cands.filter((e) => !cands.some((o) => o !== e && e.contains(o)));
      if (folhas.length && !folhas.some((e) => { const a = e.closest('a[href], button, [role="button"], [role="link"]'); return a && getComputedStyle(a).cursor === 'pointer'; })) {
        avisos.push('PDP_NOTA_SEM_LINK: ' + rotulo(folhas[0]) + ' "' + (folhas[0].textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50) + '" perto do titulo fora de a[href] (ou botao) com cursor:pointer');
      }
    }
  }

  // 9c) Barra de anuncio com texto cortado (overflow escondido e scrollHeight > clientHeight + 2), so no topo
  //     da pagina; letreiro animado e slider vertical (filhos da altura da barra) ficam de fora.
  const anuncios = [];
  document.querySelectorAll('[class*="announcement"], [id*="announcement"], [class*="-ann"]').forEach((el) => {
    if (!visivel(el) || el.closest('[class*="marquee"], [class*="ticker"]')) return;
    if (el.getBoundingClientRect().top + scrollY > 300 || !el.clientHeight) return;
    if (!(el.scrollHeight > el.clientHeight + 2) || getComputedStyle(el).overflowY === 'visible') return;
    const filhos = [...el.children];
    if (filhos.length >= 2 && filhos.every((c) => Math.abs(c.offsetHeight - el.clientHeight) <= 2)) return;
    if (el.getAnimations && el.getAnimations({ subtree: true }).some((a) => a.playState === 'running')) return;
    anuncios.push(rotulo(el) + ' ' + el.scrollHeight + '>' + el.clientHeight);
  });
  if (anuncios.length) avisos.push('ANUNCIO_CORTADO(' + anuncios.length + '): ' + anuncios.slice(0, 3).join(', '));

  // 9d) Encaixe do texto no idioma em que a pagina e medida (obs. 0041): elemento com texto proprio e overflow
  //     escondido ou line-clamp nao pode ter scrollHeight > clientHeight + 1 nem scrollWidth > clientWidth + 1.
  //     innerText inclui o que o clamp cortou, entao "traducao presente" nao prova "traducao que cabe".
  //     Carrossel, letreiro, visually-hidden, aria-hidden, link de pular e icone por ligadura (fonte de icone com
  //     o nome do icone como texto) ficam de fora (normalizacao do prototipo encaixe-site e da conferencia de idioma).
  const SKIP_ENC = 'slider-component, .slider, [class*="carousel"], [class*="marquee"], [class*="ticker"], [class*="swiper"], [class*="splide"], .visually-hidden, .sr-only, [class*="skip-to"], [class*="skip-link"], [class*="material-icons"], [class*="material-symbols"], noscript, template, script, style, [aria-hidden="true"]';
  const oculto = (v) => v === 'hidden' || v === 'clip';
  const cortados = [];
  for (const e of document.body.querySelectorAll('*')) {
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'inline' || cs.display === 'none' || cs.display === 'contents') continue;
    const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
    const corteH = oculto(cs.overflowX) && e.scrollWidth > e.clientWidth + 1;
    const corteV = (oculto(cs.overflowY) || clamp) && e.scrollHeight > e.clientHeight + 1;
    if (!corteH && !corteV) continue;
    if (e.closest(SKIP_ENC) || /material|icon/i.test(cs.fontFamily) || !visivel(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    cortados.push(rotulo(e) + ' "' + (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30) + '" ' + (corteV ? e.scrollHeight + '>' + e.clientHeight + 'h' : e.scrollWidth + '>' + e.clientWidth + 'w'));
  }
  if (cortados.length) avisos.push('TEXTO_CORTADO(' + cortados.length + '): ' + cortados.slice(0, 4).join(', '));

  // 9e) Contadores da mesma pagina com prazos diferentes no mesmo instante (obs. 0049, uma loja 16/10/2026: barra do
  //     topo 2 dias 23h, buy box 1 dia 23h, capitulo II 2 dias 23h). So conta contador VIVO (o valor cai entre
  //     duas leituras ~1,2s): hora fixa no texto nao entra. Divergencia > 90s entre vivos = aviso.
  const UNID = [[/^(d|days?|dias?|días?|j|jours?|tage?|giorn[oi]|dag(en)?|dni)$/i, 86400], [/^(h|hrs?|hours?|horas?|heures?|std|stunden?|ore|uur)$/i, 3600], [/^(m|mins?|minutes?|minutos?|minuten?|minuti)$/i, 60], [/^(s|secs?|seconds?|segundos?|sekunden?|secondi|seconden)$/i, 1]];
  const paraSeg = (t0) => {
    const t = (t0 || '').replace(/\s+/g, ' ').replace(/\s*:\s*/g, ':');
    let m = t.match(/(\d{1,3}):(\d{2}):(\d{2}):(\d{2})(?!\d)/);
    if (m) return m[1] * 86400 + m[2] * 3600 + m[3] * 60 + +m[4];
    m = t.match(/(\d{1,2}):(\d{2}):(\d{2})(?!\d)/);
    if (m) {
      const md = t.match(/(\d{1,3}) ?([a-zà-ÿ]+)\.?,? ?\d{1,2}:\d{2}:\d{2}/i);
      const u = md && UNID.find(([re]) => re.test(md[2]));
      return (u && u[1] === 86400 ? md[1] * 86400 : 0) + m[1] * 3600 + m[2] * 60 + +m[3];
    }
    let s = 0, k = 0, x; const re = /(\d{1,3}) ?([a-zà-ÿ]+)/gi;
    while ((x = re.exec(t))) { const u = UNID.find(([r]) => r.test(x[2])); if (u) { s += x[1] * u[1]; k++; } }
    return k >= 2 ? s : null;
  };
  let contadores = [];
  for (const e of document.body.querySelectorAll('*')) {
    const tc = e.textContent || '';
    if (tc.length > 160 || !/\d/.test(tc) || e.closest('script, style, template, noscript')) continue;
    if (paraSeg(tc) === null) continue;
    contadores.push(e);
  }
  contadores = contadores.filter((e) => !contadores.some((o) => o !== e && e.contains(o)) && visivel(e)).map((e) => ({ e, s1: paraSeg(e.innerText) }));
  const t0Cont = Date.now();

  // 9f) PDP: blocos de aba/acordeao com numero e unidade (comparados ENTRE PDPs pelo runner: texto identico em
  //     produtos diferentes e contradizendo a descricao/titulo = PDP_STATIC_SPEC_BLOCK, obs. 0049).
  let pdp = null;
  if (mProd) {
    const txt = (e) => (e.textContent || '').replace(/\s+/g, ' ').trim();
    const comUnidade = /\d\s?(mm|cm|kg|g|ml|oz|atm|bar|inch|in|%|"|″)(?![a-z])/i;
    const blocos = [], vistos = new Set();
    document.querySelectorAll('details, [role="tabpanel"], .accordion__content, .collapsible-content, [class*="accordion"][class*="content"], [class*="tab"][class*="content"], [class*="tab"][class*="panel"]').forEach((e) => {
      if (e.closest('cart-drawer, .cart-drawer, header, footer')) return;
      const s = e.tagName === 'DETAILS' ? e.querySelector('summary') : null;
      const t = s ? txt(e).slice(txt(s).length).trim() : txt(e);
      if (!t || t.length > 3000 || !comUnidade.test(t) || vistos.has(t)) return;
      vistos.add(t);
      const lb = e.getAttribute('aria-labelledby') && document.getElementById(e.getAttribute('aria-labelledby'));
      blocos.push({ t: (s ? txt(s) : lb ? txt(lb) : '').slice(0, 40), x: t.slice(0, 1500) });
    });
    const dsc = document.querySelector('.product__description, [class*="product__description"], .product-description, [class*="product-description"], .product-single__description');
    const tit = document.querySelector('.product__title, h1');
    pdp = { handle: mProd[1], blocos: blocos.slice(0, 8), desc: ((tit ? txt(tit) : '') + ' ' + (dsc ? txt(dsc) : '')).slice(0, 4000) };
  }

  // 9f2) PDP: coerencia de CONTEUDO (obs. 0367, 05/11/2026). O Gate A deu verde nos cinco temas da rodada 1 com a PDP mostrando
  //      quatro prazos de entrega e quatro de devolucao diferentes e as bandeiras de cartao em cinza (filter: grayscale(1)); o dono da loja
  //      reprovou pelo conteudo. Tres invariantes medidas no DOM renderizado, so na PDP:
  //      PRAZO_MULTIPLO: mais de um prazo distinto no mesmo tipo (despacho em horas ou ate 3 dias, entrega em dias, data de despacho,
  //        data de chegada, devolucao). Despacho + entrega (48h + 5 a 7 dias uteis, o modelo da casa) sao tipos diferentes e passam.
  //        Texto da area principal, abas fechadas incluidas, fora de avaliacoes. Limite: dias uteis x corridos nao se distinguem.
  //      PROVA_MULTIPLA: mais de um numero de avaliacoes (ou de clientes) visivel na pagina; numeros abaixo de 50 ficam de fora
  //        (paginacao: "mostrando 8 avaliacoes"). Avaliacoes e clientes sao contagens diferentes e nao se comparam entre si.
  //      PAGAMENTO_CINZA: icone de pagamento (img/svg em bloco de classe payment/paybadge) com computed filter diferente de none.
  let conteudoPdp = null;
  if (mProd) {
    const raizC = document.querySelector('main, #MainContent') || document.body;
    const FORA_C = 'script, style, template, noscript, cart-drawer, .cart-drawer, dialog, [role="dialog"]';
    const AVAL = '[class*="review"], [id*="review"], [class*="jdgm"], [class*="loox"], [class*="stamped"], [class*="okendo"], [class*="yotpo"]';
    const dispC = new Map();
    const bloco = (el) => { let a = el; while (a && a !== document.body) { let d = dispC.get(a); if (!d) dispC.set(a, d = getComputedStyle(a).display); if (d !== 'inline' && d !== 'contents') break; a = a.parentElement; } return a || document.body; };
    const textos = new Map(); // elemento-bloco -> texto dos nos de texto dele
    const wk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = wk.nextNode());) {
      const pe = n.parentElement;
      if (!pe || !n.textContent.trim() || pe.closest(FORA_C)) continue;
      const b = bloco(pe);
      textos.set(b, (textos.get(b) || '') + n.textContent + ' ');
    }
    const UN_C = 'days?|dias?|d[ií]as?|tage?n?|jours?|giorni|hours?|horas?|stunden|heures?|ore|weeks?|semanas?|wochen|semaines?|settimane';
    const reT = new RegExp('(\\d{1,3})(?:\\s*(?:to|a|-|–|—|até|bis|à|and|ou|or)\\s*(\\d{1,3}))?[\\s-]*(?:business[\\s-]+|working[\\s-]+|calendar[\\s-]+|úteis[\\s-]+|uteis[\\s-]+|corridos[\\s-]+)?(' + UN_C + ')(?![a-zà-ÿ])', 'gi');
    const MES = '(?:jan|feb|fev|mar|apr|abr|may|mai|jun|jul|aug|ago|sep|set|oct|out|nov|dec|dez)[a-zç]*\\.?';
    const D1 = '(?:' + MES + '\\s+\\d{1,2}(?:st|nd|rd|th)?|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:de\\s+)?' + MES + ')';
    const reD = new RegExp('\\b' + D1 + '(?:\\s*(?:-|–|—|to|and|e|a|até|until)\\s*(?:' + D1 + '|\\d{1,2}(?!\\d)))?', 'gi');
    const K_RET = /\b(returns?|returned|refunds?|money[\s-]?back|devolu\w*|reembols\w*|retours?|rückgabe|rimbors\w*|devoluc\w*)/gi;
    const K_ENT = /\b(deliver\w*|arriv\w*|receive\w*|transit|entrega\w*|chega\w*|recebe\w*|livraison|lieferung|consegna|llega\w*|eta|estimated)\b/gi;
    const K_ENV = /\b(ship\w*|dispatch\w*|processing|handling|envio|enviamos|enviad\w*|enviar|despach\w*|postagem|postad\w*|expedi\w*|versand\w*|spedizion\w*|frete|envoi)/gi;
    // palavra-chave mais proxima (ate 80 caracteres) da expressao de tempo; a que vem ANTES vence a que vem depois:
    // "Ships within 48 hours, delivered in 5 to 7 business days" (tema VM, 06/11) ligava o 48 h ao "delivered" logo
    // depois da virgula e reprovava o modelo da casa como dois prazos de entrega
    const classe = (frase, ini, fim) => {
      let antes = null, depois = null;
      for (const [nome, re] of [['ret', K_RET], ['ent', K_ENT], ['env', K_ENV]]) {
        re.lastIndex = 0;
        for (let k; (k = re.exec(frase));) {
          // "devolucao em ate 30 dias da entrega": a palavra de entrega e ponto de referencia, nao o assunto do prazo
          if (nome !== 'ret' && /\b(of|after|from|since|upon|following|de|da|do|após|apos|nach|ab|après)\s+(?:the\s+|your\s+|a\s+|sua\s+|seu\s+)?$/i.test(frase.slice(Math.max(0, k.index - 16), k.index))) continue;
          if (k.index >= fim) { const dist = k.index - fim; if (dist <= 80 && (!depois || dist < depois.dist)) depois = { nome, dist }; }
          else { const dist = Math.max(0, ini - (k.index + k[0].length)); if (dist <= 80 && (!antes || dist < antes.dist)) antes = { nome, dist }; }
        }
      }
      return (antes || depois || {}).nome || null;
    };
    const prazos = { despacho: new Set(), entrega: new Set(), data_despacho: new Set(), data_entrega: new Set(), devolucao: new Set() };
    for (const [b, tx] of textos) {
      if (!raizC.contains(b) || b.closest(AVAL)) continue;
      for (const frase of tx.replace(/\s+/g, ' ').trim().split(/(?<=[.!?;|•·])\s+/)) {
        reT.lastIndex = 0;
        for (let m; (m = reT.exec(frase));) {
          const un = /^h|^ho|^st|^he|^or/i.test(m[3]) ? 'h' : /^w|^sem|^sett/i.test(m[3]) ? 'w' : 'd';
          const f = un === 'w' ? 7 : 1, lo = +m[1] * f, hi = (m[2] ? +m[2] : +m[1]) * f;
          const val = (lo === hi ? lo : lo + '-' + hi) + ' ' + (un === 'h' ? 'h' : 'd');
          const c = classe(frase, m.index, m.index + m[0].length);
          if (!c) continue;
          prazos[c === 'ret' ? 'devolucao' : c === 'ent' ? 'entrega' : (un === 'h' || hi <= 3) ? 'despacho' : 'entrega'].add(val);
        }
        reD.lastIndex = 0;
        for (let m; (m = reD.exec(frase));) {
          const c = classe(frase, m.index, m.index + m[0].length);
          if (c === 'ent' || c === 'env') prazos[c === 'ent' ? 'data_entrega' : 'data_despacho'].add(m[0].toLowerCase().replace(/\s+/g, ' '));
        }
      }
    }
    const multiplos = Object.entries(prazos).filter(([, v]) => v.size > 1).map(([k, v]) => k + ': ' + [...v].join(' | '));
    if (multiplos.length) failures.push('PRAZO_MULTIPLO(' + multiplos.length + '): ' + multiplos.join(' ; ') + ' (um prazo so por tipo na pagina inteira: area de compra, abas e blocos de politica)');
    // prova social: numeros visiveis de avaliacoes e de clientes
    const NUM = '(\\d{1,3}(?:[.,\\u00a0\\u202f]\\d{3})+|\\d+(?:[.,]\\d+)?)\\s*(k|mil|milh[õo]es|million|m)?\\s*\\+?\\s*';
    const reAv = new RegExp(NUM + '(?:verified\\s+|verificad[ao]s?\\s+|(?:five|5)[\\s-]star\\s+|5\\s+estrelas?\\s+)?(reviews?|ratings?|avalia(?:ç|c)(?:ão|ões|oes|ao)|bewertungen|avis|rese(?:ñ|n)as|recensioni|opiniones|coment[áa]rios)(?![a-zà-ÿ])', 'gi');
    const reCl = new RegExp(NUM + '(?:happy\\s+|satisfied\\s+|felizes\\s+|satisfeit\\w*\\s+)?(customers?|clients?|clientes?|kunden|buyers|compradores?|shoppers|clienti|homens|mulheres|men|women)(?![a-zà-ÿ])', 'gi');
    const prova = { avaliacoes: new Set(), clientes: new Set() };
    for (const [b, tx] of textos) {
      if (!visivel(b, false)) continue;
      const t = tx.replace(/\s+/g, ' ');
      for (const [nome, re] of [['avaliacoes', reAv], ['clientes', reCl]]) {
        re.lastIndex = 0;
        for (let m; (m = re.exec(t));) {
          const milhar = /^\d{1,3}(?:[.,  ]\d{3})+$/.test(m[1]);
          const base = milhar ? +m[1].replace(/[.,  ]/g, '') : parseFloat(m[1].replace(',', '.'));
          const suf = (m[2] || '').toLowerCase();
          const v = Math.round(base * (suf === 'k' || suf === 'mil' ? 1e3 : suf ? 1e6 : 1));
          if (v >= 50) prova[nome].add(v);
        }
      }
    }
    const provaMult = Object.entries(prova).filter(([, v]) => v.size > 1).map(([k, v]) => k + ': ' + [...v].sort((x, y) => x - y).join(' | '));
    if (provaMult.length) failures.push('PROVA_MULTIPLA(' + provaMult.length + '): ' + provaMult.join(' ; ') + ' (um numero de prova social so por tipo)');
    // bandeiras de pagamento sem cor
    const PAGO = '[class*="payment"], [class*="paybadge"], [class*="pay-badge"], [class*="pay-icon"], [class*="payicon"], [class*="pagamento"]';
    const cinza = new Set();
    for (const c of raizC.querySelectorAll(PAGO)) {
      if (c.closest(FORA_C) || !visivel(c, false)) continue;
      for (const x of [c, ...c.querySelectorAll('img, svg')]) {
        const fl = getComputedStyle(x).filter;
        if (fl !== 'none') cinza.add(rotulo(x) + ' filter: ' + fl.slice(0, 40));
      }
    }
    if (cinza.size) failures.push('PAGAMENTO_CINZA(' + cinza.size + '): ' + [...cinza].slice(0, 3).join(', ') + ' (icone de pagamento com filter diferente de none; as bandeiras vao coloridas)');
    // FRETE_REPETIDO (aula de 06/11/2026): o vestuario masculino tinha a linha "Ships within 48 hours..." perto do botao e a aba
    // "Shipping & Returns" repetindo o frete; a casa pediu UMA informacao de frete. Conta os blocos de texto da coluna de compra
    // (abas fechadas incluidas) que falam de envio; "calculated at checkout" da Dawn fica de fora.
    const colunaC = document.querySelector('.product__info-container, [id^="ProductInfo-"]') || document.querySelector('form[action*="/cart/add"]')?.closest('section, main, div');
    const FRETE = /\b(ships?|shipped|shipping|dispatch(?:es|ed)?|deliver(?:y|ed|s)?|envio|entrega|frete|versand|livraison|spedizione)\b/i;
    // devolucao que cita "30 days of delivery" so usa a entrega como marco: nao e informacao de frete (VM e AM, 06/11)
    const DEVOL = /\b(returns?|refunds?|devolu|reembols|retour|r[üu]ckgabe|reso)/i, ENVIO = /\b(ships?|shipped|shipping|dispatch|envio|frete|versand|livraison|spedizione)/i;
    const fretes = colunaC ? [...textos].filter(([b, t]) => colunaC.contains(b) && FRETE.test(t) && (!DEVOL.test(t) || ENVIO.test(t)) && !/calculated at checkout|calculad[oa] n[oa] checkout|berechnet/i.test(t) && /\d|free|gr[aá]tis|kostenlos|gratuit/i.test(t)).map(([, t]) => t.replace(/\s+/g, ' ').trim().slice(0, 60)) : [];
    if (fretes.length > 1) failures.push('FRETE_REPETIDO(' + fretes.length + '): ' + fretes.slice(0, 3).join(' ; ') + ' (uma informacao de frete so na coluna de compra)');
    conteudoPdp = { prazos: Object.fromEntries(Object.entries(prazos).map(([k, v]) => [k, [...v]])), prova: { avaliacoes: [...prova.avaliacoes], clientes: [...prova.clientes] }, pagamentoCinza: cinza.size };
  }

  // 9f3) Toda pagina: marcador e texto de programador (aula de 06/11/2026). O Gate A deu verde nos cinco temas prontos medindo com o
  //      produto de exemplo completo; com o produto do aluno (sem metacampo) a tela mostrava "[DETALHE 1]", "[SUA MARCA AQUI]" e
  //      "fill the product metafield...". Le os nos de texto do DOM (abas fechadas incluidas, script/style fora).
  //      MARCADOR_NA_TELA: "[TEXTO EM MAIUSCULAS]" com 3+ maiusculas seguidas. TEXTO_DE_DEV: instrucao de editor ou erro de Liquid.
  {
    const marc = new Set(), dev = new Set();
    const wkM = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = wkM.nextNode());) {
      const pe = n.parentElement;
      if (!pe || pe.closest('script, style, template, noscript')) continue;
      const t = n.textContent;
      for (const m of t.match(/\[[A-ZÀ-Ú0-9@][^\]\n]{2,}\]/g) || []) if (/[A-ZÀ-Ú]{3}/.test(m)) marc.add(m.slice(0, 50));
      const d = t.match(/theme editor|enable section|metafield|in its settings|liquid (?:error|syntax)|translation missing|lorem ipsum/i);
      if (d) dev.add(t.replace(/\s+/g, ' ').trim().slice(0, 70));
    }
    if (marc.size) failures.push('MARCADOR_NA_TELA(' + marc.size + '): ' + [...marc].slice(0, 4).join(', ') + ' (texto de exemplo, nunca colchete)');
    if (dev.size) failures.push('TEXTO_DE_DEV(' + dev.size + '): ' + [...dev].slice(0, 3).join(' ; '));
  }

  // 9g) Cabecalho fixo coberto depois de rolar (obs. 0018, uma loja 15/10/2026: galeria, hero e cards por cima do
  //     cabecalho com 92/92 verde, porque o sweep so media scrollY=0). Rola 400/900/1600px e sobe a 1300px
  //     (cabecalho que so reaparece ao subir, como o "on scroll up" da Dawn) e, com o cabecalho na tela,
  //     elementFromPoint em 4 pontos dele tem de cair dentro do grupo do cabecalho. Sobreposicao fixa
  //     (pop-up, cookie, barra de previa) nao conta. Com gaveta ou modal aberto (rolagem travada) nao mede.
  const HDR = 'sticky-header, .section-header, .shopify-section-group-header-group, .header-wrapper, #shopify-section-header, header';
  const hdr = ['sticky-header', '.section-header', '#shopify-section-header', '.header-wrapper', 'header'].map((s) => [...document.querySelectorAll(s)].find((e) => !e.closest('cart-drawer, .drawer, dialog, [role="dialog"], [class*="drawer"]') && visivel(e, false))).find(Boolean);
  const travado = gavetaAberta || document.body.classList.contains('overflow-hidden') || getComputedStyle(document.body).overflowY === 'hidden' || getComputedStyle(de).overflowY === 'hidden';
  const coberturas = [];
  if (hdr && !travado) {
    const y0 = scrollY;
    for (const y of [400, 900, 1600, 1300]) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      await new Promise((ok) => setTimeout(ok, 350));
      const rr = hdr.getBoundingClientRect();
      if (rr.bottom <= 2 || rr.top >= innerHeight || rr.height < 8) continue;
      const topo = Math.max(rr.top, 0), pe = Math.min(rr.bottom, innerHeight), ym = (topo + pe) / 2;
      const ruins = [];
      for (const [x, yy] of [[rr.left + 20, ym], [rr.left + rr.width / 2, ym], [rr.right - 20, ym], [rr.left + rr.width / 4, Math.min(topo + 6, pe - 1)]]) {
        if (x < 0 || x >= vw) continue;
        const el = document.elementFromPoint(x, yy);
        if (!el || el === de || el === document.body || el.closest(HDR)) continue;
        let fixo = false;
        for (let a = el; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).position === 'fixed') { fixo = true; break; }
        if (fixo || el.closest('dialog, [role="dialog"], [aria-modal="true"]')) continue;
        ruins.push(rotulo(el));
      }
      if (ruins.length) coberturas.push('y' + y + (y === 1300 ? ' subindo' : '') + ': ' + [...new Set(ruins)].join(' | '));
    }
    window.scrollTo({ top: y0, behavior: 'instant' });
    await new Promise((ok) => requestAnimationFrame(() => ok()));
  }
  if (coberturas.length) avisos.push('CABECALHO_COBERTO_AO_ROLAR: ' + coberturas.slice(0, 3).join(' ; '));

  // 10) Tres defeitos que o cliente via com o Gate A 76/76 (backup Dawn, 16-17/10/2026), cada um com invariante:
  //  FIXED_PRESO (obs. 0097): position:fixed dentro de ancestral que vira o bloco de referencia dele (transform, filter,
  //    perspective, will-change transform, contain paint/layout). O .product__info-wrapper.scroll-trigger do Dawn guarda
  //    um transform identidade: a barra fixa de compra ficou no meio da PDP a 390 e estourou 30px a 1280, onde so
  //    apareceu como OVERFLOW_H. BARRA_FIXA_FORA_DO_RODAPE: barra fixa de compra (classe sticky/satc) na janela que nao
  //    encosta no pe (2px) nem mora no terco de cima.
  //  TEXTO_ESPREMIDO (obs. 0104): texto (folha com 4+ caracteres) mais estreito que 3x a fonte e com mais de 3 linhas: o
  //    nome e o brinde da gaveta quebraram letra a letra numa coluna de 30px, sem estouro nem corte. Texto girado ou
  //    vertical fica de fora. CARRINHO_ITEM_ESPREMIDO: coluna de detalhes/nome do item do carrinho com menos de 100px.
  //  TEXTO_COBERTO (obs. 0106): rotulo de botao/link com elemento pintado por cima no ponto do texto (elementsFromPoint)
  //    ou pseudo-elemento pintado por cima (o hit-test devolve o dono, nunca o pseudo): o degrade ::after z-index 1 do
  //    botao de um tema apagou o "Add to cart" da barra fixa. Camada fixa de outro conjunto (pop-up, cookie, barra de
  //    previa, barra fixa sobre o conteudo) e modal nao contam.
  //  Na PDP, fixos e rotulos dentro de fixos sao medidos de novo rolando alem do botao de compra (barra fixa a mostra).
  const seletor = (e) => rotulo(e) + (e.id ? '#' + e.id : '');
  const fixoDe = (el) => { for (let a = el; a && a !== de; a = a.parentElement) if (getComputedStyle(a).position === 'fixed') return a; return null; };
  const alfa = (c) => { const m = /rgba?\(([^)]*)\)/.exec(c || ''); if (!m) return c === 'transparent' ? 0 : 1; const p = m[1].split(/[\s,/]+/).filter(Boolean); return p.length > 3 ? parseFloat(p[3]) : 1; };
  const pinta = (s) => s.backgroundImage !== 'none' || alfa(s.backgroundColor) > 0;
  const presos = new Map(), barras = new Set(), espremidos = new Set(), itensEspremidos = new Set(), cobertos = new Set(), sobCabecalho = new Set();
  const stickyTopo = (el) => { for (let a = el; a && a !== de; a = a.parentElement) { const c = getComputedStyle(a); if (c.position === 'sticky' && parseFloat(c.top) <= 1 && a.getBoundingClientRect().width >= 0.9 * vw) return a; } return null; };
  const medirFixos = () => {
    for (const e of document.querySelectorAll('body *')) {
      if (getComputedStyle(e).position !== 'fixed' || !visivel(e) || e.closest('script, style, template, noscript')) continue;
      for (let a = e.parentElement; a; a = a.parentElement) {
        const ac = getComputedStyle(a);
        if (ac.transform !== 'none' || ac.filter !== 'none' || ac.perspective !== 'none' || /\btransform\b/.test(ac.willChange) || /\b(layout|paint|strict|content)\b/.test(ac.contain)) { presos.set(e, seletor(e) + ' preso em ' + seletor(a)); break; }
      }
      // barra-cartao flutuante (bottom:16px, barra de compra flutuante) e desenho: o vao pode ser o proprio bottom declarado, ate 40px
      const r = e.getBoundingClientRect(), vao = innerHeight - r.bottom, cssB = parseFloat(getComputedStyle(e).bottom);
      if (/sticky|satc/i.test(typeof e.className === 'string' ? e.className : '') && r.bottom > 2 && r.top < innerHeight - 2 && r.top > innerHeight / 3 && Math.abs(vao) > 2 && !(cssB > 0 && cssB <= 40 && Math.abs(vao - cssB) <= 2)) barras.add(seletor(e) + ' pe=' + Math.round(r.bottom) + ' janela=' + innerHeight);
    }
  };
  const ROTULOS = 'button, a, [role="button"], [role="link"]';
  const medirRotulos = (lista) => {
    for (const e of lista) {
      if (!visivel(e) || !(e.innerText || '').trim()) continue;
      const fixoE = fixoDe(e), w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
      let n, motivo = '';
      while (!motivo && (n = w.nextNode())) {
        const tEl = n.parentElement;
        if (!n.textContent.trim() || !tEl || !visivel(tEl)) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        for (const tr of rg.getClientRects()) {
          const x = (tr.left + tr.right) / 2, y = (tr.top + tr.bottom) / 2;
          if (tr.width < 1 || tr.height < 1 || x < 0 || x >= vw || y < 0 || y >= innerHeight) continue;
          // a) elemento pintado acima do rotulo na pilha do ponto (sem o rotulo na pilha, pointer-events:none, nao julga)
          const pilha = document.elementsFromPoint(x, y);
          const i = pilha.findIndex((h) => h === tEl || e.contains(h));
          for (const h of i > 0 ? pilha.slice(0, i) : []) {
            if (h.contains(e) || h.closest('dialog, [role="dialog"], [aria-modal="true"]')) continue;
            const fh = fixoDe(h);
            if (fh && fh !== fixoE) continue;
            // 0369 (05/11/2026): cabecalho position:sticky colado no topo cobre, por desenho, o que rola por baixo dele na posicao
            // de rolagem em que a medida cai; com cabecalho sempre fixo (o da referencia) o carrinho a 1280 reprovou e o tema trocou o modo
            // do cabecalho. Vira aviso TEXTO_SOB_CABECALHO. So conta sticky no topo, largo; ::before/::after de botao (b) segue reprovando.
            const sk = stickyTopo(h);
            if (sk && !fixoE && !sk.contains(e)) { sobCabecalho.add(seletor(e) + ' "' + e.innerText.trim().replace(/\s+/g, ' ').slice(0, 24) + '" sob ' + seletor(sk)); continue; }
            if (pinta(getComputedStyle(h)) || /^(img|video|canvas|iframe|picture|svg)$/i.test(h.tagName)) { motivo = 'coberto por ' + seletor(h); break; }
          }
          if (motivo) break;
          // b) pseudo-elemento pintado por cima do ponto
          const hosts = new Set([e, ...e.querySelectorAll('*')]);
          for (let a = tEl; a && a !== de; a = a.parentElement) hosts.add(a);
          if (pilha[0]) hosts.add(pilha[0]);
          for (const host of hosts) {
            for (const ps of ['::before', '::after']) {
              const s = getComputedStyle(host, ps);
              if (s.content === 'none' || s.content === 'normal' || s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0 || !/^(absolute|fixed)$/.test(s.position) || !pinta(s)) continue;
              const z = s.zIndex === 'auto' ? 0 : Number(s.zIndex);
              if (z < 0) continue;
              if (host.contains(tEl)) {
                // texto em camada posicionada: z maior fica por cima; z igual fica por cima do ::before (vem depois).
                // Vale o z do ancestral MAIS EXTERNO abaixo do dono (o contexto de empilhamento que disputa com o
                // pseudo), nunca o primeiro achado: no banner do Dawn o .banner__box (z 1) mora dentro do
                // .banner__content (z 2) e o botao ficava "coberto" pelo ::after z 1 (rascunho 6mfygm, 27/10/2026).
                let tz = 0, pos = false;
                for (let a = tEl; a && a !== host; a = a.parentElement) {
                  const ac = getComputedStyle(a);
                  if (ac.position === 'static') continue;
                  pos = true;
                  if (ac.zIndex !== 'auto') tz = Number(ac.zIndex);
                }
                if (tz > z || (pos && tz === z && ps === '::before')) continue;
              }
              let cb = host;
              while (cb.parentElement && getComputedStyle(cb).position === 'static' && getComputedStyle(cb).transform === 'none') cb = cb.parentElement;
              const cr = s.position === 'fixed' ? { left: 0, top: 0, width: vw, height: innerHeight } : cb.getBoundingClientRect();
              const L = parseFloat(s.left), R = parseFloat(s.right), T = parseFloat(s.top), B = parseFloat(s.bottom), W = parseFloat(s.width), H = parseFloat(s.height);
              if (!Number.isFinite(W) || !Number.isFinite(H)) continue;
              const px = cr.left + (Number.isFinite(L) ? L : cr.width - R - W), py = cr.top + (Number.isFinite(T) ? T : cr.height - B - H);
              if (x >= px && x <= px + W && y >= py && y <= py + H) { motivo = 'coberto por ' + seletor(host) + ps; break; }
            }
            if (motivo) break;
          }
          if (motivo) break;
        }
      }
      if (motivo) cobertos.add(seletor(e) + ' "' + e.innerText.trim().replace(/\s+/g, ' ').slice(0, 24) + '" ' + motivo);
    }
  };
  medirFixos();
  medirRotulos(document.querySelectorAll(ROTULOS));
  for (const e of document.querySelectorAll('body *')) {
    if (e.children.length || e.closest('script, style, template, noscript') || !visivel(e)) continue;
    const t = (e.innerText || '').trim();
    if (t.length < 4) continue;
    // caixa do TEXTO (Range), nao do elemento: item de grid/flex estica ate a altura da linha e daria "4 linhas" a 1 linha
    const cs = getComputedStyle(e), rg = document.createRange(), fs = parseFloat(cs.fontSize);
    rg.selectNodeContents(e);
    const r = rg.getBoundingClientRect();
    if (!(fs > 0) || r.width >= 3 * fs || cs.writingMode.startsWith('vertical')) continue;
    let lh = parseFloat(cs.lineHeight);
    if (!Number.isFinite(lh)) { // "normal" nao e numero: sonda de uma linha na mesma fonte, removida em seguida
      const p = document.createElement('span'); p.textContent = 'M';
      p.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;padding:0;border:0'; p.style.font = cs.font;
      e.appendChild(p); lh = p.getBoundingClientRect().height; p.remove();
    }
    if (!(lh > 0) || r.height / lh <= 3) continue;
    let gira = false;
    for (let a = e; a && a !== de && !gira; a = a.parentElement) { const tf = getComputedStyle(a).transform; if (tf !== 'none') { const m = new DOMMatrixReadOnly(tf); gira = !!(m.b || m.c); } }
    if (!gira) espremidos.add(rotulo(e) + ' "' + t.replace(/\s+/g, ' ').slice(0, 20) + '" ' + Math.round(r.width) + 'px, fonte ' + fs + 'px, ' + Math.round(r.height / lh) + ' linhas');
  }
  document.querySelectorAll('.cart-item, .cart-drawer-item, .cart-drawer__item, .cart__item').forEach((it) => {
    if (!visivel(it)) return;
    const d = [...it.querySelectorAll('[class*="details"], [class*="item__name"], [class*="item__title"], [class*="product-title"]')].find((x) => visivel(x) && (x.innerText || '').trim().length >= 4 && x.getBoundingClientRect().width < 100);
    if (d) itensEspremidos.add(rotulo(d) + ' ' + Math.round(d.getBoundingClientRect().width) + 'px');
  });
  if (mProd && !travado) {
    const atc = [...document.querySelectorAll('form[action*="/cart/add"] [type="submit"], form[action*="/cart/add"] [name="add"]')].find((b) => visivel(b, false) && !fixoDe(b));
    if (atc) {
      const y0 = scrollY;
      window.scrollTo({ top: atc.getBoundingClientRect().bottom + scrollY + 300, behavior: 'instant' });
      await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      await new Promise((ok) => setTimeout(ok, 600));
      medirFixos();
      medirRotulos([...document.querySelectorAll(ROTULOS)].filter((b) => fixoDe(b)));
      window.scrollTo({ top: y0, behavior: 'instant' });
      await new Promise((ok) => requestAnimationFrame(() => ok()));
    }
  }
  if (presos.size) failures.push('FIXED_PRESO(' + presos.size + '): ' + [...presos.values()].slice(0, 4).join(', ') + ' (o ancestral vira o bloco de referencia do fixed: tirar dele o transform/filter/contain ou mover o elemento para o <body>)');
  // Corpus de 21/10/2026 (138 medidas: previa do backup Dawn + 15 lojas no ar): os quatro codigos ao redor deram 0
  // alarme e pegaram os tres defeitos de 16-17/10 reintroduzidos na previa; este deu 2 alarmes, os dois falsos (barra-cartao
  // de uma barra flutuante, bottom:16px, ja normalizado acima): fica como aviso ate medir de novo.
  if (barras.size) avisos.push('BARRA_FIXA_FORA_DO_RODAPE(' + barras.size + '): ' + [...barras].slice(0, 3).join(', '));
  if (espremidos.size) failures.push('TEXTO_ESPREMIDO(' + espremidos.size + '): ' + [...espremidos].slice(0, 4).join(', '));
  if (itensEspremidos.size) failures.push('CARRINHO_ITEM_ESPREMIDO(' + itensEspremidos.size + '): ' + [...itensEspremidos].slice(0, 3).join(', ') + ' (detalhes do item com menos de 100px)');
  if (cobertos.size) failures.push('TEXTO_COBERTO(' + cobertos.size + '): ' + [...cobertos].slice(0, 4).join(', '));
  if (sobCabecalho.size) avisos.push('TEXTO_SOB_CABECALHO(' + sobCabecalho.size + '): ' + [...sobCabecalho].slice(0, 3).join(', ') + ' (cabecalho sticky colado no topo; nao reprova, e o que rola por baixo dele)');
  const iOv = failures.findIndex((f) => f.startsWith('OVERFLOW_H'));
  const culpa = [...presos.keys()].filter((p) => [p, ...p.querySelectorAll('*')].some((d) => d.getBoundingClientRect().right > de.clientWidth + 2));
  if (iOv > -1 && culpa.length) failures[iOv] += ' (causa: ' + culpa.slice(0, 3).map(seletor).join(', ') + ' com position:fixed preso, ver FIXED_PRESO)';

  // 9e, segunda leitura dos contadores (>= 1,2s depois da primeira; a rolagem acima ja gastou parte da espera)
  let contadoresVivos = [];
  if (contadores.length > 1) {
    const falta = 1200 - (Date.now() - t0Cont);
    if (falta > 0) await new Promise((ok) => setTimeout(ok, falta));
    contadoresVivos = contadores.map((c) => ({ ...c, s2: paraSeg(c.e.innerText) })).filter((c) => c.s1 !== null && c.s2 !== null && c.s2 < c.s1 && c.s1 - c.s2 <= 5);
    if (contadoresVivos.length > 1) {
      const vals = contadoresVivos.map((c) => c.s2);
      if (Math.max(...vals) - Math.min(...vals) > 90) {
        const fmt = (s) => Math.floor(s / 86400) + 'd ' + new Date((s % 86400) * 1000).toISOString().slice(11, 19);
        avisos.push('COUNTDOWN_MISMATCH(' + contadoresVivos.length + '): ' + contadoresVivos.slice(0, 4).map((c) => rotulo(c.e) + '=' + fmt(c.s2)).join(', ') + ' no mesmo instante');
      }
    }
  }

  return {
    pass: failures.length === 0,
    failures,
    avisos,
    metrics: {
      viewport: vw,
      pageScrollW: de.scrollWidth,
      reviewCards: cards.length,
      reviewNoPhoto: noPhoto,
      galleryStageW: stage ? Math.round(stage.getBoundingClientRect().width) : null,
      imgWeightKB: Math.round(imgWeightKB),
      imgOversized: oversized.length,
      imgMaxRatio: Math.round(imgMaxRatio * 100) / 100,
      imgOversizedList: oversized.slice(0, 20).map((o) => o.txt),
      appImgOversizedList: appOversized,
      gavetaVazia,
      contadoresVivos: contadoresVivos.length,
      pdp,
      conteudoPdp,
    },
  };
}

// ---- PDP_STATIC_SPEC_BLOCK (obs. 0049): roda no Node, depois da rodada, sobre metrics.pdp de cada PDP. ----
// Bloco de aba/acordeao com texto IDENTICO em produtos diferentes e com numero+unidade que a descricao/titulo de
// algum deles contradiz (uma loja 16/10/2026: "Case Size: 47mm" em todas as fichas, inclusive a de 35MM) = texto de
// modelo no ar. Bloco identico sem contradicao (envio, devolucao) nao conta. Devolve [{ handles, titulo, motivo }].
function crossPdpSpec(pdps) {
  const pares = (t) => {
    const m = new Map(); const re = /(\d+(?:[.,]\d+)?)\s?(mm|cm|kg|g|ml|oz|atm|bar|inch|in|%)(?![a-z])/gi; let x;
    while ((x = re.exec(t || ''))) { const u = x[2].toLowerCase(); (m.get(u) || m.set(u, new Set()).get(u)).add(parseFloat(x[1].replace(',', '.'))); }
    return m;
  };
  const porTexto = new Map();
  for (const p of pdps) {
    if (!p || !p.handle) continue;
    for (const b of p.blocos || []) {
      const k = b.x.toLowerCase();
      if (!porTexto.has(k)) porTexto.set(k, { titulo: b.t, porHandle: new Map() });
      porTexto.get(k).porHandle.set(p.handle, p);
    }
  }
  const out = [];
  for (const [k, { titulo, porHandle }] of porTexto) {
    if (porHandle.size < 2) continue;
    const doBloco = pares(k), contra = [];
    for (const [h, p] of porHandle) {
      for (const [u, vals] of pares(p.desc)) {
        if (!doBloco.has(u)) continue;
        const fora = [...vals].filter((v) => !doBloco.get(u).has(v));
        if (fora.length) contra.push(h + ': ' + fora.join('/') + u + ' na descricao x ' + [...doBloco.get(u)].join('/') + u + ' no bloco');
      }
    }
    if (contra.length) out.push({ handles: [...porHandle.keys()], titulo, motivo: contra.slice(0, 3).join(' ; ') });
  }
  return out;
}

// ---- Navegacao com repeticao (obs. 0371, 05/11/2026). Timeout do page.goto (vitrine lenta depois de rodadas seguidas) e erro
// de rede (net::ERR_*) sao FALHA DE INFRAESTRUTURA, nao veredicto sobre o tema: o engine espera (NAV_ESPERA_MS, padrao ~2 min),
// repete UMA vez e, se falhar de novo, marca o erro com .navegacao = true; o laco do --run conta em naoMedido (NAVEGACAO_TIMEOUT,
// exit 2, rodada invalida), como ja faz com o desafio de bot. Erro dentro do assertPage nao passa por aqui e continua reprovando.
const ehErroNavegacao = (e) => /net::ERR_|page\.goto: Timeout|Navigation timeout|page\.goto: .*(?:timeout|timed out)/i.test(String((e && e.message) || e));
async function abrirPagina(page, url, { espera = 120000, aviso = () => {}, timeout = 30000, timeoutLoad = 15000 } = {}) {
  const vai = async () => { await page.goto(url, { waitUntil: 'domcontentloaded', timeout }); await page.waitForLoadState('load', { timeout: timeoutLoad }).catch(() => {}); };
  try { return await vai(); } catch (e) {
    if (!ehErroNavegacao(e)) throw e;
    aviso('navegacao falhou (' + String(e.message || e).split('\n')[0].slice(0, 90) + '); esperando ' + Math.round(espera / 1000) + 's para repetir uma vez');
    await new Promise((ok) => setTimeout(ok, espera));
    try { return await vai(); } catch (e2) { if (ehErroNavegacao(e2)) e2.navegacao = true; throw e2; }
  }
}

// ---- Passo de carrinho dos runners (sweep-node e --run). Roda no Node, com a page do Playwright. ----
// 16/10/2026: (1) a gaveta e medida nos DOIS estados que o cliente ve: vazia (contexto novo, antes do clique)
// e com item (obs. 0045); (2) /cart.js tem de voltar JSON antes e depois do clique, com 0 e com >= 1 item; se
// nao voltar, o passo FALHOU e a rodada e NAO MEDIDA (obs. 0055: o add.js recebeu o desafio de bot e 77 paginas
// sairam "verdes" com a gaveta vazia). Devolve { falhou: string|null, vazia: resultado do assert | null }.
async function lerCarrinho(pg) {
  return pg.evaluate(async () => {
    try {
      const r = await fetch('/cart.js', { headers: { Accept: 'application/json' } });
      const t = await r.text();
      if (!/^\s*\{/.test(t)) return { json: false, status: r.status, inicio: t.replace(/\s+/g, ' ').slice(0, 50) };
      return { json: true, itens: JSON.parse(t).item_count };
    } catch (e) { return { json: false, erro: String(e).slice(0, 80) }; }
  });
}
async function passoCarrinho(pg, avaliar, abreGaveta) {
  const c0 = await lerCarrinho(pg);
  if (!c0.json) return { falhou: 'CARRINHO_FALHOU: /cart.js antes do clique nao voltou JSON (' + (c0.status || c0.erro || '') + ' ' + (c0.inicio || '') + ')', vazia: null };
  let vazia = null;
  if (c0.itens === 0) {
    await abreGaveta(pg);
    vazia = await avaliar(pg);
    await pg.evaluate(() => { const cd = document.querySelector('cart-drawer'); if (cd && cd.close) cd.close(); });
    await pg.keyboard.press('Escape').catch(() => {});
    await pg.waitForTimeout(800);
  }
  // Clique real; se outra camada intercepta (banner de cookies Pandectes a 390 na previa da uma loja, 21/10/2026) ou o cabecalho
  // fixo cobre o botao, clique no proprio botao pelo DOM: mesmo caminho do tema (submit do formulario, gaveta redesenhada pelo
  // JS), sem cart/add.js + reload, que acelerava o 429 (obs. 0016). Sem botao de compra: CARRINHO_FALHOU.
  const atc = pg.locator('form[action*="/cart/add"] [type="submit"], form[action*="/cart/add"] [name="add"]').first();
  const clicou = await atc.click({ timeout: 5000 }).then(() => true).catch(() => false)
    || await atc.dispatchEvent('click', undefined, { timeout: 5000 }).then(() => true).catch(() => false);
  if (!clicou) return { falhou: 'CARRINHO_FALHOU: botao de compra da PDP nao achado (form[action*="/cart/add"] [type=submit] ou [name=add])', vazia };
  await pg.waitForTimeout(2500);
  const c1 = await lerCarrinho(pg);
  if (!c1.json || !(c1.itens >= 1)) return { falhou: 'CARRINHO_FALHOU: depois do clique de compra o /cart.js ' + (c1.json ? 'tem ' + c1.itens + ' item(ns)' : 'nao voltou JSON (' + (c1.status || c1.erro || '') + ' ' + (c1.inicio || '') + ')'), vazia };
  await abreGaveta(pg);
  return { falhou: null, vazia };
}
// Junta o estado vazio ao registro da pagina de carrinho: falha do vazio reprova a pagina (prefixo "[gaveta vazia]"),
// gaveta nao reconhecida vira aviso GAVETA_VAZIA_NAO_MEDIDA. Muta e devolve res.
function juntarGavetaVazia(res, vazia) {
  res.avisos = res.avisos || [];
  if (!vazia || vazia.blocked || vazia.cssPending || !vazia.metrics || !vazia.metrics.gavetaVazia) {
    res.avisos.push('GAVETA_VAZIA_NAO_MEDIDA: ' + (!vazia ? 'o carrinho do contexto novo nao estava vazio' : vazia.blocked ? 'bloqueio da loja' : vazia.cssPending ? 'CSS nao carregado' : 'gaveta nao reconhecida aberta com /cart.js em 0 itens'));
    return res;
  }
  const novos = (vazia.failures || []).filter((f) => !(res.failures || []).includes(f)).map((f) => '[gaveta vazia] ' + f);
  if (novos.length) { res.failures = [...(res.failures || []), ...novos]; res.pass = false; }
  for (const a of vazia.avisos || []) if (!res.avisos.includes(a)) res.avisos.push('[gaveta vazia] ' + a);
  res.metrics = res.metrics || {};
  res.metrics.gavetaVaziaMedida = vazia.metrics.gavetaVazia;
  return res;
}

// ---- Encaixe nos idiomas da loja (obs. 0076, carrier da 0041). Roda NO NAVEGADOR (page.evaluate(encaixeIdiomas, arg)). ----
// O assertPage mede o encaixe so no idioma em que a pagina abre: o "+ Add" traduzido cortava o nome do modelo na gaveta
// em 14 de 20 idiomas com o Gate A 40/40, e o nome da gaveta em alemao quebrou letra a letra com 76/76 (obs. 0104).
// Uma carga de pagina por idioma acelera o desafio de bot, entao (como o snippet da FASE 3.5 da task 04) a troca e feita
// na propria pagina: busca o HTML de cada idioma publicado (link rel=alternate hreflang da pagina, no mesmo dominio e com
// a mesma previa), troca o miolo dos componentes (sel), html.lang e dir, e mede: cortado (overflow escondido ou
// line-clamp), fora da borda do componente e espremido (mais estreito que 3x a fonte e com mais de 3 linhas). So conta o
// que nao aparece no idioma padrao (esse ja sai no assertPage). Restaura a pagina no fim.
// arg: { sel, so: ['de',...] | null, pausa: ms entre idiomas }. Devolve { idiomas, componentes, achados: { lang: [..] }, naoMedidos }.
const SEL_ENCAIXE = 'cart-drawer, #CartDrawer, .card-wrapper, .product-card-wrapper, .product__accordion, [role="tablist"]';
async function encaixeIdiomas({ sel, so, pausa }) {
  const de = document.documentElement, langAtual = (de.lang || '').toLowerCase().split('-')[0];
  const SKIP = 'slider-component, .slider, [class*="carousel"], [class*="marquee"], [class*="ticker"], [class*="swiper"], [class*="splide"], .visually-hidden, .sr-only, [class*="material-icons"], [class*="material-symbols"], template, script, style, [aria-hidden="true"]';
  const alvos = new Map();
  for (const l of document.querySelectorAll('link[rel="alternate"][hreflang]')) {
    const lang = l.hreflang.toLowerCase().split('-')[0];
    if (lang === 'x' || lang === langAtual || alvos.has(lang) || (so && !so.includes(lang))) continue;
    const u = new URL(l.href, location.href); u.protocol = location.protocol; u.host = location.host;
    new URLSearchParams(location.search).forEach((v, k) => u.searchParams.set(k, v));
    alvos.set(lang, u.href);
  }
  const todas = [...document.querySelectorAll(sel)];
  const raizes = todas.filter((r) => r.getBoundingClientRect().width > 2 && !todas.some((o) => o !== r && o.contains(r))).slice(0, 12);
  const out = { idiomas: [], componentes: raizes.length, achados: {}, naoMedidos: [] };
  if (!alvos.size || !raizes.length) return out;
  const medir = () => {
    const chaves = new Map();
    raizes.forEach((raiz, k) => {
      const caixa = raiz.getBoundingClientRect();
      [...raiz.querySelectorAll('*')].forEach((e, j) => {
        const r = e.getBoundingClientRect();
        if (r.width < 2 || e.closest(SKIP) || !e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return;
        const cs = getComputedStyle(e), temTexto = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        const txt = (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30);
        const recorta = (cs.webkitLineClamp && cs.webkitLineClamp !== 'none') || cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
        if (temTexto && recorta && (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)) chaves.set('c' + k + ':' + j, 'cortado "' + txt + '"');
        if ((temTexto || /^(button|svg|img)$/i.test(e.tagName)) && (r.right > caixa.right + 1 || r.left < caixa.left - 1)) chaves.set('f' + k + ':' + j, 'fora da borda "' + (txt || e.tagName) + '"');
        if (temTexto && txt.length >= 4 && !e.children.length) {
          const fs = parseFloat(cs.fontSize), rg = document.createRange();
          rg.selectNodeContents(e);
          const tb = rg.getBoundingClientRect(); // caixa do texto: item de grid/flex estica e daria linhas que nao existem
          let lh = parseFloat(cs.lineHeight);
          if (!Number.isFinite(lh)) { const p = document.createElement('span'); p.textContent = 'M'; p.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap'; p.style.font = cs.font; e.appendChild(p); lh = p.getBoundingClientRect().height; p.remove(); }
          if (fs > 0 && lh > 0 && tb.width < 3 * fs && tb.height / lh > 3) chaves.set('e' + k + ':' + j, 'espremido "' + txt + '" ' + Math.round(tb.width) + 'px');
        }
      });
    });
    return chaves;
  };
  const quadro = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(ok, 150))));
  const orig = raizes.map((r) => r.innerHTML), origLang = de.getAttribute('lang'), origDir = de.getAttribute('dir');
  const idx = raizes.map((r) => todas.indexOf(r));
  // Troca o miolo pelo HTML servido em url e mede; devolve null se nao veio pagina no idioma pedido.
  const naPagina = async (url, lang) => {
    let doc = null;
    try { const resp = await fetch(url, { headers: { Accept: 'text/html' } }); if (resp.ok) doc = new DOMParser().parseFromString(await resp.text(), 'text/html'); } catch (e) { doc = null; }
    const langDoc = doc ? (doc.documentElement.getAttribute('lang') || '').toLowerCase() : '';
    if (!doc || !langDoc.startsWith(lang)) { out.naoMedidos.push((lang || 'padrao') + (doc ? ' (veio ' + (langDoc || doc.title.slice(0, 30)) + ')' : ' (sem resposta)')); return null; }
    const pares = [...doc.querySelectorAll(sel)];
    raizes.forEach((r, k) => { const p = pares[idx[k]]; if (p) r.innerHTML = p.innerHTML; });
    de.setAttribute('lang', langDoc);
    if (doc.documentElement.getAttribute('dir')) de.setAttribute('dir', doc.documentElement.getAttribute('dir')); else de.removeAttribute('dir');
    await quadro();
    return medir();
  };
  try {
    // linha de base: o HTML servido no idioma padrao pelo mesmo caminho (o DOM vivo ja foi mexido pelo JS do tema)
    const base = (await naPagina(location.href, langAtual)) || medir();
    for (const [lang, url] of alvos) {
      if (pausa) await new Promise((ok) => setTimeout(ok, pausa));
      const m = await naPagina(url, lang);
      if (!m) continue;
      out.idiomas.push(lang);
      const novos = [...m].filter(([k]) => !base.has(k)).map(([, v]) => v);
      if (novos.length) out.achados[lang] = novos;
    }
  } finally {
    raizes.forEach((r, k) => { r.innerHTML = orig[k]; });
    if (origLang === null) de.removeAttribute('lang'); else de.setAttribute('lang', origLang);
    if (origDir === null) de.removeAttribute('dir'); else de.setAttribute('dir', origDir);
  }
  return out;
}
// Junta o resultado do encaixeIdiomas a pagina. Achado REPROVA (06/11/2026, obs. 0076): o achado so conta o que NAO aparece no idioma
// padrao (clamp de desenho, igual nos dois idiomas, nao entra), e os casos sinteticos do teste-invariantes provam as duas pontas
// (defeito em alemao pego como espremido/cortado; alemao que cabe e clamp igual ao do ingles sem achado), alem das 18 linguas x 2
// paginas da primeira rodada real (minhaloja.com, 03/11/2026) com 0 achado. Idioma nao medido segue aviso. Muta e devolve res.
function juntarEncaixe(res, enc) {
  res.avisos = res.avisos || [];
  const langs = Object.keys(enc.achados);
  if (langs.length) {
    res.failures = res.failures || [];
    res.failures.push('ENCAIXE_IDIOMA(' + langs.length + ' de ' + enc.idiomas.length + ' idiomas): ' + langs.slice(0, 6).map((l) => l + ': ' + enc.achados[l].slice(0, 2).join(', ')).join(' | '));
    res.pass = false;
  }
  if (enc.naoMedidos.length) res.avisos.push('ENCAIXE_IDIOMA_NAO_MEDIDO(' + enc.naoMedidos.length + '): ' + enc.naoMedidos.slice(0, 6).join(', '));
  res.metrics = res.metrics || {};
  res.metrics.encaixe = { idiomas: enc.idiomas.length, componentes: enc.componentes, comAchado: langs.length, naoMedidos: enc.naoMedidos.length };
  return res;
}

// ---- Helpers de plano ----
function buildUrls(domain, themeId, samples) {
  // samples: [{ handle, type }] type in product|collection|page|index|cart
  const base = /^https?:\/\//.test(domain) ? domain : 'https://' + domain; // http://127.0.0.1:porta = autoteste com pagina local
  const q = '?preview_theme_id=' + themeId;
  return samples.map((s) => {
    let path = '/';
    if (s.type === 'product') path = '/products/' + s.handle;
    else if (s.type === 'collection') path = '/collections/' + s.handle;
    else if (s.type === 'page') path = '/pages/' + s.handle;
    else if (s.type === 'cart') path = '/products/' + s.handle; // abrir drawer via JS depois
    else path = '/';
    return { label: s.type + ':' + (s.handle || 'home'), url: base + path + q, openCart: s.type === 'cart' };
  });
}

function parseSamples(str) {
  // "relogio-frame:product,best-sellers:collection,:index,relogio-frame:cart"
  return (str || '').split(',').filter(Boolean).map((p) => {
    const [handle, type] = p.split(':');
    return { handle: handle || '', type: type || 'index' };
  });
}

// Pior caso da PDP: o bug de galeria so aparece no produto com MAIS fotos (a fila
// de miniaturas empurra a coluna). O editor de tema abre um produto qualquer e nao
// mostra o erro — caso de uma loja, 25/09/2026: 2 fotos ok, 8 fotos = pagina de 748px
// num celular de 390. Sample "@mais-fotos:product" vira o handle com mais imagens.
async function resolveWorst(domain, samples) {
  if (!samples.some((s) => s.handle === '@mais-fotos')) return samples;
  let best = { handle: '', n: -1 };
  for (let page = 1; page <= 10; page++) {
    const r = await fetch('https://' + domain + '/products.json?limit=250&page=' + page);
    if (!r.ok) break;
    const { products = [] } = await r.json();
    if (!products.length) break;
    for (const p of products) if (p.images.length > best.n) best = { handle: p.handle, n: p.images.length };
  }
  if (!best.handle) throw new Error('@mais-fotos: products.json vazio em ' + domain);
  console.log('# pior caso da PDP: ' + best.handle + ' (' + best.n + ' fotos)');
  return samples.map((s) => (s.handle === '@mais-fotos' ? { ...s, handle: best.handle } : s));
}

// ---- CLI ----
function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : def;
}

const ASSERT_SRC = '(' + assertPage.toString() + ')()';

async function main() {
  const mode = process.argv.includes('--run') ? 'run'
    : process.argv.includes('--print-assert') ? 'assert'
    : process.argv.includes('--print-encaixe') ? 'encaixe'
    : 'plan';

  const domain = arg('domain', '');
  const themeId = arg('theme', '');
  let samples = parseSamples(arg('samples', ''));
  if (mode !== 'assert' && domain && samples.length) samples = await resolveWorst(domain, samples);

  if (mode === 'assert') {
    process.stdout.write(ASSERT_SRC + '\n');
    return;
  }
  if (mode === 'encaixe') { // corpo de browser_evaluate do encaixe por idioma (obs. 0076), para o caminho do Playwright MCP
    process.stdout.write('(' + encaixeIdiomas.toString() + ')(' + JSON.stringify({ sel: SEL_ENCAIXE, so: null, pausa: 400 }) + ')\n');
    return;
  }

  if (mode === 'plan') {
    if (!domain || !themeId || !samples.length) {
      console.log('QA SWEEP — Gate A\n');
      console.log('Uso (plano p/ Playwright MCP):');
      console.log('  node qa-sweep.mjs --plan --domain minhaloja.com --theme 157358456969 \\');
      console.log('       --samples "@mais-fotos:product,relogio-frame:product,best-sellers:collection,:index,relogio-frame:cart"');
      console.log('  @mais-fotos:product = OBRIGATORIO: resolve o produto com mais fotos (pior caso da galeria).');
      console.log('  -> imprime as URLs (mobile 390 + desktop 1280) e a funcao assertPage() pra browser_evaluate.\n');
      console.log('Standalone: acrescentar --run (precisa `npm i -D playwright` no dir do engine).');
      console.log('So a funcao de assert: --print-assert');
      console.log('Encaixe por idioma (loja multilingue): --print-encaixe; no --run, IDIOMAS=de,fr limita, IDIOMAS=0 desliga, ENCAIXE_SEL troca os componentes.');
      return;
    }
    const urls = buildUrls(domain, themeId, samples);
    console.log('# QA SWEEP PLAN — rodar CADA url em mobile 390 E desktop 1280 (Playwright MCP):');
    urls.forEach((u) => console.log((u.openCart ? '[cart] ' : '       ') + u.label + '  ->  ' + u.url));
    console.log('\n# Para cada pagina: browser_resize(390,844) e (1280,900), browser_navigate(url), browser_evaluate:');
    console.log('#   ' + ASSERT_SRC.slice(0, 60) + ' ...  (use --print-assert pra funcao completa)');
    console.log('# Cart: clique real no botao de compra da PDP (sem cart/clear.js + add.js + reload em laco: a loja responde 429), cd.open() se nao abrir, esperar ~2s.');
    console.log('# Cart, DOIS estados (16/10/2026): em contexto novo, ANTES do clique, conferir fetch(\'/cart.js\') em JSON com 0 itens, cd.open() e rodar o assert');
    console.log('#   (gaveta VAZIA); fechar, clicar em comprar, conferir /cart.js em JSON com >= 1 item e rodar o assert de novo (gaveta COM ITEM).');
    console.log('#   /cart.js em HTML ou sem item depois do clique = passo de carrinho FALHOU: a rodada e NAO MEDIDA, nunca "x/N verdes".');
    console.log('# Retorno BLOQUEIO_DA_LOJA ou CSS_NAO_CARREGADO = sem medida: esperar ~2 min (bloqueio) ou recarregar ate ~8x (CSS) e repetir.');
    console.log('# BLOQUEIA a entrega se qualquer pagina/viewport voltar pass:false. avisos[] vao no relatorio e NAO reprovam.');
    console.log('# PDPs: comparar metrics.pdp.blocos entre produtos (crossPdpSpec): bloco identico que contradiz a descricao = aviso PDP_STATIC_SPEC_BLOCK.');
    console.log('# Loja com mais de um idioma publicado (obs. 0076): no carrinho (gaveta aberta) e na colecao, a 390, browser_evaluate tambem com a');
    console.log('#   saida de --print-encaixe (troca o texto na propria pagina, idioma a idioma). Achado = ENCAIXE_IDIOMA, REPROVA (idioma nao medido segue aviso).');
    return;
  }

  // mode === 'run' (standalone com playwright, best-effort)
  const pw = await carregarPlaywright();
  if (!pw) {
    console.error('playwright nao encontrado (nem no engine nem no cache do npx). Duas saidas:');
    console.error('  1) rodar via Playwright MCP com o --plan acima (recomendado), OU');
    console.error('  2) cd _engine/revisor-clone-1a1 && npm i -D playwright && node qa-sweep.mjs --run ...');
    process.exit(2);
  }
  const { chromium } = pw;
  if (!domain || !themeId || !samples.length) { console.error('faltou --domain/--theme/--samples'); process.exit(2); }

  const urls = buildUrls(domain, themeId, samples);
  const browser = await abrirNavegador(chromium, { args: ['--disable-blink-features=AutomationControlled'] }).catch((e) => { console.error(String(e.message || e)); process.exit(2); });
  // UA de Chrome comum DA MESMA VERSAO do navegador + domcontentloaded: o UA HeadlessChrome e o 'load' longo aceleram o
  // desafio de bot (15/10/2026); com a versao do proprio navegador o Gate A deu 40/40 sem bloqueio (16/10/2026, obs. 0055)
  const UA = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Safari/537.36`;
  const abre = (page, url) => abrirPagina(page, url, { espera: process.env.NAV_ESPERA_MS !== undefined ? +process.env.NAV_ESPERA_MS : 120000, aviso: (m) => console.log('# ' + m) });
  const abreGaveta = async (page) => { await page.evaluate(() => { const cd = document.querySelector('cart-drawer'); if (cd && cd.open) cd.open(); }); await page.waitForTimeout(2200); };
  let anyFail = false, naoMedido = 0, comAviso = 0;
  const pdps = [], registros = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, userAgent: UA });
    const page = await ctx.newPage();
    for (const u of urls) {
      let ctxC = null;
      try {
        // carrinho: contexto novo (comeca vazio), gaveta medida vazia e com item, /cart.js conferido em JSON (16/10/2026)
        let pg = page;
        if (u.openCart) { ctxC = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, userAgent: UA }); pg = await ctxC.newPage(); }
        await abre(pg, u.url);
        let passo = null;
        if (u.openCart) {
          passo = await passoCarrinho(pg, (p) => p.evaluate(assertPage), abreGaveta);
          if (passo.falhou) {
            naoMedido++; anyFail = true;
            console.log(`[${vp.name}] NAO MEDIDO  ${u.label}\n    - ${passo.falhou}`);
            continue;
          }
        }
        let res = await pg.evaluate(assertPage);
        let recargas = 0;
        while (res.cssPending && recargas < 8) {
          recargas++; await pg.waitForTimeout(4000); await abre(pg, u.url);
          if (u.openCart) await abreGaveta(pg);
          res = await pg.evaluate(assertPage);
        }
        if (res.blocked) {
          await pg.waitForTimeout(120000); await abre(pg, u.url);
          if (u.openCart) await abreGaveta(pg);
          res = await pg.evaluate(assertPage);
        }
        if (passo) juntarGavetaVazia(res, passo.vazia);
        // encaixe nos idiomas publicados (obs. 0076, 03/11/2026): gaveta, abas da PDP e cards da colecao medidos em cada idioma,
        // com o texto trocado na propria pagina, so a 390 (o mesmo do sweep-node). Achado ENCAIXE_IDIOMA reprova desde 06/11/2026 (idioma nao medido segue aviso).
        if ((u.openCart || u.label.startsWith('collection:')) && vp.name === 'mobile' && process.env.IDIOMAS !== '0' && !res.blocked && !res.cssPending) {
          const enc = await pg.evaluate(encaixeIdiomas, { sel: process.env.ENCAIXE_SEL || SEL_ENCAIXE, so: process.env.IDIOMAS ? process.env.IDIOMAS.split(',') : null, pausa: 400 })
            .catch((e) => ({ idiomas: [], componentes: 0, achados: {}, naoMedidos: ['erro: ' + String(e).slice(0, 80)] }));
          juntarEncaixe(res, enc);
          if (enc.idiomas.length || enc.naoMedidos.length) console.log(`[${vp.name}] encaixe ${u.label}: ${enc.idiomas.length} idioma(s) medido(s), ${Object.keys(enc.achados).length} com achado, ${enc.naoMedidos.length} nao medido(s), ${enc.componentes} componente(s)`);
        }
        if (res.metrics && res.metrics.pdp) pdps.push(res.metrics.pdp);
        registros.push({ vp: vp.name, label: u.label, res });
        const tag = res.pass ? 'PASS' : (res.blocked ? 'BLOQUEADO' : 'FAIL');
        if (res.blocked) naoMedido++; // desafio de bot depois da espera: sem medida, nao reprova o tema (obs. 0016)
        else if (!res.pass) anyFail = true;
        if ((res.avisos || []).length) comAviso++;
        console.log(`[${vp.name}] ${tag}  ${u.label}` + (recargas ? ` (CSS servido apos ${recargas} recarga(s))` : '') + (res.metrics && res.metrics.imgMaxRatio ? ` (maior imagem ${res.metrics.imgMaxRatio}x)` : '') + (res.pass ? '' : '\n    - ' + res.failures.join('\n    - ')) + ((res.avisos || []).length ? '\n    ~ AVISO ' + res.avisos.join('\n    ~ AVISO ') : ''));
      } catch (e) {
        if (e && e.navegacao) { // infraestrutura (loja limitando, rede): sem medida, nao reprova o tema (obs. 0371)
          naoMedido++;
          console.log(`[${vp.name}] NAO MEDIDO  ${u.label}\n    - NAVEGACAO_TIMEOUT: ${String(e.message || e).split('\n')[0].slice(0, 120)} (falhou duas vezes; nao e medida do tema)`);
        } else {
          anyFail = true;
          console.log(`[${vp.name}] ERROR ${u.label}: ${String(e).slice(0, 120)}`);
        }
      } finally {
        if (ctxC) await ctxC.close().catch(() => {});
      }
    }
    await ctx.close();
  }
  await browser.close();
  const spec = crossPdpSpec(pdps);
  for (const a of spec) console.log(`~ AVISO PDP_STATIC_SPEC_BLOCK: "${a.titulo}" identico em ${a.handles.join(', ')}: ${a.motivo}`);
  if (comAviso || spec.length) console.log(`\n${comAviso} pagina(s) com AVISO${spec.length ? ' + ' + spec.length + ' bloco(s) de ficha repetido(s)' : ''} (aviso NAO reprova; conferir e corrigir o que for defeito).`);
  if (naoMedido) {
    console.log(`\nSWEEP NAO MEDIDO: ${naoMedido} pagina(s) sem medida (passo de carrinho falhou, desafio de bot da loja ou NAVEGACAO_TIMEOUT): rodada invalida, nao vale como verde nem como vermelho de tema. Esperar ~2 min e rodar de novo.`);
    process.exit(2);
  }
  // gates de dados (nao precisam de navegador): referencia de imagem morta, section ligada com midia vazia
  // (placeholder/cartao preto, uma loja 07/11/2026) e material em conflito.
  // So rodam com --loja <x>.myshopify.com, porque leem a Admin API. Sem a flag, avisam e seguem.
  const flagLoja = (process.argv.find(a => a.startsWith('--loja=')) || '').split('=')[1]
    || (/\.myshopify\.com$/.test(domain) ? domain : null);
  if (!flagLoja) {
    console.log('\n~ AVISO: gate-imagens-tema, gate-midia-vazia e gate-material NAO rodaram (faltou --loja=<x>.myshopify.com).');
  } else {
    const { execFileSync } = await import('node:child_process');
    const aqui = decodeURIComponent(new URL('.', import.meta.url).pathname); // pasta com espaco no nome: sem decode vira %20 e o node nao acha o gate (07/11/2026)
    for (const g of ['gate-imagens-tema.mjs', 'gate-midia-vazia.mjs', 'gate-material.mjs']) {
      try {
        console.log('\n' + execFileSync('node', [aqui + g, flagLoja], { encoding: 'utf8' }).trim());
      } catch (e) {
        anyFail = true;
        console.log('\n' + String(e.stdout || e.message).trim());
      }
    }
  }

  console.log('\n' + (anyFail ? 'SWEEP VERMELHO — NAO entregar. Corrigir e re-rodar.' : 'SWEEP VERDE — invariantes ok.'));
  process.exit(anyFail ? 1 : 0);
}

main();

export { abrirPagina, ehErroNavegacao, assertPage, buildUrls, parseSamples, ASSERT_SRC, VIEWPORTS, crossPdpSpec, lerCarrinho, passoCarrinho, juntarGavetaVazia, SEL_ENCAIXE, encaixeIdiomas, juntarEncaixe };
