#!/usr/bin/env python3
"""
upload_to_files.py — sobe imagens locais pros Files da Shopify (staged upload) e
devolve as refs shopify://shop_images/<nome> pra usar no tema.

Faz parte do fluxo de geração de imagem (Refazer Criativo com a Sua Marca), último passo.

Uso:
  python3 upload_to_files.py --store <handle>.myshopify.com img1.png img2.png
  python3 upload_to_files.py --store <handle>.myshopify.com --dry-run img1.png

Preflight (sempre roda): confere auth do CLI (query shop) e existência dos arquivos.
--dry-run: só valida (auth + arquivos), não sobe nada.
Rollback: arquivos subidos ficam nos Files; pra remover use fileDelete(fileIds).
"""
import subprocess, json, sys, os, argparse, time

def ex(store, q, mut=False):
    cmd = ["shopify", "store", "execute", "--store", store]
    if mut:
        cmd.append("--allow-mutations")
    cmd += ["--query", q]
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    dec = json.JSONDecoder()
    i = out.find('{')
    while i != -1:
        try:
            obj, _ = dec.raw_decode(out[i:])
            if isinstance(obj, dict):
                return obj
        except Exception:
            pass
        i = out.find('{', i + 1)
    return {"_raw": out[-300:]}

def preflight(store, files):
    d = ex(store, 'query { shop { name } }')
    shop = (d.get("shop") or {}).get("name")
    if not shop:
        print("[preflight] FALHOU: sem auth no CLI para", store, "->", d)
        return False
    print(f"[preflight] auth ok — loja: {shop}")
    ok = True
    for f in files:
        if not os.path.isfile(f):
            print(f"[preflight] FALHOU: arquivo não existe: {f}")
            ok = False
        else:
            print(f"[preflight] ok — {f} ({os.path.getsize(f)} bytes)")
    return ok

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--store", required=True)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("files", nargs="+")
    a = ap.parse_args()

    if not preflight(a.store, a.files):
        sys.exit(2)
    if a.dry_run:
        print("[dry-run] preflight ok. Nada foi enviado.")
        return

    names = [os.path.basename(f) for f in a.files]
    inputs = ", ".join('{filename:"%s", mimeType:"image/png", resource: FILE, httpMethod: POST}' % n for n in names)
    d = ex(a.store, 'mutation { stagedUploadsCreate(input: [%s]) { stagedTargets { url resourceUrl parameters { name value } } userErrors { field message } } }' % inputs, mut=True)
    sc = d.get("stagedUploadsCreate", {})
    if sc.get("userErrors"):
        print("stagedUploadsCreate erros:", sc["userErrors"]); sys.exit(3)
    targets = sc.get("stagedTargets", [])
    if len(targets) != len(a.files):
        print("stagedTargets inesperado:", d); sys.exit(3)

    resource_urls = []
    for f, t in zip(a.files, targets):
        curl = ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-X", "POST", t["url"]]
        for p in t["parameters"]:
            curl += ["-F", f"{p['name']}={p['value']}"]
        curl += ["-F", f"file=@{f}"]
        code = subprocess.run(curl, capture_output=True, text=True).stdout
        print(f"POST {os.path.basename(f)}: HTTP {code}")
        resource_urls.append(t["resourceUrl"])

    fc_inputs = ", ".join('{originalSource:"%s", contentType: IMAGE}' % u for u in resource_urls)
    d2 = ex(a.store, 'mutation { fileCreate(files: [%s]) { files { id } userErrors { field message } } }' % fc_inputs, mut=True)
    fc = d2.get("fileCreate", {})
    if fc.get("userErrors"):
        print("fileCreate erros:", fc["userErrors"]); sys.exit(4)
    ids = [x["id"] for x in fc.get("files", [])]

    for _ in range(20):
        time.sleep(3)
        idlist = ", ".join('"%s"' % i for i in ids)
        r = ex(a.store, 'query { nodes(ids: [%s]) { ... on MediaImage { fileStatus image { url } } } }' % idlist)
        nodes = r.get("nodes", [])
        st = [n.get("fileStatus") for n in nodes]
        if nodes and all(s == "READY" for s in st):
            print("=== READY ===")
            for n in nodes:
                fn = (n.get("image") or {}).get("url", "").split("/")[-1].split("?")[0]
                print("shopify://shop_images/" + fn)
            return
        print("status:", st)
    print("timeout aguardando READY")

if __name__ == "__main__":
    main()
