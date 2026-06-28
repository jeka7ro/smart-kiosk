import os
from PIL import Image, ImageDraw, ImageFont

NAVY = "#102650"
BASE = '/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/'

# Load icon
img1 = Image.open(BASE + 'media__1782488632956.png').convert("RGBA")
w1, h1 = img1.size
icon_raw = img1.crop((0, 0, int(w1 * 0.39), h1))
px = icon_raw.load(); iw, ih = icon_raw.size
min_x, min_y, max_x, max_y = iw, ih, 0, 0
for y in range(ih):
    for x in range(iw):
        r, g, b, a = px[x, y]
        if a > 40 and (r+g+b) < 700:
            if x < min_x: min_x = x
            if y < min_y: min_y = y
            if x > max_x: max_x = x
            if y > max_y: max_y = y
icon_clean = icon_raw.crop((max(0,min_x-8), max(0,min_y-8), min(iw,max_x+8), min(ih,max_y+8)))
TARGET_H = 180
icon_final = icon_clean.resize((int(icon_clean.width*TARGET_H/icon_clean.height), TARGET_H), Image.Resampling.LANCZOS)

SUPP = "/System/Library/Fonts/Supplemental/"

font_combos = [
    # (bold_font, medium_font, label, out)
    ("Poppins-ExtraBold.ttf", "Poppins-Medium.ttf", "A - Poppins ExtraBold", "LOGO_A_Poppins.png"),
    ("Montserrat-Black.ttf",  "Montserrat-Medium.ttf", "B - Montserrat Black", "LOGO_B_MontBlack.png"),
    (SUPP+"Verdana Bold.ttf", SUPP+"Verdana.ttf", "C - Verdana Bold", "LOGO_C_Verdana.png"),
    (SUPP+"Arial Bold.ttf",   SUPP+"Arial.ttf",   "D - Arial Bold",   "LOGO_D_Arial.png"),
    ("/Library/Fonts/Roboto-Bold.ttf", "/Library/Fonts/Roboto-Medium.ttf", "E - Roboto Bold", "LOGO_E_Roboto.png"),
    ("/System/Library/Fonts/HelveticaNeue.ttc", "/System/Library/Fonts/HelveticaNeue.ttc", "F - Helvetica Neue", "LOGO_F_Helvetica.png"),
]

def make_logo(bold_path, med_path, label, out_name):
    try:
        index = 1 if bold_path.endswith(".ttc") else 0
        fb = ImageFont.truetype(bold_path, 70, index=index)
        fm = ImageFont.truetype(med_path, 37)
    except Exception as e:
        print(f"Skip {label}: {e}"); return

    tmp = ImageDraw.Draw(Image.new("RGBA",(1,1)))
    ga_bb = tmp.textbbox((0,0),"GetApp",font=fb)
    sk_bb = tmp.textbbox((0,0),"Smart Kiosk",font=fm)
    ga_w,ga_h = ga_bb[2]-ga_bb[0], ga_bb[3]-ga_bb[1]
    sk_w,sk_h = sk_bb[2]-sk_bb[0], sk_bb[3]-sk_bb[1]
    text_w = max(ga_w,sk_w)+10; text_h = ga_h+8+sk_h
    GAP=20; M=25
    cw = M+icon_final.width+GAP+text_w+M+10; ch = max(TARGET_H,text_h)+M*2
    canvas = Image.new("RGBA",(cw,ch),(255,255,255,255))
    canvas.paste(icon_final,(M,(ch-TARGET_H)//2),icon_final)
    draw = ImageDraw.Draw(canvas)
    tx = M+icon_final.width+GAP; ty = (ch-text_h)//2
    draw.text((tx,ty),"GetApp",fill=NAVY,font=fb)
    draw.text((tx+2,ty+ga_h+8),"Smart Kiosk",fill=NAVY,font=fm)
    lf = ImageFont.truetype("Montserrat-Medium.ttf",18) if os.path.exists("Montserrat-Medium.ttf") else ImageFont.load_default()
    draw.rectangle([0,ch-28,cw,ch],fill="#e8e8e8")
    draw.text((10,ch-26),label,fill="#444",font=lf)
    canvas.save(BASE + out_name)
    print(f"  OK: {label}")

for combo in font_combos:
    make_logo(*combo)

print("ALL DONE")
