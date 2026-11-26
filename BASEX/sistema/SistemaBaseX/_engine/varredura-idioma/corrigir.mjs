#!/usr/bin/env node
// Correções que a varredura de idioma sabe propor.
//
// Escopo deliberadamente estreito: só o que dá para consertar sem inventar
// texto. Traduzir título e descrição é trabalho de linguagem e passa por
// julgamento; re-slugificar um handle a partir de um título que já está no
// idioma certo, e trocar "Cor" por "Color", é mecânico e verificável.
//
// O que este arquivo NÃO faz, de propósito:
//   - traduzir prosa (título, descrição, SEO). Vai para a fila humana
//   - aplicar qualquer coisa sozinho. Ele PROPÕE. A escrita na loja ao vivo não
//     está implementada; --ensaio aplica a proposta numa cópia em memória

const ROTULO_ALVO = {
  en: { cor: "Color", tamanho: "Size", modelo: "Model", material: "Material", estilo: "Style",
        couleur: "Color", taille: "Size", farbe: "Color", "größe": "Size", grosse: "Size",
        "tamaño": "Size", talla: "Size", cantidad: "Quantity", quantidade: "Quantity" },
  pt: { color: "Cor", colour: "Cor", size: "Tamanho", couleur: "Cor", taille: "Tamanho",
        farbe: "Cor", "tamaño": "Tamanho" },
  es: { color: "Color", size: "Talla", cor: "Color", tamanho: "Talla", couleur: "Color", taille: "Talla" },
  fr: { color: "Couleur", colour: "Couleur", size: "Taille", cor: "Couleur", tamanho: "Taille" },
  de: { color: "Farbe", colour: "Farbe", size: "Größe", cor: "Farbe", tamanho: "Größe" },
};

/** Slug no padrão da Shopify: minúsculo, sem acento, hífen entre palavras. */
export function slugificar(texto) {
  return String(texto || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // tira acento
    .replace(/[®™©]/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 255);
}

/**
 * Monta a proposta de correção de um produto.
 * @param {object} produto
 * @param {Array}  campos  pendências daquele produto (saída de porProduto)
 * @param {string} alvo    idioma-alvo
 * @returns {{aplicaveis:Array, manuais:Array}}
 */
export function proporCorrecao(produto, campos, alvo) {
  const aplicaveis = [], manuais = [];

  for (const c of campos) {
    if (c.campo === "handle") {
      // O handle novo nasce do título, que já está no idioma certo. Se o título
      // também estivesse errado, a pendência de título viria junto e cairia na
      // fila manual, e aí o handle espera a tradução em vez de ser slugificado
      // em cima de texto errado.
      const tituloErrado = campos.some(x => x.campo === "title");
      if (tituloErrado) { manuais.push({ ...c, motivo: "título também está fora do idioma; traduzir antes de re-slugificar" }); continue; }
      const novo = slugificar(produto.title);
      if (!novo || novo === produto.handle) { manuais.push({ ...c, motivo: "slug do título não resolve" }); continue; }
      aplicaveis.push({
        campo: "handle", de: produto.handle, para: novo,
        // Handle antigo que já circula em anúncio, e-mail e link salvo por
        // cliente quebra sem isto. A regra exige o 301 na MESMA operação.
        // Este campo é só a proposta do redirect: nada o cria.
        redirect_301: { de: `/products/${produto.handle}`, para: `/products/${novo}` },
      });
      continue;
    }

    if (c.campo === "options[].name") {
      const atual = String(c.trecho || "").trim();
      const novo = (ROTULO_ALVO[alvo] || {})[atual.toLowerCase()];
      if (!novo) { manuais.push({ ...c, motivo: `sem tradução conhecida para o rótulo "${atual}"` }); continue; }
      aplicaveis.push({ campo: "options[].name", de: atual, para: novo });
      continue;
    }

    // Prosa e valor de variante exigem tradução, que é julgamento de linguagem.
    manuais.push({ ...c, motivo: "exige tradução, não é substituição mecânica" });
  }

  return { aplicaveis, manuais };
}

/**
 * Aplica a proposta numa cópia em memória do catálogo. É o que permite ensaiar
 * a correção inteira e ver o loop convergir antes de tocar numa loja de verdade.
 */
export function aplicarEmMemoria(produtos, produto_id, aplicaveis) {
  const p = produtos.find(x => x.id === produto_id);
  if (!p) return 0;
  let n = 0;
  for (const a of aplicaveis) {
    if (a.campo === "handle") { p.handle = a.para; n++; }
    else if (a.campo === "options[].name") {
      for (const o of p.options || []) {
        if (String(o.name).toLowerCase() === String(a.de).toLowerCase()) { o.name = a.para; n++; }
      }
    }
  }
  return n;
}
