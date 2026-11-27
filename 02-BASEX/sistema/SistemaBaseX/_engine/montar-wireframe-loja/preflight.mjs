#!/usr/bin/env node
/**
 * Pre-flight da skill "Montar Wireframe de Loja".
 *
 * Contrato do ecossistema: toda skill executavel expoe `preflight.mjs`.
 * A checagem em si mora no engine Python (gerar.py --preflight), que ja valida
 * campos obrigatorios do perfil, integridade da oferta e a REGRA DAS QUATRO
 * CORES. Este arquivo e a porta de entrada padronizada.
 *
 * Uso:
 *   node preflight.mjs perfis/old-money.json
 *   node preflight.mjs            (checa todos os perfis existentes)
 *
 * Sai com 0 se tudo passou, 1 se algum perfil reprovou.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PERFIS = join(AQUI, 'perfis');

function checar(perfil) {
  const r = spawnSync('python3', [join(AQUI, 'gerar.py'), perfil, '--preflight'],
                      { encoding: 'utf-8', cwd: AQUI });
  const saida = (r.stdout || '') + (r.stderr || '');
  process.stdout.write(saida);
  return r.status === 0;
}

const arg = process.argv[2];
let alvos;

if (arg) {
  alvos = [arg];
} else {
  if (!existsSync(PERFIS)) {
    console.error('[preflight] pasta perfis/ nao encontrada');
    process.exit(1);
  }
  alvos = readdirSync(PERFIS).filter(f => f.endsWith('.json')).map(f => join(PERFIS, f));
  if (alvos.length === 0) {
    console.error('[preflight] nenhum perfil em perfis/. Criar um a partir de old-money.json');
    process.exit(1);
  }
}

let ok = true;
for (const alvo of alvos) {
  console.log(`[preflight] ${alvo}`);
  if (!checar(alvo)) ok = false;
}

if (!ok) {
  console.error('[preflight] reprovado. Corrigir o perfil antes de gerar.');
  process.exit(1);
}
console.log(`[preflight] ${alvos.length} perfil(is) ok`);
