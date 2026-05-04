import os

target_block = """      <a href="https://nationalism.mcraesocial.com/" class="site-nav__logo-link" target="_blank" aria-label="Nationalism Game">
        <picture><source srcset="/assets/images/logo.webp" type="image/webp"><img src="/assets/images/logo.png" alt="Nationalism Game" class="site-nav__logo-img" width="2752" height="795" loading="eager"></picture>
      </a>"""

# some files might use slightly different spacing or formatting, let's also try a more flexible regex if exact match fails
import re
target_regex = re.compile(r'\s*<a href="https://nationalism\.mcraesocial\.com/" class="site-nav__logo-link".*?</a>', re.DOTALL)

directory = r"C:\Users\Owner\Desktop\mcraesocial"

count = 0
for root, dirs, files in os.walk(directory):
    if "mcrae-submit" in root or ".git" in root or "node_modules" in root:
        continue
    for file in files:
        if file.endswith(".html"):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content
            if target_block in content:
                new_content = content.replace(target_block, "")
            elif target_regex.search(content):
                 new_content = target_regex.sub("", content)
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                count += 1
                
print(f"Updated {count} files.")
