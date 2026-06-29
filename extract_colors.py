import sys
from PIL import Image

img = Image.open("/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/media__1782724072388.png").convert("RGB")
# Get some pixels from the text and the arrow
# Let's just find the darkest blue and the most red pixel
w, h = img.size
px = img.load()

dark_blue = (255, 255, 255)
pure_red = (255, 255, 255)

for y in range(h):
    for x in range(w):
        r, g, b = px[x,y]
        # find dark blue
        if b > r and b > g and (r+g+b) < sum(dark_blue):
            dark_blue = (r, g, b)
        # find red (arrow)
        if r > 150 and g < 100 and b < 100:
            if g < pure_red[1]:
                pure_red = (r, g, b)

print(f"Dark Blue: #{dark_blue[0]:02x}{dark_blue[1]:02x}{dark_blue[2]:02x}")
print(f"Red: #{pure_red[0]:02x}{pure_red[1]:02x}{pure_red[2]:02x}")
