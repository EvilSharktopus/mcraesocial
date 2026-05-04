import re
from pathlib import Path

courses = ["social-10", "social-20", "social-30"]
base_dir = Path(r"C:\Users\Owner\Desktop\mcraesocial")

# Regex to extract the notes-grid-section
notes_grid_re = re.compile(
    r'\s*<section class="unit-section notes-grid-section"[^>]*>\s*<h2 class="unit-section__title">NOTES.*?</h2>\s*<div class="kn-grid">.*?</section>',
    re.DOTALL
)

# Regex to extract the scripts
scripts_re = re.compile(r'\s*<script>\s*\(function\(\)\s*\{\s*function knStep\(.*?\}\)\(\);\s*</script>', re.DOTALL)
slide_scripts_re = re.compile(r'\s*<script>\s*\(function\(\)\{\s*var viewers = \{\};.*?\}\)\(\);\s*</script>', re.DOTALL)

for course in courses:
    course_dir = base_dir / course
    for html_file in course_dir.rglob("index.html"):
        content = html_file.read_text(encoding="utf-8")
        original_content = content
        
        notes_match = notes_grid_re.search(content)
        if not notes_match:
            continue
            
        notes_block = notes_match.group(0)
        content = content.replace(notes_block, '')
        
        kn_script_block = ""
        kn_match = scripts_re.search(content)
        if kn_match:
            kn_script_block = kn_match.group(0)
            content = content.replace(kn_script_block, '')
            
        slide_script_block = ""
        slide_match = slide_scripts_re.search(content)
        if slide_match:
            slide_script_block = slide_match.group(0)
            content = content.replace(slide_script_block, '')
            
        # Now we have extracted the notes and scripts.
        # Find the end of the ASSIGNMENTS section.
        # The assignments section has <h2 class="unit-section__title">ASSIGNMENTS</h2>
        # and ends with </section>.
        
        # Or even simpler, find the start of HANDOUTS or REQUIRED READING and insert BEFORE it.
        # It's safer to look for HANDOUTS, and if not present, REQUIRED READING.
        insert_idx = -1
        
        handouts_idx = content.find('<h2 class="unit-section__title">HANDOUTS</h2>')
        if handouts_idx != -1:
            # find the <section that contains it
            section_idx = content.rfind('<section class="unit-section"', 0, handouts_idx)
            if section_idx != -1:
                insert_idx = section_idx
                
        if insert_idx == -1:
            reading_idx = content.find('<h2 class="unit-section__title">REQUIRED READING</h2>')
            if reading_idx != -1:
                section_idx = content.rfind('<section class="unit-section"', 0, reading_idx)
                if section_idx != -1:
                    insert_idx = section_idx
                    
        if insert_idx != -1:
            insertion = notes_block + kn_script_block + slide_script_block + "\n  "
            content = content[:insert_idx] + insertion + content[insert_idx:]
        else:
            # If no handouts or reading, put it back at the bottom
            footer_idx = content.find('<footer class="site-footer">')
            if footer_idx != -1:
                insertion = notes_block + kn_script_block + slide_script_block + "\n  "
                content = content[:footer_idx] + insertion + content[footer_idx:]
                
        if content != original_content:
            html_file.write_text(content, encoding="utf-8")
            print(f"Reordered notes in {html_file.relative_to(base_dir)}")

print("Reordering complete!")
