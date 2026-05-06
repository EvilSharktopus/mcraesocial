"""
Pass 3: Remove the knStep/knNavigateTo JS blocks using string matching.
"""
from pathlib import Path

SITE = Path(r"C:\Users\Owner\Desktop\mcraesocial")
pages = list(SITE.glob("social-*/*/index.html"))
print(f"Found {len(pages)} unit pages")

changed_files = []

# The JS block always starts with this and ends with </script>
START_MARKER = "function knStep(frame, forward)"
END_MARKER_GOKNFULL = "})();\n</script>"
END_MARKER_GOKNFULL_CR = "})();\r\n</script>"

for page in pages:
    try:
        content = page.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        content = page.read_text(encoding="cp1252")
    original = content

    if START_MARKER not in content:
        continue

    # Find the <script> tag before knStep
    idx = content.index(START_MARKER)
    # Walk backwards to find the <script> tag
    script_start = content.rfind("<script>", 0, idx)
    if script_start == -1:
        continue

    # Find the closing </script> after
    script_end = content.find("</script>", idx)
    if script_end == -1:
        continue
    script_end += len("</script>")

    # Also remove any leading whitespace/newlines before the <script>
    while script_start > 0 and content[script_start - 1] in (' ', '\t', '\n', '\r'):
        script_start -= 1

    content = content[:script_start] + content[script_end:]

    # Now check if knFullscreen is still defined somewhere
    if 'knFullscreen' in content and 'window.knFullscreen' not in content:
        fs_script = '\n  <script>\n  window.knFullscreen = function(btn) {\n    var tile = btn.closest(\'.kn-tile\');\n    var target = tile.querySelector(\'iframe\') || tile.querySelector(\'.slide-viewer\');\n    if (target && target.requestFullscreen) target.requestFullscreen();\n    else if (target && target.webkitRequestFullscreen) target.webkitRequestFullscreen();\n  };\n  </script>'
        content = content.replace('</body>', fs_script + '\n</body>')

    if content != original:
        page.write_text(content, encoding="utf-8")
        changed_files.append(page)
        print(f"  Fixed: {page.relative_to(SITE)}")

print(f"\nFixed {len(changed_files)} files")
