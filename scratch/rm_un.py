import os
import re

BASE_DIR = r"c:\Users\Owner\Desktop\mcraesocial"

def remove_model_un():
    # Regex to match the Model UN link with or without classes
    pattern = re.compile(r'\s*<a href="/social-20/model-un/"[^>]*>.*?</a>', re.IGNORECASE)
    
    count = 0
    for root, dirs, files in os.walk(BASE_DIR):
        if '.git' in root or 'mcrae-submit' in root or 'scratch' in root or 'node_modules' in root:
            continue
        for f in files:
            if f.endswith('.html'):
                path = os.path.join(root, f)
                with open(path, 'r', encoding='utf-8') as file:
                    content = file.read()
                
                new_content, num_subs = pattern.subn('', content)
                
                if num_subs > 0:
                    with open(path, 'w', encoding='utf-8') as file:
                        file.write(new_content)
                    count += 1
    print(f"Updated {count} HTML files to remove Model UN traces.")

remove_model_un()
