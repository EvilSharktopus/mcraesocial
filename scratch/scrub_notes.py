import re
from pathlib import Path

# Paths to search
courses = ["social-10", "social-20", "social-30"]
base_dir = Path(r"C:\Users\Owner\Desktop\mcraesocial")

# Regex to find the old Notes section (no 'notes-grid-section' class)
# We look for <section ...> NOTES ... </section>
# It must NOT contain 'notes-grid-section'
old_notes_re = re.compile(
    r'<section class="unit-section"[^>]*>\s*<h2 class="unit-section__title">NOTES.*?</h2>.*?</section>',
    re.DOTALL
)

# Regex to find the broken notes-grid-section
broken_grid_re = re.compile(
    r'<section class="unit-section notes-grid-section"[^>]*>\s*<h2 class="unit-section__title">NOTES.*?</h2>\s*<div class="kn-grid">\s*</section>\s*</div>',
    re.DOTALL
)

# Regex to find a properly formed empty notes-grid-section (just in case)
empty_grid_re = re.compile(
    r'<section class="unit-section notes-grid-section"[^>]*>\s*<h2 class="unit-section__title">NOTES.*?</h2>\s*<div class="kn-grid">\s*</div>\s*</section>',
    re.DOTALL
)

# Regex to extract ALL .kn-tile elements
# Since .kn-tile has a deep structure, we need to carefully extract them.
# The tile ends with:
#       </div>
#     </div>
#   </div>
# Wait, let's just find <div class="kn-tile" ... until the next <footer or <div class="kn-tile" or <script
# Actually, the best way to find a kn-tile is to use an HTML parser or count divs.
def extract_kn_tiles(html):
    tiles = []
    # Find all <div class="kn-tile"
    idx = 0
    while True:
        idx = html.find('<div class="kn-tile"', idx)
        if idx == -1:
            break
        # Count divs to find the matching closing div
        div_count = 0
        end_idx = idx
        pos = idx
        while pos < len(html):
            next_open = html.find('<div', pos)
            next_close = html.find('</div', pos)
            if next_close == -1:
                break
            if next_open != -1 and next_open < next_close:
                div_count += 1
                pos = next_open + 4
            else:
                div_count -= 1
                pos = next_close + 5
                if div_count == 0:
                    end_idx = html.find('>', pos) + 1
                    break
        tile_html = html[idx:end_idx]
        tiles.append(tile_html)
        # Remove from html
        html = html[:idx] + html[end_idx:]
    return html, tiles

# Also find scripts related to slideshows
scripts_re = re.compile(r'<script>\s*\(function\(\)\s*\{\s*function knStep\(.*?\}\)\(\);\s*</script>', re.DOTALL)
slide_scripts_re = re.compile(r'<script>\s*\(function\(\)\{\s*var viewers = \{\};.*?\}\)\(\);\s*</script>', re.DOTALL)

for course in courses:
    course_dir = base_dir / course
    for html_file in course_dir.rglob("index.html"):
        try:
            content = html_file.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            content = html_file.read_text(encoding="cp1252")
        
        original_content = content
        
        # 1. Remove old notes
        content = old_notes_re.sub('', content)
        
        # 2. Remove broken or empty grid
        content = broken_grid_re.sub('', content)
        content = empty_grid_re.sub('', content)
        
        # 3. Extract tiles
        content, tiles = extract_kn_tiles(content)
        
        # 4. Extract scripts if they are scattered
        kn_script_match = scripts_re.search(content)
        kn_script = kn_script_match.group(0) if kn_script_match else ""
        content = scripts_re.sub('', content)
        
        slide_script_match = slide_scripts_re.search(content)
        slide_script = slide_script_match.group(0) if slide_script_match else ""
        content = slide_scripts_re.sub('', content)
        
        # 5. Build new notes section
        if tiles:
            new_notes = f"""
  <section class="unit-section notes-grid-section" style="background: rgba(100,160,140,0.06);">
    <h2 class="unit-section__title">NOTES <span style="font-weight:400; text-transform:none; letter-spacing:0; font-size:0.75em; color:var(--text-dim);">&mdash; hover over the left side for slide controls</span></h2>
    <div class="kn-grid">
"""
            new_notes += "\n".join(tiles)
            new_notes += "\n    </div>\n  </section>\n"
            if kn_script:
                new_notes += "\n  " + kn_script
            if slide_script:
                new_notes += "\n  " + slide_script
                
            # Insert right before <footer class="site-footer">
            footer_idx = content.find('<footer class="site-footer">')
            if footer_idx != -1:
                content = content[:footer_idx] + new_notes + "\n  " + content[footer_idx:]
            else:
                content += new_notes
        
        if content != original_content:
            html_file.write_text(content, encoding="utf-8")
            print(f"Scrubbed and fixed {html_file.relative_to(base_dir)}")

print("Scrubbing complete!")
