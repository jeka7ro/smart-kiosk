import os, urllib.request
from PIL import Image, ImageDraw, ImageFont

NAVY = "#102650"
WHITE = "#FFFFFF"
BASE = '/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/'

# The icon I extracted earlier was from kiosk_icon_clean_noframe_1782556522743.png
icon_path = BASE + 'kiosk_icon_clean_noframe_1782556522743.png'
if not os.path.exists(icon_path):
    print("Icon not found!")
    exit(1)

icon_scaled = Image.open(icon_path).convert("RGBA")
# Target height for sidebar is smaller
TARGET_H = 140
icon_scaled = icon_scaled.resize(
    (int(icon_scaled.width * TARGET_H / icon_scaled.height), TARGET_H),
    Image.Resampling.LANCZOS
)

# Render text
if not os.path.exists("Poppins-ExtraBold.ttf"):
    # Download font if missing
    urllib.request.urlretrieve("https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-ExtraBold.ttf", "Poppins-ExtraBold.ttf")
    urllib.request.urlretrieve("https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Medium.ttf", "Poppins-Medium.ttf")

fb = ImageFont.truetype("Poppins-ExtraBold.ttf", 60)
fm = ImageFont.truetype("Poppins-Medium.ttf", 32)

tmp_draw = ImageDraw.Draw(Image.new("RGBA", (1,1)))
ga_bb = tmp_draw.textbbox((0,0), "GetApp",      font=fb)
sk_bb = tmp_draw.textbbox((0,0), "Smart Kiosk", font=fm)
ga_w, ga_h = ga_bb[2]-ga_bb[0], ga_bb[3]-ga_bb[1]
sk_w, sk_h = sk_bb[2]-sk_bb[0], sk_bb[3]-sk_bb[1]

text_w = max(ga_w, sk_w) + 8
text_h = ga_h + 4 + sk_h

GAP = 16
M = 20
cw = M + icon_scaled.width + GAP + text_w + M
ch = max(TARGET_H, text_h) + M * 2

# Transparent background
canvas = Image.new("RGBA", (cw, ch), (255, 255, 255, 0))
canvas.paste(icon_scaled, (M, (ch - TARGET_H) // 2), icon_scaled)

draw = ImageDraw.Draw(canvas)
tx = M + icon_scaled.width + GAP
ty = (ch - text_h) // 2

# Draw text in white for dark sidebar
draw.text((tx, ty),              "GetApp",      fill=WHITE, font=fb)
draw.text((tx + 2, ty + ga_h + 2), "Smart Kiosk", fill=WHITE, font=fm)

out = BASE + 'SIDEBAR_LOGO_WHITE.png'
canvas.save(out)
canvas.save('packages/admin/public/getapp_smart_kiosk_white.png')

# Also draw dark text version just in case
canvas_dark = Image.new("RGBA", (cw, ch), (255, 255, 255, 0))
canvas_dark.paste(icon_scaled, (M, (ch - TARGET_H) // 2), icon_scaled)
draw_dark = ImageDraw.Draw(canvas_dark)
draw_dark.text((tx, ty),              "GetApp",      fill=NAVY, font=fb)
draw_dark.text((tx + 2, ty + ga_h + 2), "Smart Kiosk", fill=NAVY, font=fm)

canvas_dark.save(BASE + 'SIDEBAR_LOGO_DARK.png')
canvas_dark.save('packages/admin/public/getapp_smart_kiosk_black.png')

print(f"SUCCESS: {canvas.size}")
