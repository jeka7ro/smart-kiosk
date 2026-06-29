from PIL import Image, ImageDraw, ImageFont

img_path = "/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/media__1782724072388.png"
img = Image.open(img_path).convert("RGBA")
d = ImageDraw.Draw(img)

# 1. Erase "Smart Displays"
# The text "Smart Displays" is roughly at x=115 to 296, y=55 to 90
# Let's find the background color at top-right
bg_color = img.getpixel((290, 5))
d.rectangle([115, 55, 296, 95], fill=bg_color)

# 2. Write "Smart Kiosk"
# Find a suitable font
font_path = "/System/Library/Fonts/HelveticaNeue.ttc"
f2 = ImageFont.truetype(font_path, 21, index=1) # Helvetica Neue Light/Medium
d.text((122, 59), "Smart Kiosk", fill="#0c2b4e", font=f2)

# 3. Erase the red arrow from the icon
# The icon is from x=15 to 110, y=10 to 90
# We need to rebuild the inner screen and the blue frame that the arrow cut.
# To be safe, we can just redraw the icon entirely over the old one to make it perfect,
# matching its dimensions exactly.

# The old icon bbox is roughly [15, 12, 105, 80]
# Let's draw a rounded rectangle with the exact same blue `#0c2b4e`
d.rectangle([10, 10, 110, 85], fill=bg_color) # wipe old icon

# Draw new clean icon
BLUE = "#0c2b4e"
RED = "#fb5b4c"
WHITE = "#ffffff"

# Outer frame
d.rounded_rectangle([15, 12, 105, 80], radius=12, fill=BLUE)
# Inner cutout
d.rounded_rectangle([23, 20, 101, 74], radius=8, fill=WHITE)
# Screen
d.rounded_rectangle([25, 22, 97, 72], radius=6, fill=WHITE)

# Draw gradient on screen
for y in range(22, 72):
    for x in range(25, 97):
        # gradient from bottom-left white to top-right red
        dist = ((x - 25)**2 + (y - 72)**2)**0.5
        max_dist = 90
        ratio = min(1.0, dist / max_dist)
        r = int(255 + (0xfb - 255) * ratio)
        g = int(255 + (0x5b - 255) * ratio)
        b = int(255 + (0x4c - 255) * ratio)
        d.point((x, y), fill=(r, g, b, 255))

# We need to make the background transparent
# Replace bg_color with transparent
px = img.load()
for y in range(img.height):
    for x in range(img.width):
        r,g,b,a = px[x,y]
        # if it matches background roughly
        if abs(r - bg_color[0]) < 10 and abs(g - bg_color[1]) < 10 and abs(b - bg_color[2]) < 10:
            px[x,y] = (255,255,255,0)

img.save("PERFECT_LOGO.png")
