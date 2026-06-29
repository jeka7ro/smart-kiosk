import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# 1. Load the inpainted image
inpainted = cv2.imread("inpainted_logo.png")
# convert BGR to RGBA
img_rgba = cv2.cvtColor(inpainted, cv2.COLOR_BGR2RGBA)
img = Image.fromarray(img_rgba)

d = ImageDraw.Draw(img)

# Find background color at top-right
bg_color = img.getpixel((290, 5))

# 2. Erase "Smart Displays"
d.rectangle([115, 55, 296, 95], fill=bg_color)

# 3. Write "Smart Kiosk"
font_path = "/System/Library/Fonts/HelveticaNeue.ttc"
f2 = ImageFont.truetype(font_path, 21, index=1) # Helvetica Neue Light/Medium
d.text((122, 59), "Smart Kiosk", fill="#0c2b4e", font=f2)

# 4. Make background transparent
px = img.load()
for y in range(img.height):
    for x in range(img.width):
        r,g,b,a = px[x,y]
        if abs(r - bg_color[0]) < 15 and abs(g - bg_color[1]) < 15 and abs(b - bg_color[2]) < 15:
            px[x,y] = (255,255,255,0)

# 5. Save the DARK text version (for light backgrounds)
img.save("PERFECT_LOGO_DARK.png")
img.save("packages/admin/public/getapp_smart_kiosk_black.png")
img.save("packages/admin/public/getapp_smart_kiosk_logo.png")
img.save("/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/FINAL_INPAINTED_DARK.png")

# 6. Create the WHITE text version (for dark sidebar)
# We need to change the dark blue text (#0c2b4e) to white, 
# and also the dark blue frame of the icon to white, so it looks good on navy.
# Actually, if we just invert the dark blue pixels to white.
img_white = img.copy()
px_w = img_white.load()
for y in range(img_white.height):
    for x in range(img_white.width):
        r,g,b,a = px_w[x,y]
        if a > 0:
            # If it's dark blue
            if r < 100 and g < 100 and b < 150:
                px_w[x,y] = (255, 255, 255, a)

img_white.save("PERFECT_LOGO_WHITE.png")
img_white.save("packages/admin/public/getapp_smart_kiosk_white.png")
img_white.save("/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/FINAL_INPAINTED_WHITE.png")

print("All done!")
