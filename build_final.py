import sys, os, urllib.request
from PIL import Image, ImageDraw, ImageFont

try:
    font_path = "Montserrat-Medium.ttf"
    if not os.path.exists(font_path):
        urllib.request.urlretrieve("https://raw.githubusercontent.com/googlefonts/montserrat/master/fonts/ttf/Montserrat-Medium.ttf", font_path)

    img1 = Image.open('/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/media__1782488632956.png').convert("RGBA")
    img2 = Image.open('/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/media__1782488639171.png').convert("RGBA")

    # ─── ICON: crop 38% from img1, then find bounding box ────────────────────
    icon_raw = img1.crop((0, 0, int(img1.width * 0.38), img1.height))
    gray = icon_raw.convert("L")
    inv  = Image.eval(gray, lambda x: 255 - x)
    bbox = inv.getbbox()
    icon = icon_raw.crop(bbox) if bbox else icon_raw
    print(f"Icon: {icon.size}")

    # ─── TEXT from img2: crop out the grey/bg sidebar ─────────────────────────
    # We see img2 has a left "block" (icon area). Text starts around 32%
    text_full = img2.crop((int(img2.width * 0.32), 0, img2.width, img2.height))
    # Find bounding box of text
    gray2 = text_full.convert("L")
    inv2  = Image.eval(gray2, lambda x: 255 - x)
    bbox2 = inv2.getbbox()
    text_full = text_full.crop(bbox2) if bbox2 else text_full
    print(f"Text full: {text_full.size}")

    # ─── Crop ONLY "GetApp" from top portion (approx top 60%) ─────────────────
    tf_w, tf_h = text_full.size
    # Scan rows bottom-to-top to find gap between "GetApp" and "Smart Displays"
    pix = text_full.convert("RGBA").load()
    gap_y = int(tf_h * 0.55)  # start looking from 55% height
    for y in range(int(tf_h * 0.4), int(tf_h * 0.75)):
        row_dark = any(pix[x, y][3] > 30 and (pix[x,y][0]+pix[x,y][1]+pix[x,y][2]) < 450 for x in range(tf_w))
        if not row_dark:
            gap_y = y
            break
    print(f"Gap found at y={gap_y}")
    getapp_img = text_full.crop((0, 0, tf_w, gap_y))

    # ─── Scale both to target height 200px ────────────────────────────────────
    target_h = 200
    icon_scaled = icon.resize((int(icon.width * target_h / icon.height), target_h), Image.Resampling.LANCZOS)
    
    # GetApp height: 60% of total
    ga_h = int(target_h * 0.58)
    ga_w = int(getapp_img.width * ga_h / getapp_img.height)
    getapp_scaled = getapp_img.resize((ga_w, ga_h), Image.Resampling.LANCZOS)

    # ─── "Smart Kiosk" in Montserrat same weight as "Smart Displays" ─────────
    sk_font_size = int(ga_h * 0.50)
    font = ImageFont.truetype(font_path, sk_font_size)
    dummy = ImageDraw.Draw(Image.new("RGBA", (1,1)))
    sk_bbox = dummy.textbbox((0,0), "Smart Kiosk", font=font)
    sk_w = sk_bbox[2] - sk_bbox[0]
    sk_h = sk_bbox[3] - sk_bbox[1]

    # ─── Canvas ───────────────────────────────────────────────────────────────
    gap = 18
    text_col_w = max(ga_w, sk_w) + 10
    text_col_h = ga_h + 6 + sk_h
    canvas_w = icon_scaled.width + gap + text_col_w + 40
    canvas_h = max(target_h, text_col_h) + 40
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (255, 255, 255, 255))

    # Paste icon, vertically centered
    iy = (canvas_h - target_h) // 2
    canvas.paste(icon_scaled, (20, iy), icon_scaled if 'A' in icon_scaled.mode else None)

    # Paste GetApp text, vertically centered  
    tx = 20 + icon_scaled.width + gap
    ty = (canvas_h - text_col_h) // 2
    canvas.paste(getapp_scaled, (tx, ty), getapp_scaled if 'A' in getapp_scaled.mode else None)

    # Draw Smart Kiosk
    draw = ImageDraw.Draw(canvas)
    draw.text((tx + 2, ty + ga_h + 6), "Smart Kiosk", fill="#10264F", font=font)

    # Trim
    gray_f = canvas.convert("L")
    inv_f  = Image.eval(gray_f, lambda x: 255 - x)
    fb = inv_f.getbbox()
    if fb:
        canvas = canvas.crop((max(0, fb[0]-20), max(0, fb[1]-20), min(canvas_w, fb[2]+20), min(canvas_h, fb[3]+20)))

    out = '/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/LOGO_FINAL_V3.png'
    canvas.save(out)
    print("SUCCESS:", canvas.size)
except Exception as e:
    import traceback; traceback.print_exc()
