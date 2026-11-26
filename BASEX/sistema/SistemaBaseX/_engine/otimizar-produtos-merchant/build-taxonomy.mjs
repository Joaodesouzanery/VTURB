#!/usr/bin/env node
// build-taxonomy.mjs - OPCIONAL. Converte o TXT oficial do Google em JSON pre-parseado.
// Os scripts leem taxonomy/{lang}.txt direto; isto so serve pra quem quiser o JSON.
// Uso: node build-taxonomy.mjs --input taxonomy/es-ES.txt --lang es-ES

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTaxonomyTxt } from './taxonomy-lib.mjs';

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

const input = args.input;
const lang = args.lang;
if (!input || !lang) {
  console.error('ERRO: --input {path.txt} --lang {es-ES|en-US|pt-BR} obrigatorios');
  process.exit(2);
}

const categories = parseTaxonomyTxt(readFileSync(input, 'utf-8'));

const outPath = join(__dirname, 'taxonomy', `${lang}.json`);
writeFileSync(outPath, JSON.stringify({ lang, source: basename(input), version: '2021-09-21', count: categories.length, categories }, null, 0));
console.log(`OK ${lang}: ${categories.length} categorias salvas em ${outPath}`);
