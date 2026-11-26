#!/usr/bin/env node
// preflight.mjs — valida ambiente do QA funcional de compra (skill 71)
// Uso: node preflight.mjs --loja https://minhaloja.com [--paises IT,DE,ES]
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENGINE_DIR = dirname(fileURLToPath(import.meta.url));
const a = {};
for (let i = 2; i < process.argv.length; i++) {
  const m = process.argv[i].match(/^--([a-z-]+)$/);
  if (m) a[m[1]] = process.argv[++i];
}

const checks = [];
checks.push({ nome: 'Node 20+', ok: parseInt(process.versions.node) >= 20 });

// Chrome Brain (preferido) ou Playwright como fallback
let chrome = false;
try { const r = await fetch('http://localhost:9222/json/version'); chrome = r.ok; } catch {}
checks.push({ nome: 'Chrome Brain porta 9222', ok: chrome, dica: 'abrir Chrome com --remote-debugging-port=9222 (ou usar Playwright MCP)' });

// Endereços de teste
const endPath = join(ENGINE_DIR, 'enderecos-teste.json');
checks.push({ nome: 'enderecos-teste.json', ok: existsSync(endPath) });
if (existsSync(endPath) && a.paises) {
  const cfg = JSON.parse(readFileSync(endPath, 'utf8'));
  for (const p of a.paises.split(','))
    checks.push({ nome: `endereço de teste ${p}`, ok: !!cfg.enderecos[p.trim().toUpperCase()], dica: 'adicionar ao enderecos-teste.json' });
}

// Loja responde
if (a.loja) {
  try {
    const url = a.loja.startsWith('http') ? a.loja : `https://${a.loja}`;
    const r = await fetch(url, { redirect: 'follow' });
    checks.push({ nome: `loja responde (${r.status})`, ok: r.ok || r.status === 401 });
    // a loja protegida por senha responde 200 e REDIRECIONA para /password.
    // olhar so o status deixa a password page passar despercebida.
    const naSenha = r.status === 401 || /\/password\b/.test(r.url || '');
    checks.push({
      nome: 'sem password page',
      ok: !naSenha,
      dica: 'informe a senha do storefront, ou desligue em Online Store > Preferences > Password protection',
    });
  } catch (e) { checks.push({ nome: 'loja responde', ok: false, dica: e.message }); }
} else checks.push({ nome: '--loja informada', ok: false });

console.log('\n=== Pre-flight qa-funcional-compra ===\n');
let falhas = 0;
for (const c of checks) { console.log(`${c.ok ? '[OK]  ' : '[FAIL]'} ${c.nome}${!c.ok && c.dica ? '  → ' + c.dica : ''}`); if (!c.ok) falhas++; }
process.exit(falhas === 0 ? 0 : 1);
