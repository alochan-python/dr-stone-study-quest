#!/usr/bin/env python3
"""PWAアイコンを生成する（キャラクター画像は使わないオリジナルデザイン）。"""
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent / "public"
OUT = ROOT / "icons"
SS = 4
BG = (10, 16, 22, 255)


def hexagon(cx, cy, r):
    return [(cx + r * math.sin(math.radians(60 * i)), cy - r * math.cos(math.radians(60 * i))) for i in range(6)]


def draw_icon(size, scale=1.0, transparent=False):
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0) if transparent else BG)
    d = ImageDraw.Draw(img)
    c = s / 2
    d.polygon(hexagon(c, c, s * 0.46 * scale), fill=(84, 230, 212, 255))
    d.polygon(hexagon(c, c, s * 0.405 * scale), fill=(16, 32, 40, 255))
    d.polygon(hexagon(c, c, s * 0.33 * scale), fill=(255, 208, 72, 255))
    w = max(1, round(s * 0.058 * scale))
    points = [
        (c - s * 0.15 * scale, c + s * 0.005 * scale),
        (c - s * 0.035 * scale, c + s * 0.12 * scale),
        (c + s * 0.165 * scale, c - s * 0.115 * scale),
    ]
    d.line(points, fill=(10, 16, 22, 255), width=w, joint="curve")
    for x, y in (points[0], points[2]):
        d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=(10, 16, 22, 255))
    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    draw_icon(192).save(OUT / "icon-192.png")
    draw_icon(512).save(OUT / "icon-512.png")
    draw_icon(512, scale=0.78).save(OUT / "icon-maskable-512.png")
    draw_icon(180, scale=0.98).save(OUT / "apple-touch-icon.png")


if __name__ == "__main__":
    main()
