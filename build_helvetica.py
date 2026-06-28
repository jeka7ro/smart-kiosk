import os
from PIL import Image, ImageDraw, ImageFont

NAVY = "#102650"
BASE = '/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/'

# Load reference image - kiosk inside rounded frame
ref = Image.open(BASE + 'media__1782555989921.png').convert("RGBA")
rw, rh = ref.size

# Crop inner kiosk icon - skip the outer rounded frame
# The frame starts at ~3% and the inner kiosk is centered inside
# Crop tighter: start from ~5% x, end at ~30% x, and cut top/bottom to remove frame
icon_raw = ref.crop((int(rw*0.03), int(rh*0.06), int(rw*0.31), int(rh*0.94)))

# Find only the kiosk pixels (dark blue + red) - skip the grey bg AND the blue frame
px = icon_raw.load()
iw, ih = icon_raw.size
min_x, min_y, max_x, max_y = iw, ih, 0, 0
for y in range(ih):
    for x in range(iw):
        r, g, b, a = px[x, y]
        # Skip: grey background (light), and the outer rounded rect frame (navy blue border ~2-3px)
        # The actual kiosk has pixels that are either:
        # - dark navy blue (kiosk body): R<80, G<80, B<120
        # - red screen: R>150, G<80, B<80
        is_kiosk_body = r < 90 and g < 90 and b < 140
        is_red_screen = r > 140 and g < 80 and b < 80
        if is_kiosk_body or is_red_screen:
            if x < min_x: min_x = x
            if y < min_y: min_y = y
            if x > max_x: max_x = x
            if y > max_y: max_y = y

pad = 8
icon_clean = icon_raw.crop((max(0, min_x-pad), max(0, min_y-pad),
                             min(iw, max_x+pad), min(ih, max_y+pad)))
print(f"Kiosk icon (no frame): {icon_clean.size}")

# Scale icon
TARGET_H = 180
icon_scaled = icon_clean.resize(
    (int(icon_clean.width * TARGET_H / icon_clean.height), TARGET_H),
    Image.Resampling.LANCZOS
)

# Helvetica font (system)
# index 0 = regular, 1 = bold, 2 = bold oblique, 3 = oblique
HELV = "/System/Library/Fonts/Helvetica.ttc"
fb = ImageFont.truetype(HELV, 78, index=1)   # Bold
fm = ImageFont.truetype(HELV, 40, index=0)   # Regular

tmp_draw = ImageDraw.Draw(Image.new("RGBA", (1,1)))
ga_bb = tmp_draw.textbbox((0,0), "GetApp",      font=fb)
sk_bb = tmp_draw.textbbox((0,0), "Smart Kiosk", font=fm)
ga_w, ga_h = ga_bb[2]-ga_bb[0], ga_bb[3]-ga_bb[1]
sk_w, sk_h = sk_bb[2]-sk_bb[0], sk_bb[3]-sk_bb[1]

text_w = max(ga_w, sk_w) + 10
text_h = ga_h + 6 + sk_h

GAP = 22; M = 28
cw = M + icon_scaled.width + GAP + text_w + M
ch = max(TARGET_H, text_h) + M * 2

canvas = Image.new("RGBA", (cw, ch), (255, 255, 255, 255))
canvas.paste(icon_scaled, (M, (ch - TARGET_H) // 2), icon_scaled)

draw = ImageDraw.Draw(canvas)
tx = M + icon_scaled.width + GAP
ty = (ch - text_h) // 2

draw.text((tx, ty),                "GetApp",      fill=NAVY, font=fb)
draw.text((tx + 2, ty + ga_h + 6), "Smart Kiosk", fill=NAVY, font=fm)

out = BASE + 'LOGO_HELVETICA_FINAL.png'
canvas.save(out)
print(f"SUCCESS: {canvas.size}")
