#!/usr/bin/env python3
"""Snapshot batch-a-batch do clone (regra R66).

Portado de _engine/clonar-tema-shopify-1x1/rollback.py com adaptação
pra URL clone: salva estado de arquivos MODIFICADOS por batch em
.tmp/criar-tema-clonado/batches/{N}/ pra rollback granular.

Diferente do Passo 11 (backup Dawn puro pré-clone, 1 snapshot único),
esse script salva N snapshots — um por batch — permitindo rollback pra
último estado healthy sem perder trabalho de batches anteriores.

Uso:
  # Após batch N push com sucesso:
  python3 snapshot-batch.py save --batch=N --target=<gid> --store=<handle> \
    --files="file1.liquid,file2.json,file3.css"

  # Rollback pra batch M (último healthy):
  python3 snapshot-batch.py restore --batch=M --target=<gid> --store=<handle>

  # List batches disponíveis:
  python3 snapshot-batch.py list
"""
import argparse, base64, json, re, subprocess, sys
from pathlib import Path

STORE_DEFAULT = None
BASE = Path.home() / ".tmp/criar-tema-clonado/batches"
BASE.mkdir(exist_ok=True, parents=True)

PULL = """
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

def gql(store, query, variables, allow_mut=False, timeout=180):
    q = Path('/tmp/snap-q.gql'); v = Path('/tmp/snap-v.json')
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

def save_batch(store, target, batch, filenames):
    """Save state of these files pre-batch (rollback point)."""
    batch_dir = BASE / str(batch)
    batch_dir.mkdir(exist_ok=True, parents=True)
    import urllib.request
    for i in range(0, len(filenames), 25):
        chunk = filenames[i:i+25]
        d = gql(store, PULL, {'id': target, 'filenames': chunk})
        for n in d['theme']['files']['nodes']:
            fn = n['filename']
            b = n.get('body', {}) or {}
            tn = b.get('__typename', '')
            safe = fn.replace('/', '__')
            if tn == 'OnlineStoreThemeFileBodyText' and b.get('content') is not None:
                (batch_dir / safe).write_text(b['content'])
            elif tn == 'OnlineStoreThemeFileBodyUrl' and b.get('url'):
                with urllib.request.urlopen(b['url'], timeout=60) as r:
                    raw = r.read()
                ctype = n.get('contentType', '')
                is_text = ctype.startswith('text/') or 'javascript' in ctype or 'json' in ctype
                if is_text:
                    try:
                        (batch_dir / safe).write_text(raw.decode('utf-8'))
                    except UnicodeDecodeError:
                        (batch_dir / safe).write_bytes(raw)
                else:
                    (batch_dir / safe).write_bytes(raw)
            elif tn == 'OnlineStoreThemeFileBodyBase64':
                (batch_dir / safe).write_bytes(base64.b64decode(b['contentBase64']))
    manifest = {'batch': batch, 'store': store, 'target': target, 'files': filenames}
    (batch_dir / '_manifest.json').write_text(json.dumps(manifest, indent=2))
    print(f"Batch {batch}: {len(filenames)} files snapshotted → {batch_dir}")

def restore_batch(store, target, batch):
    """Restore theme to state pre-batch N."""
    batch_dir = BASE / str(batch)
    if not batch_dir.exists():
        sys.exit(f"Batch {batch} não existe em {BASE}")
    manifest = json.loads((batch_dir / '_manifest.json').read_text())
    print(f"Restaurando {len(manifest['files'])} files do batch {batch}")
    payload = []
    for fn in manifest['files']:
        safe = fn.replace('/', '__')
        fp = batch_dir / safe
        if not fp.exists():
            print(f"  ⚠ missing local: {fn}")
            continue
        try:
            content = fp.read_text()
            payload.append({'filename': fn, 'body': {'type': 'TEXT', 'value': content}})
        except UnicodeDecodeError:
            raw = fp.read_bytes()
            b64 = base64.b64encode(raw).decode('ascii')
            payload.append({'filename': fn, 'body': {'type': 'BASE64', 'value': b64}})
    # Push in batches of 30 (learning R66)
    for i in range(0, len(payload), 30):
        chunk = payload[i:i+30]
        d = gql(store, UPSERT, {'themeId': target, 'files': chunk}, allow_mut=True)
        res = d['themeFilesUpsert']
        print(f"  chunk {i//30+1}: pushed={len(res['upsertedThemeFiles'])} errors={len(res['userErrors'])}")

def list_batches():
    if not BASE.exists():
        print("Nenhum batch salvo")
        return
    for d in sorted(BASE.iterdir()):
        if d.is_dir() and (d / '_manifest.json').exists():
            m = json.loads((d / '_manifest.json').read_text())
            print(f"  batch {m['batch']}: {len(m['files'])} files, target={m['target']}")

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest='action', required=True)
    save = sp.add_parser('save'); save.add_argument('--batch', required=True); save.add_argument('--target', required=True); save.add_argument('--store', required=True); save.add_argument('--files', required=True)
    restore = sp.add_parser('restore'); restore.add_argument('--batch', required=True); restore.add_argument('--target', required=True); restore.add_argument('--store', required=True)
    lst = sp.add_parser('list')
    args = ap.parse_args()
    if args.action == 'save':
        save_batch(args.store, args.target, int(args.batch), args.files.split(','))
    elif args.action == 'restore':
        restore_batch(args.store, args.target, int(args.batch))
    elif args.action == 'list':
        list_batches()
