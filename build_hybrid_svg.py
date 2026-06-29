import base64
from PIL import Image, ImageOps
import io

BASE = '/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/'

# 1. Load icon, make transparent, mirror
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

# Keep it high resolution for the embedded PNG!
# Just save it to an in-memory buffer
buffer = io.BytesIO()
icon.save(buffer, format="PNG")
img_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

# Icon aspect ratio
w, h = icon.size
# We want the icon to display at height = 70 in the SVG viewBox
target_h = 70
target_w = target_h * (w / h)

# SVG ViewBox dimensions
svg_w = target_w + 12 + 200
svg_h = 70

svg_template = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {svg_w:.0f} {svg_h:.0f}" width="100%" height="100%">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&amp;display=swap');
    </style>
  </defs>
  
  <!-- High-Res Embedded Image for the Icon -->
  <image href="data:image/png;base64,{img_b64}" x="0" y="0" width="{target_w:.1f}" height="{target_h:.1f}" />
  
  <!-- Crisp Vector Text -->
  <text x="{target_w + 12:.1f}" y="32" font-family="Montserrat, sans-serif" font-weight="700" font-size="34" fill="{{TEXT_COLOR}}">GetApp</text>
  <text x="{target_w + 13:.1f}" y="56" font-family="Montserrat, sans-serif" font-weight="400" font-size="18" letter-spacing="3.5" fill="{{TEXT_COLOR}}">Smart Kiosk</text>
</svg>'''

svg_dark = svg_template.replace("{TEXT_COLOR}", "#0c2b4e")
svg_white = svg_template.replace("{TEXT_COLOR}", "#ffffff")

with open("packages/admin/public/getapp_smart_kiosk_logo.svg", "w") as f:
    f.write(svg_dark)
with open("packages/admin/public/getapp_smart_kiosk_white.svg", "w") as f:
    f.write(svg_white)

print("HYBRID SVGS SAVED")
