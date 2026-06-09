#!/usr/bin/env python3
"""
Make background transparent for an image and save as a PNG.

Usage:
  python make_transparent.py [src] [-o OUT] [-t TOL]

If `src` is omitted the script defaults to `../screenshot.png`.
"""
from PIL import Image
import argparse
from pathlib import Path


def make_transparent(src_path: Path, out_path: Path, tol: int = 30) -> None:
    img = Image.open(src_path).convert('RGBA')
    bg = img.getpixel((0, 0))[:3]
    pixels = list(img.getdata())
    new = []
    for r, g, b, a in pixels:
        if abs(r - bg[0]) <= tol and abs(g - bg[1]) <= tol and abs(b - bg[2]) <= tol:
            new.append((r, g, b, 0))
        else:
            new.append((r, g, b, a))
    img.putdata(new)
    img.save(out_path)
    print('Saved', out_path)


def main() -> None:
    p = argparse.ArgumentParser(description='Make image background transparent')
    p.add_argument('src', nargs='?', default='../screenshot.png', help='source image path')
    p.add_argument('-o', '--out', default='pokemon-center-transparent.png', help='output filename')
    p.add_argument('-t', '--tol', type=int, default=30, help='tolerance for background color matching (0-255)')
    args = p.parse_args()

    src = Path(args.src)
    out = Path(args.out)

    if not src.exists():
        print(f"Source not found: {src}")
        raise SystemExit(1)

    make_transparent(src, out, args.tol)


if __name__ == '__main__':
    main()
