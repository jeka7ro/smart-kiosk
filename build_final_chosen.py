from PIL import Image, ImageDraw, ImageFont, ImageOps

NAVY = "#0c2b4e"
BASE = '/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/'

# 1. Load the chosen icon (V2)
icon = Image.open(BASE + "kiosk_logo_v2_1782727845555.png").convert("RGBA")

# 2. Remove white background
px = icon.load()
for y in range(icon.height):
    for x in range(icon.width):
        r, g, b, a = px[x, y]
        if r > 240 and g > 240 and b > 240:
            px[x, y] = (255, 255, 255, 0)

# 3. Crop to content
bbox = icon.getbbox()
if bbox:
    icon = icon.crop(bbox)

# 4. Mirror horizontally (flip in oglinda)
icon = ImageOps.mirror(icon)

# 5. Resize icon to a good logo height
target_h = 120
aspect = icon.width / icon.height
target_w = int(target_h * aspect)
icon = icon.resize((target_w, target_h), Image.LANCZOS)

# 6. Load Helvetica Neue
font_path = "/System/Library/Fonts/HelveticaNeue.ttc"
f_bold = ImageFont.truetype(font_path, 52, index=4)   # Bold
f_light = ImageFont.truetype(font_path, 28, index=1)   # Light

# 7. Measure text
tmp = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
bb1 = tmp.textbbox((0, 0), "GetApp", font=f_bold)
bb2 = tmp.textbbox((0, 0), "Smart Kiosk", font=f_light)
t1_w, t1_h = bb1[2] - bb1[0], bb1[3] - bb1[1]
t2_w, t2_h = bb2[2] - bb2[0], bb2[3] - bb2[1]
text_w = max(t1_w, t2_w)
text_h = t1_h + 6 + t2_h

# 8. Assemble final logo (transparent background)
GAP = 18
MARGIN = 10
final_w = MARGIN + target_w + GAP + text_w + MARGIN
final_h = max(target_h, text_h) + MARGIN * 2

canvas = Image.new("RGBA", (final_w, final_h), (255, 255, 255, 0))
canvas.paste(icon, (MARGIN, (final_h - target_h) // 2), icon)

draw = ImageDraw.Draw(canvas)
tx = MARGIN + target_w + GAP
ty = (final_h - text_h) // 2
draw.text((tx, ty), "GetApp", fill=NAVY, font=f_bold)
draw.text((tx + 2, ty + t1_h + 4), "Smart Kiosk", fill=NAVY, font=f_light)

# Save preview (dark text on transparent = for light backgrounds)
canvas.save(BASE + "CHOSEN_LOGO_PREVIEW.png")

# Also save a version on white background for easy viewing
canvas_white = Image.new("RGBA", (final_w, final_h), (255, 255, 255, 255))
canvas_white.paste(canvas, (0, 0), canvas)
canvas_white.save(BASE + "CHOSEN_LOGO_ON_WHITE.png")

# White text version for dark sidebar
canvas_white_text = canvas.copy()
px2 = canvas_white_text.load()
for y in range(canvas_white_text.height):
    for x in range(canvas_white_text.width):
        r, g, b, a = px2[x, y]
        if a > 0 and r < 80 and g < 80 and b < 120:
            px2[x, y] = (255, 255, 255, a)
canvas_white_text.save(BASE + "CHOSEN_LOGO_WHITE.png")

# Preview on navy background
canvas_navy = Image.new("RGBA", (final_w, final_h), (12, 43, 78, 255))
canvas_navy.paste(canvas_white_text, (0, 0), canvas_white_text)
canvas_navy.save(BASE + "CHOSEN_LOGO_ON_NAVY.png")

print("DONE")
