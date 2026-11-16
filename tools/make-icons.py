"""Draws Krillify's pixel-art pufferfish icon at every size the extension and the store need.

    python tools/make-icons.py

Writes extension/icons/icon-{16,32,48,128}.png. The art is a 16x16 grid scaled up with no
smoothing, so every size stays crisp. The 128 icon keeps the art at 96x96 with 16px of clear
space around it, as the Chrome Web Store recommends.
"""
from pathlib import Path
from PIL import Image

# One character per pixel. '.' is transparent.
ART = [
    "................",
    "......s..s......",
    "...s..OOOO..s...",
    "....OOYYYYOO....",
    "...OYYYYYYYYO.s.",
    "ccOYYYYYYYWWYO..",
    "cOYYYYYYYYWKYO..",
    "cOYYYYYYYYYYYYO.",
    "cOYYyYYYYYYYpYO.",
    "ccOYyYYYYYYYYOs.",
    "...OYbbbbbbbYO..",
    "...sOObbbbbOO...",
    ".....sOOOOOs....",
    "......s..s......",
    "................",
    "................",
]
COLORS = {
    "O": (11, 26, 43, 255),     # navy outline
    "Y": (255, 209, 102, 255),  # gold body
    "y": (224, 169, 58, 255),   # shaded side
    "b": (255, 241, 199, 255),  # pale belly
    "W": (255, 255, 255, 255),  # eye
    "K": (11, 26, 43, 255),     # pupil
    "p": (255, 159, 115, 255),  # cheek
    "s": (255, 233, 168, 255),  # spines
    "c": (77, 227, 255, 255),   # cyan tail
}

assert len(ART) == 16 and all(len(row) == 16 for row in ART)
base = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
for y, row in enumerate(ART):
    for x, ch in enumerate(row):
        if ch != ".":
            base.putpixel((x, y), COLORS[ch])

out = Path(__file__).resolve().parent.parent / "extension" / "icons"
out.mkdir(parents=True, exist_ok=True)
for size in (16, 32, 48):
    base.resize((size, size), Image.NEAREST).save(out / f"icon-{size}.png")
store = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
store.paste(base.resize((96, 96), Image.NEAREST), (16, 16))
store.save(out / "icon-128.png")
print("wrote", ", ".join(sorted(p.name for p in out.glob("icon-*.png"))))
