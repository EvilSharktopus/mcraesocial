import re, os

HANDOUTS_REQUIRED = (
    '  <section class="unit-section" style="background: rgba(181,143,123,0.06);">\n'
    '    <h2 class="unit-section__title">HANDOUTS</h2>\n'
    '    <p class="unit-para" style="color:var(--text-dim);">Handouts will be posted here.</p>\n'
    '  </section>\n'
    '  <section class="unit-section" style="background: rgba(143,123,181,0.06);">\n'
    '    <h2 class="unit-section__title">REQUIRED READING</h2>\n'
    '    <p class="unit-para" style="color:var(--text-dim);">Required reading will be posted here.</p>\n'
    '  </section>'
)

def fix_page(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the notes-grid-section block (the new injected one at the bottom)
    grid_match = re.search(r'(<section class="unit-section notes-grid-section".*?</section>)', content, re.DOTALL)
    if not grid_match:
        print(f'  No grid section found in {path}')
        return

    new_notes_block = grid_match.group(1)

    # Find assignments section end
    assignments_end = re.search(r'(ASSIGNMENTS.*?</section>)', content, re.DOTALL)
    if not assignments_end:
        print(f'  No ASSIGNMENTS found in {path}')
        return

    assign_end_pos = assignments_end.end()
    grid_end_pos = grid_match.end()

    # Also consume an orphaned </div> right after the grid section if present
    after_grid = content[grid_end_pos:]
    page_close_match = re.match(r'\s*</div>', after_grid)
    if page_close_match:
        grid_end_pos += page_close_match.end()

    new_middle = '\n' + new_notes_block + '\n' + HANDOUTS_REQUIRED + '\n  </div>\n'
    content = content[:assign_end_pos] + new_middle + content[grid_end_pos:]

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'  Fixed: {path}')

pages = ['ccrf', 'collective-rights', 'immigration', 'pat-prep']
for p in pages:
    path = f'social-9/{p}/index.html'
    print(f'Processing {p}...')
    fix_page(path)

print('\nAll done!')
