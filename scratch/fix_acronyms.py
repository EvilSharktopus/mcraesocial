import re
from pathlib import Path

base_dir = Path(r"C:\Users\Owner\Desktop\mcraesocial")
courses = ["social-9", "social-10", "social-20", "social-30"]

replacements = {
    "Ccrf": "CCRF",
    "Ycja": "YCJA",
    "Pat Prep": "PAT Prep",
    "Model Un": "Model UN"
}

for course in courses:
    course_dir = base_dir / course
    if not course_dir.exists(): continue
        
    for html_file in course_dir.rglob("index.html"):
        try:
            content = html_file.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            content = html_file.read_text(encoding="cp1252")
            
        original_content = content
        
        for old, new in replacements.items():
            content = content.replace(f"<title>{old}", f"<title>{new}")
        
        if content != original_content:
            html_file.write_text(content, encoding="utf-8")
            print(f"Fixed acronyms in {html_file.relative_to(base_dir)}")

print("Done fixing acronyms!")
