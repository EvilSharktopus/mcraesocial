import os
import re

root_dir = r'C:\Users\Owner\Desktop\mcraesocial'

patterns_to_remove = [
    r'<a[^>]*href=["\'][^"\']*textbook[^"\']*["\'][^>]*>.*?</a>',
]

count = 0

for dirpath, _, filenames in os.walk(root_dir):
    if 'node_modules' in dirpath or '.git' in dirpath:
        continue
    for f in filenames:
        if f.endswith('.html'):
            filepath = os.path.join(dirpath, f)
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as file:
                    content = file.read()
            except Exception as e:
                print(f"Skipping {filepath} due to error: {e}")
                continue
            
            original_content = content
            
            lines = content.split('\n')
            new_lines = []
            
            skip_next = False
            for i, line in enumerate(lines):
                if skip_next:
                    skip_next = False
                    continue
                    
                remove_line = False
                for pattern in patterns_to_remove:
                    if re.search(pattern, line, re.IGNORECASE):
                        remove_line = True
                        break
                        
                if remove_line:
                    if len(new_lines) > 0 and 'class="assignment-block__label"' in new_lines[-1] and 'Textbook' in new_lines[-1]:
                        new_lines.pop()
                    continue
                    
                if 'class="assignment-block__label"' in line and 'Textbook' in line:
                    if i + 1 < len(lines):
                        next_line = lines[i+1]
                        if 'textbook' in next_line.lower():
                            remove_line = True
                            skip_next = True
                            
                if not remove_line:
                    new_lines.append(line)
            
            new_content = '\n'.join(new_lines)
            
            if new_content != original_content:
                with open(filepath, 'w', encoding='utf-8', errors='ignore') as file:
                    file.write(new_content)
                count += 1
                print(f"Updated {filepath}")

print(f"Total files updated: {count}")
