#!/usr/bin/env node
// Leitor do Repositorio de Nichos da BaseX (https://basex-di3.pages.dev/nichos/).
//
// A pagina nao expoe endpoint JSON: /nichos/dados-nichos.json devolve o HTML da
// propria aplicacao. Os dados vivem embutidos no HTML, em quatro constantes
// JavaScript. Este leitor baixa a pagina, recorta essas constantes e responde
// perguntas sobre elas pela linha de comando.
//
// Uso:
//   node ler-acervo.mjs nichos
//   node ler-acervo.mjs nicho joias_semijoias
//   node ler-acervo.mjs lojas joias_semijoias --top 15
//   node ler-acervo.mjs dossies joias_semijoias
//   node ler-acervo.mjs dossie <dominio>
//   node ler-acervo.mjs veredito
//   node ler-acervo.mjs prompts
//   node ler-acervo.mjs buscar "pulseira"
//   (qualquer comando aceita --json e --atualizar)

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(AQUI, '.cache');
const CACHE_HTML = join(CACHE_DIR, 'nichos.html');
const FONTE = 'https://basex-di3.pages.dev/nichos/';
const VALIDADE_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------- argumentos

// Aceita --chave valor e --chave=valor. O parser antigo dos engines descartava a
// segunda forma calado, entao --dry-run=true nunca era respeitado.
function lerArgs(argv) {
  const livres = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { livres.push(a); continue; }
    const igual = a.indexOf('=');
    if (igual > -1) { flags[a.slice(2, igual)] = a.slice(igual + 1); continue; }
    const chave = a.slice(2);
    const prox = argv[i + 1];
    if (prox !== undefined && !prox.startsWith('--')) { flags[chave] = prox; i++; }
    else flags[chave] = true;
  }
  return { livres, flags };
}

// ------------------------------------------------------------------- download

async function idadeDoCache() {
  try { return Date.now() - (await stat(CACHE_HTML)).mtimeMs; }
  catch { return Infinity; }
}

async function baixarPagina(forcar) {
  const idade = await idadeDoCache();
  if (!forcar && idade < VALIDADE_MS) return readFile(CACHE_HTML, 'utf8');

  let html;
  try {
    const r = await fetch(FONTE, { headers: { 'user-agent': 'basex-acervo/1.0' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    html = await r.text();
  } catch (erro) {
    if (idade < Infinity) {
      const dias = (idade / 86400000).toFixed(1);
      console.error(`[aviso] nao consegui baixar o acervo (${erro.message}). Usando a copia local de ${dias} dia(s) atras.`);
      return readFile(CACHE_HTML, 'utf8');
    }
    throw new Error(
      `nao consegui baixar o acervo e nao existe copia local.\n` +
      `  fonte: ${FONTE}\n  erro : ${erro.message}\n` +
      `  Confira a internet e rode de novo.`
    );
  }

  if (html.length < 500_000) {
    throw new Error(`o acervo voltou com ${html.length} bytes, muito menor que o esperado. Nao vou gravar isso por cima do cache.`);
  }
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_HTML, html);
  return html;
}

// -------------------------------------------------------------- extracao JSON

// Recorta `const NOME = {...}` respeitando string, escape e aninhamento. Contar
// so chave abre/fecha quebra no primeiro `}` que aparece dentro de um texto.
function recortar(html, nome) {
  // O publicador da taxonomia nova grava um marcador antes do objeto:
  //   const ED  = /*__EDITORIAL__*/{...}
  // Sem pular o comentario, o recorte le "/" como abertura e morre.
  const m = new RegExp(`const\\s+${nome}\\s*=\\s*(?:/\\*[\\s\\S]*?\\*/\\s*)?`).exec(html);
  if (!m) throw new Error(`constante ${nome} nao encontrada no HTML do acervo`);
  const ini = m.index + m[0].length;
  const abre = html[ini];
  const fecha = { '{': '}', '[': ']' }[abre];
  if (!fecha) throw new Error(`constante ${nome} nao abre com { nem [`);

  let prof = 0, emString = false, escapando = false, aspa = '';
  for (let i = ini; i < html.length; i++) {
    const c = html[i];
    if (emString) {
      if (escapando) escapando = false;
      else if (c === '\\') escapando = true;
      else if (c === aspa) emString = false;
      continue;
    }
    if (c === '"' || c === "'") { emString = true; aspa = c; continue; }
    if (c === abre) prof++;
    else if (c === fecha && --prof === 0) return html.slice(ini, i + 1);
  }
  throw new Error(`constante ${nome} nao fecha`);
}

// A reforma do acervo (52 -> 15 nichos) deixou dois vocabularios no mesmo dado: o trilho vem
// como codigo antigo (WILDCARD) ou como rotulo novo (Descoberta rara), e 77 dossies ficaram com
// o slug de um nicho que nao existe mais. Sem juntar, --trilho WILDCARD deixava 1.123 lojas de
// fora e "dossies calcados" perdia os de calcados_femininos (medido em 10/11/2026).
const TRILHO_CODIGO = { wildcard: 'Descoberta rara', breakout: 'Explodindo agora', escalando: 'Escalando', evergreen: 'Perene funciona sempre' };
const TRILHOS = ['Descoberta rara', 'Explodindo agora', 'Escalando', 'Perene funciona sempre', 'Consolidada'];
function trilho(t) {
  const limpo = String(t ?? '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}()]/gu, '').replace(/\s+/g, ' ').trim();
  const k = limpo.toLowerCase();
  return TRILHO_CODIGO[k] || TRILHOS.find((x) => x.toLowerCase() === k) || limpo || null;
}
const dominio = (s) => String(s || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
// Dossie com slug antigo volta ao nicho atual em que a loja dele aparece.
const doNicho = (o, slug) => o.nicho_slug === slug || o.nichos_atuais.includes(slug);

function normalizar(d) {
  const donos = new Map();
  for (const x of d.DB.nichos) for (const l of x.lojas || []) {
    l.trilho = trilho(l.trilho);
    const k = dominio(l.domain);
    if (!donos.has(k)) donos.set(k, new Set());
    donos.get(k).add(x.slug);
  }
  const atuais = new Set(d.DB.nichos.map((x) => x.slug));
  for (const o of d.DBR.dossies || []) {
    o.nichos_atuais = atuais.has(o.nicho_slug) ? [o.nicho_slug] : [...(donos.get(dominio(o.dominio)) || [])];
  }
}

async function carregar(forcar) {
  const html = await baixarPagina(forcar);
  const dados = {};
  for (const nome of ['DB', 'ED', 'DBR', 'PROMPTS']) {
    try { dados[nome] = JSON.parse(recortar(html, nome)); }
    catch (e) { throw new Error(`falha lendo ${nome} do acervo: ${e.message}`); }
  }
  normalizar(dados);
  return dados;
}

const SEM_VEREDITO = 'O acervo publicado hoje nao traz veredito: a decisao de entrar, observar ou descartar e do dono da loja e fica anotada em Minhas Lojas/Meus nichos.md.';

// ------------------------------------------------------------------ formatacao

const n = (v) => (v === null || v === undefined || v === '' ? '-' : String(v));
const num = (v) => (typeof v === 'number' ? v.toLocaleString('pt-BR') : n(v));

// Emoji conta 2 em .length e desalinha a coluna. [...s] conta por caractere.
const visivel = (s) => [...String(s)].length;
const cortar = (s, teto) => {
  const cs = [...String(s)];
  return cs.length <= teto ? String(s) : cs.slice(0, teto - 1).join('') + '\u2026';
};
const encher = (s, larg, dir) => {
  const falta = Math.max(0, larg - visivel(s));
  return dir ? ' '.repeat(falta) + s : s + ' '.repeat(falta);
};

function tabela(linhas, colunas) {
  if (!linhas.length) return '  (nada encontrado)';
  const celas = linhas.map((l) => colunas.map((c) => cortar(c.valor(l), c.max || 46)));
  const larg = colunas.map((c, i) =>
    Math.max(visivel(c.titulo), ...celas.map((r) => visivel(r[i]))));
  const cab = colunas.map((c, i) => encher(c.titulo, larg[i])).join('  ');
  const risco = larg.map((w) => '-'.repeat(w)).join('  ');
  const corpo = celas.map((r) => r.map((v, i) => encher(v, larg[i], colunas[i].dir)).join('  '));
  return [cab, risco, ...corpo].map((l) => '  ' + l).join('\n');
}

function acharNicho(DB, alvo) {
  const chave = String(alvo).toLowerCase();
  return DB.nichos.find((x) => x.slug.toLowerCase() === chave)
      || DB.nichos.find((x) => (x.nome || '').toLowerCase() === chave)
      || DB.nichos.find((x) => x.slug.toLowerCase().includes(chave))
      || DB.nichos.find((x) => (x.nome || '').toLowerCase().includes(chave));
}

// -------------------------------------------------------------------- comandos

const comandos = {
  nichos(d, _args, flags) {
    const linhas = [...d.DB.nichos].sort((a, b) => (b.total_lojas || 0) - (a.total_lojas || 0));
    if (flags.json) return linhas.map(({ lojas, ...r }) => r);
    return [
      `Acervo de nichos — ${linhas.length} nichos, gerado em ${n(d.DB.gerado_em).slice(0, 10)}`,
      '',
      tabela(linhas, [
        { titulo: 'slug', valor: (l) => l.slug },
        { titulo: 'nome', valor: (l) => n(l.nome) },
        { titulo: 'lojas', valor: (l) => num(l.total_lojas), dir: true },
        { titulo: 'ads ativos', valor: (l) => num(l.ads_ativos_total), dir: true },
        { titulo: 'score', valor: (l) => (typeof l.score_medio === 'number' ? l.score_medio.toFixed(1) : '-'), dir: true },
      ]),
    ].join('\n');
  },

  nicho(d, args, flags) {
    const alvo = args[0];
    if (!alvo) throw new Error('diga o slug do nicho. Ex: node ler-acervo.mjs nicho joias_semijoias');
    const x = acharNicho(d.DB, alvo);
    if (!x) throw new Error(`nicho "${alvo}" nao existe no acervo. Rode "nichos" para ver a lista.`);
    const verb = (d.ED.indice || []).find((i) => i.chave === x.slug || i.nicho === x.nome);
    const road = (d.ED.roadmap || []).find((r) => r.nicho === x.nome || r.nicho === x.slug);
    const dos = (d.DBR.dossies || []).filter((o) => doNicho(o, x.slug));

    // O --json saia antes daqui e devolvia menos que o modo texto: sem veredito,
    // sem roadmap e sem a lista de dossies. Como o JSON e justamente o que o agente
    // consome, o modo mais completo era o que a pessoa le, e o mais pobre o que a
    // maquina le. Invertido.
    if (flags.json) {
      return {
        ...x,
        veredito: verb || null,
        roadmap: road || null,
        dossies: dos.map(({ markdown_completo, ...r }) => r),
      };
    }
    const top = [...(x.lojas || [])].sort((a, b) => (b.ads_ativos || 0) - (a.ads_ativos || 0)).slice(0, 10);

    const partes = [
      `${x.nome}  (${x.slug})`,
      `  lojas ${num(x.total_lojas)} · ads ativos ${num(x.ads_ativos_total)} · score medio ${typeof x.score_medio === 'number' ? x.score_medio.toFixed(1) : '-'} · levantado em ${n(x.data)}`,
    ];
    if (verb) partes.push(`  veredito ${n(verb.veredito)} · status ${n(verb.status)} · ultima pesquisa ${n(verb.ultima_pesquisa)}`);
    if (road) partes.push(`  roadmap: prioridade ${n(road.prioridade)} · estacao ${n(road.estacao)} · AOV ${n(road.aov)} · saturacao ${n(road.saturacao)} · fit ${n(road.fit)}`);
    if (x.por_trilho) partes.push(`  por trilho: ${Object.entries(x.por_trilho).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
    if (x.top_apps?.length) partes.push(`  apps mais vistos: ${x.top_apps.map((a) => `${a.app} (${a.n})`).join(', ')}`);
    partes.push(`  dossies escritos: ${dos.length}${dos.length ? ' — ' + dos.map((o) => o.dominio).join(', ') : ''}`);
    partes.push('', '  As 10 lojas que mais anunciam:', tabela(top, [
      { titulo: 'dominio', valor: (l) => n(l.domain) },
      { titulo: 'trilho', valor: (l) => n(l.trilho) },
      { titulo: 'ads', valor: (l) => num(l.ads_ativos), dir: true },
      { titulo: 'dias no ar', valor: (l) => num(l.dias_no_ar), dir: true },
      { titulo: 'score', valor: (l) => num(l.score), dir: true },
    ]));
    return partes.join('\n');
  },

  lojas(d, args, flags) {
    const alvo = args[0];
    if (!alvo) throw new Error('diga o slug do nicho. Ex: node ler-acervo.mjs lojas joias_semijoias');
    const x = acharNicho(d.DB, alvo);
    if (!x) throw new Error(`nicho "${alvo}" nao existe no acervo.`);
    let lojas = [...(x.lojas || [])];
    if (flags.trilho) {
      const alvo = String(trilho(flags.trilho)).toLowerCase();
      const existentes = [...new Set(d.DB.nichos.flatMap((y) => (y.lojas || []).map((l) => l.trilho)).filter(Boolean))];
      if (!existentes.some((t) => t.toLowerCase() === alvo)) throw new Error(`trilho "${flags.trilho}" nao existe no acervo. Os que existem: ${existentes.join(', ')}.`);
      lojas = lojas.filter((l) => String(l.trilho).toLowerCase() === alvo);
    }
    lojas.sort((a, b) => (b.ads_ativos || 0) - (a.ads_ativos || 0));
    const teto = flags.top ? parseInt(flags.top, 10) : lojas.length;
    lojas = lojas.slice(0, teto);
    if (flags.json) return lojas;
    return [
      `${x.nome} — ${lojas.length} loja(s)`,
      '',
      tabela(lojas, [
        { titulo: 'dominio', valor: (l) => n(l.domain) },
        { titulo: 'trilho', valor: (l) => n(l.trilho) },
        { titulo: 'ads', valor: (l) => num(l.ads_ativos), dir: true },
        { titulo: 'google', valor: (l) => num(l.ads_google), dir: true },
        { titulo: 'dias', valor: (l) => num(l.dias_no_ar), dir: true },
        { titulo: 'apps', valor: (l) => (Array.isArray(l.apps) ? l.apps.slice(0, 3).join(', ') : '-'), max: 40 },
      ]),
    ].join('\n');
  },

  dossies(d, args, flags) {
    let lista = d.DBR.dossies || [];
    if (args[0]) {
      const x = acharNicho(d.DB, args[0]);
      const slug = x ? x.slug : args[0];
      lista = lista.filter((o) => doNicho(o, slug));
    }
    if (flags.json) return lista.map(({ markdown_completo, ...r }) => r);
    return [
      `${lista.length} dossie(s)`,
      '',
      tabela(lista, [
        { titulo: 'dominio', valor: (o) => n(o.dominio) },
        { titulo: 'nicho', valor: (o) => n(o.nicho_slug) },
        { titulo: 'marca', valor: (o) => n(o.page_name), max: 34 },
        { titulo: 'rotulo', valor: (o) => n(o.rotulo), max: 30 },
      ]),
      '',
      '  Para ler um: node ler-acervo.mjs dossie <dominio>',
    ].join('\n');
  },

  dossie(d, args, flags) {
    const alvo = String(args[0] || '').toLowerCase().replace(/^www\./, '');
    if (!alvo) throw new Error('diga o dominio. Ex: node ler-acervo.mjs dossie <dominio>');
    const o = (d.DBR.dossies || []).find((x) => String(x.dominio || '').toLowerCase().replace(/^www\./, '') === alvo)
           || (d.DBR.dossies || []).find((x) => String(x.dominio || '').toLowerCase().includes(alvo));
    if (!o) throw new Error(`nao existe dossie para "${args[0]}". Rode "dossies" para ver a lista.`);
    if (flags.json) return o;
    return [
      `# ${o.page_name || o.dominio || 'sem nome'} (${n(o.dominio)})`,
      `nicho ${n(o.nicho_slug)} · rotulo ${n(o.rotulo)} · formato ${n(o.formato)}`,
      '',
      o.markdown_completo || '(dossie sem texto)',
      '',
      '---',
      'Este texto e material de estudo. Nao cole ele num documento que circula fora da',
      'sua operacao: ele nomeia a loja copiada e descreve como o levantamento foi feito.',
    ].join('\n');
  },

  veredito(d, args, flags) {
    if (args[0]) {
      const x = acharNicho(d.DB, args[0]);
      const slug = x ? x.slug : args[0];
      const v = (d.ED.vereditos || []).find((y) => y.slug === slug);
      const i = (d.ED.indice || []).find((y) => y.chave === slug);
      if (flags.json) return { veredito: v || null, indice: i || null };
      if (!v && !i) throw new Error(`sem veredito registrado para "${args[0]}".${(d.ED.indice || []).length ? '' : ' ' + SEM_VEREDITO}`);
      const linhas = [];
      if (v?.veredito) linhas.push(`${n(v.veredito.emoji)} ${n(v.veredito.rotulo)}`, '', n(v.veredito.racional));
      if (i) linhas.push('', `status ${n(i.status)} · ultima pesquisa ${n(i.ultima_pesquisa)}`);
      return linhas.join('\n');
    }
    const idx = d.ED.indice || [];
    if (flags.json) return d.ED;
    if (!idx.length) return `0 nichos com veredito registrado. ${SEM_VEREDITO}`;
    return [
      `${idx.length} nichos com veredito registrado`,
      '',
      tabela(idx, [
        { titulo: 'nicho', valor: (i) => n(i.nicho) },
        { titulo: 'chave', valor: (i) => n(i.chave) },
        { titulo: 'veredito', valor: (i) => n(i.veredito), max: 44 },
        { titulo: 'status', valor: (i) => n(i.status), max: 16 },
        { titulo: 'pesquisa', valor: (i) => n(i.ultima_pesquisa) },
      ]),
    ].join('\n');
  },

  prompts(d, args, flags) {
    const P = d.PROMPTS;
    if (flags.json) return P;
    const lista = P.prompts || [];
    if (args[0]) {
      const i = parseInt(args[0], 10);
      const p = Number.isFinite(i) ? lista[i - 1] : lista.find((x) => String(x.id || x.titulo || '').toLowerCase().includes(String(args[0]).toLowerCase()));
      if (!p) throw new Error(`prompt "${args[0]}" nao existe. Sao ${lista.length}.`);
      return JSON.stringify(p, null, 2);
    }
    return [
      `Prompts de montagem — versao ${n(P.versao)}, atualizado ${n(P.atualizado)}`,
      '',
      n(P.intro),
      '',
      lista.map((p, i) => `  ${i + 1}. ${n(p.titulo || p.nome || p.id)}`).join('\n'),
      '',
      '  Para ler um: node ler-acervo.mjs prompts 1',
    ].join('\n');
  },

  buscar(d, args, flags) {
    const termo = String(args.join(' ') || '').toLowerCase();
    if (!termo) throw new Error('diga o que procurar. Ex: node ler-acervo.mjs buscar pulseira');
    const achados = { nichos: [], lojas: [], dossies: [] };
    for (const x of d.DB.nichos) {
      if (`${x.slug} ${x.nome}`.toLowerCase().includes(termo)) achados.nichos.push({ slug: x.slug, nome: x.nome, lojas: x.total_lojas });
      for (const l of x.lojas || []) {
        if (`${l.domain} ${l.page_name}`.toLowerCase().includes(termo)) {
          achados.lojas.push({ nicho: x.slug, dominio: l.domain, marca: l.page_name, ads: l.ads_ativos });
        }
      }
    }
    for (const o of d.DBR.dossies || []) {
      if (`${o.dominio} ${o.page_name} ${o.markdown_completo || ''}`.toLowerCase().includes(termo)) {
        achados.dossies.push({ dominio: o.dominio, nicho: o.nicho_slug, marca: o.page_name });
      }
    }
    if (flags.json) return achados;
    const partes = [`Busca por "${termo}"`, ''];
    partes.push(`  nichos (${achados.nichos.length})`, tabela(achados.nichos.slice(0, 20), [
      { titulo: 'slug', valor: (x) => n(x.slug) },
      { titulo: 'nome', valor: (x) => n(x.nome) },
      { titulo: 'lojas', valor: (x) => num(x.lojas), dir: true },
    ]), '');
    partes.push(`  lojas (${achados.lojas.length})`, tabela(achados.lojas.slice(0, 20), [
      { titulo: 'dominio', valor: (x) => n(x.dominio) },
      { titulo: 'nicho', valor: (x) => n(x.nicho) },
      { titulo: 'ads', valor: (x) => num(x.ads), dir: true },
    ]), '');
    partes.push(`  dossies (${achados.dossies.length})`, tabela(achados.dossies.slice(0, 20), [
      { titulo: 'dominio', valor: (x) => n(x.dominio) },
      { titulo: 'nicho', valor: (x) => n(x.nicho) },
      { titulo: 'marca', valor: (x) => n(x.marca) },
    ]));
    return partes.join('\n');
  },
};

// ----------------------------------------------------------------------- main

const AJUDA = `
Leitor do Repositorio de Nichos da BaseX

  nichos                     lista os nichos do acervo
  nicho <slug>               resumo de um nicho: veredito, roadmap, apps, top lojas
  lojas <slug>               todas as lojas do nicho   [--top N] [--trilho X]
  dossies [slug]             lista os dossies escritos
  dossie <dominio>           o dossie inteiro de uma loja
  veredito [slug]            entrar ou nao entrar, por nicho
  prompts [n]                os prompts de montagem de loja
  buscar <termo>             procura em nichos, lojas e dossies

  --json                     devolve JSON em vez de tabela
  --atualizar                baixa de novo, ignorando o cache de 24h

Fonte: ${FONTE}
`.trim();

async function main() {
  const { livres, flags } = lerArgs(process.argv.slice(2));
  const cmd = livres[0];
  if (!cmd || flags.help || cmd === 'ajuda') { console.log(AJUDA); return; }
  const fn = comandos[cmd];
  if (!fn) {
    console.error(`comando "${cmd}" nao existe.\n`);
    console.error(AJUDA);
    process.exitCode = 1;
    return;
  }
  const dados = await carregar(Boolean(flags.atualizar));
  const saida = fn(dados, livres.slice(1), flags);
  console.log(typeof saida === 'string' ? saida : JSON.stringify(saida, null, 2));
}

main().catch((e) => {
  console.error(`[erro] ${e.message}`);
  process.exitCode = 1;
});
