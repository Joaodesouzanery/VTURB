// taxonomy-lib.mjs - parser unico da taxonomia Google Product Category.
// Formato nativo: o proprio .txt publicado pelo Google, sem passo de conversao.
//   https://www.google.com/basepages/producttype/taxonomy-with-ids.{lang}.txt
// segments e tokens sao derivados de full_path em tempo de carga (~0,1s).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// "412 - Alimentacion, bebida y tabaco > Alimentos" -> {id, full_path, segments, tokens}
export function parseTaxonomyTxt(raw) {
  const lines = String(raw).split('\n').filter((l) => l && !l.startsWith('#'));
  const categories = [];
  for (const line of lines) {
    const m = line.match(/^(\d+)\s*-\s*(.+)$/);
    if (!m) continue;
    const id = parseInt(m[1]);
    const full_path = m[2].trim();
    const segments = full_path.split(' > ').map((s) => s.trim());
    // Tokens normalizados pra fuzzy match
    const tokens = (full_path + ' ' + segments[segments.length - 1])
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // remove acentos
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
    categories.push({ id, full_path, segments, tokens });
  }
  return categories;
}

// Caminho do arquivo de taxonomia do idioma, ou null se nao existir.
// Aceita .txt (formato oficial, o que viaja) e .json (formato antigo, ainda suportado).
export function findTaxonomyFile(baseDir, lang) {
  for (const ext of ['txt', 'json']) {
    const p = join(baseDir, 'taxonomy', `${lang}.${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

// Carrega a taxonomia do idioma. Lanca se o arquivo nao existir.
export function loadTaxonomy(baseDir, lang) {
  const path = findTaxonomyFile(baseDir, lang);
  if (!path) {
    throw new Error(
      `taxonomy/${lang}.txt nao encontrada em ${baseDir}. ` +
        `Baixar: curl -o "${join(baseDir, 'taxonomy', lang + '.txt')}" ` +
        `https://www.google.com/basepages/producttype/taxonomy-with-ids.${lang}.txt`
    );
  }
  const raw = readFileSync(path, 'utf-8');
  const categories = path.endsWith('.json')
    ? JSON.parse(raw).categories
    : parseTaxonomyTxt(raw);
  return { lang, path, count: categories.length, categories };
}
