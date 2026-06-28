import sys, os, urllib.request
from PIL import Image, ImageDraw, ImageFont

try:
    font_url = "https://raw.githubusercontent.com/googlefonts/montserrat/master/fonts/ttf/Montserrat-Medium.ttf"
    font_path = "Montserrat-Medium.ttf"
    if not os.path.exists(font_path):
        urllib.request.urlretrieve(font_url, font_path)

    img1 = Image.open('/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/media__1782488632956.png').convert("RGBA")
    img2 = Image.open('/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/media__1782488639171.png').convert("RGBA")

    # Save intermediate crops to debug
    img1.save('/tmp/debug_img1_full.png')
    img2.save('/tmp/debug_img2_full.png')
    
    # Crop left 40% of img1 for icon only
    icon_raw = img1.crop((0, 0, int(img1.width * 0.42), img1.height))
    icon_raw.save('/tmp/debug_icon_raw.png')

    # Crop right 60% of img2 for text only (skip icon on left)
    text_raw = img2.crop((int(img2.width * 0.35), 0, img2.width, img2.height))
    text_raw.save('/tmp/debug_text_raw.png')
    
    print(f"img1: {img1.size}, img2: {img2.size}")
    print(f"icon_raw: {icon_raw.size}")
    print(f"text_raw: {text_raw.size}")
    print("DONE - check /tmp/ for debug images")
except Exception as e:
    import traceback; traceback.print_exc()
