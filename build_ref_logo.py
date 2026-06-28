import os, urllib.request
from PIL import Image, ImageDraw, ImageFont

NAVY = "#102650"
BASE = '/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/'

# 1. Load the kiosk image they just sent (the one with rounded frame)
ref = Image.open(BASE + 'media__1782555989921.png').convert("RGBA")
rw, rh = ref.size
print(f"Reference image: {rw}x{rh}")

# The icon is the LEFT portion (roughly 30-32% of the wide image)
icon_raw = ref.crop((0, 0, int(rw * 0.32), rh))

# Find bounding box of actual content (non-grey background)
px = icon_raw.load()
iw, ih = icon_raw.size
min_x, min_y, max_x, max_y = iw, ih, 0, 0
for y in range(ih):
    for x in range(iw):
        r, g, b, a = px[x, y]
        # Background is grey (#e5e5e5 approx), icon has darker pixels
        if not (220 <= r <= 245 and 220 <= g <= 245 and 220 <= b <= 245):
            if x < min_x: min_x = x
            if y < min_y: min_y = y
            if x > max_x: max_x = x
            if y > max_y: max_y = y

pad = 10
icon_clean = icon_raw.crop((max(0, min_x-pad), max(0, min_y-pad),
                             min(iw, max_x+pad), min(ih, max_y+pad)))
print(f"Icon clean: {icon_clean.size}")

# Save debug
icon_clean.save('/tmp/debug_ref_icon.png')

# Scale icon
TARGET_H = 200
icon_scaled = icon_clean.resize(
    (int(icon_clean.width * TARGET_H / icon_clean.height), TARGET_H),
    Image.Resampling.LANCZOS
)

# 2. Render text with Poppins ExtraBold
fb = ImageFont.truetype("Poppins-ExtraBold.ttf", 80)
fm = ImageFont.truetype("Poppins-Medium.ttf", 44)

tmp_draw = ImageDraw.Draw(Image.new("RGBA", (1,1)))
ga_bb = tmp_draw.textbbox((0,0), "GetApp",      font=fb)
sk_bb = tmp_draw.textbbox((0,0), "Smart Kiosk", font=fm)
ga_w, ga_h = ga_bb[2]-ga_bb[0], ga_bb[3]-ga_bb[1]
sk_w, sk_h = sk_bb[2]-sk_bb[0], sk_bb[3]-sk_bb[1]

text_w = max(ga_w, sk_w) + 10
text_h = ga_h + 6 + sk_h

GAP = 24; M = 30
cw = M + icon_scaled.width + GAP + text_w + M
ch = max(TARGET_H, text_h) + M * 2

# White background
canvas = Image.new("RGBA", (cw, ch), (255, 255, 255, 255))
canvas.paste(icon_scaled, (M, (ch - TARGET_H) // 2), icon_scaled)

draw = ImageDraw.Draw(canvas)
tx = M + icon_scaled.width + GAP
ty = (ch - text_h) // 2

draw.text((tx, ty),              "GetApp",      fill=NAVY, font=fb)
draw.text((tx + 2, ty + ga_h + 6), "Smart Kiosk", fill=NAVY, font=fm)

out = BASE + 'LOGO_POPPINS_FINAL.png'
canvas.save(out)
print(f"SUCCESS: {canvas.size}")
