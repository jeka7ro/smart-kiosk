import sys
from PIL import Image

try:
    # 1. Open original user logo to extract text
    orig = Image.open('/Users/eugeniucazmal/Downloads/dev_office/smart_kiosk/logo_getapp.png').convert("RGBA")
    w, h = orig.size
    
    # We assume the text in the original 303x153 image starts around x=105. 
    # Let's crop x=105 to w.
    text_part = orig.crop((105, 0, w, h))
    
    # 2. Open the user-selected generated image (v7 with arrow)
    gen_path = '/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/getapp_kiosk_horizontal_v7_1782487439005.png'
    gen = Image.open(gen_path).convert("RGBA")
    gw, gh = gen.size
    
    # The icon is on the left side of the 1024x1024 image. 
    # Let's crop from x=50 to x=450, y=200 to y=800 (rough guess for DALL-E)
    # Actually, we can just find the bounding box of non-white pixels on the left half!
    # Let's just crop the left half and find bounding box.
    left_half = gen.crop((0, 0, int(gw*0.48), gh))
    
    # Remove white background to find bounding box
    bg = Image.new("RGBA", left_half.size, (255,255,255,255))
    diff = Image.composite(left_half, bg, left_half)
    # Convert to grayscale and invert to find bounding box
    gray = left_half.convert("L")
    inv = Image.eval(gray, lambda x: 255 - x)
    bbox = inv.getbbox()
    if bbox:
        icon_part = left_half.crop(bbox)
    else:
        icon_part = left_half.crop((50, 200, 450, 800))
        
    # Resize icon to match the height of the text image (h)
    aspect = icon_part.width / icon_part.height
    new_h = h
    new_w = int(aspect * new_h)
    icon_part = icon_part.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # 3. Composite them together
    padding = 15
    final_w = new_w + padding + text_part.width
    final_img = Image.new("RGBA", (final_w, h), (255, 255, 255, 0)) # transparent bg
    
    # If the original image had a white background, we might want to fill with white
    # Let's fill with white just in case to match DALL-E
    final_img_white = Image.new("RGBA", (final_w, h), (255, 255, 255, 255))
    
    # Paste icon
    final_img_white.paste(icon_part, (0, 0), icon_part if icon_part.mode == 'RGBA' else None)
    # Paste text
    final_img_white.paste(text_part, (new_w + padding, 0), text_part if text_part.mode == 'RGBA' else None)
    
    out_path = '/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/FINAL_LOGO_V7.png'
    final_img_white.save(out_path)
    print("SUCCESS")
except Exception as e:
    print("ERROR:", e)
