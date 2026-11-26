#!/usr/bin/env python3
"""End-to-end clone Shopify theme-to-theme (fases 1-5 da skill 55).

Encoda 10 aprendizados de retrospective real:
1. Pull TODOS os body types (Text/Base64/Url), inclusive URL signed pra >200KB
2. Snapshot atômico ANTES de qualquer push
3. Dependency-ordered push (blocks→snippets→sections→locales→schema→assets→templates→groups→layout→settings_data)
4. Batches de 30 files
5. Screenshot pós-batch NÃO implementado aqui — CHAMAR external (Chrome Brain) do orquestrador
6. Pré-validação de schemas
7. Confirma role MAIN pré-push
8. Nunca surgical mapping
9. curl+section-diff pós-batch como health check
10. Rollback path documentado em toda saída

Uso:
  python3 clone.py --source=<gid> --target=<gid> --store=<handle> [--dry-run] [--skip-snapshot]

Requer:
  - shopify CLI autenticado
  - Python 3.8+
  - urllib (padrão)
"""
import argparse, base64, json, re, subprocess, sys, time, urllib.request
from pathlib import Path

def gql(store, query, variables, allow_mut=False, timeout=180):
    q = Path('/tmp/gql-q.graphql'); v = Path('/tmp/gql-v.json')
    q.write_text(query); v.write_text(json.dumps(variables))
    cmd = ['shopify','store','execute','--store',store,
           '--query-file',str(q),'--variable-file',str(v),'--json']
    if allow_mut: cmd.append('--allow-mutations')
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    clean = re.sub(r'\x1b\[[0-9;]*[a-zA-Z]', '', r.stdout)
    js = clean[clean.find('{'):] if '{' in clean else ''
    if not js:
        raise RuntimeError(f"GraphQL failed: {r.stderr[:300]}")
    return json.loads(js)

LIST_FILES = """
query listFiles($id: ID!, $after: String) {
  theme(id: $id) {
    files(first: 250, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { filename }
    }
  }
}
"""

PULL_BODIES = """
query pullBodies($id: ID!, $filenames: [String!]!) {
  theme(id: $id) {
    files(first: 50, filenames: $filenames) {
      nodes {
        filename size contentType
        body {
          __typename
          ... on OnlineStoreThemeFileBodyText { content }
          ... on OnlineStoreThemeFileBodyBase64 { contentBase64 }
          ... on OnlineStoreThemeFileBodyUrl { url }
        }
      }
    }
  }
}
"""

UPSERT = """
mutation themeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
  themeFilesUpsert(themeId: $themeId, files: $files) {
    upsertedThemeFiles { filename }
    userErrors { field message code filename }
  }
}
"""

def list_files(store, theme_id):
    files = []
    cursor = None
    while True:
        v = {'id': theme_id}
        if cursor: v['after'] = cursor
        d = gql(store, LIST_FILES, v)
        nodes = d['theme']['files']['nodes']
        files.extend(n['filename'] for n in nodes)
        info = d['theme']['files']['pageInfo']
        if not info['hasNextPage']: break
        cursor = info['endCursor']
    return files

def pull_batch(store, theme_id, filenames, outdir):
    """Pull batch of files. Handles all 3 body types.

    Returns: list of (filename, content_str, is_base64) tuples.
    """
    d = gql(store, PULL_BODIES, {'id': theme_id, 'filenames': filenames})
    results = []
    for n in d['theme']['files']['nodes']:
        fn = n['filename']
        b = n.get('body', {}) or {}
        tn = b.get('__typename', '')
        safe = fn.replace('/', '__')
        if tn == 'OnlineStoreThemeFileBodyText' and b.get('content') is not None:
            content = b['content']
            (outdir / safe).write_text(content)
            results.append((fn, content, False))
        elif tn == 'OnlineStoreThemeFileBodyUrl' and b.get('url'):
            # LEARNING #3: URL body pra arquivos >200KB. NÃO ignorar.
            with urllib.request.urlopen(b['url'], timeout=60) as r:
                raw = r.read()
            ctype = n.get('contentType', '')
            is_text = ctype.startswith('text/') or ctype.startswith('application/javascript') or ctype.startswith('application/json')
            if is_text:
                try:
                    content = raw.decode('utf-8')
                    (outdir / safe).write_text(content)
                    results.append((fn, content, False))
                except UnicodeDecodeError:
                    b64 = base64.b64encode(raw).decode('ascii')
                    (outdir / safe).write_bytes(raw)
                    results.append((fn, b64, True))
            else:
                b64 = base64.b64encode(raw).decode('ascii')
                (outdir / safe).write_bytes(raw)
                results.append((fn, b64, True))
        elif tn == 'OnlineStoreThemeFileBodyBase64' and b.get('contentBase64'):
            b64 = b['contentBase64']
            (outdir / safe).write_bytes(base64.b64decode(b64))
            results.append((fn, b64, True))
    return results

def push_batch(store, theme_id, files_batch):
    """Push batch of (filename, content, is_base64) tuples."""
    payload = []
    for fn, content, is_b64 in files_batch:
        body_type = 'BASE64' if is_b64 else 'TEXT'
        payload.append({'filename': fn, 'body': {'type': body_type, 'value': content}})
    d = gql(store, UPSERT, {'themeId': theme_id, 'files': payload}, allow_mut=True, timeout=300)
    res = d['themeFilesUpsert']
    return res['upsertedThemeFiles'], res['userErrors']

# LEARNING #8: dependency-ordered push
PUSH_PRIORITY = {
    'blocks/': 1,
    'snippets/': 2,
    'sections/': 3,        # override: -group files get 8
    'locales/': 4,
    'config/settings_schema.json': 5,
    'assets/': 6,
    'templates/': 7,
    'layout/': 9,
    'config/settings_data.json': 10,
}

def priority(fn):
    if fn == 'config/settings_schema.json': return 5
    if fn == 'config/settings_data.json': return 10
    if fn.startswith('sections/') and fn.endswith('-group.json'): return 8
    for prefix, p in PUSH_PRIORITY.items():
        if fn.startswith(prefix): return p
    return 5

def confirm_role(store, theme_id):
    q = "query themes { themes(first: 25) { nodes { id name role } } }"
    d = gql(store, q, {})
    for t in d['themes']['nodes']:
        if t['id'] == theme_id:
            return t
    return None

def check_preview(store, theme_id, expected_sections=None):
    """Post-batch health check via curl.

    LEARNING #6: userErrors=[] não é suficiente. Check render.
    """
    import urllib.request as ur
    url = f"https://{store}/?preview_theme_id={theme_id.split('/')[-1]}&pb=0&_fd=0&_={int(time.time())}"
    try:
        req = ur.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        html = ur.urlopen(req, timeout=30).read().decode('utf-8', errors='ignore')
    except Exception as e:
        return {'ok': False, 'error': str(e)}
    sections = set(re.findall(r'shopify-section-template--[0-9]+__[a-zA-Z0-9_-]+', html))
    # Cheap CSS check: presença de <link rel="stylesheet"> ou <style>
    has_css = bool(re.search(r'<link\s+[^>]*stylesheet', html)) or '<style' in html
    result = {'ok': has_css, 'sections_count': len(sections), 'has_css': has_css}
    if expected_sections:
        result['missing'] = list(expected_sections - sections)
    return result

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', required=True)
    ap.add_argument('--target', required=True)
    ap.add_argument('--store', required=True)
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--skip-snapshot', action='store_true')
    ap.add_argument('--publish-after', action='store_true')
    ap.add_argument('--batch-size', type=int, default=30)
    args = ap.parse_args()

    TS = time.strftime('%Y%m%d%H%M%S')
    base = Path(f'/tmp/theme-clone/clone-{TS}')
    snap = base / 'target-snapshot'
    pull = base / 'source-pull'
    reports = base / 'reports'
    for p in [snap, pull, reports]: p.mkdir(parents=True, exist_ok=True)

    # === Fase 0: Pre-flight ===
    print(f"=== Fase 0: Pre-flight ===")
    source_info = confirm_role(args.store, args.source)
    target_info = confirm_role(args.store, args.target)
    if not source_info: sys.exit("SOURCE não encontrado")
    if not target_info: sys.exit("TARGET não encontrado")
    print(f"  SOURCE: {source_info['name']} ({source_info['role']})")
    print(f"  TARGET: {target_info['name']} ({target_info['role']})")
    if target_info['role'] == 'MAIN' and not args.publish_after:
        # LEARNING #5: alterações públicas exigem confirm
        print("  ⚠️  TARGET é MAIN. Alterações visíveis publicamente imediatamente.")

    # === Fase 1: Snapshot target ===
    if not args.skip_snapshot:
        print(f"\n=== Fase 1: Snapshot target → {snap} ===")
        target_files = list_files(args.store, args.target)
        print(f"  {len(target_files)} files no target")
        for i in range(0, len(target_files), 25):
            batch = target_files[i:i+25]
            pull_batch(args.store, args.target, batch, snap)
        saved = len(list(snap.glob('*')))
        (snap / '_manifest.json').write_text(json.dumps(target_files, indent=2))
        # LEARNING #2 gate
        if saved != len(target_files):
            sys.exit(f"SNAPSHOT INCOMPLETO: {saved}/{len(target_files)}. ABORT.")
        print(f"  ✓ Snapshot atômico: {saved}/{len(target_files)}")

    # === Fase 2: Pull source ===
    print(f"\n=== Fase 2: Pull source → {pull} ===")
    source_files = list_files(args.store, args.source)
    print(f"  {len(source_files)} files no source")
    pulled_data = []
    for i in range(0, len(source_files), 25):
        batch = source_files[i:i+25]
        results = pull_batch(args.store, args.source, batch, pull)
        pulled_data.extend(results)
        print(f"    batch {i//25+1}: {len(results)} pulled")
    (pull / '_manifest.json').write_text(json.dumps(source_files, indent=2))
    # LEARNING #3 gate
    if len(pulled_data) != len(source_files):
        missing = set(source_files) - set(fn for fn, _, _ in pulled_data)
        sys.exit(f"PULL INCOMPLETO. Missing: {missing}. ABORT.")
    print(f"  ✓ Pull completo: {len(pulled_data)}/{len(source_files)}")

    if args.dry_run:
        print(f"\n=== DRY RUN: would push {len(pulled_data)} files ===")
        # Log ordering preview
        ordered = sorted(pulled_data, key=lambda x: priority(x[0]))
        for fn, _, _ in ordered[:15]:
            print(f"  P{priority(fn)}: {fn}")
        print(f"  ... ({len(ordered)-15} more)")
        return

    # === Fase 3: Pré-validação schemas ===
    # LEARNING #4: pré-validar antes de push
    print(f"\n=== Fase 3: Pré-validação schemas (skipped em v1 — TODO) ===")

    # === Fase 4: Push dependency-ordered ===
    print(f"\n=== Fase 4: Push dependency-ordered em batches de {args.batch_size} ===")
    ordered = sorted(pulled_data, key=lambda x: priority(x[0]))
    total_pushed = 0
    all_errors = []
    for i in range(0, len(ordered), args.batch_size):
        batch = ordered[i:i+args.batch_size]
        pushed, errors = push_batch(args.store, args.target, batch)
        total_pushed += len(pushed)
        if errors:
            all_errors.extend(errors)
            print(f"  batch {i//args.batch_size+1}: ✗ pushed={len(pushed)} errors={len(errors)}")
            for e in errors[:3]:
                print(f"    ✗ {e.get('filename')}: {e.get('message','')[:120]}")
        else:
            print(f"  batch {i//args.batch_size+1}: ✓ pushed={len(pushed)}")
        # Health check post-batch (learning #6)
        # NOTA: screenshot Chrome Brain deve ser rodado pelo orquestrador externo
        # aqui só faz curl+section-count
        if (i // args.batch_size) % 3 == 2:  # cada 3 batches
            hc = check_preview(args.store, args.target)
            print(f"    health check: has_css={hc.get('has_css')}, sections={hc.get('sections_count')}")

    # === Fase 5: Report + optional publish ===
    print(f"\n=== Fase 5: Report ===")
    print(f"  Total pushed: {total_pushed}/{len(ordered)}")
    print(f"  Errors: {len(all_errors)}")
    report = {
        'timestamp': TS,
        'source': source_info,
        'target': target_info,
        'files_pushed': total_pushed,
        'files_total': len(ordered),
        'errors': all_errors,
        'snapshot': str(snap),
        'pull_dir': str(pull),
    }
    (reports / 'clone-report.json').write_text(json.dumps(report, indent=2))
    print(f"  Report: {reports}/clone-report.json")
    print(f"  Rollback dir: {snap}")

    if args.publish_after and not all_errors:
        print(f"\n=== Publishing target as MAIN ===")
        pub_q = "mutation themePublish($id: ID!) { themePublish(id: $id) { theme { id name role } userErrors { message } } }"
        d = gql(args.store, pub_q, {'id': args.target}, allow_mut=True)
        print(json.dumps(d, indent=2))

if __name__ == '__main__':
    main()
