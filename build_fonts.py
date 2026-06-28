import os, urllib.request
from PIL import Image, ImageDraw, ImageFont

NAVY = "#102650"
BASE = '/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/'

# Download fonts
FONTS = {
    "Nunito-Black.ttf":       "https://raw.githubusercontent.com/googlefonts/nunito/main/fonts/TTF/Nunito-Black.ttf",
    "Nunito-SemiBold.ttf":    "https://raw.githubusercontent.com/googlefonts/nunito/main/fonts/TTF/Nunito-SemiBold.ttf",
    "Poppins-ExtraBold.ttf":  "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-ExtraBold.ttf",
    "Poppins-Medium.ttf":     "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Medium.ttf",
    "Raleway-ExtraBold.ttf":  "https://raw.githubusercontent.com/google/fonts/main/ofl/raleway/static/Raleway-ExtraBold.ttf",
    "Raleway-Medium.ttf":     "https://raw.githubusercontent.com/google/fonts/main/ofl/raleway/static/Raleway-Medium.ttf",
    "Montserrat-Black.ttf":   "https://raw.githubusercontent.com/googlefonts/montserrat/master/fonts/ttf/Montserrat-Black.ttf",
    "Montserrat-Medium.ttf":  "https://raw.githubusercontent.com/googlefonts/montserrat/master/fonts/ttf/Montserrat-Medium.ttf",
}
for fname, url in FONTS.items():
    if not os.path.exists(fname):
        print(f"Downloading {fname}...")
        try:
            urllib.request.urlretrieve(url, fname)
        except Exception as e:
            print(f"  FAIL: {e}")

# Load and clean icon
img1 = Image.open(BASE + 'media__1782488632956.png').convert("RGBA")
w1, h1 = img1.size
icon_raw = img1.crop((0, 0, int(w1 * 0.39), h1))
px = icon_raw.load()
iw, ih = icon_raw.size
min_x, min_y, max_x, max_y = iw, ih, 0, 0
for y in range(ih):
    for x in range(iw):
        r, g, b, a = px[x, y]
        if a > 40 and (r + g + b) < 700:
            if x < min_x: min_x = x
            if y < min_y: min_y = y
            if x > max_x: max_x = x
            if y > max_y: max_y = y
icon_clean = icon_raw.crop((max(0,min_x-8), max(0,min_y-8), min(iw,max_x+8), min(ih,max_y+8)))
TARGET_H = 180
icon_final = icon_clean.resize((int(icon_clean.width * TARGET_H / icon_clean.height), TARGET_H), Image.Resampling.LANCZOS)

def make_logo(font_bold_path, font_medium_path, label, out_name):
    try:
        fb = ImageFont.truetype(font_bold_path,   70)
        fm = ImageFont.truetype(font_medium_path, 37)
    except Exception as e:
        print(f"Font error {font_bold_path}: {e}"); return

    tmp = ImageDraw.Draw(Image.new("RGBA", (1,1)))
    ga_bb = tmp.textbbox((0,0), "GetApp",      font=fb)
    sk_bb = tmp.textbbox((0,0), "Smart Kiosk", font=fm)
    ga_w, ga_h = ga_bb[2]-ga_bb[0], ga_bb[3]-ga_bb[1]
    sk_w, sk_h = sk_bb[2]-sk_bb[0], sk_bb[3]-sk_bb[1]

    text_w = max(ga_w, sk_w) + 10
    text_h = ga_h + 8 + sk_h
    GAP = 20; M = 25
    cw = M + icon_final.width + GAP + text_w + M
    ch = max(TARGET_H, text_h) + M*2
    canvas = Image.new("RGBA", (cw, ch), (255,255,255,255))
    canvas.paste(icon_final, (M, (ch-TARGET_H)//2), icon_final)

    draw = ImageDraw.Draw(canvas)
    tx = M + icon_final.width + GAP
    ty = (ch - text_h) // 2
    draw.text((tx, ty),           "GetApp",      fill=NAVY, font=fb)
    draw.text((tx+2, ty+ga_h+8),  "Smart Kiosk", fill=NAVY, font=fm)

    # Label
    lf = ImageFont.truetype("Montserrat-Medium.ttf", 20) if os.path.exists("Montserrat-Medium.ttf") else ImageFont.load_default()
    draw.rectangle([0, ch-30, cw, ch], fill="#f0f0f0")
    draw.text((10, ch-28), label, fill="#555", font=lf)

    canvas.save(out_name)
    print(f"Saved: {out_name}")

make_logo("Nunito-Black.ttf",      "Nunito-SemiBold.ttf",   "1. Nunito Black",        BASE+"FONT_1_Nunito.png")
make_logo("Poppins-ExtraBold.ttf", "Poppins-Medium.ttf",    "2. Poppins ExtraBold",   BASE+"FONT_2_Poppins.png")
make_logo("Raleway-ExtraBold.ttf", "Raleway-Medium.ttf",    "3. Raleway ExtraBold",   BASE+"FONT_3_Raleway.png")
make_logo("Montserrat-Black.ttf",  "Montserrat-Medium.ttf", "4. Montserrat Black",    BASE+"FONT_4_Montserrat.png")
print("ALL DONE")
