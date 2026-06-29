from PIL import Image, ImageDraw, ImageFont, ImageOps
import os

NAVY = "#0c2b4e"
BASE = '/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/'

# Load icon
icon_orig = Image.open(BASE + "kiosk_logo_v2_1782727845555.png").convert("RGBA")
px = icon_orig.load()
for y in range(icon_orig.height):
    for x in range(icon_orig.width):
        r, g, b, a = px[x, y]
        if r > 240 and g > 240 and b > 240:
            px[x, y] = (255, 255, 255, 0)
bbox = icon_orig.getbbox()
if bbox: icon_orig = icon_orig.crop(bbox)
icon_orig = ImageOps.mirror(icon_orig)
w, h = icon_orig.size
icon_orig = icon_orig.crop((0, 0, w, h - int(h * 0.28)))

fonts = [
    ("/System/Library/Fonts/HelveticaNeue.ttc", 4, 1, "A) Helvetica Neue"),
    ("/System/Library/Fonts/Supplemental/Futura.ttc", 2, 0, "B) Futura"),
    ("/System/Library/Fonts/Avenir.ttc", 5, 1, "C) Avenir"),
    ("/System/Library/Fonts/Avenir Next.ttc", 3, 0, "D) Avenir Next"),
    ("/System/Library/Fonts/SF-Pro.ttf", 0, 0, "E) SF Pro"),
]

results = []
for font_path, bold_idx, light_idx, name in fonts:
    if not os.path.exists(font_path):
        print(f"SKIP {name}")
        continue
    try:
        f_bold = ImageFont.truetype(font_path, 48, index=bold_idx)
        f_light = ImageFont.truetype(font_path, 26, index=light_idx)
    except:
        # Try simpler indices
        try:
            f_bold = ImageFont.truetype(font_path, 48, index=0)
            f_light = ImageFont.truetype(font_path, 26, index=0)
        except Exception as e:
            print(f"SKIP {name} - {e}")
            continue

    tmp = ImageDraw.Draw(Image.new("RGBA", (1,1)))
    bb1 = tmp.textbbox((0,0), "GetApp", font=f_bold)
    bb2 = tmp.textbbox((0,0), "Smart Kiosk", font=f_light)
    t1_w, t1_h = bb1[2]-bb1[0], bb1[3]-bb1[1]
    t2_w, t2_h = bb2[2]-bb2[0], bb2[3]-bb2[1]
    text_w = max(t1_w, t2_w)
    text_h = t1_h + 6 + t2_h

    icon = icon_orig.copy()
    target_h = text_h + 6
    aspect = icon.width / icon.height
    target_w = int(target_h * aspect)
    icon = icon.resize((target_w, target_h), Image.LANCZOS)

    GAP = 14; MARGIN = 10
    final_w = MARGIN + target_w + GAP + text_w + MARGIN
    final_h = max(target_h, text_h) + MARGIN * 2 + 32

    canvas = Image.new("RGBA", (final_w, final_h), (255,255,255,255))
    canvas.paste(icon, (MARGIN, (final_h - 32 - target_h) // 2), icon)
    
    draw = ImageDraw.Draw(canvas)
    tx = MARGIN + target_w + GAP
    ty = (final_h - 32 - text_h) // 2
    draw.text((tx, ty), "GetApp", fill=NAVY, font=f_bold)
    draw.text((tx+2, ty + t1_h + 4), "Smart Kiosk", fill=NAVY, font=f_light)

    label_font = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 16, index=0)
    draw.text((MARGIN, final_h - 28), name, fill="#888888", font=label_font)

    safe = name.replace(" ", "_").replace(")", "").replace("(", "")
    fname = f"FONT_{safe}.png"
    canvas.save(BASE + fname)
    results.append((name, fname))
    print(f"OK: {name}")

print("ALL DONE")
