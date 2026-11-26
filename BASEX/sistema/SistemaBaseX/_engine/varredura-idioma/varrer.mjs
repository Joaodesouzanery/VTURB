#!/usr/bin/env node
// Loop 1: varredura de idioma do catálogo, até zero violação.
//
// A regra de idioma do catálogo já exige "re-varrer 100% dos produtos; a
// tarefa só conclui com ZERO violações". Isso é, literalmente, uma condição de
// parada. O que faltava era alguém executar a volta. É o que este arquivo faz.
//
// Fontes aceitas:
//   --cofre <slug>    lê <CATALOGOS_DIR>/<slug>/data/products.json (catálogo salvo
//                     localmente; CATALOGOS_DIR default: ~/catalogos-lojas)
//   --loja <handle>   consulta a loja ao vivo pela Admin API (a loja precisa
//                     estar autenticada na CLI `shopify`)
//
// Modo padrão é AUDITORIA: mede e relata, não escreve nada. Corrigir catálogo
// mexe em handle, e handle sem redirecionamento 301 quebra link que já circula,
// então a correção é passo deliberado, com --corrigir, nunca o default.
//
// ATENÇÃO: --corrigir gera as propostas de correção e as grava no relatório.
// A escrita na loja NÃO está implementada: nenhum modo deste programa altera
// catálogo de loja ao vivo. Para ver a correção sendo aplicada de ponta a
// ponta, use --ensaio, que aplica numa cópia em memória do catálogo.
//
// Uso:
//   node varrer.mjs --cofre minha-loja --alvo en
//   node varrer.mjs --cofre todas
//   node varrer.mjs --cofre minha-loja --alvo en --ensaio
//   node varrer.mjs --loja <handle-da-sua-loja> --alvo en

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
import { loop, PARADAS } from "../_shared/loop.mjs";
import { varrerCatalogo, porProduto } from "./detectar.mjs";
import { proporCorrecao, aplicarEmMemoria } from "./corrigir.mjs";

// Pasta local com os catálogos já baixados, um diretório por loja:
//   <CATALOGOS_DIR>/<slug>/data/products.json
const COFRE = process.env.CATALOGOS_DIR || join(homedir(), "catalogos-lojas");
const log = (m) => process.stderr.write(`[idioma] ${m}\n`);
const die = (m) => { process.stderr.write(`ERRO: ${m}\n`); process.exit(1); };

// --- args ---
const a = process.argv.slice(2);
let cofre = null, loja = null, alvo = null, corrigir = false, ensaio = false, trailDir = null, maxRodadas = 6;
for (let i = 0; i < a.length; i++) {
  if (a[i] === "--cofre") cofre = a[++i];
  else if (a[i] === "--loja") loja = a[++i];
  else if (a[i] === "--alvo") alvo = a[++i];
  else if (a[i] === "--corrigir") corrigir = true;
  else if (a[i] === "--ensaio") ensaio = true;
  else if (a[i] === "--trail") trailDir = a[++i];
  else if (a[i] === "--max-rodadas") maxRodadas = Number(a[++i]);
  else die(`opção desconhecida: ${a[i]}`);
}
if (!cofre && !loja) die("informe --cofre <slug|todas> ou --loja <handle>");
trailDir = trailDir || join(tmpdir(), "varredura-idioma");

// Vocabulário de marca já confirmado por uma pessoa, por loja. Uma vez aqui, o
// termo para de aparecer na varredura. É o que evita rediscutir "Noir" toda semana.
// Arquivo: <CATALOGOS_DIR>/<slug>/idioma-permitidos.json → ["noir","blanc","argent"]
// Só funciona no modo --cofre: no modo --loja o nome do alvo é o handle e não
// existe pasta local correspondente, então a lista volta vazia.
function lerPermitidos(slug) {
  const p = join(COFRE, slug, "idioma-permitidos.json");
  if (!existsSync(p)) return [];
  try { return JSON.parse(readFileSync(p, "utf-8")); } catch { return []; }
}

// --- leitura do catálogo ---
function doCofre(slug) {
  const p = join(COFRE, slug, "data", "products.json");
  if (!existsSync(p)) die(`catálogo não encontrado: ${p}`);
  const produtos = JSON.parse(readFileSync(p, "utf-8"));
  // O idioma-alvo é o locale primário declarado pela própria loja, não um
  // palpite: loja inglesa com francês habilitado tem "en" como primário, e é
  // contra ele que o catálogo deve ser medido.
  let idi = alvo;
  const ml = join(COFRE, slug, "data", "markets-locales.json");
  if (!idi && existsSync(ml)) {
    const m = JSON.parse(readFileSync(ml, "utf-8"));
    idi = (m.shopLocales || []).find(l => l.primary)?.locale?.split("-")[0];
  }
  // Sem idioma declarado não há contra o que medir, e arbitrar um seria pior
  // que não medir: acusaria o catálogo inteiro de estar errado. Pular é a
  // resposta honesta, e o aviso registra que a loja ficou de fora.
  if (!idi) return { produtos, alvo: null, motivo: `${slug} não declara locale primário (markets-locales.json ausente ou vazio); passe --alvo` };
  return { produtos, alvo: idi };
}

function doVivo(handle) {
  // Validado antes da consulta: errar o argumento não pode custar uma chamada
  // à loja.
  if (!alvo) die("com --loja é obrigatório passar --alvo");

  // Pagina de verdade. Antes pedia products(first: 250), pedia o pageInfo junto e
  // jogava o pageInfo fora: catálogo com 700 produtos era medido nos 250 primeiros
  // e a varredura dizia "limpo" sobre o catálogo inteiro. Verdicto errado em
  // silêncio é pior que erro, porque ninguém vai conferir.
  const produtos = [];
  let cursor = null;
  let pagina = 0;

  for (;;) {
    pagina++;
    const depois = cursor ? `, after: "${cursor}"` : "";
    const q = `query { products(first: 250${depois}) { pageInfo { hasNextPage endCursor } nodes {
      id title handle status descriptionHtml productType vendor tags
      seo { title description } options { name values } } } }`;
    const f = join(tmpdir(), `idioma-q-${Date.now()}-${pagina}.graphql`);
    writeFileSync(f, q);
    const out = execSync(`shopify store execute --store ${handle}.myshopify.com --json --query-file ${f}`,
      { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
    const d = JSON.parse(out.slice(out.indexOf("{")));
    const bloco = (d.data ?? d).products;
    produtos.push(...bloco.nodes);
    if (!bloco.pageInfo?.hasNextPage) break;
    cursor = bloco.pageInfo.endCursor;
    if (pagina >= 40) {
      // 10 mil produtos. Acima disso é catálogo fora do padrão de dropshipping e
      // parar calado seria repetir o bug que esta função existe para corrigir.
      log(`AVISO: parei em ${produtos.length} produtos (40 páginas). O catálogo é maior e o resto NÃO foi medido.`);
      break;
    }
  }

  if (pagina > 1) log(`catálogo lido em ${pagina} páginas · ${produtos.length} produtos`);
  return { produtos, alvo };
}

// --- um alvo ---
async function rodarUm(nome, carregar) {
  const { produtos, alvo: idi, motivo } = carregar();
  if (!idi) {
    log(`${nome}: PULADA — ${motivo}`);
    return { nome, alvo: null, total_produtos: produtos.length, ok: false, parada: "pulada", pendencias_finais: null, achados: [], motivo };
  }
  log(`${nome}: ${produtos.length} produtos · idioma-alvo ${idi}`);

  const trail = join(trailDir, `${nome}.json`);
  let ultimos = [];
  // No ensaio o catálogo vive em memória e a correção é aplicada nele. É o
  // jeito de ver o loop convergir de verdade, com dado real, sem tocar na loja.
  const memoria = ensaio ? JSON.parse(JSON.stringify(produtos)) : null;
  const propostas = [];

  const r = await loop({
    nome,
    trail,
    maxRodadas,
    semProgresso: 2,
    tetoAcoes: 300,
    varrer: async () => {
      // Relê o estado a cada rodada de propósito: se a correção não pegou, a
      // pendência continua lá e o loop percebe sozinho. Medir o que se acredita
      // ter corrigido, em vez de assumir, é o que faz o loop ser confiável.
      const atuais = memoria
        ? memoria
        : (cofre ? JSON.parse(readFileSync(join(COFRE, nome, "data", "products.json"), "utf-8")) : produtos);
      ultimos = varrerCatalogo(atuais, idi, { permitidos: lerPermitidos(nome) });
      // Só confiança alta conta como pendência do loop. Confiança baixa é nome
      // de marca até prova em contrário, e travar entrega por causa de um
      // "Legacy Noir" faria a equipe ignorar o gate inteiro em duas semanas.
      return porProduto(ultimos.filter(x => x.confianca === "alta"));
    },
    agir: (ensaio || corrigir) ? async (pend) => {
      let feitas = 0;
      for (const item of pend) {
        const p = (memoria || produtos).find(x => x.id === item.produto_id);
        if (!p) continue;
        const { aplicaveis, manuais } = proporCorrecao(p, item.campos, idi);
        propostas.push({ produto_id: p.id, titulo: p.title, aplicaveis, manuais });

        if (ensaio) { feitas += aplicarEmMemoria(memoria, p.id, aplicaveis); continue; }

        // Escrever na loja exigiria, no caso do handle, criar o 301 na mesma
        // operação. Esse passo não está implementado, então o loop registra a
        // proposta e não age: proposta guardada é útil, escrita pela metade não.
        if (aplicaveis.length) log(`  ${p.title}: ${aplicaveis.length} correção(ões) propostas no relatório`);
      }
      if (!ensaio && feitas === 0) log(`modo proposta: nada foi escrito na loja (escrita não implementada)`);
      return feitas;
    } : null,
  });

  return { nome, alvo: idi, total_produtos: produtos.length, ...r, achados: ultimos, propostas };
}

// --- execução ---
const alvos = [];
if (cofre === "todas") {
  const { readdirSync } = await import("node:fs");
  // Só entra quem tem catálogo: um .DS_Store no meio não pode derrubar a rodada.
  for (const s of readdirSync(COFRE)) {
    if (!existsSync(join(COFRE, s, "data", "products.json"))) continue;
    alvos.push([s, () => doCofre(s)]);
  }
} else if (cofre) {
  alvos.push([cofre, () => doCofre(cofre)]);
} else {
  alvos.push([loja, () => doVivo(loja)]);
}

const relatorio = [];
for (const [nome, carregar] of alvos) relatorio.push(await rodarUm(nome, carregar));

// --- saída ---
mkdirSync(trailDir, { recursive: true });
const resumo = join(trailDir, "relatorio.json");
writeFileSync(resumo, JSON.stringify(relatorio, null, 2));

process.stderr.write("\n");
process.stderr.write(`${"loja".padEnd(16)}${"alvo".padEnd(6)}${"produtos".padEnd(10)}${"c/ violação".padEnd(13)}parada\n`);
for (const r of relatorio) {
  process.stderr.write(
    `${r.nome.padEnd(16)}${String(r.alvo ?? "—").padEnd(6)}${String(r.total_produtos).padEnd(10)}` +
    `${String(r.pendencias_finais ?? "?").padEnd(13)}${r.parada}\n`);
}
const sujas = relatorio.filter(r => !r.ok);
process.stderr.write(`\nrelatório: ${resumo}\n`);
process.exit(sujas.length ? 2 : 0);   // 2 = há violação, para gate em script
