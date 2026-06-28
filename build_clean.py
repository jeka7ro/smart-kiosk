import os, urllib.request
from PIL import Image, ImageDraw, ImageFont

# Download Montserrat fonts
fonts = {
    "Montserrat-ExtraBold.ttf": "https://raw.githubusercontent.com/googlefonts/montserrat/master/fonts/ttf/Montserrat-ExtraBold.ttf",
    "Montserrat-Medium.ttf":    "https://raw.githubusercontent.com/googlefonts/montserrat/master/fonts/ttf/Montserrat-Medium.ttf",
}
for fname, url in fonts.items():
    if not os.path.exists(fname):
        print(f"Downloading {fname}...")
        urllib.request.urlretrieve(url, fname)
    else:
        print(f"Already have {fname}")

# ─── 1. Load and crop ONLY THE ICON from poza 1 ──────────────────────────────
img1 = Image.open('/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/media__1782488632956.png').convert("RGBA")
w1, h1 = img1.size
print(f"Img1 size: {w1}x{h1}")

# Icon is the LEFT part. Crop at 38% to avoid the text that starts after
icon_raw = img1.crop((0, 0, int(w1 * 0.39), h1))

# Find exact bounding box of non-white content
px = icon_raw.load()
iw, ih = icon_raw.size
min_x, min_y, max_x, max_y = iw, ih, 0, 0
for y in range(ih):
    for x in range(iw):
        r, g, b, a = px[x, y]
        if a > 40 and (r + g + b) < 700:  # non-white, non-transparent pixel
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)

pad = 8
icon_clean = icon_raw.crop((
    max(0, min_x - pad), max(0, min_y - pad),
    min(iw, max_x + pad), min(ih, max_y + pad)
))
print(f"Icon clean: {icon_clean.size}")

# ─── 2. Scale icon to target height ──────────────────────────────────────────
TARGET_H = 180
scale = TARGET_H / icon_clean.height
icon_final = icon_clean.resize(
    (int(icon_clean.width * scale), TARGET_H),
    Image.Resampling.LANCZOS
)
print(f"Icon final: {icon_final.size}")

# ─── 3. Render text from scratch ─────────────────────────────────────────────
NAVY = "#102650"
font_bold   = ImageFont.truetype("Montserrat-ExtraBold.ttf", 72)  # "GetApp"
font_medium = ImageFont.truetype("Montserrat-Medium.ttf",    38)  # "Smart Kiosk"

# Measure text
tmp_draw = ImageDraw.Draw(Image.new("RGBA", (1,1)))
ga_bbox = tmp_draw.textbbox((0,0), "GetApp",     font=font_bold)
sk_bbox = tmp_draw.textbbox((0,0), "Smart Kiosk", font=font_medium)
ga_w = ga_bbox[2] - ga_bbox[0]
ga_h = ga_bbox[3] - ga_bbox[1]
sk_w = sk_bbox[2] - sk_bbox[0]
sk_h = sk_bbox[3] - sk_bbox[1]
print(f"GetApp: {ga_w}x{ga_h}, Smart Kiosk: {sk_w}x{sk_h}")

text_col_w = max(ga_w, sk_w) + 10
text_col_h = ga_h + 8 + sk_h

# ─── 4. Compose final canvas ──────────────────────────────────────────────────
GAP     = 20
MARGIN  = 25
canvas_w = MARGIN + icon_final.width + GAP + text_col_w + MARGIN
canvas_h = max(TARGET_H, text_col_h) + MARGIN * 2
canvas = Image.new("RGBA", (canvas_w, canvas_h), (255, 255, 255, 255))

# Paste icon (vertically centered)
iy = (canvas_h - TARGET_H) // 2
canvas.paste(icon_final, (MARGIN, iy), icon_final)

# Draw text (vertically centered as a block)
tx = MARGIN + icon_final.width + GAP
ty = (canvas_h - text_col_h) // 2

draw = ImageDraw.Draw(canvas)
draw.text((tx, ty),              "GetApp",      fill=NAVY, font=font_bold)
draw.text((tx + 2, ty + ga_h + 8), "Smart Kiosk", fill=NAVY, font=font_medium)

# ─── 5. Save ─────────────────────────────────────────────────────────────────
out = '/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/LOGO_CLEAN_V4.png'
canvas.save(out)
print("SUCCESS:", out)
