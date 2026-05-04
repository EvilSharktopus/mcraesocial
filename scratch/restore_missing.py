import shutil
from pathlib import Path
import re

DROPZONE = Path(r"C:\Users\Owner\OneDrive - Rocky View Schools\McRae Dropzone")
SITE_SLIDES = Path(r"C:\Users\Owner\Desktop\mcraesocial\assets\slides")

def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s-]+', '-', text)
    return text.strip('-')

restored_count = 0

for course_dir in DROPZONE.iterdir():
    if not course_dir.is_dir(): continue
    for unit_dir in course_dir.iterdir():
        if not unit_dir.is_dir(): continue
        proc_dir = unit_dir / "_processed"
        if not proc_dir.exists(): continue
        
        for item in proc_dir.iterdir():
            title = item.stem if item.is_file() else item.name
            slug = slugify(title)
            
            # Check if this slug exists in the site
            slide_dir = SITE_SLIDES / course_dir.name / unit_dir.name / slug
            if not slide_dir.exists():
                print(f"Restoring missing item: {course_dir.name}/{unit_dir.name}/{item.name}")
                dest = unit_dir / item.name
                if dest.exists():
                    if dest.is_dir(): shutil.rmtree(dest)
                    else: dest.unlink()
                shutil.move(str(item), str(dest))
                restored_count += 1

print(f"Restored {restored_count} missing items to be re-processed.")
