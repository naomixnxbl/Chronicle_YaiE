#!/usr/bin/env python3
# Generate the brand-outro assets at a given canvas size:
#   butterfly.png  — a soft brand-coloured butterfly sprite (transparent)
#   outrobg.png    — soft cream→blush gradient background (WxH)
#   wordmark.png   — transparent WxH frame with "Florapeutic" centred + url + flower
# Usage: brand.py <out_dir> <W> <H>
import sys, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

out = sys.argv[1]; W = int(sys.argv[2]); H = int(sys.argv[3])
os.makedirs(out, exist_ok=True)
GEORGIA_B = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
GEORGIA_I = "/System/Library/Fonts/Supplemental/Georgia Italic.ttf"

INK = (29, 42, 77)
BLUSH = (217, 139, 150)
LILAC = (205, 184, 224)

# ---- butterfly sprite (on a 460px canvas, brand colours) ----
S = 460
bf = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(bf)
cx = S // 2
# body
d.ellipse([cx - 12, S * 0.28, cx + 12, S * 0.74], fill=INK + (255,))
# wings (upper big, lower small), left + right
def wing(box, fill):
    d.ellipse(box, fill=fill)
d.ellipse([cx - 200, S * 0.18, cx - 10, S * 0.52], fill=BLUSH + (220,))   # upper-left
d.ellipse([cx + 10, S * 0.18, cx + 200, S * 0.52], fill=BLUSH + (220,))   # upper-right
d.ellipse([cx - 150, S * 0.46, cx - 10, S * 0.74], fill=LILAC + (220,))   # lower-left
d.ellipse([cx + 10, S * 0.46, cx + 150, S * 0.74], fill=LILAC + (220,))   # lower-right
# lighter wing centres
d.ellipse([cx - 150, S * 0.24, cx - 50, S * 0.44], fill=(255, 228, 232, 180))
d.ellipse([cx + 50, S * 0.24, cx + 150, S * 0.44], fill=(255, 228, 232, 180))
# antennae
d.line([cx - 4, S * 0.30, cx - 40, S * 0.12], fill=INK + (230,), width=4)
d.line([cx + 4, S * 0.30, cx + 40, S * 0.12], fill=INK + (230,), width=4)
d.ellipse([cx - 48, S * 0.10, cx - 36, S * 0.14], fill=INK + (230,))
d.ellipse([cx + 36, S * 0.10, cx + 48, S * 0.14], fill=INK + (230,))
bf = bf.filter(ImageFilter.GaussianBlur(0.6))
bf.save(os.path.join(out, "butterfly.png"))

# ---- soft gradient background ----
bg = Image.new("RGB", (W, H), (251, 246, 239))
top = (251, 246, 239); bot = (244, 217, 218)
for y in range(H):
    t = y / max(1, H - 1)
    r = int(top[0] + (bot[0] - top[0]) * t)
    g = int(top[1] + (bot[1] - top[1]) * t)
    b = int(top[2] + (bot[2] - top[2]) * t)
    ImageDraw.Draw(bg).line([(0, y), (W, y)], fill=(r, g, b))
bg.save(os.path.join(out, "outrobg.png"))

# ---- centred wordmark frame ----
wm = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(wm)
name_fs = max(54, int(min(W, H) * 0.11))
url_fs = max(22, int(min(W, H) * 0.032))
flower_fs = max(40, int(min(W, H) * 0.09))
nf = ImageFont.truetype(GEORGIA_B, name_fs)
uf = ImageFont.truetype(GEORGIA_I, url_fs)
ff = ImageFont.truetype(GEORGIA_B, flower_fs)

def centre(txt, font, y, fill, shadow=(0, 0, 0, 90)):
    bb = d.textbbox((0, 0), txt, font=font)
    x = (W - (bb[2] - bb[0])) // 2 - bb[0]
    d.text((x + 2, y + 2), txt, font=font, fill=shadow)
    d.text((x, y), txt, font=font, fill=fill)

cy = int(H * 0.42)
# draw a little 5-petal flower above the wordmark (no glyph dependency)
fr = max(14, int(min(W, H) * 0.022))
fcx, fcy = W // 2, cy - int(flower_fs * 0.9)
import math
for i in range(5):
    a = math.radians(i * 72 - 90)
    px, py = fcx + math.cos(a) * fr, fcy + math.sin(a) * fr
    d.ellipse([px - fr, py - fr * 0.8, px + fr, py + fr * 0.8], fill=BLUSH + (255,))
d.ellipse([fcx - fr * 0.55, fcy - fr * 0.55, fcx + fr * 0.55, fcy + fr * 0.55], fill=(201, 163, 91, 255))
centre("Florapeutic", nf, cy, INK + (255,))
centre("florapeutic.com.au", uf, cy + int(name_fs * 1.15), (54, 69, 111, 255))
wm.save(os.path.join(out, "wordmark.png"))
print("brand assets written")
