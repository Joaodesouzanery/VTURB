#!/usr/bin/env node
/**
 * Pre-flight pra Fase 7 de tradução.
 * Valida que locale alvo está habilitado, glossário existe, shopify CLI autenticado.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, arr) =>
    a.startsWith('--') ? [[a.slice(2), arr[i + 1] ?? true]] : []
  )
);

const store = args.store;
const locale = args.locale;
const glossario = args.glossario ?? resolve(import.meta.dirname, 'glossary', 'generic.json');
const dryRun = args['dry-run'] === true;

if (!store || !locale) {
  console.error('Uso: node preflight.mjs --store {handle} --locale fr [--glossario path] [--dry-run]');
  process.exit(2);
}

const checks = [];

// 1. shopify CLI
let cliOk = false;
try {
  execSync('shopify version', { stdio: ['ignore', 'pipe', 'ignore'] });
  cliOk = true;
} catch {}
checks.push({ nome: 'shopify CLI instalado', ok: cliOk, detalhe: cliOk ? 'OK' : 'comando nao encontrado' });

// 2. Glossário
checks.push({
  nome: `Glossário existe (${glossario})`,
  ok: existsSync(glossario),
  detalhe: existsSync(glossario) ? `${(readFileSync(glossario, 'utf8').length / 1024).toFixed(1)}KB` : 'arquivo nao encontrado',
});

// 3. Locale habilitado (via GraphQL)
if (cliOk && !dryRun) {
  const tmp = join(tmpdir(), `wwsetup-preflight-${Date.now()}.gql`);
  const out = join(tmpdir(), `wwsetup-preflight-${Date.now()}.json`);
  writeFileSync(tmp, '{ shop { shopLocales { locale primary published } } }');
  try {
    execSync(
      `shopify store execute --store "${store}" --query-file "${tmp}" --output-file "${out}" 2>/dev/null`,
      { stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const data = JSON.parse(readFileSync(out, 'utf8'));
    const locales = data?.data?.shop?.shopLocales ?? [];
    const habilitado = locales.find(l => l.locale === locale);
    checks.push({
      nome: `Locale ${locale} habilitado na loja`,
      ok: !!habilitado,
      detalhe: habilitado
        ? `${locale} ${habilitado.primary ? '(primary)' : ''} ${habilitado.published ? '(published)' : '(NAO published)'}`
        : `Locales atuais: ${locales.map(l => l.locale).join(',')}. Habilitar o idioma antes (fase 3 do worldwide_setup.py)`,
    });
    unlinkSync(tmp); unlinkSync(out);
  } catch (err) {
    checks.push({
      nome: `Locale ${locale} habilitado na loja`,
      ok: false,
      detalhe: `Falha ao consultar: ${err.message}. Validar autenticacao: shopify store auth --store ${store}`,
    });
  }
}

if (locale === 'en-GB') {
  checks.push({
    nome: 'AVISO: en-GB NÃO é locale habilitado tipicamente',
    ok: false,
    detalhe: 'UK herda do master EN. translationsRegister vai retornar INVALID_LOCALE_FOR_SHOP.',
  });
}

console.log('\n=== Pre-flight Fase 7 Tradução ===\n');
let bloqueios = 0;
for (const c of checks) {
  const icone = c.ok ? '[OK]  ' : '[FAIL]';
  console.log(`${icone} ${c.nome}`);
  console.log(`       ${c.detalhe}`);
  if (!c.ok) bloqueios++;
}
console.log(`\n${bloqueios === 0 ? 'PRONTO' : `${bloqueios} bloqueio(s)`}\n`);

if (dryRun) console.log('(dry-run)');

process.exit(bloqueios === 0 ? 0 : 1);
