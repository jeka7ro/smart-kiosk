from PIL import Image, ImageDraw, ImageFont

# 1. Load the AI generated kiosk icon
ai_img = Image.open("/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/new_kiosk_branded_1782724827887.png").convert("RGBA")
# It's a 1024x1024 image. The kiosk is in the middle.
# Let's crop it tightly. It has a white background.
# We will make the white background transparent.
# We can find the bounding box by looking for non-white pixels
bg = (255,255,255)
px = ai_img.load()
for y in range(ai_img.height):
    for x in range(ai_img.width):
        r,g,b,a = px[x,y]
        if r > 240 and g > 240 and b > 240:
            px[x,y] = (255,255,255,0)
            
bbox = ai_img.getbbox()
if bbox:
    ai_img = ai_img.crop(bbox)

# Resize to something reasonable, like height=120
aspect = ai_img.width / ai_img.height
new_h = 100
new_w = int(new_h * aspect)
ai_img = ai_img.resize((new_w, new_h), Image.LANCZOS)

# 2. Extract GetApp from user's original perfect text
text_img = Image.open("PERFECT_LOGO_DARK.png").convert("RGBA")
text_crop = text_img.crop((110, 0, 296, 102))

# 3. Assemble
final_w = new_w + 15 + text_crop.width
final_h = max(new_h, text_crop.height)
final_logo = Image.new("RGBA", (final_w, final_h), (255,255,255,0))

# Paste icon
final_logo.paste(ai_img, (0, (final_h - new_h) // 2), ai_img)

# Paste text
final_logo.paste(text_crop, (new_w + 15, (final_h - text_crop.height) // 2), text_crop)

final_logo.save("FINAL_AI_BRANDED_DARK.png")
final_logo.save("packages/admin/public/getapp_smart_kiosk_black.png")
final_logo.save("packages/admin/public/getapp_smart_kiosk_logo.png")

# 4. White text version
final_white = final_logo.copy()
px_w = final_white.load()
for y in range(final_white.height):
    for x in range(final_white.width):
        r,g,b,a = px_w[x,y]
        if a > 0:
            if r < 100 and g < 100 and b < 150: # Dark blue
                px_w[x,y] = (255, 255, 255, a)

final_white.save("FINAL_AI_BRANDED_WHITE.png")
final_white.save("packages/admin/public/getapp_smart_kiosk_white.png")
