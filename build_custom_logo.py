import os
from PIL import Image, ImageDraw, ImageFont

NAVY = "#0c2b4e"
RED = "#fb5b4c"
WHITE = "#ffffff"
BASE = '/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/'

HELV_NEUE = "/System/Library/Fonts/HelveticaNeue.ttc"
f1 = ImageFont.truetype(HELV_NEUE, 68, index=4) # Bold
f2 = ImageFont.truetype(HELV_NEUE, 38, index=1) # Light / Medium

def draw_icon(is_white_text):
    # To match the "Smart Displays" icon without the arrow
    img = Image.new("RGBA", (150, 120), (255,255,255,0))
    d = ImageDraw.Draw(img)
    
    # Outer frame (navy) - thicker on left/bottom
    frame_color = WHITE if is_white_text else NAVY
    d.rounded_rectangle([10, 15, 140, 110], radius=16, fill=frame_color)
    d.rounded_rectangle([18, 20, 132, 100], radius=10, fill=(255,255,255,0)) # cutout later
    
    # Actually it's easier to draw the inner part over the outer part
    d.rounded_rectangle([10, 15, 140, 110], radius=16, fill=frame_color)
    
    # The white gap
    d.rounded_rectangle([20, 22, 135, 105], radius=10, fill=WHITE)
    
    # Inner red screen with gradient
    # We will simulate the gradient by drawing a red rect and then a white polygon or fading it
    inner = Image.new("RGBA", (115, 83), (255,255,255,0))
    inner_d = ImageDraw.Draw(inner)
    inner_d.rounded_rectangle([0, 0, 115, 83], radius=6, fill=RED)
    
    # Simple linear gradient from bottom-left (white) to top-right (transparent)
    px = inner.load()
    for y in range(83):
        for x in range(115):
            r,g,b,a = px[x,y]
            if a > 0:
                # distance from bottom left (0, 83)
                dist = ((x - 0)**2 + (y - 83)**2)**0.5
                max_dist = 140
                ratio = min(1.0, dist / max_dist)
                # blend RED and WHITE
                # closer to 0 dist = more white
                # ratio 0 = white, ratio 1 = red
                c_r = int(255 + (0xfb - 255) * ratio)
                c_g = int(255 + (0x5b - 255) * ratio)
                c_b = int(255 + (0x4c - 255) * ratio)
                px[x,y] = (c_r, c_g, c_b, a)
                
    # Paste inner screen onto main icon
    img.paste(inner, (20, 22), inner)
    
    # The original icon has a "cut" in the bottom left frame.
    # In the uploaded image, the bottom left of the blue frame is cut by the red arrow.
    # Since the user asked for NO ARROW ("fara sageata"), we leave the frame fully connected!
    return img

def make_layout(name, is_white_text):
    text_color = WHITE if is_white_text else NAVY
    bg_color = (16,38,80,255) if is_white_text else (255,255,255,0)
    
    img_icon = draw_icon(is_white_text)
    
    tmp_draw = ImageDraw.Draw(Image.new("RGBA", (1,1)))
    ga_bb = tmp_draw.textbbox((0,0), "GetApp", font=f1)
    sk_bb = tmp_draw.textbbox((0,0), "Smart Kiosk", font=f2)
    ga_w, ga_h = ga_bb[2]-ga_bb[0], ga_bb[3]-ga_bb[1]
    sk_w, sk_h = sk_bb[2]-sk_bb[0], sk_bb[3]-sk_bb[1]

    text_w = max(ga_w, sk_w) + 12
    text_h = ga_h + 0 + sk_h

    GAP = 20
    M = 20
    icon_w = img_icon.width
    cw = M + icon_w + GAP + text_w + M
    
    TARGET_H = img_icon.height
    ch = max(TARGET_H, text_h) + M * 2

    canvas = Image.new("RGBA", (cw, ch), bg_color)
    canvas.paste(img_icon, (M, (ch - TARGET_H) // 2), img_icon)

    draw = ImageDraw.Draw(canvas)
    tx = M + icon_w + GAP
    # The original has GetApp higher up.
    ty = (ch - text_h) // 2
    
    draw.text((tx, ty - 8), "GetApp", fill=text_color, font=f1)
    draw.text((tx + 2, ty + ga_h - 2), "Smart Kiosk", fill=text_color, font=f2)

    canvas.save(BASE + name)
    if not is_white_text:
        canvas.save('packages/admin/public/getapp_smart_kiosk_black.png')
        canvas.save('packages/admin/public/getapp_smart_kiosk_logo.png')
    else:
        canvas.save('packages/admin/public/getapp_smart_kiosk_white.png')

make_layout('FINAL_CUSTOM_LOGO_DARK.png', False)
make_layout('FINAL_CUSTOM_LOGO_WHITE.png', True)

print("DONE")
