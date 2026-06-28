import sys
from PIL import Image

try:
    # Open the user's original logo
    orig = Image.open('logo_getapp.png').convert("RGBA")
    w, h = orig.size
    # Guess: Icon is usually left 35-40% of the image. Let's crop from x=100 to w
    # We can refine this by finding the gap.
    # Actually let's just make a composite of the text part and one of the generated icons
    
    text_part = orig.crop((100, 0, w, h))
    
    # Open a generated icon, crop its icon part
    gen = Image.open('/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/getapp_kiosk_exact_fonts_1_1782487866817.png').convert("RGBA")
    gw, gh = gen.size
    # DALL-E horizontal logos usually have the icon on the left half. Let's crop the left 40%
    # and resize it to match the height of our text_part
    icon_part = gen.crop((100, 200, int(gw*0.45), gh-200)) # rough crop
    
    # Resize icon to match height
    aspect = icon_part.width / icon_part.height
    new_h = h
    new_w = int(aspect * new_h)
    icon_part = icon_part.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # Create new image
    final_w = new_w + text_part.width + 10 # 10px padding
    final = Image.new("RGBA", (final_w, h), (255, 255, 255, 255))
    final.paste(icon_part, (0, 0), icon_part) # if it has alpha, though DALL-E is usually white bg
    final.paste(text_part, (new_w + 10, 0), text_part)
    
    final.save('/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/FINAL_CUSTOM_LOGO.png')
    print("SUCCESS")
except Exception as e:
    print("ERROR:", e)

