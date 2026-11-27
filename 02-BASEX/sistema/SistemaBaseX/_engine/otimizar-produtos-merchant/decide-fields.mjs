#!/usr/bin/env node
// decide-fields.mjs v1.2 - + custom_label_0 (slug produto) e custom_label_1 (signature variante)
// Uso: node decide-fields.mjs --snapshot path.json --lang es-ES [--default-gender auto]
//      --brand-rename "marcaantiga,marcaantigo=marcanova" (opcional)
//      --custom-product true|false (padrao true = produto sem GTIN/MPN)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTaxonomy } from './taxonomy-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, arr) => {
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq > -1) {
        // forma --chave=valor
        acc.push([arg.slice(2, eq), arg.slice(eq + 1)]);
      } else {
        const key = arg.slice(2);
        const value = arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true;
        acc.push([key, value]);
      }
    }
    return acc;
  }, [])
);

// Aceita --flag, --flag true, --flag=false, --flag no. Ausente devolve o padrao.
function boolArg(v, padrao) {
  if (v === undefined) return padrao;
  if (v === true) return true;
  return !/^(false|0|no|nao)$/i.test(String(v).trim());
}

const snapshotPath = args.snapshot;
const lang = args.lang || 'es-ES';
const defaultGender = args['default-gender'] || 'auto';
const defaultAgeGroup = args['default-age-group'] || 'adult';
const dryRun = boolArg(args['dry-run'], true);
const minScore = parseFloat(args['min-score'] || '0.3');
// custom_product vira identifier_exists no feed do Google.
// true  = produto SEM GTIN/MPN (padrao desta engine, que nao preenche esses dois campos)
// false = so use se os produtos realmente tiverem GTIN ou MPN cadastrado
const customProduct = boolArg(args['custom-product'], true) ? 'true' : 'false';

// --brand-rename "from1,from2=to" → renomeia ocorrencias no slug do custom_label_0
// Ex: "marcaantiga,marcaantigo=marcanova" troca essas grafias pelo nome novo
const brandRenameArg = args['brand-rename'] || '';
const brandRenameMap = brandRenameArg
  ? (() => {
      const [from, to] = brandRenameArg.split('=');
      const sources = from.split(',').map((s) => s.trim()).filter(Boolean);
      return { sources, target: (to || '').trim() };
    })()
  : null;

if (!snapshotPath) {
  console.error('ERRO: --snapshot {path.json} obrigatorio');
  process.exit(2);
}

const snap = JSON.parse(readFileSync(snapshotPath, 'utf-8'));

// Taxonomia (taxonomy/{lang}.txt, o arquivo oficial do Google)
let tax;
try {
  tax = loadTaxonomy(__dirname, lang);
} catch (e) {
  console.error('ERRO: ' + e.message);
  process.exit(3);
}

// IDs que representam "sem categoria" / "Uncategorized" / placeholder default Shopify
const UNCATEGORIZED_IDS = new Set([
  'gid://shopify/ProductTaxonomyNode/9483', // "Sem categoria"
  '9483',
]);

// Hints de contexto - restringe busca por rama da taxonomia
// Se algum trigger casa no productType/title, BOOST se categoria comeca com algum dos boost_roots
// e PENALTY se categoria comeca com algum dos penalty_roots.
const CATEGORY_HINTS = {
  'es-ES': [
    { triggers: ['cartera','billetera','monedero','wallet','billfold'], target_ids: [2668], boost_roots: ['Ropa y accesorios > Bolsos, billeteras y estuches'], penalty_roots: ['Equipamiento deportivo', 'Material de oficina', 'Bricolaje'] },
    { triggers: ['cinturon','cinto','belt'], target_ids: [169], boost_roots: ['Ropa y accesorios > Complementos > Cinturones'], penalty_roots: ['Equipamiento deportivo', 'Bricolaje', 'Economía e industria'] },
    { triggers: ['caja regalo','caja de regalo','gift box','envoltorio de regalo'], target_ids: [5091], boost_roots: ['Arte y ocio > Fiestas y celebraciones > Regalos'], penalty_roots: ['Material de oficina', 'Alimentación'] },
    { triggers: ['reloj','watch','wristwatch'], target_ids: [201], boost_roots: ['Ropa y accesorios > Complementos > Relojes de pulsera'], penalty_roots: ['Bricolaje'] },
    { triggers: ['bolso','bolsa','handbag','purse'], target_ids: [3032], boost_roots: ['Ropa y accesorios > Bolsos, billeteras y estuches'], penalty_roots: ['Equipamiento deportivo'] },
    { triggers: ['mochila','backpack'], target_ids: [5181], boost_roots: ['Maletas y bolsas de viaje > Mochilas'], penalty_roots: [] },
    { triggers: ['zapato','calzado','shoe'], boost_roots: ['Ropa y accesorios > Calzado'], penalty_roots: ['Equipamiento deportivo'] },
    { triggers: ['camisa','camiseta','playera','shirt'], boost_roots: ['Ropa y accesorios > Ropa'], penalty_roots: [] },
    { triggers: ['gorra','sombrero','cap','hat'], boost_roots: ['Ropa y accesorios > Complementos > Sombreros'], penalty_roots: [] },
    { triggers: ['gafas','lentes','sunglasses'], boost_roots: ['Ropa y accesorios > Complementos > Gafas de sol'], penalty_roots: [] },
    { triggers: ['anillo','sortija','ring'], boost_roots: ['Ropa y accesorios > Joyería'], penalty_roots: [] },
    { triggers: ['pulsera','brazalete','bracelet'], boost_roots: ['Ropa y accesorios > Joyería > Pulseras'], penalty_roots: [] },
    { triggers: ['collar','cadena','necklace'], boost_roots: ['Ropa y accesorios > Joyería > Collares'], penalty_roots: [] },
    { triggers: ['llavero','keychain'], boost_roots: ['Ropa y accesorios > Accesorios para bolsos y billeteras > Llaveros'], penalty_roots: [] },
  ],
  'en-US': [
    { triggers: ['wallet','billfold','money clip'], target_ids: [5841], boost_roots: ['Apparel & Accessories > Handbags, Wallets'], penalty_roots: ['Sporting Goods', 'Office Supplies'] },
    { triggers: ['belt'], target_ids: [187], boost_roots: ['Apparel & Accessories > Clothing Accessories > Belts'], penalty_roots: ['Sporting Goods', 'Hardware'] },
    { triggers: ['gift box','wrapping'], target_ids: [4998], boost_roots: ['Arts & Entertainment > Party & Celebration'], penalty_roots: ['Office Supplies'] },
    { triggers: ['watch','wristwatch'], target_ids: [201], boost_roots: ['Apparel & Accessories > Clothing Accessories > Wristwatches'], penalty_roots: [] },
    { triggers: ['handbag','purse'], target_ids: [167], boost_roots: ['Apparel & Accessories > Handbags, Wallets & Cases'], penalty_roots: [] },
  ],
  'pt-BR': [
    { triggers: ['carteira'], target_ids: [2668], boost_roots: ['Roupas e acessórios > Bolsas, carteiras e maletas'], penalty_roots: ['Equipamento esportivo', 'Material de escritório'] },
    { triggers: ['cinto'], target_ids: [169], boost_roots: ['Roupas e acessórios > Acessórios de roupas > Cintos'], penalty_roots: ['Equipamento esportivo'] },
    { triggers: ['caixa de presente'], target_ids: [5091], boost_roots: ['Arte e entretenimento'], penalty_roots: [] },
  ],
};

// Sinonimos por idioma - expandir tokens do produto antes de match
const SYNONYMS = {
  'es-ES': {
    cartera: ['cartera', 'billetera', 'monedero'],
    billetera: ['cartera', 'billetera'],
    cinturon: ['cinturon', 'cinto'],
    cinto: ['cinturon', 'cinto'],
    caja: ['caja', 'estuche', 'envoltorio'],
    regalo: ['regalo', 'obsequio'],
    reloj: ['reloj', 'pulsera'],
    bolso: ['bolso', 'bolsa'],
    zapato: ['zapato', 'calzado'],
    camisa: ['camisa', 'camiseta', 'remera'],
    gorra: ['gorra', 'sombrero'],
    gafas: ['gafas', 'lentes', 'sol'],
    pulsera: ['pulsera', 'brazalete'],
    collar: ['collar', 'cadena'],
    anillo: ['anillo', 'sortija'],
    pendiente: ['pendiente', 'arete'],
  },
  'en-US': {
    wallet: ['wallet', 'billfold', 'money', 'clip'],
    belt: ['belt'],
    watch: ['watch', 'wristwatch'],
    bag: ['bag', 'purse', 'handbag'],
    sunglasses: ['sunglasses', 'shades'],
    hat: ['hat', 'cap'],
  },
  'pt-BR': {
    carteira: ['carteira', 'billfold'],
    cinto: ['cinto'],
    relogio: ['relogio'],
    bolsa: ['bolsa', 'bolso'],
    oculos: ['oculos', 'sol'],
  },
};

const COLORS = {
  'es-ES': ['negro','negra','blanco','blanca','rojo','roja','azul','verde','amarillo','amarilla','rosa','morado','morada','naranja','marron','marrón','beige','gris','dorado','dorada','plateado','plateada','vino','turquesa','celeste','crema','caqui','coral','fucsia','lila','menta','oliva','salmon','salmón','violeta'],
  'en-US': ['black','white','red','blue','green','yellow','pink','purple','orange','brown','beige','gray','grey','gold','silver','wine','turquoise','cream','khaki','coral','fuchsia','lilac','mint','olive','salmon','violet','navy','maroon','teal'],
  'pt-BR': ['preto','preta','branco','branca','vermelho','vermelha','azul','verde','amarelo','amarela','rosa','roxo','roxa','laranja','marrom','bege','cinza','dourado','dourada','prateado','prateada','vinho','turquesa','celeste','creme','caqui','coral','fucsia','lilás','menta','oliva','salmão','violeta'],
};

const SIZE_PATTERNS = /^(XXS|XS|S|M|L|XL|XXL|XXXL|\d{2,3}|único|único|único|único|único|one\s*size|único)$/i;

const GENDER_SIGNALS = {
  female: ['mujer','women','woman','lady','feminino','femenino','female','girl','girls','her','dama'],
  male: ['hombre','men','man','masculino','male','boy','boys','his','him','gentleman','caballero'],
};

const ONE_SIZE = { 'es-ES': 'Único', 'en-US': 'One Size', 'pt-BR': 'Único' };

function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function expandWithSynonyms(tokens, lang) {
  const syn = SYNONYMS[lang] || {};
  const expanded = new Set();
  for (const t of tokens) {
    expanded.add(t);
    if (syn[t]) for (const s of syn[t]) expanded.add(s);
  }
  return Array.from(expanded);
}

function findBestCategory(product, lang, tax) {
  // Tokens do produto: title + productType + tags relevantes
  const text = `${product.title || ''} ${product.productType || ''} ${(product.tags || []).join(' ')}`;
  const rawTokens = normalize(text);
  const productTokens = new Set(expandWithSynonyms(rawTokens, lang));

  // Identificar hints aplicaveis (boost/penalty roots + target_ids)
  const hints = CATEGORY_HINTS[lang] || [];
  const textLower = text.toLowerCase();
  const activeHints = hints.filter((h) => h.triggers.some((t) => textLower.includes(t)));
  const boostRoots = activeHints.flatMap((h) => h.boost_roots || []);
  const penaltyRoots = activeHints.flatMap((h) => h.penalty_roots || []);
  const targetIds = new Set(activeHints.flatMap((h) => h.target_ids || []));

  // SHORT-CIRCUIT: se algum target_id existe na taxonomia, retornar direto com score alto
  if (targetIds.size > 0) {
    for (const cat of tax.categories) {
      if (targetIds.has(cat.id)) {
        return { id: cat.id, full_path: cat.full_path, score: 10.0, segments: cat.segments, source: 'target_id' };
      }
    }
  }

  // Score cada categoria
  let best = { id: null, full_path: null, score: 0 };
  for (const cat of tax.categories) {
    const catTokens = new Set(cat.tokens);
    let overlap = 0;
    let lastSegmentMatches = 0;
    const lastSeg = normalize(cat.segments[cat.segments.length - 1]);
    for (const t of productTokens) {
      if (catTokens.has(t)) overlap++;
      if (lastSeg.includes(t)) lastSegmentMatches++;
    }
    const baseScore = overlap / Math.max(productTokens.size, catTokens.size);
    const lastSegBoost = lastSegmentMatches / Math.max(lastSeg.length, 1);
    const depthBonus = cat.segments.length * 0.05;
    let score = baseScore + lastSegBoost * 0.5 + depthBonus * 0.1;

    // Aplicar hints
    if (boostRoots.length > 0) {
      // BOOST 3x se categoria comeca com algum boost_root (match prefixo no full_path)
      if (boostRoots.some((r) => cat.full_path.startsWith(r))) {
        score *= 3.0;
      }
    }
    if (penaltyRoots.length > 0) {
      // PENALTY 0.2x se categoria comeca com algum penalty_root
      if (penaltyRoots.some((r) => cat.full_path.startsWith(r))) {
        score *= 0.2;
      }
    }

    if (score > best.score) {
      best = { id: cat.id, full_path: cat.full_path, score, segments: cat.segments };
    }
  }
  return best;
}

function detectColor(text, lang) {
  const t = String(text || '').toLowerCase();
  for (const c of COLORS[lang] || []) {
    const re = new RegExp(`\\b${c}\\b`, 'i');
    if (re.test(t)) return c.charAt(0).toUpperCase() + c.slice(1);
  }
  return null;
}

function extractColorFromTitle(title) {
  const parts = String(title || '').split(/\s*\|\s*|\s+-\s+/);
  if (parts.length >= 2) {
    const last = parts.slice(-1)[0].trim();
    if (last && last.length <= 30) return last;
  }
  return null;
}

function detectSize(variantOptions) {
  for (const opt of variantOptions || []) {
    const v = String(opt.value || '').trim();
    if (SIZE_PATTERNS.test(v)) return v.toUpperCase();
    if (/^[Tt]alla\s+/.test(v)) return v.replace(/^[Tt]alla\s+/, '').trim();
  }
  return null;
}

function detectGender(product, defaultGender) {
  if (defaultGender !== 'auto') return defaultGender;
  const text = `${product.title} ${product.productType} ${(product.tags || []).join(' ')}`.toLowerCase();
  for (const [g, signals] of Object.entries(GENDER_SIGNALS)) {
    for (const s of signals) {
      if (new RegExp(`\\b${s}\\b`, 'i').test(text)) return g;
    }
  }
  return 'unisex';
}

function existingMeta(metafields, key) {
  return metafields?.nodes?.find((m) => m.key === key)?.value || null;
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// custom_label_0 = slug curto do produto (uniquo por produto, igual em todas variantes)
// Aplica brand-rename se configurado (ex: marcaantiga → marcanova)
function buildCustomLabel0(p) {
  let base = String(p.handle || slugify(p.title)).toLowerCase();
  if (brandRenameMap) {
    for (const src of brandRenameMap.sources) {
      base = base.replace(new RegExp(`\\b${src}\\b`, 'gi'), brandRenameMap.target);
    }
  }
  // Limpar hifens duplicados que possam aparecer apos rename
  return base.replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
}

// custom_label_1 = signature da variante
// Se tem options reais → concatena valores (ex: "marron-110")
// Se eh variante unica (Default Title) → usa cor detectada do produto ou 'single'
function buildCustomLabel1(v, p) {
  const realOpts = (v.option1 || []).filter((o) => {
    const n = String(o.name || '').toLowerCase();
    const val = String(o.value || '').toLowerCase();
    return n !== 'título' && n !== 'titulo' && n !== 'title' && val !== 'default title';
  });
  if (realOpts.length > 0) {
    return realOpts.map((o) => slugify(o.value)).filter(Boolean).join('-').slice(0, 100);
  }
  // Fallback pra produto sem variante real: cor extraida do title
  const titleColor = extractColorFromTitle(p.title);
  if (titleColor) return slugify(titleColor);
  return 'single';
}

function hasRealCategory(product) {
  const id = product.productCategory?.productTaxonomyNode?.id;
  if (!id) return false;
  // Tratar IDs uncategorized como "vazio"
  if (UNCATEGORIZED_IDS.has(id) || UNCATEGORIZED_IDS.has(String(id).split('/').pop())) return false;
  const name = product.productCategory?.productTaxonomyNode?.fullName?.toLowerCase() || '';
  if (name.includes('sem categoria') || name.includes('uncategorized') || name.includes('sin categoria')) return false;
  return true;
}

// Build plan
const plan = {
  store: snap.store,
  lang,
  generated_at: new Date().toISOString(),
  dry_run: dryRun,
  defaults: { gender: defaultGender, age_group: defaultAgeGroup },
  min_score_taxonomy: minScore,
  products: [],
};

let stats = { needs_update: 0, no_change: 0, by_field: { product_category: 0, color: 0, size: 0, age_group: 0, gender: 0, condition: 0, custom_product: 0, custom_label_0: 0, custom_label_1: 0 }, low_confidence_taxonomy: 0 };

for (const p of snap.products) {
  const productChanges = {};
  const variantChanges = {};

  // Product-level fields
  const existingAge = existingMeta(p.metafields, 'age_group');
  const existingGender = existingMeta(p.metafields, 'gender');
  const existingCondition = existingMeta(p.metafields, 'condition');
  const existingCustom = existingMeta(p.metafields, 'custom_product');

  if (!existingAge) {
    productChanges.age_group = defaultAgeGroup;
    stats.by_field.age_group++;
  }
  if (!existingGender) {
    productChanges.gender = detectGender(p, defaultGender);
    stats.by_field.gender++;
  }
  if (!existingCondition) {
    productChanges.condition = 'new';
    stats.by_field.condition++;
  }
  if (!existingCustom) {
    // Esta engine nao preenche GTIN nem MPN, entao declara identifier_exists=no
    productChanges.custom_product = customProduct;
    stats.by_field.custom_product++;
  }

  // google_product_category metafield (Google Shopping feed)
  // FIX: checar metafield 'google_product_category' especificamente — NAO o productCategory field
  // (productCategory eh responsabilidade da skill 06 SEO Gate F, e usa Shopify Taxonomy IDs diferentes)
  const existingGoogleCat = existingMeta(p.metafields, 'google_product_category');
  if (!existingGoogleCat) {
    const best = findBestCategory(p, lang, tax);
    if (best.id && best.score >= minScore) {
      productChanges.product_category = {
        id: best.id,
        full_path: best.full_path,
        score: Number(best.score.toFixed(3)),
        gid: `gid://shopify/ProductTaxonomyNode/${best.id}`,
      };
      stats.by_field.product_category++;
    } else {
      productChanges.product_category = {
        id: null,
        suggestion: best.full_path,
        suggestion_id: best.id,
        score: Number(best.score.toFixed(3)),
        status: 'LOW_CONFIDENCE_NEEDS_REVIEW',
      };
      stats.low_confidence_taxonomy++;
    }
  }

  // Variant-level — color/size proprios + REPLICA age_group/gender/condition/custom_product
  // do produto pra cada variante (bulk editor Google exige nos 2 niveis)
  const titleColor = extractColorFromTitle(p.title);
  const variantAgeGroup = productChanges.age_group || existingAge;
  const variantGender = productChanges.gender || existingGender;
  const variantCondition = productChanges.condition || existingCondition;
  const variantCustom = productChanges.custom_product ?? existingCustom;

  // custom_label_0 = slug do produto (mesmo valor pra todas variantes)
  const productCustomLabel0 = buildCustomLabel0(p);

  for (const v of p.variants?.nodes || []) {
    const vChanges = {};
    const existingVColor = existingMeta(v.metafields, 'color');
    const existingVSize = existingMeta(v.metafields, 'size');
    const existingVAge = existingMeta(v.metafields, 'age_group');
    const existingVGender = existingMeta(v.metafields, 'gender');
    const existingVCondition = existingMeta(v.metafields, 'condition');
    const existingVCustom = existingMeta(v.metafields, 'custom_product');
    const existingVCl0 = existingMeta(v.metafields, 'custom_label_0');
    const existingVCl1 = existingMeta(v.metafields, 'custom_label_1');

    if (!existingVColor) {
      const optColor = detectColor(v.option1?.map((o) => o.value).join(' '), lang);
      const variantColor = optColor || detectColor(v.title, lang);
      const finalColor = variantColor || titleColor;
      if (finalColor) {
        vChanges.color = finalColor;
        stats.by_field.color++;
      }
    }

    if (!existingVSize) {
      const size = detectSize(v.option1) || ONE_SIZE[lang];
      vChanges.size = size;
      stats.by_field.size++;
    }

    // Replicar campos do produto na variante quando vazios
    if (!existingVAge && variantAgeGroup) vChanges.age_group = variantAgeGroup;
    if (!existingVGender && variantGender) vChanges.gender = variantGender;
    if (!existingVCondition && variantCondition) vChanges.condition = variantCondition;
    if (!existingVCustom && variantCustom !== null && variantCustom !== undefined) vChanges.custom_product = String(variantCustom);

    // custom_label_0 (slug produto) — sempre setar se vazio
    if (!existingVCl0) {
      vChanges.custom_label_0 = productCustomLabel0;
      stats.by_field.custom_label_0++;
    }
    // custom_label_1 (signature variante) — sempre setar se vazio
    if (!existingVCl1) {
      vChanges.custom_label_1 = buildCustomLabel1(v, p);
      stats.by_field.custom_label_1++;
    }

    if (v.inventoryQuantity <= 0 && v.inventoryPolicy !== 'CONTINUE') {
      vChanges.inventory_policy = 'CONTINUE';
    }

    if (Object.keys(vChanges).length > 0) {
      variantChanges[v.id] = vChanges;
    }
  }

  if (Object.keys(productChanges).length > 0 || Object.keys(variantChanges).length > 0) {
    stats.needs_update++;
    plan.products.push({
      id: p.id,
      handle: p.handle,
      title: p.title,
      product_type: p.productType,
      current_category: p.productCategory?.productTaxonomyNode?.fullName || null,
      product_changes: productChanges,
      variant_changes: variantChanges,
    });
  } else {
    stats.no_change++;
  }
}

plan.stats = stats;

const plansDir = join(__dirname, 'plans');
mkdirSync(plansDir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const planPath = join(plansDir, `${snap.store}-${ts}.json`);
writeFileSync(planPath, JSON.stringify(plan, null, 2));

console.log('\n=== Plano de Otimizacao Merchant (v1.2 + custom_labels) ===');
console.log(`Store:       ${snap.store}`);
console.log(`Lang:        ${lang}`);
console.log(`Taxonomy:    ${tax.count} categorias`);
console.log(`Min score:   ${minScore}`);
console.log(`Total produtos: ${snap.products.length}`);
console.log(`A atualizar:    ${stats.needs_update}`);
console.log(`Sem mudanca:    ${stats.no_change}`);
console.log(`Low confidence taxonomy: ${stats.low_confidence_taxonomy}\n`);
console.log('Por campo (numero de produtos/variantes que vao receber valor):');
for (const [k, v] of Object.entries(stats.by_field)) {
  console.log(`  ${k.padEnd(20)} ${v}`);
}
console.log(`\nPlan salvo: ${planPath}`);
console.log(dryRun ? '\nDRY-RUN: nenhuma mutation foi aplicada.' : '');
