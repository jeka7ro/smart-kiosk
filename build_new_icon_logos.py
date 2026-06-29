import os
from PIL import Image, ImageDraw, ImageFont

NAVY = "#102650"
WHITE = "#ffffff"
BASE = '/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/'

HELV_NEUE = "/System/Library/Fonts/HelveticaNeue.ttc"
f1 = ImageFont.truetype(HELV_NEUE, 60, index=4) # Bold
f2 = ImageFont.truetype(HELV_NEUE, 32, index=1) # Light

def crop_and_scale(img_path, target_h=140):
    img = Image.open(img_path).convert("RGBA")
    # find bbox
    px = img.load()
    iw, ih = img.size
    min_x, min_y, max_x, max_y = iw, ih, 0, 0
    for y in range(ih):
        for x in range(iw):
            r,g,b,a = px[x,y]
            if not (r > 240 and g > 240 and b > 240): # ignore white background
                if x < min_x: min_x = x
                if y < min_y: min_y = y
                if x > max_x: max_x = x
                if y > max_y: max_y = y
    
    # Crop
    pad = 5
    cropped = img.crop((max(0, min_x-pad), max(0, min_y-pad), min(iw, max_x+pad), min(ih, max_y+pad)))
    # Scale
    scaled = cropped.resize(
        (int(cropped.width * target_h / cropped.height), target_h),
        Image.Resampling.LANCZOS
    )
    # Make background pixels fully transparent
    px2 = scaled.load()
    for y in range(scaled.height):
        for x in range(scaled.width):
            r,g,b,a = px2[x,y]
            if r > 240 and g > 240 and b > 240:
                px2[x,y] = (255,255,255,0)
    
    return scaled

def generate_option(name, icon_img, bg_color, is_white_text):
    tmp_draw = ImageDraw.Draw(Image.new("RGBA", (1,1)))
    ga_bb = tmp_draw.textbbox((0,0), "GetApp", font=f1)
    sk_bb = tmp_draw.textbbox((0,0), "Smart Kiosk", font=f2)
    ga_w, ga_h = ga_bb[2]-ga_bb[0], ga_bb[3]-ga_bb[1]
    sk_w, sk_h = sk_bb[2]-sk_bb[0], sk_bb[3]-sk_bb[1]

    text_w = max(ga_w, sk_w) + 8
    text_h = ga_h + 4 + sk_h

    GAP = 16
    M = 20
    icon_w = icon_img.width if icon_img else 0
    cw = M + icon_w + (GAP if icon_img else 0) + text_w + M
    
    TARGET_H = icon_img.height if icon_img else 0
    ch = max(TARGET_H, text_h) + M * 2

    canvas = Image.new("RGBA", (cw, ch), bg_color)
    
    if icon_img:
        icon_to_use = icon_img.copy()
        if is_white_text:
            px = icon_to_use.load()
            for y in range(icon_to_use.height):
                for x in range(icon_to_use.width):
                    r,g,b,a = px[x,y]
                    # if pixel is dark, make it white
                    if a > 50 and r < 100 and g < 100 and b < 150:
                        px[x,y] = (255,255,255,a)
        
        canvas.paste(icon_to_use, (M, (ch - TARGET_H) // 2), icon_to_use)

    draw = ImageDraw.Draw(canvas)
    tx = M + icon_w + (GAP if icon_img else 0)
    ty = (ch - text_h) // 2
    
    tc1 = WHITE if is_white_text else NAVY
    tc2 = WHITE if is_white_text else NAVY
    draw.text((tx, ty), "GetApp", fill=tc1, font=f1)
    draw.text((tx + 2, ty + ga_h + 2), "Smart Kiosk", fill=tc2, font=f2)

    canvas.save(BASE + name)


# 1. Minimalist Flat
icon_flat = crop_and_scale(BASE + 'kiosk_icon_minimal_1782723563423.png')
generate_option('OPT_NEW_1_DARK.png', icon_flat, (255,255,255,255), False)
generate_option('OPT_NEW_1_WHITE.png', icon_flat, (16,38,80,255), True)

# 2. Abstract
icon_abs = crop_and_scale(BASE + 'kiosk_icon_abstract_1782723580759.png')
generate_option('OPT_NEW_2_DARK.png', icon_abs, (255,255,255,255), False)
generate_option('OPT_NEW_2_WHITE.png', icon_abs, (16,38,80,255), True)

# 3. Text Only
generate_option('OPT_NEW_3_DARK.png', None, (255,255,255,255), False)
generate_option('OPT_NEW_3_WHITE.png', None, (16,38,80,255), True)

print("SUCCESS")
