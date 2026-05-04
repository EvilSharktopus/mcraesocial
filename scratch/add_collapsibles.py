import re

with open('social-30/pendulum-of-ideology/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace the start of the section with the details/summary wrapper
text = re.sub(
    r'<h2 class="unit-section__title">(18TH CENTURY|19TH CENTURY|20TH CENTURY|21ST CENTURY)</h2>\s*<div style="display: grid; gap: 1rem; grid-template-columns: repeat\(auto-fill, minmax\(200px, 1fr\)\);">',
    r'<details>\n        <summary class="unit-section__title" style="cursor: pointer; margin-bottom: 0;">\1 &#x25BE;</summary>\n        <div style="display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); margin-top: 1.5rem;">',
    text
)

# Replace the end of the section
text = re.sub(
    r'      </div>\n    </section>',
    r'      </div>\n      </details>\n    </section>',
    text
)

with open('social-30/pendulum-of-ideology/index.html', 'w', encoding='utf-8') as f:
    f.write(text)

print('Done')
