#!/usr/bin/env node
// Detector de idioma fora do alvo em catálogo Shopify.
//
// O caso que motivou: 32 produtos com título e descrição em português numa loja
// inglesa passaram por uma revisão completa sem serem pegos. A revisão tinha
// sido AMOSTRAL, e o SEO em inglês mascarava o conteúdo português por baixo.
//
// Daí as duas decisões centrais:
//   1. Varre TODOS os produtos e TODOS os campos visíveis. Nunca amostra.
//   2. Nunca usa o SEO nem o handle como prova de que o produto está certo. Foi
//      exatamente isso que enganou a revisão que falhou.
//
// DUAS CONFIANÇAS, e a distinção não é preciosismo. Marca de moda batiza cor em
// francês de propósito: "Legacy Noir" e "Dusk Blanc" numa loja inglesa de
// relógio são nome de modelo, não tradução esquecida. Se isso entrar na mesma
// lista que um "Cor" no lugar de "Color", a lista perde credibilidade e a
// pessoa para de ler. Então:
//
//   alta   → bloqueia. Prosa com duas ou mais marcas estruturais do idioma
//            errado, ou rótulo de campo que é tradução literal conhecida
//   baixa  → só relata. Uma marca isolada, ou palavra estrangeira dentro de
//            nome composto. Vai para revisão humana, não trava entrega

const limparHtml = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ");
const palavras = (s) => String(s || "").toLowerCase().normalize("NFC")
  .replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(w => w.length > 1);

// --- vocabulário estrutural (para prosa) ---
// Artigo, preposição, conjunção e verbo comum. Escolhidos por não serem
// traduzidos por engano nem virarem nome próprio.
const MARCAS = {
  pt: ["para", "com", "sem", "sua", "seu", "nossa", "nosso", "você", "voce", "mais", "muito",
       "cada", "todos", "todas", "quando", "porque", "também", "tambem", "então", "entao",
       "além", "alem", "através", "atraves", "qualquer", "sempre", "nunca", "onde", "quem",
       "isso", "esse", "essa", "aquele", "não", "nao", "são", "sao", "está", "esta", "estão",
       "tem", "ter", "ser", "foi", "pode", "vai", "faz", "dia", "vida", "coisa", "gente",
       "bolsa", "carteira", "porta", "cartão", "cartao", "couro", "tamanho", "preto",
       "branco", "azul", "verde", "vermelho", "amarelo", "cinza", "dourado", "prata",
       "feminino", "masculino", "frete", "compra", "envio", "entrega", "peça", "peca"],
  es: ["para", "con", "sin", "sus", "nuestro", "nuestra", "usted", "más", "mas", "muy",
       "cada", "todos", "todas", "cuando", "porque", "también", "tambien", "entonces",
       "además", "ademas", "cualquier", "siempre", "nunca", "donde", "quien", "eso", "ese",
       "esa", "aquel", "está", "están", "tiene", "ser", "fue", "puede", "hace", "día",
       "vida", "bolso", "cartera", "cuero", "tamaño", "negro", "blanco", "azul",
       "verde", "rojo", "amarillo", "gris", "dorado", "plata", "envío", "envio"],
  fr: ["pour", "avec", "sans", "votre", "notre", "vous", "plus", "très", "tres", "chaque",
       "tous", "toutes", "quand", "parce", "aussi", "alors", "toujours", "jamais",
       "qui", "cette", "celui", "sont", "peut", "fait", "jour", "vie", "sac",
       "portefeuille", "cuir", "taille", "couleur", "noir", "blanc", "bleu", "vert", "rouge",
       "jaune", "doré", "dore", "argent", "livraison"],
  de: ["für", "fur", "mit", "ohne", "ihre", "unser", "unsere", "mehr", "sehr",
       "jeder", "alle", "wenn", "weil", "auch", "dann", "immer", "wo", "wer",
       "diese", "dieser", "ist", "sind", "kann", "macht", "tag", "leben", "tasche",
       "geldbörse", "geldborse", "leder", "größe", "grosse", "farbe", "schwarz", "weiß",
       "weiss", "blau", "grün", "grun", "gelb", "grau", "versand"],
  en: ["for", "with", "without", "your", "our", "you", "more", "very", "each", "all",
       "when", "because", "also", "then", "always", "never", "where", "who", "this",
       "that", "are", "can", "makes", "day", "life", "bag", "wallet", "leather",
       "size", "color", "colour", "black", "white", "blue", "green", "red", "yellow",
       "grey", "gray", "golden", "silver", "shipping", "delivery"],
};

// Palavra presente em mais de um idioma da lista não prova nada. "para" é
// português e espanhol. Sem esta limpeza, loja espanhola seria acusada de estar
// em português.
const AMBIGUAS = (() => {
  const c = new Map();
  for (const ws of Object.values(MARCAS)) for (const w of new Set(ws)) c.set(w, (c.get(w) || 0) + 1);
  return new Set([...c].filter(([, n]) => n > 1).map(([w]) => w));
})();

// --- vocabulário fechado (para rótulo de campo) ---
// Nome de opção e tipo de produto vêm de um conjunto pequeno e previsível, então
// aqui casamento exato é confiável e dispensa estatística. É o campo que mais
// escapa: "Cor" e "Tamanho" sobrevivem à tradução do título.
const ROTULOS = {
  pt: ["cor", "tamanho", "modelo", "material", "estilo", "quantidade", "sabor", "voltagem", "medida"],
  es: ["color", "tamaño", "talla", "modelo", "material", "estilo", "cantidad", "sabor", "medida"],
  fr: ["couleur", "taille", "modèle", "modele", "matière", "matiere", "style", "quantité", "quantite"],
  de: ["farbe", "größe", "grosse", "modell", "material", "stil", "menge"],
  en: ["color", "colour", "size", "model", "material", "style", "quantity", "flavor", "flavour"],
};

/**
 * Idioma provável de um texto em prosa, pelas marcas estruturais.
 * Devolve null sem evidência suficiente: nome próprio, texto curto e lista de
 * material não são prova de idioma, e chutar aqui acusa produto correto.
 */
export function idiomaDe(texto, candidatos) {
  const ws = palavras(texto);
  if (ws.length < 3) return null;
  const set = new Set(ws);
  const placar = {};
  for (const idi of candidatos) {
    placar[idi] = (MARCAS[idi] || []).filter(m => !AMBIGUAS.has(m) && set.has(m)).length;
  }
  const ord = Object.entries(placar).sort((a, b) => b[1] - a[1]);
  if (!ord.length || ord[0][1] === 0) return null;
  if (ord[1] && ord[0][1] === ord[1][1]) return null;   // empate não decide nada
  return { idioma: ord[0][0], evidencia: ord[0][1], placar };
}

/** Rótulo de campo: casamento exato contra o vocabulário fechado. */
function rotuloDe(texto, alvo, candidatos) {
  const w = String(texto || "").trim().toLowerCase().normalize("NFC");
  if (!w || w.includes(" ")) return null;                     // rótulo é uma palavra
  if ((ROTULOS[alvo] || []).includes(w)) return null;          // já está no alvo
  for (const idi of candidatos) {
    if (idi !== alvo && (ROTULOS[idi] || []).includes(w)) return { idioma: idi };
  }
  return null;
}

/**
 * Valor de variante. Palavra estrangeira SOZINHA ("Noir") é tradução esquecida;
 * dentro de nome composto ("Legacy Noir") é batismo de marca, que moda faz de
 * propósito. Por isso a mesma palavra cai em confiança diferente conforme o
 * lugar onde aparece.
 */
function valorDe(valor, alvo, candidatos) {
  const ws = palavras(valor);
  if (!ws.length) return null;
  for (const idi of candidatos) {
    if (idi === alvo) continue;
    const marcas = (MARCAS[idi] || []).filter(m => !AMBIGUAS.has(m));
    const bate = ws.filter(w => marcas.includes(w));
    if (!bate.length) continue;
    // toda palavra do valor é do idioma errado → tradução esquecida
    if (bate.length === ws.length) return { idioma: idi, confianca: "alta", termo: bate.join(" ") };
    return { idioma: idi, confianca: "baixa", termo: bate.join(" ") };
  }
  return null;
}

const PROSA = [
  ["title", p => p.title],
  ["descriptionHtml", p => limparHtml(p.descriptionHtml)],
  ["seo.title", p => p.seo?.title],
  ["seo.description", p => p.seo?.description],
];

/**
 * Handle tem regra própria, e é a mais reveladora do catálogo.
 *
 * Ele não é prosa: é slug curto, então medir estatisticamente sempre daria
 * evidência fraca. Mas ele deveria ser a versão slugificada do título. Quando o
 * título está no idioma certo e o handle carrega palavra do idioma errado, os
 * dois se contradizem, e essa contradição só tem uma explicação: alguém
 * traduziu o título e não re-slugificou o handle.
 *
 * É o resíduo clássico desse conserto, e é o motivo de a regra exigir handle
 * re-slugificado NA MESMA operação, com 301 do antigo.
 */
function handleDe(p, alvo, candidatos) {
  const hs = palavras((p.handle || "").replace(/-/g, " "));
  if (!hs.length) return null;
  const noTitulo = new Set(palavras(p.title));
  for (const idi of candidatos) {
    if (idi === alvo) continue;
    const marcas = (MARCAS[idi] || []).filter(m => !AMBIGUAS.has(m));
    // Só interessa a palavra que está no handle e NÃO está no título: se
    // aparece nos dois, é nome da marca e o handle está apenas acompanhando.
    const sobra = hs.filter(w => marcas.includes(w) && !noTitulo.has(w));
    if (sobra.length) return { idioma: idi, confianca: "alta", termo: sobra.join(" ") };
  }
  return null;
}

/**
 * Varre o catálogo inteiro.
 * @param {Array} produtos  products.json local ou nós da Admin API
 * @param {string} alvo     idioma-alvo (ex: "en")
 * @param {object} [opts]   { outros: [...], permitidos: ["noir","blanc"] }
 */
export function varrerCatalogo(produtos, alvo, opts = {}) {
  const outros = opts.outros || Object.keys(MARCAS).filter(i => i !== alvo);
  const candidatos = [alvo, ...outros];
  // Termos confirmados como vocabulário da marca. Uma vez na lista, param de
  // aparecer: é o que impede a mesma discussão a cada varredura.
  const permitidos = new Set((opts.permitidos || []).map(s => s.toLowerCase()));
  const achados = [];
  const add = (p, campo, r, trecho, confianca) => {
    if (r.termo && r.termo.split(" ").every(t => permitidos.has(t))) return;
    achados.push({
      produto_id: p.id, titulo: p.title, handle: p.handle, status: p.status,
      campo, idioma_detectado: r.idioma, confianca,
      termo: r.termo || null, evidencia: r.evidencia ?? null,
      trecho: String(trecho).replace(/\s+/g, " ").trim().slice(0, 120),
    });
  };

  for (const p of produtos) {
    for (const [campo, ler] of PROSA) {
      const txt = ler(p);
      if (!txt) continue;
      const r = idiomaDe(txt, candidatos);
      if (!r || r.idioma === alvo) continue;
      // Duas marcas ou mais é prosa no idioma errado. Uma só pode ser nome
      // próprio que por acaso coincide com palavra comum.
      add(p, campo, r, txt, r.evidencia >= 2 ? "alta" : "baixa");
    }

    const rh = handleDe(p, alvo, candidatos);
    if (rh) add(p, "handle", rh, p.handle, rh.confianca);

    for (const [campo, valor] of [["productType", p.productType], ["vendor", p.vendor]]) {
      if (!valor) continue;
      const r = rotuloDe(valor, alvo, candidatos) || idiomaDe(valor, candidatos);
      if (r && r.idioma !== alvo) add(p, campo, r, valor, r.evidencia >= 2 ? "alta" : "baixa");
    }

    for (const o of p.options || []) {
      const r = rotuloDe(o.name, alvo, candidatos);
      if (r) add(p, "options[].name", r, o.name, "alta");
      const valores = o.values || (o.optionValues || []).map(v => v.name) || [];
      for (const v of valores) {
        const rv = valorDe(v, alvo, candidatos);
        if (rv) add(p, "optionValues[].name", rv, v, rv.confianca);
      }
    }

    for (const t of p.tags || []) {
      const rt = valorDe(t, alvo, candidatos);
      if (rt) add(p, "tags", rt, t, rt.confianca);
    }
  }
  return achados;
}

/** Agrupa por produto: produto com 4 campos errados é UM trabalho, não quatro. */
export function porProduto(achados) {
  const m = new Map();
  for (const a of achados) {
    if (!m.has(a.produto_id)) m.set(a.produto_id, {
      produto_id: a.produto_id, titulo: a.titulo, handle: a.handle, status: a.status,
      confianca: a.confianca, campos: [],
    });
    const e = m.get(a.produto_id);
    if (a.confianca === "alta") e.confianca = "alta";
    e.campos.push({ campo: a.campo, idioma: a.idioma_detectado, confianca: a.confianca, termo: a.termo, trecho: a.trecho });
  }
  return [...m.values()];
}
