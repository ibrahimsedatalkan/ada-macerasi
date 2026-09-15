#!/usr/bin/env python3
"""Üretilen PNG görselleri web için optimize eder (JPEG, küçültülmüş).

Kullanım:
    uv run --with pillow python tools/optimize_images.py
    uv run --with pillow python tools/optimize_images.py --width 1600 --quality 82

- assets/bg/*.png        → assets/bg/*.jpg   (kaynak PNG'ler assets/_source/bg/ altına taşınır)
- assets/avatars/*.png   → assets/avatars/*.jpg
Boyut hedefi: arka plan ~250-400 KB, avatar ~40-80 KB.
"""
import argparse
import pathlib
import shutil
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow yok: uv run --with pillow python tools/optimize_images.py")


def process(src: pathlib.Path, dest: pathlib.Path, width: int, quality: int, source_dir: pathlib.Path) -> tuple:
    img = Image.open(src).convert("RGB")
    if img.width > width:
        h = round(img.height * width / img.width)
        img = img.resize((width, h), Image.LANCZOS)
    img.save(dest, "JPEG", quality=quality, optimize=True, progressive=True)
    source_dir.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(source_dir / src.name))
    return (dest.stat().st_size, img.size)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--width", type=int, default=1600)
    ap.add_argument("--quality", type=int, default=82)
    args = ap.parse_args()

    root = pathlib.Path(__file__).resolve().parent.parent
    total = 0
    for folder, width, quality in (("bg", args.width, args.quality), ("avatars", 512, args.quality), ("mascot", 512, args.quality)):
        src_dir = root / "assets" / folder
        if not src_dir.exists():
            continue
        for png in sorted(src_dir.glob("*.png")):
            size, dims = process(png, src_dir / (png.stem + ".jpg"), width, quality, root / "assets" / "_source" / folder)
            total += size
            print(f"✅ {folder}/{png.name} → {png.stem}.jpg  {size // 1024} KB  {dims[0]}×{dims[1]}")
    print(f"toplam {total // 1024} KB (kaynak PNG'ler assets/_source/ altında)")


if __name__ == "__main__":
    main()
