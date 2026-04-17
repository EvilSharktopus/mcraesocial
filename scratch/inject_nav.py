"""
Inject course-level dropdown nav into every HTML file in the site.
Replaces the flat Social 9/10/20/30 links with hover dropdowns listing all units.
"""
import os
import re

BASE = "c:/Users/Owner/Desktop/mcraesocial"

NEW_NAV_LINKS = """      <ul class="site-nav__links">
        <li><a href="/" class="site-nav__link">Home</a></li>
        <li class="site-nav__dropdown">
          <a href="/social-9/" class="site-nav__link">Social 9 &#x25BE;</a>
          <div class="site-nav__dropdown-menu">
            <a href="/social-9/federal-political-systems/" class="site-nav__dropdown-item">Federal Political System</a>
            <a href="/social-9/ycja/" class="site-nav__dropdown-item">Youth Criminal Justice Act</a>
            <a href="/social-9/ccrf/" class="site-nav__dropdown-item">Canadian Charter of Rights</a>
            <a href="/social-9/collective-rights/" class="site-nav__dropdown-item">Collective Rights</a>
            <a href="/social-9/immigration/" class="site-nav__dropdown-item">Immigration</a>
            <a href="/social-9/economics/" class="site-nav__dropdown-item">Economic Systems</a>
            <a href="/social-9/consumerism/" class="site-nav__dropdown-item">Consumerism</a>
            <a href="/social-9/textbook/" class="site-nav__dropdown-item">The Textbook</a>
            <a href="/social-9/pat-prep/" class="site-nav__dropdown-item">PAT Prep</a>
          </div>
        </li>
        <li class="site-nav__dropdown">
          <a href="/social-10/" class="site-nav__link">Social 10 &#x25BE;</a>
          <div class="site-nav__dropdown-menu">
            <a href="/social-10/identity/" class="site-nav__dropdown-item">Shape Identity</a>
            <a href="/social-10/historical/" class="site-nav__dropdown-item">Respond to Historical</a>
            <a href="/social-10/modern-globalization/" class="site-nav__dropdown-item">Modern Globalization</a>
            <a href="/social-10/global-citizenship/" class="site-nav__dropdown-item">Global Citizenship</a>
          </div>
        </li>
        <li class="site-nav__dropdown">
          <a href="/social-20/" class="site-nav__link">Social 20 &#x25BE;</a>
          <div class="site-nav__dropdown-menu">
            <a href="/social-20/factors-of-nationalism/" class="site-nav__dropdown-item">Factors of Nationalism</a>
            <a href="/social-20/contending-loyalties/" class="site-nav__dropdown-item">Contending Loyalties</a>
            <a href="/social-20/national-interest/" class="site-nav__dropdown-item">National Interest</a>
            <a href="/social-20/ultranationalism/" class="site-nav__dropdown-item">Ultranationalism</a>
            <a href="/social-20/internationalism/" class="site-nav__dropdown-item">Internationalism</a>
            <a href="/social-20/challenges-to-canada/" class="site-nav__dropdown-item">Challenges to Canada</a>
            <a href="/social-20/create-a-country/" class="site-nav__dropdown-item">Create a Country</a>
            <a href="/social-20/model-un/" class="site-nav__dropdown-item">Model UN</a>
          </div>
        </li>
        <li class="site-nav__dropdown">
          <a href="/social-30/" class="site-nav__link">Social 30 &#x25BE;</a>
          <div class="site-nav__dropdown-menu">
            <a href="/social-30/intro-to-ideologies/" class="site-nav__dropdown-item">Intro to Ideologies</a>
            <a href="/social-30/economics/" class="site-nav__dropdown-item">Economics of Ideology</a>
            <a href="/social-30/dictatorships/" class="site-nav__dropdown-item">Dictatorships</a>
            <a href="/social-30/democracy/" class="site-nav__dropdown-item">Democracy</a>
            <a href="/social-30/imposition/" class="site-nav__dropdown-item">Imposing Liberalism</a>
            <a href="/social-30/illiberalism/" class="site-nav__dropdown-item">Illiberalism</a>
          </div>
        </li>
        <li class="site-nav__dropdown">
          <span class="site-nav__link" style="cursor: pointer;">Workbooks &#x25BE;</span>
          <div class="site-nav__dropdown-menu">
            <a href="https://mcraesocial.vercel.app/workbooks/10-2" class="site-nav__dropdown-item" target="_blank">10-2 Digital Workbook</a>
          </div>
        </li>
        <li><a href="https://nationalism.mcraesocial.com/" class="site-nav__link" target="_blank">Nationalism Game</a></li>
      </ul>"""

# Pattern that matches the entire <ul class="site-nav__links">...</ul> block
NAV_PATTERN = re.compile(
    r'<ul class="site-nav__links">.*?</ul>',
    re.DOTALL
)

updated = 0
skipped = 0

for root, dirs, files in os.walk(BASE):
    # Skip asset dumps and scratch files
    dirs[:] = [d for d in dirs if d not in ('assets', 'scratch', '.git', '__pycache__')]
    for fname in files:
        if not fname.endswith('.html'):
            continue
        path = os.path.join(root, fname)
        content = open(path, encoding='utf-8').read()
        if 'site-nav__links' not in content:
            skipped += 1
            continue
        new_content = NAV_PATTERN.sub(NEW_NAV_LINKS, content)
        if new_content != content:
            open(path, 'w', encoding='utf-8').write(new_content)
            print(f"  Updated: {path.replace(BASE, '')}")
            updated += 1
        else:
            skipped += 1

print(f"\nDone. {updated} files updated, {skipped} unchanged/skipped.")
