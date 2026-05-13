"""Génère les icônes PWA pour Matrix Bets — robot androïde MATRIX + ballon glow.

Style : photoréaliste basé sur une image source (Downloads/robot ia.avif), recolorée
en teinte MATRIX (vert néon sur fond noir), avec ballon de foot glow ajouté en
avant-plan + cadre HUD sci-fi.

Usage :
  python icons/generate_icons.py
"""
from __future__ import annotations
from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageChops

# ─── Sources & sorties ───
SOURCE_AVIF = Path(r"C:/Users/flori/Downloads/robot ia.avif")
OUT = Path(__file__).parent
MASTER_SIZE = 1024
TARGETS = [(1024, "icon-master-1024.png"), (512, "icon-512.png"),
           (192, "icon-192.png"), (180, "apple-touch-icon.png")]

# ─── Palette MATRIX ───
HUD = (0, 255, 102)
HUD_PASTEL = (130, 255, 180)
GLOW_ALPHA_BG = 35


def _crop_square(img: Image.Image) -> Image.Image:
    """Crop carré centré sur la partie haute (visage + buste du robot)."""
    w, h = img.size
    if w > h:
        # Image paysage : crop carré centré horizontalement, légèrement déplacé pour
        # cadrer le visage qui est au centre-droit dans cette image
        side = h
        # Le robot est centré horizontalement à ~50% de l'image source
        cx = w // 2
        left = max(0, cx - side // 2)
    else:
        side = w
        cx = h // 2
        left = 0
    top = 0
    return img.crop((left, top, left + side, top + side))


def _matrix_silhouette(img: Image.Image) -> Image.Image:
    """Transforme l'image en silhouette MATRIX : fond noir absolu, robot vert détaillé.

    Approche : détection RGB directe. Le robot métallique est NEUTRE (R≈G≈B), le fond
    rouge a R >> G,B et le fond bleu a B >> R,G. On masque par déséquilibre RGB.
    """
    rgb = img.convert("RGB")
    hsv = rgb.convert("HSV")
    _, _, v_ch = hsv.split()
    v_enh = ImageEnhance.Contrast(v_ch).enhance(1.6)

    rgb_pixels = list(rgb.getdata())
    v_pixels = list(v_enh.getdata())
    out_pixels = []
    for (r, g, b), v in zip(rgb_pixels, v_pixels):
        # Détection fond rouge : R domine clairement sur G et B
        is_red_bg = r > 70 and (r - g) > 25 and (r - b) > 25
        # Détection fond bleu : B domine clairement sur R et G
        is_blue_bg = b > 70 and (b - r) > 25 and (b - g) > 25
        if is_red_bg or is_blue_bg:
            out_pixels.append((0, 7, 0))
        else:
            # Pixel neutre/robot : remap luminance vers vert MATRIX
            if v < 22:
                out_pixels.append((0, 7, 0))
            else:
                t = min(1.0, (v - 22) / 230.0) ** 0.72
                gr = int(40 + t * 215)
                rd = int(t * 18)
                bl = int(t * 50)
                out_pixels.append((min(255, rd), min(255, gr), min(255, bl)))

    out = Image.new("RGB", img.size)
    out.putdata(out_pixels)
    return out


def _apply_vignette(img: Image.Image, strength: float = 0.85) -> Image.Image:
    """Assombrit progressivement les bords pour éliminer les fonds résiduels."""
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    cx, cy = w // 2, int(h * 0.45)  # centre légèrement haut pour suivre le robot
    max_r = math.sqrt(cx ** 2 + cy ** 2)
    # Cercles concentriques de noir vers blanc (gradient inverse)
    steps = 80
    for i in range(steps, 0, -1):
        t = i / steps
        # Rayon : plus i grand, plus le cercle est grand
        r = int(max_r * t * 0.95)
        # Opacité : centre = blanc (garde), bord = noir (vignette)
        alpha = int(255 * (1 - t ** 1.5 * strength))
        md.ellipse([cx - r, cy - r, cx + r, cy + r], fill=alpha)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=20))
    black = Image.new("RGB", img.size, (0, 7, 0))
    return Image.composite(img, black, mask)


def _add_glow_layer(img: Image.Image) -> Image.Image:
    """Ajoute un halo vert subtil autour des zones lumineuses (le robot)."""
    # On extrait les pixels clairs (le robot)
    base = img.convert("RGB")
    bright = base.point(lambda v: v if v > 100 else 0)
    glow = bright.filter(ImageFilter.GaussianBlur(radius=15))
    # Composite : ajoute le glow par dessus en mode lighter
    out = ImageChops.add(base, glow, scale=2.5)
    return out


def _draw_hud_frame(img: Image.Image) -> None:
    """Cadre HUD avec coins angulaires sur fond transparent par-dessus."""
    d = ImageDraw.Draw(img)
    S = img.size[0]
    w = 6
    L = 95
    pad = 48
    # 4 coins en équerre
    d.line([(pad, pad + L), (pad, pad), (pad + L, pad)], fill=HUD, width=w)
    d.line([(S - pad - L, pad), (S - pad, pad), (S - pad, pad + L)], fill=HUD, width=w)
    d.line([(pad, S - pad - L), (pad, S - pad), (pad + L, S - pad)], fill=HUD, width=w)
    d.line([(S - pad - L, S - pad), (S - pad, S - pad), (S - pad, S - pad - L)],
           fill=HUD, width=w)
    # Carrés aux coins
    sz = 14
    for (x, y) in [(pad, pad), (S - pad - sz, pad),
                   (pad, S - pad - sz), (S - pad - sz, S - pad - sz)]:
        d.rectangle([x, y, x + sz, y + sz], fill=HUD)


def _draw_ball(img: Image.Image) -> None:
    """Dessine un ballon de foot stylisé en bas à gauche avec glow vert."""
    S = img.size[0]
    cx = int(S * 0.18)
    cy = int(S * 0.78)
    r = int(S * 0.075)

    # Aura externe
    aura = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ad = ImageDraw.Draw(aura)
    ad.ellipse([cx - r - 35, cy - r - 35, cx + r + 35, cy + r + 35],
               fill=(0, 255, 102, 110))
    aura = aura.filter(ImageFilter.GaussianBlur(radius=22))
    img.alpha_composite(aura)

    d = ImageDraw.Draw(img)
    # Ballon
    d.ellipse([cx - r, cy - r, cx + r, cy + r],
              fill=(0, 60, 30, 255), outline=HUD, width=5)
    # Motifs pentagonaux noirs (motif foot)
    rr = int(r * 0.5)
    d.polygon([(cx, cy - rr), (cx + rr, cy - rr // 2),
               (cx + int(rr * 0.6), cy + rr // 2),
               (cx - int(rr * 0.6), cy + rr // 2),
               (cx - rr, cy - rr // 2)],
              fill=(0, 16, 0, 220))
    # Pentagones latéraux
    d.polygon([(cx - r + 5, cy - 5), (cx - rr, cy - rr // 2),
               (cx - rr, cy + rr // 2), (cx - r + 5, cy + rr // 2)],
              fill=(0, 16, 0, 200))
    d.polygon([(cx + r - 5, cy - 5), (cx + rr, cy - rr // 2),
               (cx + rr, cy + rr // 2), (cx + r - 5, cy + rr // 2)],
              fill=(0, 16, 0, 200))
    # Highlight blanc
    d.ellipse([cx - r // 2, cy - r // 2,
               cx - r // 4, cy - r // 4],
              fill=(255, 255, 255, 180))

    # Étincelles autour
    sparks = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sparks)
    for (dx, dy, sz) in [(-r - 15, -r - 10, 6), (r + 12, -r - 15, 5),
                          (-r - 20, r + 5, 5), (r + 18, r + 8, 6),
                          (-r // 2, -r - 25, 4), (r // 2, r + 20, 4)]:
        x, y = cx + dx, cy + dy
        sd.ellipse([x - sz, y - sz, x + sz, y + sz], fill=HUD)
    sparks_blur = sparks.filter(ImageFilter.GaussianBlur(radius=2))
    img.alpha_composite(sparks_blur)
    img.alpha_composite(sparks)


def _add_matrix_rain(img: Image.Image) -> None:
    """Pluie Matrix discrète sur les bords (lignes verticales vertes faibles)."""
    rain = Image.new("RGBA", img.size, (0, 0, 0, 0))
    rd = ImageDraw.Draw(rain)
    S = img.size[0]
    cols = [
        (90, 180, 360, 0.5), (90, 600, 220, 0.4),
        (S - 105, 200, 260, 0.5), (S - 105, 540, 320, 0.4),
        (200, 80, 70, 0.3), (380, 80, 50, 0.3), (550, 80, 90, 0.3), (720, 80, 60, 0.3),
        (200, S - 100, 70, 0.3), (380, S - 100, 50, 0.3),
        (550, S - 100, 90, 0.3), (720, S - 100, 60, 0.3),
    ]
    for (x, y, length, opacity_mult) in cols:
        for j in range(0, length, 12):
            opacity = int(max(20, 80 - j // 4) * opacity_mult)
            rd.rectangle([x, y + j, x + 3, y + j + 8], fill=(0, 255, 102, opacity))
    rain = rain.filter(ImageFilter.GaussianBlur(radius=1.5))
    img.alpha_composite(rain)


def build_master() -> Image.Image:
    print(f"[1/6] Chargement source : {SOURCE_AVIF.name}")
    src = Image.open(SOURCE_AVIF).convert("RGB")
    print(f"      taille source : {src.size}")

    print("[2/6] Crop carré centré")
    sq = _crop_square(src)
    print(f"      après crop : {sq.size}")

    print(f"[3/6] Resize → {MASTER_SIZE}×{MASTER_SIZE}")
    sq = sq.resize((MASTER_SIZE, MASTER_SIZE), Image.LANCZOS)

    print("[4/6] Silhouette MATRIX (fond noir / robot vert)")
    silhouette = _matrix_silhouette(sq)

    print("[5/6] Vignetting pour noir-iser les bords résiduels")
    silhouette = _apply_vignette(silhouette, strength=0.92)

    print("[6/6] Glow + cadre HUD + pluie Matrix + ballon")
    glowed = _add_glow_layer(silhouette)
    img = glowed.convert("RGBA")
    _add_matrix_rain(img)
    _draw_hud_frame(img)
    _draw_ball(img)

    return img


def main():
    master = build_master()
    for size, fname in TARGETS:
        out = OUT / fname
        resized = master.resize((size, size), Image.LANCZOS)
        resized.save(out, "PNG", optimize=True)
        print(f"  → {out.name} ({size}×{size}) {out.stat().st_size // 1024} KB")
    print("\nOK — icônes générées.")


if __name__ == "__main__":
    main()
