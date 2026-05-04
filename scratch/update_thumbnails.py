import os
import re

base_dir = r"C:\Users\Owner\Desktop\mcraesocial"
screenshots_dir = os.path.join(base_dir, "assets", "images", "social-10", "screenshots")

# 1. Rename files
for file in ["1.0", "4.0"]:
    old_path = os.path.join(screenshots_dir, file)
    new_path = os.path.join(screenshots_dir, file + ".png")
    if os.path.exists(old_path):
        os.rename(old_path, new_path)

# 2. Update HTML files
mappings = {
    "social-10/identity/index.html": [
        "1.0.png",
        "1.3.PNG",
        "4.0.png"
    ],
    "social-10/historical/index.html": [
        "1.0 historical.PNG",
        "2.0 historical.PNG",
        "3.0 historical.PNG"
    ],
    "social-10/modern-globalization/index.html": [
        "RI 3 notes.PNG",
        "2.0 free trade.PNG"
    ]
}

for file_path, screenshots in mappings.items():
    full_path = os.path.join(base_dir, file_path.replace("/", os.sep))
    if not os.path.exists(full_path):
        print(f"File not found: {full_path}")
        continue
        
    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Find all google drive thumbnail images
    pattern = r'<img\s+src="https://drive\.google\.com/thumbnail\?id=[^"]+"[^>]*class="pdf-thumb__img"[^>]*>'
    matches = list(re.finditer(pattern, content))
    
    if len(matches) != len(screenshots):
        print(f"Warning: Found {len(matches)} thumbnail tags but expected {len(screenshots)} in {file_path}")
        continue
        
    new_content = content
    # Replace from back to front to avoid index shifting
    for i, match in reversed(list(enumerate(matches))):
        img_tag = match.group(0)
        
        # We need to preserve class and alt, and maybe loading attributes.
        # It's easier to just replace the src and remove onerror.
        # Actually, let's just construct a new img tag to be safe, or just do regex sub on src and onerror.
        
        new_tag = re.sub(r'src="[^"]+"', f'src="/assets/images/social-10/screenshots/{screenshots[i]}"', img_tag)
        new_tag = re.sub(r'\s*onerror="[^"]+"', '', new_tag)
        
        new_content = new_content[:match.start()] + new_tag + new_content[match.end():]
        
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(new_content)
        
    print(f"Updated {file_path}")

print("Done.")
