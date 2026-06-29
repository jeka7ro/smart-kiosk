import os
from PIL import Image, ImageDraw, ImageFont

NAVY = "#102650"
WHITE = "#ffffff"
BASE = '/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/'

HELV_NEUE = "/System/Library/Fonts/HelveticaNeue.ttc"
f1 = ImageFont.truetype(HELV_NEUE, 60, index=4) # Bold
f2 = ImageFont.truetype(HELV_NEUE, 32, index=1) # Light

def draw_solid_kiosk(is_white_theme):
    # If is_white_theme = True (meaning it's for the dark sidebar, so elements are white)
    main_color = WHITE if is_white_theme else NAVY
    screen_color = NAVY if is_white_theme else WHITE
    accent_color = (200, 200, 200, 255) if is_white_theme else (200, 200, 200, 255) # grey screen maybe? No, let's keep it 2 colors
    
    img = Image.new("RGBA", (100, 160), (255,255,255,0))
    d = ImageDraw.Draw(img)
    
    # Base stand
    d.rounded_rectangle([30, 140, 70, 150], radius=2, fill=main_color)
    d.rounded_rectangle([40, 120, 60, 140], radius=0, fill=main_color)
    
    # Main Body
    d.rounded_rectangle([10, 10, 90, 130], radius=12, fill=main_color)
    
    # Screen (cutout or solid opposite color)
    # If for the white sidebar (main=white), screen is transparent or navy
    # Actually if background is navy, screen should be transparent so navy shows through, 
    # but let's make it explicitly opposite color or slightly transparent
    if is_white_theme:
        d.rounded_rectangle([20, 20, 80, 90], radius=4, fill=(255,255,255,0)) # actually just draw over it with a clear/cutout
    
    # Best way to do cutout in PIL:
    # We will draw a mask
    return img

def make_solid_layout(name, is_white_theme):
    main_color = WHITE if is_white_theme else NAVY
    bg_color = (16,38,80,255) if is_white_theme else (255,255,255,255)
    
    # Draw icon
    img_icon = Image.new("RGBA", (100, 160), (255,255,255,0))
    d = ImageDraw.Draw(img_icon)
    
    # Stand
    d.rounded_rectangle([25, 145, 75, 155], radius=5, fill=main_color)
    d.rounded_rectangle([40, 125, 60, 145], radius=0, fill=main_color)
    # Body
    d.rounded_rectangle([15, 10, 85, 130], radius=15, fill=main_color)
    
    # Screen
    # if it's white theme, we want a dark screen so it looks like a screen
    screen_color = (16,38,80,255) if is_white_theme else WHITE
    d.rounded_rectangle([25, 25, 75, 95], radius=5, fill=screen_color)
    
    # Small slot or detail below screen
    d.rounded_rectangle([40, 105, 60, 110], radius=2, fill=screen_color)

    tmp_draw = ImageDraw.Draw(Image.new("RGBA", (1,1)))
    ga_bb = tmp_draw.textbbox((0,0), "GetApp", font=f1)
    sk_bb = tmp_draw.textbbox((0,0), "Smart Kiosk", font=f2)
    ga_w, ga_h = ga_bb[2]-ga_bb[0], ga_bb[3]-ga_bb[1]
    sk_w, sk_h = sk_bb[2]-sk_bb[0], sk_bb[3]-sk_bb[1]

    text_w = max(ga_w, sk_w) + 8
    text_h = ga_h + 4 + sk_h

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
    ty = (ch - text_h) // 2
    
    draw.text((tx, ty), "GetApp", fill=main_color, font=f1)
    draw.text((tx + 2, ty + ga_h + 2), "Smart Kiosk", fill=main_color, font=f2)

    canvas.save(BASE + name)

make_solid_layout('OPTIUNEA_SOLID_DARK.png', False)
make_solid_layout('OPTIUNEA_SOLID_WHITE.png', True)

print("DONE")
