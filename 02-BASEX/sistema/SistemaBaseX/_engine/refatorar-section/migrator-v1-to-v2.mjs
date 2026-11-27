#!/usr/bin/env node
/**
 * Migra section v1 (label hardcoded) → v2 (label t: keys + locale populado).
 * Preserva CSS, blocks, presets. Só mexe nos labels do schema.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, arr) =>
    a.startsWith('--')
      ? [[a.slice(2), (arr[i + 1] && !arr[i + 1].startsWith('--')) ? arr[i + 1] : true]]
      : []
  )
);

const sectionPath = args.section;
const localeFile = args['locale-file'];
const dryRun = args['dry-run'] === true;

if (!sectionPath || !localeFile) {
  console.error('Uso: node migrator-v1-to-v2.mjs --section path/sections/x.liquid --locale-file path/locales/en.default.schema.json [--dry-run]');
  process.exit(2);
}

const liquidContent = readFileSync(sectionPath, 'utf8');
const slug = basename(sectionPath, '.liquid');

const schemaMatch = liquidContent.match(/({%\s*schema\s*%})([\s\S]+?)({%\s*endschema\s*%})/);
if (!schemaMatch) {
  console.error('Bloco schema nao encontrado em', sectionPath);
  process.exit(1);
}

let schema;
try {
  schema = JSON.parse(schemaMatch[2].trim());
} catch (err) {
  console.error('Schema JSON invalido:', err.message);
  process.exit(1);
}

const locale = existsSync(localeFile)
  ? JSON.parse(readFileSync(localeFile, 'utf8'))
  : {};

locale.sections ??= {};
locale.sections[slug] ??= {};
const localeSec = locale.sections[slug];

const sintetizarKey = (caminho) => `t:sections.${slug}.${caminho}`;

function set(obj, path, val) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] ??= {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}

let migrated = 0;

// Migrar name
if (schema.name && !schema.name.startsWith('t:')) {
  set(localeSec, 'name', schema.name);
  schema.name = sintetizarKey('name');
  migrated++;
}

// Migrar presets[].name
if (Array.isArray(schema.presets)) {
  schema.presets.forEach((preset, i) => {
    if (preset.name && !preset.name.startsWith('t:')) {
      const chave = schema.presets.length > 1 ? `presets.${i}.name` : 'presets.name';
      set(localeSec, chave, preset.name);
      preset.name = sintetizarKey(chave);
      migrated++;
    }
  });
}

// Migrar settings[].label, settings[].content (headers), settings[].options[].label
function migrarSetting(s, prefixo = 'settings') {
  if (s.type === 'header' && s.content && !s.content.startsWith('t:')) {
    const id = `header_${s.content.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    set(localeSec, `${prefixo}.${id}.content`, s.content);
    s.content = sintetizarKey(`${prefixo}.${id}.content`);
    migrated++;
  }
  if (s.label && !s.label.startsWith('t:') && s.id) {
    set(localeSec, `${prefixo}.${s.id}.label`, s.label);
    s.label = sintetizarKey(`${prefixo}.${s.id}.label`);
    migrated++;
  }
  if (Array.isArray(s.options)) {
    s.options.forEach(opt => {
      if (opt.label && !opt.label.startsWith('t:') && s.id) {
        set(localeSec, `${prefixo}.${s.id}.options.${opt.value}`, opt.label);
        opt.label = sintetizarKey(`${prefixo}.${s.id}.options.${opt.value}`);
        migrated++;
      }
    });
  }
}

// Arrow explicito: forEach passa o INDICE como 2o argumento e ele viraria o prefixo.
(schema.settings ?? []).forEach(s => migrarSetting(s));
(schema.blocks ?? []).forEach(block => {
  if (block.name && !block.name.startsWith('t:') && block.type) {
    set(localeSec, `blocks.${block.type}.name`, block.name);
    block.name = sintetizarKey(`blocks.${block.type}.name`);
    migrated++;
  }
  (block.settings ?? []).forEach(s => migrarSetting(s, `blocks.${block.type}.settings`));
});

// Reconstruir arquivo
const novoSchema = JSON.stringify(schema, null, 2);
// Replacement como FUNCAO: em string, $&, $`, $' e $$ seriam interpretados e
// corromperiam o arquivo quando algum label/default do schema contivesse esses caracteres.
const novoLiquid = liquidContent.replace(
  schemaMatch[0],
  () => `${schemaMatch[1]}\n${novoSchema}\n${schemaMatch[3]}`
);

if (dryRun) {
  console.log(JSON.stringify({
    dry_run: true,
    section: slug,
    migrated,
    novo_schema_preview: JSON.parse(novoSchema),
    locale_section_preview: localeSec,
  }, null, 2));
  process.exit(0);
}

writeFileSync(sectionPath, novoLiquid);
writeFileSync(localeFile, JSON.stringify(locale, null, 2) + '\n');

console.log(JSON.stringify({
  ok: true,
  section: slug,
  migrated,
  arquivos_modificados: [sectionPath, localeFile],
}));
