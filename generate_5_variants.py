import math
from PIL import Image, ImageDraw, ImageFont

NAVY = "#0c2b4e"
RED = "#fb5b4c"
WHITE = "#ffffff"

font_bold = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 56, index=4) # Bold
font_light = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 32, index=1) # Light

def draw_text(canvas, x, y, text_color):
    d = ImageDraw.Draw(canvas)
    d.text((x, y), "GetApp", fill=text_color, font=font_bold)
    # Get bounding box to place the next line
    bb = d.textbbox((0,0), "GetApp", font=font_bold)
    d.text((x + 2, y + (bb[3]-bb[1]) + 2), "Smart Kiosk", fill=text_color, font=font_light)

# Helper to draw gradient
def draw_gradient_rect(draw_obj, rect, color1, color2, radius):
    # Simplification: we'll just draw a solid color or a manual pixel gradient
    # But since it's an ImageDraw object, we can't easily pixel-push without the underlying image.
    pass

# We will create 5 distinct icons and assemble them with text.

def assemble_variant(filename, icon_img, is_dark_bg=False):
    bg_color = (12, 43, 78, 255) if is_dark_bg else (255, 255, 255, 255)
    text_color = WHITE if is_dark_bg else NAVY
    
    # Text dims
    tmp = ImageDraw.Draw(Image.new("RGBA", (1,1)))
    bb1 = tmp.textbbox((0,0), "GetApp", font=font_bold)
    bb2 = tmp.textbbox((0,0), "Smart Kiosk", font=font_light)
    tw = max(bb1[2], bb2[2]) + 10
    th = bb1[3] + bb2[3] + 10
    
    w = 40 + icon_img.width + 30 + tw + 40
    h = max(icon_img.height, th) + 60
    
    canvas = Image.new("RGBA", (w, h), bg_color)
    
    # Paste icon
    ix = 40
    iy = (h - icon_img.height) // 2
    canvas.paste(icon_img, (ix, iy), icon_img)
    
    # Draw text
    tx = ix + icon_img.width + 30
    ty = (h - th) // 2
    draw_text(canvas, tx, ty, text_color)
    
    canvas.save(filename)


# --- VARIANT 1: The Original Model (Horizontal Screen, No Arrow) ---
def build_v1():
    img = Image.new("RGBA", (130, 90), (255,255,255,0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, 130, 90], radius=12, fill=NAVY)
    d.rounded_rectangle([8, 8, 122, 82], radius=8, fill=WHITE)
    d.rounded_rectangle([12, 12, 118, 78], radius=6, fill=RED)
    # manual gradient
    px = img.load()
    for y in range(12, 78):
        for x in range(12, 118):
            dist = ((x - 12)**2 + (y - 78)**2)**0.5
            ratio = min(1.0, dist / 110.0)
            r = int(255 + (0xfb - 255) * ratio)
            g = int(255 + (0x5b - 255) * ratio)
            b = int(255 + (0x4c - 255) * ratio)
            px[x,y] = (r, g, b, 255)
    return img

# --- VARIANT 2: Vertical Kiosk (Stand + Screen) ---
def build_v2():
    img = Image.new("RGBA", (90, 130), (255,255,255,0))
    d = ImageDraw.Draw(img)
    # Stand
    d.rounded_rectangle([25, 110, 65, 125], radius=2, fill=NAVY)
    d.rounded_rectangle([35, 90, 55, 120], radius=0, fill=NAVY)
    # Frame
    d.rounded_rectangle([0, 0, 90, 100], radius=10, fill=NAVY)
    d.rounded_rectangle([8, 8, 82, 92], radius=6, fill=WHITE)
    d.rounded_rectangle([12, 12, 78, 88], radius=4, fill=RED)
    px = img.load()
    for y in range(12, 88):
        for x in range(12, 78):
            dist = ((x - 12)**2 + (y - 88)**2)**0.5
            ratio = min(1.0, dist / 90.0)
            r = int(255 + (0xfb - 255) * ratio)
            g = int(255 + (0x5b - 255) * ratio)
            b = int(255 + (0x4c - 255) * ratio)
            px[x,y] = (r, g, b, 255)
    return img

# --- VARIANT 3: Abstract Overlap ---
def build_v3():
    img = Image.new("RGBA", (110, 110), (255,255,255,0))
    d = ImageDraw.Draw(img)
    # Two overlapping rounded rectangles
    d.rounded_rectangle([0, 20, 80, 110], radius=15, fill=NAVY)
    d.rounded_rectangle([30, 0, 110, 90], radius=15, fill=RED)
    return img

# --- VARIANT 4: Ultra Minimalist Flat Vertical ---
def build_v4():
    img = Image.new("RGBA", (80, 120), (255,255,255,0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, 80, 120], radius=8, fill=NAVY)
    d.rounded_rectangle([10, 10, 70, 80], radius=4, fill=RED) # Solid red
    d.rounded_rectangle([30, 95, 50, 105], radius=2, fill=WHITE) # slot
    return img

# --- VARIANT 5: Circular Modern ---
def build_v5():
    img = Image.new("RGBA", (120, 120), (255,255,255,0))
    d = ImageDraw.Draw(img)
    d.ellipse([0, 0, 120, 120], fill=NAVY)
    # Inner red screen
    d.rounded_rectangle([35, 25, 85, 95], radius=6, fill=RED)
    d.rounded_rectangle([45, 80, 75, 85], radius=2, fill=WHITE)
    return img

BASE = "/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/"

assemble_variant(BASE + "VAR_1.png", build_v1())
assemble_variant(BASE + "VAR_2.png", build_v2())
assemble_variant(BASE + "VAR_3.png", build_v3())
assemble_variant(BASE + "VAR_4.png", build_v4())
assemble_variant(BASE + "VAR_5.png", build_v5())

print("VARIANTS GENERATED")
