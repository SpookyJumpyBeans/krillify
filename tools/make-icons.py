"""Makes Krillify's icons from the pufferfish in the README banner.

    python tools/make-icons.py

Crops the pufferfish out of assets/krillify-banner.png, darkens the water toward the edges so
the fish stands out, and frames it as a rounded tile. Writes extension/icons/icon-{16,32,48,128}.png.
The 128 icon keeps the tile at 96x96 with 16px of clear space around it, as the Chrome Web
Store recommends; the toolbar sizes fill their whole canvas, and the two smallest crop closer
to the fish's face so it still reads.
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

root = Path(__file__).resolve().parent.parent
banner = Image.open(root / "assets" / "krillify-banner.png").convert("RGB")
out = root / "extension" / "icons"
out.mkdir(parents=True, exist_ok=True)

# Squares around the pufferfish in the 2172x724 banner: the whole fish with fins, and a closer
# crop on the body and face for small sizes.
WHOLE = (1425, 20, 2025, 620)
CLOSE = (1480, 95, 1930, 545)


def tile(box, size, radius_ratio=0.22, vignette=0.55):
    """The cropped fish at `size` px on a rounded tile, edges darkened toward deep water."""
    art = banner.crop(box).resize((size * 4, size * 4), Image.LANCZOS)
    # Radial darkening: full brightness in the middle, `vignette` darkness at the corners.
    big = size * 4
    glow = Image.new("L", (big, big), 0)
    ImageDraw.Draw(glow).ellipse((-big * 0.05, -big * 0.05, big * 1.05, big * 1.05), fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(big * 0.12))
    floor = int(255 * (1 - vignette))
    glow = glow.point(lambda v: floor + v * (255 - floor) // 255)
    dark = Image.merge("RGB", [glow] * 3)
    art = ImageChops.multiply(art, dark)
    # Rounded-square mask, drawn large and scaled down for smooth corners.
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, big - 1, big - 1), radius=int(big * radius_ratio), fill=255)
    # Thin cyan rim, like the panels in the extension.
    rim = Image.new("L", (big, big), 0)
    w = max(4, big // 48)
    ImageDraw.Draw(rim).rounded_rectangle((0, 0, big - 1, big - 1), radius=int(big * radius_ratio), outline=255, width=w)
    art = Image.composite(Image.new("RGB", (big, big), (77, 227, 255)), art, rim.point(lambda v: v * 70 // 255))
    rgba = art.convert("RGBA")
    rgba.putalpha(mask)
    return rgba.resize((size, size), Image.LANCZOS)


tile(CLOSE, 16, radius_ratio=0.18, vignette=0.35).save(out / "icon-16.png")
tile(CLOSE, 32, radius_ratio=0.2, vignette=0.4).save(out / "icon-32.png")
tile(WHOLE, 48).save(out / "icon-48.png")
store = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
store.alpha_composite(tile(WHOLE, 96), (16, 16))
store.save(out / "icon-128.png")
print("wrote", ", ".join(sorted(p.name for p in out.glob("icon-*.png"))))
