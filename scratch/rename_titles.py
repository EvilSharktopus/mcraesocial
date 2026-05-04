import re
from pathlib import Path

base_dir = Path(r"C:\Users\Owner\Desktop\mcraesocial")
courses = ["social-9", "social-10", "social-20", "social-30"]

def format_unit_name(slug: str) -> str:
    # Convert 'factors-of-nationalism' to 'Factors of Nationalism'
    words = slug.split('-')
    # Words that shouldn't be capitalized if they are not the first word
    minor_words = {'of', 'to', 'and', 'the', 'in', 'on', 'for', 'with', 'a', 'an'}
    
    formatted = []
    for i, word in enumerate(words):
        if i > 0 and word in minor_words:
            formatted.append(word)
        else:
            formatted.append(word.capitalize())
            
    return " ".join(formatted)

for course in courses:
    course_dir = base_dir / course
    course_name = course.replace('-', ' ').title() # 'Social 10'
    
    if not course_dir.exists():
        continue
        
    for html_file in course_dir.rglob("index.html"):
        # The unit directory is the parent of index.html
        unit_dir = html_file.parent
        # Skip the root course index.html (e.g. social-10/index.html)
        if unit_dir.name == course:
            continue
            
        unit_slug = unit_dir.name
        unit_title = format_unit_name(unit_slug)
        
        # New title format
        new_title_tag = f"<title>{unit_title} - {course_name}</title>"
        
        try:
            content = html_file.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            content = html_file.read_text(encoding="cp1252")
            
        original_content = content
        
        # Replace the <title> tag
        content = re.sub(r'<title>.*?</title>', new_title_tag, content, count=1, flags=re.DOTALL)
        
        if content != original_content:
            html_file.write_text(content, encoding="utf-8")
            print(f"Updated {html_file.relative_to(base_dir)} -> {new_title_tag}")

print("Title renaming complete!")
