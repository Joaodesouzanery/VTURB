/**
 * lib.mjs — acesso ao Admin GraphQL usando a auth já guardada pelo Shopify CLI.
 * Nunca escreve token em disco nem em log.
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CLIENT_ID = '7e9cb568cfd431c538f36d1ad3f2b4f6';
export const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-07';

function configPaths() {
  const home = os.homedir();
  return [
    path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'shopify-cli-store-nodejs', 'Config', 'config.json'),
    path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'shopify-cli-store-nodejs', 'config.json'),
    path.join(home, 'Library', 'Preferences', 'shopify-cli-store-nodejs', 'config.json'),
    path.join(home, '.config', 'shopify-cli-store-nodejs', 'config.json'),
  ];
}

/**
 * O config do CLI e escrito por uma lib de dot-notation: a chave
 * "<clientId>::loja.myshopify.com" vira o objeto aninhado
 * cfg["<clientId>::loja"].myshopify.com. Ler so a chave plana acha
 * a entrada mas nao a sessao, e o motor jura que nao ha auth guardada.
 * Esta funcao desce por objetos ate encontrar quem tem sessionsByUserId.
 */
function achaEntrada(cfg, chave) {
  const direto = cfg[chave];
  if (direto && direto.sessionsByUserId) return direto;
  const raiz = direto || cfg[chave.replace(/\.myshopify\.com$/, '')];
  if (!raiz || typeof raiz !== 'object') return null;
  const fila = [raiz];
  while (fila.length) {
    const no = fila.shift();
    if (no && typeof no === 'object') {
      if (no.sessionsByUserId) return no;
      for (const v of Object.values(no)) if (v && typeof v === 'object') fila.push(v);
    }
  }
  return null;
}

export async function tokenDaLoja(loja) {
  const handle = loja.replace(/\.myshopify\.com$/, '');
  for (const p of configPaths()) {
    let cfg;
    try { cfg = JSON.parse(await fs.readFile(p, 'utf8')); } catch { continue; }
    for (const chave of [`${CLIENT_ID}::${handle}.myshopify.com`, `${CLIENT_ID}::${handle}`]) {
      const entrada = achaEntrada(cfg, chave);
      if (!entrada) continue;
      const sess = entrada.sessionsByUserId?.[entrada.currentUserId]
        || Object.values(entrada.sessionsByUserId || {})[0];
      if (sess?.accessToken) {
        const expira = sess.expiresAt ? new Date(sess.expiresAt) : null;
        if (expira && expira.getTime() < Date.now()) {
          throw new Error(`auth do CLI para ${handle} expirou em ${sess.expiresAt}. Rode: shopify store auth --store ${handle}.myshopify.com`);
        }
        return { token: sess.accessToken, loja: `${handle}.myshopify.com`, escopos: sess.scopes || [], conta: sess.associatedUser?.email || null };
      }
    }
  }
  throw new Error(`sem auth guardada para ${handle}. Rode: shopify store auth --store ${handle}.myshopify.com`);
}

const espera = ms => new Promise(r => setTimeout(r, ms));

export function criaGql({ token, loja }) {
  const url = `https://${loja}/admin/api/${API_VERSION}/graphql.json`;
  return async function gql(query, variables = {}, tentativa = 0) {
    let r, corpo;
    try {
      r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({ query, variables }),
      });
      corpo = await r.json();
    } catch (e) {
      if (tentativa < 5) { await espera(1500 * (tentativa + 1)); return gql(query, variables, tentativa + 1); }
      throw e;
    }
    if (r.status === 429 || corpo?.errors?.some(e => /throttl/i.test(e.message || '') || e.extensions?.code === 'THROTTLED')) {
      if (tentativa < 8) { await espera(2000 * (tentativa + 1)); return gql(query, variables, tentativa + 1); }
    }
    if (!r.ok) throw new Error(`HTTP ${r.status} — ${JSON.stringify(corpo).slice(0, 400)}`);
    if (corpo.errors?.length) throw new Error('GraphQL: ' + corpo.errors.map(e => e.message).join(' | '));
    const custo = corpo.extensions?.cost?.throttleStatus;
    if (custo && custo.currentlyAvailable < 300) await espera(1200);
    return corpo.data;
  };
}
