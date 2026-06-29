from PIL import Image

img = Image.open("PERFECT_LOGO.png").convert("RGBA")
px = img.load()

# Invert dark blue to white
for y in range(img.height):
    for x in range(img.width):
        r,g,b,a = px[x,y]
        if a > 0:
            # If it's dark blue #0c2b4e (ish)
            if r < 100 and g < 100 and b < 150:
                px[x,y] = (255, 255, 255, a)

img.save("PERFECT_LOGO_WHITE.png")
