import cv2
import numpy as np
from PIL import Image, ImageOps

BASE = '/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/'
NAVY = (12, 43, 78)
RED = (251, 91, 76)

# 1. Load the icon, remove bg, mirror, get clean version
icon = Image.open(BASE + "kiosk_logo_v2_1782727845555.png").convert("RGBA")
px = icon.load()
for y in range(icon.height):
    for x in range(icon.width):
        r, g, b, a = px[x, y]
        if r > 240 and g > 240 and b > 240:
            px[x, y] = (255, 255, 255, 0)
bbox = icon.getbbox()
if bbox: icon = icon.crop(bbox)
icon = ImageOps.mirror(icon)

# Save clean icon for tracing
icon.save("_clean_icon.png")
w, h = icon.size

# 2. Separate navy and red layers
img_cv = cv2.imread("_clean_icon.png", cv2.IMREAD_UNCHANGED)

# Navy mask: dark blue pixels
navy_mask = np.zeros(img_cv.shape[:2], dtype=np.uint8)
red_mask = np.zeros(img_cv.shape[:2], dtype=np.uint8)

for y in range(img_cv.shape[0]):
    for x in range(img_cv.shape[1]):
        b, g, r, a = img_cv[y, x]
        if a < 50: continue
        # Navy: dark, bluish
        if r < 80 and g < 80 and b > 40:
            navy_mask[y, x] = 255
        # Red/coral
        elif r > 150 and g < 150 and b < 150:
            red_mask[y, x] = 255

# 3. Find contours and convert to SVG paths
def contours_to_svg_path(mask, simplify=2.0):
    contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    paths = []
    for i, cnt in enumerate(contours):
        if len(cnt) < 3: continue
        approx = cv2.approxPolyDP(cnt, simplify, True)
        pts = approx.reshape(-1, 2)
        d = f"M {pts[0][0]},{pts[0][1]} "
        for p in pts[1:]:
            d += f"L {p[0]},{p[1]} "
        d += "Z"
        paths.append(d)
    return paths

navy_paths = contours_to_svg_path(navy_mask, 1.5)
red_paths = contours_to_svg_path(red_mask, 1.5)

# 4. Scale factor: icon should be ~70px high in the final SVG, matching text
scale = 70 / h
sw = w * scale
sh = 70

# 5. Build the SVG
# Text positioning
text_x = sw + 12
text_y_getapp = 28
text_y_smart = 55

svg_w = sw + 12 + 200
svg_h = 82

# Build navy paths scaled
def scale_path(d, sx, sy):
    import re
    def replace_coords(match):
        cmd = match.group(1)
        x = float(match.group(2)) * sx
        y = float(match.group(3)) * sy
        return f"{cmd} {x:.1f},{y:.1f}"
    return re.sub(r'([ML])\s*([\d.]+),([\d.]+)', replace_coords, d)

navy_svg = ""
for p in navy_paths:
    navy_svg += f'    <path d="{scale_path(p, scale, scale)}" fill="#0c2b4e"/>\n'

red_svg = ""
for p in red_paths:
    red_svg += f'    <path d="{scale_path(p, scale, scale)}" fill="#fb5b4c"/>\n'

# Dark version (navy text, for light backgrounds)
svg_dark = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {svg_w:.0f} {svg_h:.0f}" width="{svg_w:.0f}" height="{svg_h:.0f}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&amp;display=swap');
    </style>
  </defs>
  <g transform="translate(6, {(svg_h - sh) / 2:.0f})">
{navy_svg}{red_svg}  </g>
  <text x="{text_x:.0f}" y="{text_y_getapp}" font-family="Montserrat, sans-serif" font-weight="700" font-size="32" fill="#0c2b4e">GetApp</text>
  <text x="{text_x:.0f}" y="{text_y_smart}" font-family="Montserrat, sans-serif" font-weight="400" font-size="18" fill="#0c2b4e">Smart Kiosk</text>
</svg>'''

# White version (white text, for dark backgrounds)
svg_white = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {svg_w:.0f} {svg_h:.0f}" width="{svg_w:.0f}" height="{svg_h:.0f}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&amp;display=swap');
    </style>
  </defs>
  <g transform="translate(6, {(svg_h - sh) / 2:.0f})">
{red_svg}    <g opacity="0.9">
{navy_svg.replace('#0c2b4e', '#ffffff')}    </g>
  </g>
  <text x="{text_x:.0f}" y="{text_y_getapp}" font-family="Montserrat, sans-serif" font-weight="700" font-size="32" fill="#ffffff">GetApp</text>
  <text x="{text_x:.0f}" y="{text_y_smart}" font-family="Montserrat, sans-serif" font-weight="400" font-size="18" fill="#ffffff">Smart Kiosk</text>
</svg>'''

# Save
with open("packages/admin/public/getapp_smart_kiosk_logo.svg", "w") as f:
    f.write(svg_dark)
with open("packages/admin/public/getapp_smart_kiosk_white.svg", "w") as f:
    f.write(svg_white)
with open(BASE + "FINAL_SVG_DARK.svg", "w") as f:
    f.write(svg_dark)
with open(BASE + "FINAL_SVG_WHITE.svg", "w") as f:
    f.write(svg_white)

print(f"Icon size: {w}x{h}, Scaled: {sw:.0f}x{sh:.0f}")
print(f"SVG size: {svg_w:.0f}x{svg_h:.0f}")
print(f"Navy paths: {len(navy_paths)}, Red paths: {len(red_paths)}")
print("SVG FILES SAVED")
