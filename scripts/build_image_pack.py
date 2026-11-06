#!/usr/bin/env python3
"""提供ランキング画像からキャラ単位に切り出し、私的利用の画像パックを作る。

入力: private-assets/source/*.jpg（git管理外）
出力: private-assets/cards/rank-XX.webp と private-assets/dr-stone-image-pack.json（git管理外）
生成物は公開リポジトリに含めず、各端末のアプリ設定画面から読み込む。
"""
import base64
import io
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent / "private-assets"
SOURCE = ROOT / "source"
CARDS = ROOT / "cards"
SIZE = 320  # 出力の一辺(px)
SS = 4      # マスクのアンチエイリアス倍率

# (ファイル, 中心y, 六角形の幅, {順位: 中心x})
ROWS = [
    ("ranks-01-03.jpg", 288, 350, {1: 524}),
    ("ranks-01-03.jpg", 845, 350, {2: 285, 3: 758}),
    ("ranks-04-17.jpg", 163, 220, {4: 265, 5: 516, 6: 768}),
    ("ranks-04-17.jpg", 544, 220, {7: 140, 8: 391, 9: 643, 10: 895}),
    ("ranks-04-17.jpg", 925, 220, {11: 265, 12: 516, 13: 768}),
    ("ranks-04-17.jpg", 1306, 220, {14: 140, 15: 391, 16: 643, 17: 895}),
    ("ranks-18-29.jpg", 188, 220, {18: 263, 19: 515, 20: 767}),
    ("ranks-18-29.jpg", 550, 168, {21: 112, 22: 313, 23: 515, 24: 716, 25: 918}),
    ("ranks-18-29.jpg", 842, 168, {26: 214, 27: 415, 28: 616, 29: 817}),
    ("ranks-30-47.jpg", 128, 168, {30: 112, 31: 313, 32: 515, 33: 716, 34: 918}),
    ("ranks-30-47.jpg", 423, 168, {35: 214, 36: 415, 37: 616, 38: 817}),
    ("ranks-30-47.jpg", 718, 168, {39: 112, 40: 313, 41: 515, 42: 716, 43: 918}),
    ("ranks-30-47.jpg", 1012, 168, {44: 214, 45: 415, 46: 616, 47: 817}),
    ("ranks-48-50.jpg", 106, 168, {48: 312, 49: 514, 50: 716}),
]
INSET = 0.86  # 枠の光を落とすための縮小率
# 名前の文字が下端に写り込む順位は、少し上へずらして小さめに切り出す
TIGHT = {5, 7, 21, 22, 28, 33, 35, 42, 45, 46}
TIGHT_INSET = 0.78
TIGHT_SHIFT = 0.07


def hex_mask() -> Image.Image:
    s = SIZE * SS
    q = s * 0.933 / 2  # 尖った頂点を上下に置いた正六角形の半幅(高さ基準)
    pts = [(s / 2, 0), (s / 2 + q, s * 0.25), (s / 2 + q, s * 0.75),
           (s / 2, s), (s / 2 - q, s * 0.75), (s / 2 - q, s * 0.25)]
    m = Image.new("L", (s, s), 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m.resize((SIZE, SIZE), Image.LANCZOS)


def main() -> None:
    CARDS.mkdir(parents=True, exist_ok=True)
    mask = hex_mask()
    pack = {}
    for file, cy, width, centers in ROWS:
        src = Image.open(SOURCE / file).convert("RGB")
        for rank, cx in centers.items():
            tight = rank in TIGHT
            half = width * (TIGHT_INSET if tight else INSET) * 0.58  # 高さ≒幅×1.155 の半分
            y = cy - (width * TIGHT_SHIFT if tight else 0)
            box = (round(cx - half), round(y - half), round(cx + half), round(y + half))
            card = src.crop(box).resize((SIZE, SIZE), Image.LANCZOS).convert("RGBA")
            card.putalpha(mask)
            buf = io.BytesIO()
            card.save(buf, "WEBP", quality=80, method=6)
            (CARDS / f"rank-{rank:02d}.webp").write_bytes(buf.getvalue())
            pack[str(rank)] = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
    assert sorted(map(int, pack)) == list(range(1, 51)), "50人分そろっていません"
    out = ROOT / "dr-stone-image-pack.json"
    out.write_text(json.dumps({"app": "dr-stone-study-quest", "type": "image-pack", "version": 1, "images": pack}))
    print(f"{len(pack)}人分 → {out} ({out.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
