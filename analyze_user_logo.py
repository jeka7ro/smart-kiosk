from PIL import Image

img = Image.open("/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/media__1782724072388.png").convert("RGBA")
print(f"Size: {img.width} x {img.height}")
