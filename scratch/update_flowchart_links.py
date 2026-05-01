import os

files_to_update = [
    r'C:\Users\Owner\Desktop\mcraesocial\social-10\index.html',
    r'C:\Users\Owner\Desktop\mcraesocial\social-20\index.html',
    r'C:\Users\Owner\Desktop\mcraesocial\social-30\index.html'
]

for file_path in files_to_update:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace 3 source planner
    content = content.replace(
        'href="/3-source-planner.html"',
        'href="/assets/docs/3_source_flow_chart.pdf" target="_blank"'
    )

    # Replace position paper planner
    content = content.replace(
        'href="/position-paper-planner.html"',
        'href="/assets/docs/position_paper_flow_chart.pdf" target="_blank"'
    )

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Updated links in all 3 files.")
