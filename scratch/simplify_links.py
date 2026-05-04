import re

file_path = 'social-30/pendulum-of-ideology/index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

pattern = re.compile(
    r'<div class="assignment-block" style="flex-direction: column; align-items: stretch; text-align: center;">\s*'
    r'<div class="assignment-block__label" style="margin-bottom: 1rem;">(.*?)</div>\s*'
    r'<a href="(.*?)" target="_blank" class="utility-btn">Open Doc</a>\s*'
    r'</div>',
    re.MULTILINE
)

replacement = r'<a href="\2" target="_blank" class="utility-btn" style="padding: 1rem; font-weight: 600; font-size: 1.05rem;">\1</a>'

new_text, count = pattern.subn(replacement, text)

if count > 0:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_text)
    print(f"Replaced {count} blocks.")
else:
    print("No blocks found. Regex might be wrong.")
