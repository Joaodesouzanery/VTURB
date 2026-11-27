#!/usr/bin/env python3
# Converte PNG/JPG/JPEG/TIFF/HEIC/BMP para WebP usando Pillow (PIL).
# Pillow vem pre-instalado no Python do macOS atual. Sem dependencias externas.
#
# Uso:
#   python3 convert.py <input> [--quality=80] [--replace] [--recursive] [--out=<dir>] [--lossless] [--dry-run]
#
# Argumentos:
#   <input>        Arquivo OU pasta. Se pasta, converte todas as imagens dentro.
#   --quality=N    Qualidade WebP de 0 a 100 (default: 80). Ignorado se --lossless.
#   --lossless     Conversao lossless (preserva 100% da qualidade, arquivos maiores).
#   --replace      Remove os originais apos converter com sucesso (default: mantem).
#   --recursive    Quando input e pasta, percorre subpastas.
#   --out=<dir>    Pasta de saida. Default: mesma pasta dos originais.
#   --dry-run      Lista o que seria feito sem converter.
#
# Saida:
#   Tabela com nome | antes | depois | reducao %.
#   Total economizado ao final.

import sys
import os
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("ERRO: Pillow nao esta instalado. Rodar: pip3 install --user Pillow", file=sys.stderr)
    sys.exit(2)

EXTS = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".heic", ".heif", ".gif"}


def parse_args(argv):
    args = {
        "input": None,
        "quality": 80,
        "lossless": False,
        "replace": False,
        "recursive": False,
        "out": None,
        "dry_run": False,
    }
    for a in argv[1:]:
        if a.startswith("--quality="):
            args["quality"] = max(0, min(100, int(a.split("=", 1)[1])))
        elif a == "--lossless":
            args["lossless"] = True
        elif a == "--replace":
            args["replace"] = True
        elif a == "--recursive":
            args["recursive"] = True
        elif a.startswith("--out="):
            args["out"] = a.split("=", 1)[1]
        elif a == "--dry-run":
            args["dry_run"] = True
        elif not a.startswith("--"):
            args["input"] = a
    return args


def list_images(path: Path, recursive: bool):
    files = []
    if path.is_file():
        if path.suffix.lower() in EXTS:
            files.append(path)
        return files
    iterator = path.rglob("*") if recursive else path.glob("*")
    for p in iterator:
        if p.is_file() and not p.name.startswith(".") and p.suffix.lower() in EXTS:
            files.append(p)
    return sorted(files)


def human_bytes(n: int) -> str:
    if n < 1024:
        return f"{n} B"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f} KB"
    return f"{n / 1024 / 1024:.2f} MB"


def convert_one(src: Path, out_dir: Path, quality: int, lossless: bool, replace: bool):
    out_dir.mkdir(parents=True, exist_ok=True)
    dest = out_dir / (src.stem + ".webp")
    before = src.stat().st_size

    img = Image.open(src)
    # Preservar canal alpha se existir
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA") if "A" in img.mode else img.convert("RGB")

    save_kwargs = {"format": "WEBP", "method": 6}
    if lossless:
        save_kwargs["lossless"] = True
        save_kwargs["quality"] = 100
    else:
        save_kwargs["quality"] = quality

    img.save(dest, **save_kwargs)
    after = dest.stat().st_size

    # Guarda: WebP maior que o original nao vale a troca.
    # Descarta o .webp, mantem o original, e NUNCA apaga sob --replace.
    # Acontece em imagem com muito ruido, textura fina ou ja bem comprimida.
    if after >= before and src.resolve() != dest.resolve():
        dest.unlink(missing_ok=True)
        return {"src": str(src), "dest": None, "before": before, "after": before, "mantido": True}

    if replace and src.resolve() != dest.resolve():
        src.unlink()

    return {"src": str(src), "dest": str(dest), "before": before, "after": after, "mantido": False}


def main():
    args = parse_args(sys.argv)
    if not args["input"]:
        print("Uso: python3 convert.py <input> [--quality=80] [--lossless] [--replace] [--recursive] [--out=<dir>] [--dry-run]", file=sys.stderr)
        sys.exit(1)

    input_path = Path(args["input"]).expanduser().resolve()
    if not input_path.exists():
        print(f"ERRO: caminho nao existe: {input_path}", file=sys.stderr)
        sys.exit(1)

    files = list_images(input_path, args["recursive"])
    if not files:
        print("Nenhuma imagem encontrada (.png .jpg .jpeg .tiff .heic .bmp .gif).", file=sys.stderr)
        sys.exit(1)

    mode = "lossless" if args["lossless"] else f"quality={args['quality']}"
    print(f"Encontradas {len(files)} imagem(ns). Modo={mode}. Replace={args['replace']}. Recursive={args['recursive']}.")

    if args["dry_run"]:
        for f in files:
            print(f"  [dry-run] {f}")
        return

    results = []
    total_before = 0
    total_after = 0
    failed = 0

    for f in files:
        out_dir = Path(args["out"]).expanduser().resolve() if args["out"] else f.parent
        try:
            r = convert_one(f, out_dir, args["quality"], args["lossless"], args["replace"])
            results.append(r)
            total_before += r["before"]
            total_after += r["after"]
        except Exception as e:
            failed += 1
            print(f"FALHA: {f} -> {e}", file=sys.stderr)

    print("")
    print(f"{'Arquivo':<50} {'Antes':>10} {'Depois':>10} {'Reducao':>8}")
    print("-" * 82)
    for r in results:
        name = Path(r["src"]).name
        name_col = (name[:47] + "...") if len(name) > 50 else name.ljust(50)
        pct = ((r["before"] - r["after"]) / r["before"] * 100) if r["before"] else 0
        if r.get("mantido"):
            print(f"{name_col} {human_bytes(r['before']):>10} {'-':>10} {'mantido':>8}")
        else:
            print(f"{name_col} {human_bytes(r['before']):>10} {human_bytes(r['after']):>10} {pct:>7.1f}%")
    print("-" * 82)

    pct_total = ((total_before - total_after) / total_before * 100) if total_before else 0
    mantidos = sum(1 for r in results if r.get("mantido"))
    convertidas = len(results) - mantidos
    print(f"TOTAL: {convertidas} convertidas | {human_bytes(total_before)} -> {human_bytes(total_after)} | economia {pct_total:.1f}%")
    if mantidos:
        print(f"{mantidos} imagem(ns) ficaram maiores em WebP. O original foi mantido e nada foi apagado.")
    if failed:
        print(f"Falhas: {failed}", file=sys.stderr)


if __name__ == "__main__":
    main()
