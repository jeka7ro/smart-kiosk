import os
from PIL import Image, ImageDraw, ImageFont

BASE = '/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/'

NAVY      = (16, 38, 80)       # #102650
BG_GREY   = (233, 234, 236)    # light grey background
FRAME_COL = (30, 58, 105)      # slightly lighter navy for frame stroke

# ── Load clean kiosk icon ────────────────────────────────────────────────────
kiosk_src = Image.open(BASE + 'kiosk_icon_clean_noframe_1782556522743.png').convert("RGBA")
kw, kh = kiosk_src.size

# Crop to content
px = kiosk_src.load()
min_x, min_y, max_x, max_y = kw, kh, 0, 0
for y in range(kh):
    for x in range(kw):
        r, g, b, a = px[x, y]
        if not (240 <= r <= 255 and 240 <= g <= 255 and 240 <= b <= 255):
            if x < min_x: min_x = x
            if y < min_y: min_y = y
            if x > max_x: max_x = x
            if y > max_y: max_y = y
kiosk = kiosk_src.crop((max(0,min_x-5), max(0,min_y-5),
                         min(kw,max_x+5), min(kh,max_y+5)))

# ── Fonts ────────────────────────────────────────────────────────────────────
fb = ImageFont.truetype("Poppins-ExtraBold.ttf", 86)   # GetApp
fm = ImageFont.truetype("Poppins-Medium.ttf",    48)   # Smart Kiosk

tmp = ImageDraw.Draw(Image.new("RGB", (1,1)))
ga_bb = tmp.textbbox((0,0), "GetApp",       font=fb)
sk_bb = tmp.textbbox((0,0), "Smart Kiosk",  font=fm)
ga_w  = ga_bb[2]-ga_bb[0];  ga_h = ga_bb[3]-ga_bb[1]
sk_w  = sk_bb[2]-sk_bb[0];  sk_h = sk_bb[3]-sk_bb[1]

# ── Layout dimensions ────────────────────────────────────────────────────────
FRAME_SIZE    = 240    # rounded square size
FRAME_RADIUS  = 40    # corner radius
FRAME_STROKE  = 8     # border width
KIOSK_PAD     = 22    # padding inside frame
MARGIN        = 36
GAP           = 30    # gap between frame and text
TEXT_H        = ga_h + 10 + sk_h

canvas_w = MARGIN + FRAME_SIZE + GAP + max(ga_w, sk_w) + MARGIN
canvas_h = max(FRAME_SIZE, TEXT_H) + MARGIN * 2
canvas   = Image.new("RGB", (canvas_w, canvas_h), BG_GREY)
draw     = ImageDraw.Draw(canvas)

# ── Draw rounded frame ───────────────────────────────────────────────────────
fx = MARGIN
fy = (canvas_h - FRAME_SIZE) // 2
frame_rect = [fx, fy, fx + FRAME_SIZE, fy + FRAME_SIZE]

# Fill inside frame with slightly lighter grey (almost white)
draw.rounded_rectangle(frame_rect, radius=FRAME_RADIUS, fill=(245,246,248), outline=FRAME_COL, width=FRAME_STROKE)

# ── Paste kiosk INSIDE the frame ────────────────────────────────────────────
inner_size = FRAME_SIZE - KIOSK_PAD * 2 - FRAME_STROKE * 2
scale      = inner_size / max(kiosk.width, kiosk.height)
k_w        = int(kiosk.width * scale)
k_h        = int(kiosk.height * scale)
kiosk_scaled = kiosk.resize((k_w, k_h), Image.Resampling.LANCZOS)

kx = fx + FRAME_STROKE + KIOSK_PAD + (inner_size - k_w) // 2
ky = fy + FRAME_STROKE + KIOSK_PAD + (inner_size - k_h) // 2
canvas.paste(kiosk_scaled.convert("RGB"), (kx, ky))

# ── Draw text ────────────────────────────────────────────────────────────────
tx = MARGIN + FRAME_SIZE + GAP
ty = (canvas_h - TEXT_H) // 2

draw.text((tx, ty),              "GetApp",      fill=NAVY, font=fb)
draw.text((tx + 3, ty + ga_h + 10), "Smart Kiosk", fill=NAVY, font=fm)

# ── Save ─────────────────────────────────────────────────────────────────────
out = BASE + 'LOGO_GROK_STYLE.png'
canvas.save(out)
print(f"SUCCESS: {canvas.size}")
