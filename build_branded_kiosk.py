import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

NAVY = "#0c2b4e"
RED = "#fb5b4c"
WHITE = "#ffffff"

# 1. We will extract the EXACT text from PERFECT_LOGO_DARK.png (which has the perfect GetApp text)
# Wait, PERFECT_LOGO_DARK.png has the horizontal icon on the left.
# The text starts around x=115
text_img = Image.open("PERFECT_LOGO_DARK.png").convert("RGBA")
# Crop the text part
# Bbox for text: x from 115 to 296, y from 0 to 102
text_crop = text_img.crop((110, 0, 296, 102))

# 2. Draw the vertical Kiosk Icon matching the brand style
icon_w = 70
icon_h = 100
icon = Image.new("RGBA", (icon_w, icon_h), (255,255,255,0))
d = ImageDraw.Draw(icon)

# The stand (bottom)
d.rounded_rectangle([15, 90, 55, 100], radius=2, fill=NAVY)
d.rounded_rectangle([25, 80, 45, 95], radius=0, fill=NAVY)

# Outer Navy Frame (Vertical)
d.rounded_rectangle([5, 5, 65, 85], radius=10, fill=NAVY)

# Inner White Cutout
d.rounded_rectangle([12, 12, 58, 78], radius=6, fill=WHITE)

# Inner Red Screen
screen_w = 42
screen_h = 62
screen = Image.new("RGBA", (screen_w, screen_h), (255,255,255,0))
ds = ImageDraw.Draw(screen)
ds.rounded_rectangle([0, 0, screen_w, screen_h], radius=4, fill=WHITE)

# Draw red gradient on the screen (bottom-left to top-right)
px = screen.load()
for y in range(screen_h):
    for x in range(screen_w):
        r,g,b,a = px[x,y]
        if a > 0:
            dist = ((x - 0)**2 + (y - screen_h)**2)**0.5
            max_dist = (screen_w**2 + screen_h**2)**0.5
            ratio = min(1.0, dist / max_dist)
            cr = int(255 + (0xfb - 255) * ratio)
            cg = int(255 + (0x5b - 255) * ratio)
            cb = int(255 + (0x4c - 255) * ratio)
            px[x,y] = (cr, cg, cb, a)

icon.paste(screen, (14, 14), screen)

# 3. Assemble the final logo
final_w = icon_w + 10 + text_crop.width
final_h = max(icon_h, text_crop.height)
final_logo = Image.new("RGBA", (final_w, final_h), (255,255,255,0))

# Paste icon (vertically centered)
final_logo.paste(icon, (0, (final_h - icon_h) // 2), icon)

# Paste text
final_logo.paste(text_crop, (icon_w + 10, (final_h - text_crop.height) // 2), text_crop)

final_logo.save("FINAL_BRANDED_DARK.png")
final_logo.save("packages/admin/public/getapp_smart_kiosk_black.png")
final_logo.save("packages/admin/public/getapp_smart_kiosk_logo.png")

# 4. Create the WHITE text version for the dark sidebar
final_white = final_logo.copy()
px_w = final_white.load()
for y in range(final_white.height):
    for x in range(final_white.width):
        r,g,b,a = px_w[x,y]
        if a > 0:
            # Change dark blue to white
            if r < 100 and g < 100 and b < 150:
                px_w[x,y] = (255, 255, 255, a)

final_white.save("FINAL_BRANDED_WHITE.png")
final_white.save("packages/admin/public/getapp_smart_kiosk_white.png")

print("SUCCESS")
