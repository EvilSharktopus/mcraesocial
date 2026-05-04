import os
import re

files = [
    r"social-30\intro-to-ideologies\index.html",
    r"social-30\economics\index.html",
    r"social-30\dictatorships\index.html",
    r"social-30\democracy\index.html",
    r"social-30\imposition\index.html",
    r"social-30\illiberalism\index.html"
]

append_html = """
    <div class="assignment-block">
      <div class="assignment-block__label">30-1 Written Assignments Rubrics</div>
      <div class="assignment-block__actions">
        <a href="https://drive.google.com/file/d/0Bx6i2Sen30DabXp3eE91NHBwemM/view?usp=sharing&resourcekey=0-904ob_lVl6dyETxm9q5haQ" target="_blank" class="utility-btn">Open Doc</a>
      </div>
    </div>
    <div class="assignment-block">
      <div class="assignment-block__label">30-2 Written Assignments Rubrics</div>
      <div class="assignment-block__actions">
        <a href="https://drive.google.com/file/d/0Bx6i2Sen30DadkxucWdVbU9kR3M/view?usp=sharing&resourcekey=0-srPlsvX3aIRYywmY6f4d-A" target="_blank" class="utility-btn">Open Doc</a>
      </div>
    </div>
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

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove the placeholder p tag if it exists below HANDOUTS
    content = re.sub(
        r'(<h2 class="unit-section__title">HANDOUTS</h2>)\s*<p class="unit-para" style="color:var\(--text-dim\);">Handouts will be posted here\.</p>',
        r'\1',
        content
    )
    
    # Append the new blocks right after the HANDOUTS header
    content = re.sub(
        r'(<h2 class="unit-section__title">HANDOUTS</h2>)',
        r'\1' + append_html,
        content
    )
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
print("Updated all 6 files.")
