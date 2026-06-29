import os
from PIL import Image, ImageDraw, ImageFont

NAVY = "#102650"
WHITE = "#ffffff"
BASE = '/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/'

icon_path = BASE + 'kiosk_icon_clean_noframe_1782556522743.png'
icon_scaled = Image.open(icon_path).convert("RGBA")
TARGET_H = 140
icon_scaled = icon_scaled.resize(
    (int(icon_scaled.width * TARGET_H / icon_scaled.height), TARGET_H),
    Image.Resampling.LANCZOS
)

HELV_NEUE = "/System/Library/Fonts/HelveticaNeue.ttc"
f1 = ImageFont.truetype(HELV_NEUE, 60, index=4) # Bold
f2 = ImageFont.truetype(HELV_NEUE, 32, index=1) # Light

def generate_transparent(name, c1, c2, is_white_version=False):
    tmp_draw = ImageDraw.Draw(Image.new("RGBA", (1,1)))
    ga_bb = tmp_draw.textbbox((0,0), "GetApp", font=f1)
    sk_bb = tmp_draw.textbbox((0,0), "Smart Kiosk", font=f2)
    ga_w, ga_h = ga_bb[2]-ga_bb[0], ga_bb[3]-ga_bb[1]
    sk_w, sk_h = sk_bb[2]-sk_bb[0], sk_bb[3]-sk_bb[1]

    text_w = max(ga_w, sk_w) + 8
    text_h = ga_h + 4 + sk_h

    GAP = 16; M = 20
    cw = M + icon_scaled.width + GAP + text_w + M
    ch = max(TARGET_H, text_h) + M * 2

    canvas = Image.new("RGBA", (cw, ch), (255, 255, 255, 0)) # fully transparent
    
    icon_to_use = icon_scaled.copy()
    if is_white_version:
        px = icon_to_use.load()
        for y in range(icon_to_use.height):
            for x in range(icon_to_use.width):
                r,g,b,a = px[x,y]
                if a > 0:
                    if r < 100 and g < 100 and b < 150:
                        px[x,y] = (255,255,255,a)
    
    canvas.paste(icon_to_use, (M, (ch - TARGET_H) // 2), icon_to_use)
    draw = ImageDraw.Draw(canvas)
    tx = M + icon_scaled.width + GAP
    ty = (ch - text_h) // 2
    draw.text((tx, ty), "GetApp", fill=c1, font=f1)
    draw.text((tx + 2, ty + ga_h + 2), "Smart Kiosk", fill=c2, font=f2)

    canvas.save(name)

# Generate Dark Text Version (for white sidebar/screens)
generate_transparent('packages/admin/public/getapp_smart_kiosk_black.png', NAVY, NAVY, False)
generate_transparent('packages/admin/public/getapp_smart_kiosk_logo.png', NAVY, NAVY, False)

# Generate White Text Version (for dark sidebar)
generate_transparent('packages/admin/public/getapp_smart_kiosk_white.png', WHITE, WHITE, True)

print("SUCCESS")
