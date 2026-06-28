import os
from PIL import Image, ImageDraw, ImageFont

NAVY = "#102650"
BASE = '/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/'

# Load the clean kiosk icon (white background, no frame)
icon_img = Image.open(BASE + 'kiosk_icon_clean_noframe_1782556522743.png').convert("RGBA")
iw, ih = icon_img.size

# Find bounding box of non-white content
pixels = icon_img.load()
min_x, min_y, max_x, max_y = iw, ih, 0, 0
for y in range(ih):
    for x in range(iw):
        r, g, b, a = pixels[x, y]
        if not (240 <= r <= 255 and 240 <= g <= 255 and 240 <= b <= 255):
            if x < min_x: min_x = x
            if y < min_y: min_y = y
            if x > max_x: max_x = x
            if y > max_y: max_y = y

pad = 10
icon_clean = icon_img.crop((max(0,min_x-pad), max(0,min_y-pad),
                             min(iw,max_x+pad), min(ih,max_y+pad)))

# Scale
TARGET_H = 190
icon_scaled = icon_clean.resize(
    (int(icon_clean.width * TARGET_H / icon_clean.height), TARGET_H),
    Image.Resampling.LANCZOS
)

# Helvetica fonts
HELV = "/System/Library/Fonts/Helvetica.ttc"
fb = ImageFont.truetype(HELV, 78, index=1)   # Bold
fm = ImageFont.truetype(HELV, 40, index=0)   # Regular

tmp = ImageDraw.Draw(Image.new("RGBA", (1,1)))
ga_bb = tmp.textbbox((0,0), "GetApp",      font=fb)
sk_bb = tmp.textbbox((0,0), "Smart Kiosk", font=fm)
ga_w, ga_h = ga_bb[2]-ga_bb[0], ga_bb[3]-ga_bb[1]
sk_w, sk_h = sk_bb[2]-sk_bb[0], sk_bb[3]-sk_bb[1]

text_w = max(ga_w, sk_w) + 10
text_h = ga_h + 6 + sk_h

GAP = 24; M = 28
cw = M + icon_scaled.width + GAP + text_w + M
ch = max(TARGET_H, text_h) + M * 2

canvas = Image.new("RGBA", (cw, ch), (255, 255, 255, 255))
canvas.paste(icon_scaled, (M, (ch - TARGET_H) // 2), icon_scaled)

draw = ImageDraw.Draw(canvas)
tx = M + icon_scaled.width + GAP
ty = (ch - text_h) // 2
draw.text((tx, ty),                "GetApp",      fill=NAVY, font=fb)
draw.text((tx + 2, ty + ga_h + 6), "Smart Kiosk", fill=NAVY, font=fm)

out = BASE + 'LOGO_HELVETICA_CLEAN.png'
canvas.save(out)
print(f"SUCCESS: {canvas.size}")
