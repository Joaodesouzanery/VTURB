#!/usr/bin/env python3
"""Rollback atômico: restaura snapshot pra theme target.

Uso: python3 rollback.py --snapshot=/tmp/theme-clone/clone-TS/target-snapshot --target=<gid> --store=<handle>
"""
import argparse, base64, json, re, subprocess
from pathlib import Path

UPSERT = """
mutation themeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
  themeFilesUpsert(themeId: $themeId, files: $files) {
    upsertedThemeFiles { filename }
    userErrors { field message code filename }
  }
}
"""

def gql(store, query, variables, allow_mut=True):
    q = Path('/tmp/rb-q.graphql'); v = Path('/tmp/rb-v.json')
    q.write_text(query); v.write_text(json.dumps(variables))
    cmd = ['shopify','store','execute','--store',store,
           '--query-file',str(q),'--variable-file',str(v),'--json']
    if allow_mut: cmd.append('--allow-mutations')
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    clean = re.sub(r'\x1b\[[0-9;]*[a-zA-Z]', '', r.stdout)
    return json.loads(clean[clean.find('{'):])

ap = argparse.ArgumentParser()
ap.add_argument('--snapshot', required=True)
ap.add_argument('--target', required=True)
ap.add_argument('--store', required=True)
args = ap.parse_args()

snap = Path(args.snapshot)
manifest = json.loads((snap / '_manifest.json').read_text())
print(f"Restoring {len(manifest)} files to {args.target}")

payload = []
for fn in manifest:
    safe = fn.replace('/', '__')
    fp = snap / safe
    if not fp.exists():
        print(f"  ⚠ missing local: {fn}")
        continue
    # Detect binary vs text
    try:
        content = fp.read_text()
        payload.append((fn, content, False))
    except UnicodeDecodeError:
        raw = fp.read_bytes()
        b64 = base64.b64encode(raw).decode('ascii')
        payload.append((fn, b64, True))

# Push in batches of 30
for i in range(0, len(payload), 30):
    batch = payload[i:i+30]
    files_input = [{'filename': f, 'body': {'type': 'BASE64' if b else 'TEXT', 'value': c}} for f, c, b in batch]
    d = gql(args.store, UPSERT, {'themeId': args.target, 'files': files_input})
    res = d['themeFilesUpsert']
    print(f"  batch {i//30+1}: pushed={len(res['upsertedThemeFiles'])} errors={len(res['userErrors'])}")

print("Rollback complete.")
