"""Génère les icônes PWA pour Matrix Bets — androïde futuriste kickant un ballon.

Style : palette MATRIX (vert néon #00FF66 sur fond noir #001000), look robot
géométrique anguleux type Daft Punk, ballon avec glow, cadre HUD sci-fi.

Implémentation : Pillow pur (pas de cairo/SVG runtime à installer côté Windows).
Génère une icône maître 1024×1024 puis downscale en 512 / 192 / 180.

Usage :
  python icons/generate_icons.py
"""
from __future__ import annotations
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

# ─── Palette MATRIX ───
BG_TOP = (0, 7, 0, 255)
BG_GLOW = (0, 48, 32, 255)         # vert très sombre au centre
HUD = (0, 255, 102, 255)           # vert flashy
HUD_PASTEL = (130, 255, 180, 255)
HUD_DARK = (10, 77, 42, 255)       # vert foncé pour ombre
WHITE = (255, 255, 255, 255)
ARMOR_FILL = (0, 30, 14, 230)      # remplissage corps robot (vert très sombre)

S = 1024  # taille master
OUT = Path(__file__).parent


def _create_canvas() -> Image.Image:
    """Fond noir avec gradient radial vert au centre."""
    img = Image.new("RGBA", (S, S), BG_TOP)
    # Gradient radial : on dessine des cercles concentriques d'opacité décroissante
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx, cy = S // 2, int(S * 0.52)
    for r in range(int(S * 0.55), 50, -20):
        # opacité fonction de la distance au centre (max 50 au centre)
        alpha = int(50 * (1 - r / (S * 0.55)))
        gd.ellipse([cx - r, cy - r, cx + r, cy + r],
                   fill=(0, 80, 40, max(0, alpha)))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=40))
    img = Image.alpha_composite(img, glow)
    return img


def _draw_hud_frame(img: Image.Image) -> None:
    """Cadre HUD avec coins angulaires et petits carrés."""
    d = ImageDraw.Draw(img)
    w = 6
    L = 95         # longueur des bras du coin
    pad = 48
    # 4 coins en équerre (L-shape)
    # top-left
    d.line([(pad, pad + L), (pad, pad), (pad + L, pad)], fill=HUD, width=w)
    # top-right
    d.line([(S - pad - L, pad), (S - pad, pad), (S - pad, pad + L)], fill=HUD, width=w)
    # bottom-left
    d.line([(pad, S - pad - L), (pad, S - pad), (pad + L, S - pad)], fill=HUD, width=w)
    # bottom-right
    d.line([(S - pad - L, S - pad), (S - pad, S - pad), (S - pad, S - pad - L)], fill=HUD, width=w)
    # Carrés aux coins (détail tech)
    sz = 14
    for (x, y) in [(pad, pad), (S - pad - sz, pad),
                   (pad, S - pad - sz), (S - pad - sz, S - pad - sz)]:
        d.rectangle([x, y, x + sz, y + sz], fill=HUD)


def _draw_matrix_rain(img: Image.Image) -> None:
    """Caractères Matrix faibles en arrière-plan (sur les bords)."""
    d = ImageDraw.Draw(img)
    # Quelques '$', '_', '0', '1' placés en bordure (sans charger de font custom)
    # On simule avec des petites lignes verticales représentant la pluie
    rain = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rain)
    for (x_start, y_start, length) in [
        (90, 180, 360), (90, 600, 220),
        (S - 105, 200, 260), (S - 105, 540, 320),
        (200, 80, 70), (380, 80, 50), (550, 80, 90), (720, 80, 60),
        (200, S - 100, 70), (380, S - 100, 50), (550, S - 100, 90), (720, S - 100, 60),
    ]:
        # petite "colonne de pluie" : ligne pointillée verte
        for j in range(0, length, 12):
            opacity = max(20, 80 - j // 4)
            rd.rectangle([x_start, y_start + j, x_start + 3, y_start + j + 8],
                         fill=(0, 255, 102, opacity))
    rain = rain.filter(ImageFilter.GaussianBlur(radius=1.5))
    img.alpha_composite(rain)


def _stroked_polygon(d: ImageDraw.ImageDraw, pts, fill=ARMOR_FILL, outline=HUD, width=4):
    d.polygon(pts, fill=fill, outline=outline)
    # Pillow's polygon outline width=1 par défaut. On retrace en line pour avoir width.
    if width > 1:
        d.line(list(pts) + [pts[0]], fill=outline, width=width, joint="curve")


def _draw_robot(img: Image.Image) -> None:
    """Androïde futuriste en plein élan de frappe (jambe gauche tendue horizontalement)."""
    d = ImageDraw.Draw(img)

    # ─── TÊTE / CASQUE octogonale (style Daft Punk) ───
    head = [(430, 200), (530, 200), (565, 235), (565, 310),
            (530, 345), (430, 345), (395, 310), (395, 235)]
    _stroked_polygon(d, head, fill=ARMOR_FILL, outline=HUD, width=5)
    # Reflet supérieur
    crown = [(450, 215), (510, 215), (535, 240), (530, 255), (430, 255), (425, 240)]
    _stroked_polygon(d, crown, fill=(0, 80, 40, 180), outline=HUD_PASTEL, width=2)
    # Visière LED
    d.rectangle([405, 260, 560, 300], fill=(0, 16, 0, 255), outline=HUD, width=4)
    d.rectangle([414, 269, 552, 291], fill=HUD)
    # 3 LEDs internes plus brillantes
    for cx in (444, 482, 522):
        d.ellipse([cx - 6, 274, cx + 6, 286], fill=WHITE)
    # Antenne
    d.line([(480, 200), (480, 165)], fill=HUD, width=5)
    d.ellipse([470, 152, 490, 172], fill=HUD)
    d.ellipse([464, 146, 496, 178], outline=HUD, width=2)

    # ─── COU + ÉPAULIÈRES ───
    d.rectangle([455, 343, 505, 368], fill=ARMOR_FILL, outline=HUD, width=4)
    _stroked_polygon(d, [(360, 360), (460, 360), (470, 405), (470, 450), (350, 425)],
                     outline=HUD, width=4)
    _stroked_polygon(d, [(500, 360), (600, 360), (610, 425), (490, 450), (490, 405)],
                     outline=HUD, width=4)

    # ─── TORSE ───
    torso = [(385, 405), (575, 405), (590, 565), (582, 650), (380, 650), (370, 565)]
    _stroked_polygon(d, torso, fill=ARMOR_FILL, outline=HUD, width=5)
    # Lignes tech intérieures
    d.line([(480, 415), (480, 640)], fill=HUD_DARK, width=3)
    d.line([(390, 500), (570, 500)], fill=HUD_DARK, width=3)
    # Cœur reactor central
    d.ellipse([455, 478, 505, 528], fill=(0, 16, 0, 255), outline=HUD, width=4)
    d.ellipse([467, 490, 493, 516], fill=HUD)
    d.ellipse([475, 498, 485, 508], fill=WHITE)

    # ─── BRAS GAUCHE (notre droite, arrière, en équilibre) ───
    _stroked_polygon(d, [(580, 410), (635, 430), (680, 510), (655, 525), (595, 470)],
                     outline=HUD, width=4)
    _stroked_polygon(d, [(650, 510), (700, 580), (685, 625), (640, 625), (615, 555)],
                     outline=HUD, width=4)
    d.rounded_rectangle([640, 608, 700, 655], radius=8,
                        fill=(0, 80, 40, 230), outline=HUD, width=4)

    # ─── BRAS DROIT (notre gauche, devant pour l'élan) ───
    _stroked_polygon(d, [(370, 410), (320, 445), (290, 545), (320, 565), (385, 465)],
                     outline=HUD, width=4)
    _stroked_polygon(d, [(305, 545), (282, 605), (310, 660), (355, 640), (335, 565)],
                     outline=HUD, width=4)
    d.rounded_rectangle([270, 638, 330, 685], radius=8,
                        fill=(0, 80, 40, 230), outline=HUD, width=4)

    # ─── JAMBE D'APPUI (côté droit écran, verticale) ───
    # Cuisse
    _stroked_polygon(d, [(495, 645), (585, 650), (600, 800), (545, 820), (495, 760)],
                     outline=HUD, width=5)
    # Genou
    d.ellipse([542, 790, 575, 822], fill=(0, 80, 40, 230), outline=HUD, width=4)
    # Tibia
    _stroked_polygon(d, [(530, 800), (600, 800), (615, 935), (540, 950), (520, 835)],
                     outline=HUD, width=5)
    # Pied
    _stroked_polygon(d, [(505, 935), (635, 935), (645, 968), (495, 972)],
                     fill=(0, 80, 40, 230), outline=HUD, width=4)

    # ─── JAMBE DE FRAPPE (notre gauche, tendue horizontalement vers ballon) ───
    # Cuisse (descend du bassin vers genou avancé)
    _stroked_polygon(d, [(385, 645), (470, 650), (460, 755), (365, 780), (360, 695)],
                     outline=HUD, width=5)
    # Genou avancé
    d.ellipse([348, 745, 384, 781], fill=(0, 80, 40, 230), outline=HUD, width=4)
    # Tibia horizontal (vers la gauche écran, en extension)
    _stroked_polygon(d, [(360, 728), (368, 795), (220, 800), (200, 752)],
                     outline=HUD, width=5)
    # Cheville
    d.ellipse([205, 758, 235, 788], fill=(0, 80, 40, 230), outline=HUD, width=4)
    # Pied de frappe (orienté vers ballon)
    _stroked_polygon(d, [(195, 754), (215, 750), (215, 800), (172, 800), (160, 778)],
                     fill=(0, 80, 40, 230), outline=HUD, width=4)


def _draw_ball(img: Image.Image) -> None:
    """Ballon de foot devant le pied de frappe, avec aura/glow vert."""
    cx, cy, r = 120, 778, 55

    # Aura externe (cercle flou)
    aura = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ad = ImageDraw.Draw(aura)
    ad.ellipse([cx - r - 50, cy - r - 50, cx + r + 50, cy + r + 50],
               fill=(0, 255, 102, 90))
    aura = aura.filter(ImageFilter.GaussianBlur(radius=30))
    img.alpha_composite(aura)

    d = ImageDraw.Draw(img)
    # Ballon principal (cercle vert)
    d.ellipse([cx - r, cy - r, cx + r, cy + r],
              fill=(0, 80, 40, 250), outline=HUD, width=5)
    # Pentagones noirs (motif foot stylisé)
    d.polygon([(cx, cy - 28), (cx + 22, cy - 12), (cx + 14, cy + 12),
               (cx - 14, cy + 12), (cx - 22, cy - 12)],
              fill=(0, 16, 0, 220))
    d.polygon([(cx - 38, cy + 5), (cx - 22, cy - 12), (cx - 22, cy + 18),
               (cx - 38, cy + 28)], fill=(0, 16, 0, 200))
    d.polygon([(cx + 38, cy + 5), (cx + 22, cy - 12), (cx + 22, cy + 18),
               (cx + 38, cy + 28)], fill=(0, 16, 0, 200))
    d.polygon([(cx - 18, cy + 25), (cx + 18, cy + 25), (cx + 24, cy + 42),
               (cx, cy + 50), (cx - 24, cy + 42)], fill=(0, 16, 0, 200))
    # Highlight blanc (effet brillant)
    d.ellipse([cx - 30, cy - 30, cx - 14, cy - 18], fill=(255, 255, 255, 160))


def _draw_speed_and_sparks(img: Image.Image) -> None:
    """Lignes de vitesse (impact) + étincelles autour du ballon."""
    d = ImageDraw.Draw(img)
    # Lignes de vitesse (derrière le pied)
    for y, length in [(660, 100), (705, 130), (750, 110), (795, 140), (840, 95)]:
        d.line([(210 - length, y), (220, y)], fill=HUD_PASTEL, width=4)

    # Étincelles autour du ballon (carrés et losanges scintillants)
    sparks = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sparks)
    for (x, y, r) in [(170, 715, 8), (90, 720, 6), (60, 770, 5),
                       (75, 850, 7), (170, 855, 6), (200, 745, 5)]:
        sd.ellipse([x - r, y - r, x + r, y + r], fill=HUD)
    # Diamants 4 branches (look énergie)
    for (cx, cy, sz) in [(170, 720, 14), (75, 845, 10)]:
        sd.polygon([(cx, cy - sz), (cx + sz, cy), (cx, cy + sz), (cx - sz, cy)],
                   fill=HUD_PASTEL)
    sparks_blurred = sparks.filter(ImageFilter.GaussianBlur(radius=3))
    img.alpha_composite(sparks_blurred)
    img.alpha_composite(sparks)  # version nette dessus


def _add_global_glow(img: Image.Image) -> Image.Image:
    """Ajoute un glow vert sur l'ensemble du robot et ballon."""
    # Extraire les pixels verts puissants pour les flouter et les rajouter dessous
    glow_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    # Approche simple : prendre l'image, masquer le fond noir, flouter
    base = img.convert("RGBA")
    # On crée une version "halo" en floutant l'image entière à fort niveau
    blurred = base.filter(ImageFilter.GaussianBlur(radius=8))
    # On compose le flou sous l'image originale pour amplifier la luminosité verte
    out = Image.alpha_composite(base, Image.new("RGBA", img.size, (0, 0, 0, 0)))
    out = Image.blend(blurred, base, alpha=0.85)
    return out


def build_icon() -> Image.Image:
    img = _create_canvas()
    _draw_matrix_rain(img)
    _draw_hud_frame(img)
    _draw_robot(img)
    _draw_ball(img)
    _draw_speed_and_sparks(img)
    img = _add_global_glow(img)
    return img


def main():
    master = build_icon()
    master_path = OUT / "icon-master-1024.png"
    master.save(master_path, "PNG", optimize=True)
    print(f"  → {master_path.name} (1024×1024) {master_path.stat().st_size // 1024} KB")

    for size in (512, 192, 180):
        out = OUT / (f"icon-{size}.png" if size != 180 else "apple-touch-icon.png")
        resized = master.resize((size, size), Image.LANCZOS)
        resized.save(out, "PNG", optimize=True)
        print(f"  → {out.name} ({size}×{size}) {out.stat().st_size // 1024} KB")

    print("\nOK — icônes générées.")


if __name__ == "__main__":
    main()
