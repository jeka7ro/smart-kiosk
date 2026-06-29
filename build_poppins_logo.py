from PIL import Image, ImageDraw, ImageFont, ImageOps

NAVY = "#0c2b4e"
BASE = '/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/'

# 1. Load icon
icon = Image.open(BASE + "kiosk_logo_v2_1782727845555.png").convert("RGBA")
px = icon.load()
for y in range(icon.height):
    for x in range(icon.width):
        r, g, b, a = px[x, y]
        if r > 240 and g > 240 and b > 240:
            px[x, y] = (255, 255, 255, 0)
bbox = icon.getbbox()
if bbox: icon = icon.crop(bbox)
icon = ImageOps.mirror(icon)

# DON'T CUT THE STAND! Just resize the whole thing proportionally

# 2. Load Poppins
f_bold = ImageFont.truetype("Poppins-SemiBold.ttf", 48)
f_light = ImageFont.truetype("Poppins-Regular.ttf", 26)

# 3. Measure text
tmp = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
bb1 = tmp.textbbox((0, 0), "GetApp", font=f_bold)
bb2 = tmp.textbbox((0, 0), "Smart Kiosk", font=f_light)
t1_w, t1_h = bb1[2] - bb1[0], bb1[3] - bb1[1]
t2_w, t2_h = bb2[2] - bb2[0], bb2[3] - bb2[1]
text_w = max(t1_w, t2_w)
text_h = t1_h + 4 + t2_h

# 4. Resize icon to match text height (keep proportions, keep stand)
target_h = text_h + 10
aspect = icon.width / icon.height
target_w = int(target_h * aspect)
icon = icon.resize((target_w, target_h), Image.LANCZOS)

# 5. Assemble
GAP = 14
MARGIN = 8
final_w = MARGIN + target_w + GAP + text_w + MARGIN
final_h = max(target_h, text_h) + MARGIN * 2

canvas = Image.new("RGBA", (final_w, final_h), (255, 255, 255, 0))
canvas.paste(icon, (MARGIN, (final_h - target_h) // 2), icon)

draw = ImageDraw.Draw(canvas)
tx = MARGIN + target_w + GAP
ty = (final_h - text_h) // 2
draw.text((tx, ty), "GetApp", fill=NAVY, font=f_bold)
draw.text((tx + 2, ty + t1_h + 2), "Smart Kiosk", fill=NAVY, font=f_light)

# Save transparent
canvas.save(BASE + "POPPINS_LOGO_TRANSPARENT.png")

# On white
cw = Image.new("RGBA", (final_w, final_h), (255, 255, 255, 255))
cw.paste(canvas, (0, 0), canvas)
cw.save(BASE + "POPPINS_LOGO_ON_WHITE.png")

# White text version
canvas_wt = canvas.copy()
px2 = canvas_wt.load()
for y in range(canvas_wt.height):
    for x in range(canvas_wt.width):
        r, g, b, a = px2[x, y]
        if a > 0 and r < 80 and g < 80 and b < 120:
            px2[x, y] = (255, 255, 255, a)
canvas_wt.save(BASE + "POPPINS_LOGO_WHITE.png")

# On navy
cn = Image.new("RGBA", (final_w, final_h), (12, 43, 78, 255))
cn.paste(canvas_wt, (0, 0), canvas_wt)
cn.save(BASE + "POPPINS_LOGO_ON_NAVY.png")

print(f"Icon: {target_w}x{target_h}, Text: {text_w}x{text_h}, Final: {final_w}x{final_h}")
print("DONE")
