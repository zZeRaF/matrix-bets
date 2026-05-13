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
    """Transforme l'image en silhouette MATRIX : fond noir absolu, robot vert vif.

    Mapping vert PLUS CLAIR pour augmenter le contraste :
      - Niveau 0-22 : noir
      - Niveau 22-100 : vert sombre (50→130)
      - Niveau 100-180 : vert moyen (130→220)
      - Niveau 180-255 : vert très clair (220→255) — détails métalliques nets
    """
    rgb = img.convert("RGB")
    hsv = rgb.convert("HSV")
    _, _, v_ch = hsv.split()
    v_enh = ImageEnhance.Contrast(v_ch).enhance(1.7)

    rgb_pixels = list(rgb.getdata())
    v_pixels = list(v_enh.getdata())
    out_pixels = []
    for (r, g, b), v in zip(rgb_pixels, v_pixels):
        # Fonds rouge et bleu → noir
        is_red_bg = r > 70 and (r - g) > 25 and (r - b) > 25
        is_blue_bg = b > 70 and (b - r) > 25 and (b - g) > 25
        if is_red_bg or is_blue_bg:
            out_pixels.append((0, 7, 0))
        else:
            if v < 22:
                out_pixels.append((0, 7, 0))
            elif v < 100:
                # Tons sombres : vert sombre à moyen
                t = (v - 22) / 78.0
                gr = int(50 + t * 80)
                out_pixels.append((int(gr * 0.08), gr, int(gr * 0.22)))
            elif v < 180:
                # Tons moyens : vert moyen à clair (le plus de contraste ici)
                t = (v - 100) / 80.0
                gr = int(130 + t * 90)
                out_pixels.append((int(gr * 0.10), gr, int(gr * 0.25)))
            else:
                # Hautes lumières : vert très clair (yeux + reflets badass)
                t = (v - 180) / 75.0
                gr = int(220 + t * 35)
                # Touche de blanc pour faire ressortir les reflets
                rd = int(60 + t * 80)
                bl = int(90 + t * 60)
                out_pixels.append((min(255, rd), min(255, gr), min(255, bl)))

    out = Image.new("RGB", img.size)
    out.putdata(out_pixels)
    return out


def _enhance_eyes(img: Image.Image) -> Image.Image:
    """Force 2 LEDs lumineuses aux yeux du robot (coordonnées estimées).

    Le robot dans l'image source est centré-gauche après crop, visage à ~y=28% h.
    On dessine 2 LEDs vert/blanc avec halo concentrique pour effet badass.
    """
    out = img.convert("RGBA")
    w, h = out.size

    # Coordonnées des yeux — décalées de +10% vers la droite à la demande utilisateur
    eye_left = (int(w * 0.616), int(h * 0.218))   # +0.10 en x
    eye_right = (int(w * 0.765), int(h * 0.225))  # +0.10 en x

    # Couche 1 : Halo très large vert (atmosphère)
    halo_far = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo_far)
    for (cx, cy) in (eye_left, eye_right):
        for r in range(50, 0, -2):
            alpha = int(20 * (1 - r / 50))
            hd.ellipse([cx - r, cy - r, cx + r, cy + r],
                       fill=(0, 255, 102, max(0, alpha)))
    halo_far = halo_far.filter(ImageFilter.GaussianBlur(radius=15))
    out = Image.alpha_composite(out, halo_far)

    # Couche 2 : Halo moyen vert vif
    halo_mid = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    hmd = ImageDraw.Draw(halo_mid)
    for (cx, cy) in (eye_left, eye_right):
        hmd.ellipse([cx - 22, cy - 22, cx + 22, cy + 22],
                    fill=(0, 255, 102, 180))
    halo_mid = halo_mid.filter(ImageFilter.GaussianBlur(radius=10))
    out = Image.alpha_composite(out, halo_mid)

    # Couche 3 : LED principale (vert flashy + cœur blanc)
    leds = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ld = ImageDraw.Draw(leds)
    for (cx, cy) in (eye_left, eye_right):
        # Cercle vert vif extérieur
        ld.ellipse([cx - 12, cy - 12, cx + 12, cy + 12], fill=(0, 255, 102, 255))
        # Cœur blanc lumineux
        ld.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(220, 255, 220, 255))
        # Centre blanc pur
        ld.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=(255, 255, 255, 255))
    leds_blurred = leds.filter(ImageFilter.GaussianBlur(radius=1.5))
    out = Image.alpha_composite(out, leds_blurred)
    out = Image.alpha_composite(out, leds)

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

    print("[6/7] Glow général")
    glowed = _add_glow_layer(silhouette)

    print("[7/7] Lueur yeux badass + cadre HUD + pluie + ballon")
    eyes_boosted = _enhance_eyes(glowed)
    img = eyes_boosted if eyes_boosted.mode == "RGBA" else eyes_boosted.convert("RGBA")
    _add_matrix_rain(img)
    _draw_hud_frame(img)
    _draw_ball(img)

    return img


def build_robot_portrait() -> Image.Image:
    """Variante sans cadre HUD ni ballon : juste le robot avec son halo, pour usage
    en sprite dans l'animation du splash."""
    src = Image.open(SOURCE_AVIF).convert("RGB")
    sq = _crop_square(src).resize((MASTER_SIZE, MASTER_SIZE), Image.LANCZOS)
    silhouette = _matrix_silhouette(sq)
    silhouette = _apply_vignette(silhouette, strength=0.95)
    glowed = _add_glow_layer(silhouette)
    eyes = _enhance_eyes(glowed)
    img = eyes if eyes.mode == "RGBA" else eyes.convert("RGBA")
    # Pas de cadre HUD, pas de ballon, pas de pluie — sprite pur
    return img


def main():
    master = build_master()
    for size, fname in TARGETS:
        out = OUT / fname
        resized = master.resize((size, size), Image.LANCZOS)
        resized.save(out, "PNG", optimize=True)
        print(f"  → {out.name} ({size}×{size}) {out.stat().st_size // 1024} KB")

    # Robot portrait sans ballon ni cadre, pour utilisation comme sprite dans le splash
    portrait = build_robot_portrait()
    # Plus petit : on n'a pas besoin de 1024 pour un sprite splash. 600px suffit.
    for size in (600,):
        out = OUT / f"robot-portrait-{size}.png"
        resized = portrait.resize((size, size), Image.LANCZOS)
        resized.save(out, "PNG", optimize=True)
        print(f"  → {out.name} ({size}×{size}) {out.stat().st_size // 1024} KB")

    print("\nOK — icônes générées.")


if __name__ == "__main__":
    main()
