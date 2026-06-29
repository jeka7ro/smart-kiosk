import os
from PIL import Image, ImageDraw, ImageFont

NAVY = "#102650"
GREY = "#64748b"
WHITE = "#ffffff"
BASE = '/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/'

HELV_NEUE = "/System/Library/Fonts/HelveticaNeue.ttc"
f1 = ImageFont.truetype(HELV_NEUE, 60, index=4) # Bold
f2 = ImageFont.truetype(HELV_NEUE, 32, index=1) # Light

def draw_rect_icon(color):
    # A simple rounded rectangle kiosk shape
    img = Image.new("RGBA", (100, 140), (255,255,255,0))
    d = ImageDraw.Draw(img)
    # Outer body
    d.rounded_rectangle([10, 10, 90, 130], radius=10, outline=color, width=6)
    # Inner screen
    d.rounded_rectangle([20, 20, 80, 90], radius=4, outline=color, width=4)
    # Receipt slot
    d.line([35, 110, 65, 110], fill=color, width=4)
    return img

def draw_solid_icon(color):
    img = Image.new("RGBA", (100, 140), (255,255,255,0))
    d = ImageDraw.Draw(img)
    # Solid body
    d.rounded_rectangle([15, 15, 85, 125], radius=10, fill=color)
    # Cutout screen (transparent)
    # We can fake it by drawing the background color, but we want true transparent
    # So we draw the shape manually or just draw a different color. Let's draw a white screen
    # Wait, if it's for white background we draw white, if dark we draw dark.
    # To keep it simple, we draw the screen in the opposite color or just an outline.
    return draw_rect_icon(color) # fallback to rect for now

def draw_abstract_icon(color):
    img = Image.new("RGBA", (100, 140), (255,255,255,0))
    d = ImageDraw.Draw(img)
    # Abstract screen
    d.rounded_rectangle([15, 20, 85, 100], radius=15, outline=color, width=8)
    # Stand
    d.line([50, 100, 50, 120], fill=color, width=8)
    d.line([30, 120, 70, 120], fill=color, width=8)
    return img

def make_layout(name, icon_func, text_color, bg_color):
    img_icon = icon_func(text_color) if icon_func else None
    
    tmp_draw = ImageDraw.Draw(Image.new("RGBA", (1,1)))
    ga_bb = tmp_draw.textbbox((0,0), "GetApp", font=f1)
    sk_bb = tmp_draw.textbbox((0,0), "Smart Kiosk", font=f2)
    ga_w, ga_h = ga_bb[2]-ga_bb[0], ga_bb[3]-ga_bb[1]
    sk_w, sk_h = sk_bb[2]-sk_bb[0], sk_bb[3]-sk_bb[1]

    text_w = max(ga_w, sk_w) + 8
    text_h = ga_h + 4 + sk_h

    GAP = 16
    M = 20
    icon_w = img_icon.width if img_icon else 0
    cw = M + icon_w + (GAP if img_icon else 0) + text_w + M
    
    TARGET_H = img_icon.height if img_icon else 0
    ch = max(TARGET_H, text_h) + M * 2

    canvas = Image.new("RGBA", (cw, ch), bg_color)
    
    if img_icon:
        canvas.paste(img_icon, (M, (ch - TARGET_H) // 2), img_icon)

    draw = ImageDraw.Draw(canvas)
    tx = M + icon_w + (GAP if img_icon else 0)
    ty = (ch - text_h) // 2
    
    draw.text((tx, ty), "GetApp", fill=text_color, font=f1)
    draw.text((tx + 2, ty + ga_h + 2), "Smart Kiosk", fill=text_color, font=f2)

    canvas.save(BASE + name)

# Option A: Clean Outline Kiosk
make_layout('OPTIUNEA_A_DARK.png', draw_rect_icon, NAVY, (255,255,255,255))
make_layout('OPTIUNEA_A_WHITE.png', draw_rect_icon, WHITE, (16,38,80,255))

# Option B: Abstract Monitor with Stand
make_layout('OPTIUNEA_B_DARK.png', draw_abstract_icon, NAVY, (255,255,255,255))
make_layout('OPTIUNEA_B_WHITE.png', draw_abstract_icon, WHITE, (16,38,80,255))

# Option C: Only Text
make_layout('OPTIUNEA_C_DARK.png', None, NAVY, (255,255,255,255))
make_layout('OPTIUNEA_C_WHITE.png', None, WHITE, (16,38,80,255))

print("DONE")
