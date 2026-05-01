import os
import re

directories = [
    r"social-10\global-citizenship",
    r"social-10\historical",
    r"social-10\identity",
    r"social-10\modern-globalization",
    r"social-10\socratic-seminars",
    r"social-20\challenges-to-canada",
    r"social-20\contending-loyalties",
    r"social-20\create-a-country",
    r"social-20\factors-of-nationalism",
    r"social-20\internationalism",
    r"social-20\model-un",
    r"social-20\national-interest",
    r"social-20\ultranationalism"
]

append_html = """
    <div class="assignment-block">
      <div class="assignment-block__label">3 Source Planner</div>
      <div class="assignment-block__actions">
        <a href="/assets/docs/3_source_flow_chart.pdf" target="_blank" class="utility-btn">Open PDF</a>
      </div>
    </div>
    <div class="assignment-block">
      <div class="assignment-block__label">Position Paper Planner</div>
      <div class="assignment-block__actions">
        <a href="/assets/docs/position_paper_flow_chart.pdf" target="_blank" class="utility-btn">Open PDF</a>
      </div>
    </div>"""

for d in directories:
    filepath = os.path.join(d, "index.html")
    if not os.path.exists(filepath):
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove the placeholder p tag if it exists below HANDOUTS
    content = re.sub(
        r'(<h2 class="unit-section__title">HANDOUTS</h2>)\s*<p class="unit-para" style="color:var\(--text-dim\);">Handouts will be posted here\.</p>',
        r'\1',
        content
    )
    
    # Remove existing planner blocks in identity unit to avoid duplicates
    content = re.sub(
        r'\s*<div class="assignment-block">\s*<div class="assignment-block__label">(?:Three Source|3 Source) Planner</div>.*?</div>\s*</div>',
        '',
        content,
        flags=re.DOTALL
    )
    content = re.sub(
        r'\s*<div class="assignment-block">\s*<div class="assignment-block__label">Position Paper Planner</div>.*?</div>\s*</div>',
        '',
        content,
        flags=re.DOTALL
    )
    
    # Append the new blocks right after the HANDOUTS header
    content = re.sub(
        r'(<h2 class="unit-section__title">HANDOUTS</h2>)',
        r'\1' + append_html,
        content
    )
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
print("Updated all sub-units.")
