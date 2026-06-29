import cv2
import numpy as np

img = cv2.imread("/Users/eugeniucazmal/.gemini/antigravity-ide/brain/7f78c519-6cc5-4fc6-a7d0-5542f15b6e71/media__1782724072388.png")
if img is None:
    print("Image not found")
    exit(1)

# The image is BGR. Arrow is red (R > 200, B < 100, G < 100)
# Let's create a mask for the arrow.
mask = np.zeros(img.shape[:2], dtype=np.uint8)

# Bounding box roughly containing the arrow to avoid masking the screen gradient
# The icon is on the left. The arrow is roughly x:10 to 90, y:20 to 100
for y in range(20, 100):
    for x in range(10, 90):
        b, g, r = img[y, x]
        # Solid red arrow
        if r > 200 and g < 120 and b < 120:
            # Also the arrow has some anti-aliasing edges
            mask[y, x] = 255
        elif r > 150 and g < 150 and b < 150 and (int(r)-int(g)) > 50:
            mask[y, x] = 255

# Dilate the mask to catch the anti-aliased edges
kernel = np.ones((3,3), np.uint8)
mask_dilated = cv2.dilate(mask, kernel, iterations=2)

# Inpaint
inpainted = cv2.inpaint(img, mask_dilated, 3, cv2.INPAINT_TELEA)

cv2.imwrite("inpainted_logo.png", inpainted)
cv2.imwrite("mask_debug.png", mask_dilated)
print("Inpainting complete")
