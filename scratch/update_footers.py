import os
import re

directory = 'C:/Users/Owner/Desktop/mcraesocial'

new_footer = """  <footer class="site-footer">
    <a href="/" aria-label="Home" style="display:inline-block; transition: transform 0.2s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
      <picture>
        <source srcset="/assets/images/home/mcrae-logo.webp" type="image/webp">
        <img src="/assets/images/home/mcrae-logo.jpg" alt="McRae's Social Studies" width="50" height="50" loading="lazy" style="border-radius: 50%; opacity: 0.8; transition: opacity 0.2s ease;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
      </picture>
    </a>
  </footer>"""

count = 0
for root, dirs, files in os.walk(directory):
    # skip node_modules, .git, mcrae-submit
    if 'node_modules' in root or '.git' in root or 'mcrae-submit' in root or 'tools' in root:
        continue
        
    for file in files:
        if file.endswith('.html'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Use regex to find and replace the footer
            # It matches <footer class="site-footer">...</footer>
            pattern = re.compile(r'<footer class="site-footer">.*?</footer>', re.DOTALL)
            
            if pattern.search(content):
                new_content = pattern.sub(new_footer, content)
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                count += 1

print(f"Updated footers in {count} HTML files.")
