import os
import re
import requests
from bs4 import BeautifulSoup, NavigableString
import uuid

BASE_URL = "https://mcraesocial.weebly.com"

NAV_HTML = """  <nav class="site-nav">
    <div class="site-nav__inner">
      <a href="/" class="site-nav__brand">MCRAE'S SOCIAL STUDIES</a>
      <button class="site-nav__hamburger" aria-label="Toggle navigation" aria-expanded="false">&#x2630;</button>
      <ul class="site-nav__links">
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
      </ul>
    </div>
  </nav>"""

# Each Weebly section (wsite-section-wrap) gets a subtle tinted background
SECTION_GRADIENTS = [
    "rgba(123,143,181,0.06)",
    "rgba(100,160,140,0.06)",
    "rgba(181,143,123,0.06)",
    "rgba(143,123,181,0.06)",
    "rgba(123,181,181,0.06)",
]


def slugify(text):
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    return re.sub(r'[\s]+', '-', text)


def detect_stream(text):
    """Returns '1', '2', or 'shared' based on heading text."""
    t = text.strip()
    if re.search(r'\b(10-1|20-1|30-1)\b', t):
        return '1'
    if re.search(r'\b(10-2|20-2|30-2)\b', t):
        return '2'
    return None


def render_link_as_card(href, label, stream=None):
    """Render a single assignment link as a dual-button card."""
    aid = f"assignment-{uuid.uuid4().hex[:6]}"
    stream_attr = f' data-stream="{stream}"' if stream else ''
    return f"""    <div class="assignment-block"{stream_attr}>
      <div class="assignment-block__label">{label}</div>
      <div class="assignment-block__actions">
        <a href="{href}" target="_blank" class="utility-btn">See Assignment</a>
        <a href="#" data-assignment-id="{aid}" class="utility-btn utility-btn--work">Work on Assignment</a>
      </div>
    </div>"""


def extract_drive_id(url):
    """Pull the file ID out of a Google Drive URL."""
    m = re.search(r'/d/([a-zA-Z0-9_-]+)', url)
    return m.group(1) if m else None


def render_pdf_card(src, stream=None):
    """Render a Google Drive iframe as a clickable image thumbnail tile.
    
    Uses Google Drive's built-in thumbnail endpoint — no manual image needed.
    Falls back to a styled placeholder if the Drive thumbnail isn't available.
    """
    stream_attr = f' data-stream="{stream}"' if stream else ''
    view_url = src.replace('/preview', '/view')
    file_id = extract_drive_id(src)
    # lh3.googleusercontent.com/d/ is Google's public CDN for Drive files —
    # more browser-friendly than /thumbnail?id= (avoids CORS/cookie issues)
    thumb_src = f'https://lh3.googleusercontent.com/d/{file_id}=w800' if file_id else ''

    return f"""    <a href="{view_url}" target="_blank" class="pdf-thumb"{stream_attr}>
      <div class="pdf-thumb__img-wrap">
        <img
          src="{thumb_src}"
          alt="Unit Notes"
          class="pdf-thumb__img"
          onerror="this.style.display='none';this.nextElementSibling.style.removeProperty('display')"
        >
        <div class="pdf-thumb__placeholder" style="display:none;">
          <span class="pdf-thumb__icon">PDF</span>
          <span class="pdf-thumb__label">View Notes</span>
        </div>
      </div>
    </a>"""


def render_handout_link(href, label):
    """Render a plain handout/reading link as a styled flat link."""
    return f'    <a href="{href}" target="_blank" class="utility-link-item">{label}</a>'


def extract_links_from_el(el, stream=None, as_handout=False):
    """Pull all <a> tags from an element and render them appropriately."""
    lines = []
    for a in el.find_all('a', href=True):
        label = a.get_text(strip=True)
        href = a['href']
        if not label:
            continue
        if as_handout:
            lines.append(render_handout_link(href, label))
        else:
            lines.append(render_link_as_card(href, label, stream=stream))
    return lines


def process_section(section_el, section_idx):
    """Convert a wsite-section-wrap into clean HTML output."""
    lines = []
    bg = SECTION_GRADIENTS[section_idx % len(SECTION_GRADIENTS)]
    lines.append(f'  <section class="unit-section" style="background: {bg};">')

    elements = section_el.find('div', class_='wsite-section-elements')
    if not elements:
        lines.append('  </section>')
        return '\n'.join(lines)

    # Determine if this is a "special" section by its h2 label
    section_h2 = elements.find('h2')
    section_label = section_h2.get_text(strip=True).upper() if section_h2 else ''

    is_handout = section_label in ('HANDOUTS', 'REQUIRED READING', 'LINKS')
    has_streams = False

    # Check for wsite-multicol — Weebly's column layout
    multicol = elements.find('div', class_='wsite-multicol')

    if multicol:
        # Columns-based content — detect stream from column headers
        cols = multicol.find_all('td', class_='wsite-multicol-col')
        col_streams = []
        for col in cols:
            col_h2 = col.find('h2')
            stream_id = detect_stream(col_h2.get_text(strip=True)) if col_h2 else None
            col_streams.append(stream_id)

        has_streams = any(s in ('1', '2') for s in col_streams)

        if section_label:
            lines.append(f'    <h2 class="unit-section__title">{section_label}</h2>')

        if has_streams:
            lines.append('    <div class="stream-toggle">')
            lines.append('      <button class="stream-btn active" data-target-stream="shared">All Streams</button>')
            lines.append('      <button class="stream-btn" data-target-stream="1">-1 Only</button>')
            lines.append('      <button class="stream-btn" data-target-stream="2">-2 Only</button>')
            lines.append('    </div>')

        # Always wrap columns in a 2-column grid (stream-groups handles both stream and non-stream cases)
        lines.append('    <div class="stream-groups">')

        for col, stream_id in zip(cols, col_streams):
            # Emit stream label if meaningful
            col_h2 = col.find('h2')
            if col_h2:
                col_lbl = col_h2.get_text(strip=True)
                stream_attr = f' data-stream="{stream_id}"' if stream_id else ''
                lines.append(f'    <div class="stream-group"{stream_attr}>')
                lines.append(f'      <h3 class="stream-group__label">{col_lbl}</h3>')
            else:
                lines.append('    <div class="stream-group">')

            # PDF iframes
            for iframe in col.find_all('iframe'):
                src = iframe.get('src', '')
                if 'drive.google.com' in src:
                    lines.append(render_pdf_card(src, stream=stream_id))

            # pdf-cards already processed
            for pc in col.find_all('div', class_='pdf-card'):
                pass  # Already converted in-DOM if any

            # Links
            if is_handout:
                lines += extract_links_from_el(col, stream=stream_id, as_handout=True)
            else:
                lines += extract_links_from_el(col, stream=stream_id, as_handout=False)

            lines.append('    </div>')

        lines.append('    </div>')  # close .stream-groups

    else:
        # Single-column section
        if section_label:
            lines.append(f'    <h2 class="unit-section__title">{section_label}</h2>')

        # PDF iframes
        for iframe in elements.find_all('iframe'):
            src = iframe.get('src', '')
            if 'drive.google.com' in src:
                lines.append(render_pdf_card(src))

        # Links
        if is_handout:
            lines += extract_links_from_el(elements, as_handout=True)
        else:
            lines += extract_links_from_el(elements, as_handout=False)

        # any plain text paragraphs (for required reading text etc.)
        for para in elements.find_all('div', class_='paragraph'):
            # Only emit paragraphs without links as plain text
            if not para.find('a'):
                txt = para.get_text(strip=True)
                if txt:
                    lines.append(f'    <p class="unit-para">{txt}</p>')

    lines.append('  </section>')
    return '\n'.join(lines)


def migrate_unit(url, output_dir, course_name, custom_title=None, image_path=None):
    print(f"Fetching {url}...")
    res = requests.get(url)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, 'html.parser')

    title_el = soup.find('h2', class_='wsite-content-title')
    title = custom_title if custom_title else (title_el.get_text(strip=True) if title_el else "Unit")
    # Strip invisible characters from Weebly titles
    title = title.replace('\u200b', '').strip()

    content_root = soup.find('div', class_='wsite-elements wsite-not-footer')
    if not content_root:
        print("Could not find main content")
        return

    sections = content_root.find_all('div', class_='wsite-section-wrap')

    # Push "Required Reading" sections to the bottom
    def section_sort_key(sec):
        h2 = sec.find('h2', class_='wsite-content-title') or sec.find('h2')
        label = h2.get_text(strip=True).upper() if h2 else ''
        return 1 if 'REQUIRED READING' in label else 0

    sections = sorted(sections, key=section_sort_key)

    body_parts = []
    for i, sec in enumerate(sections):
        body_parts.append(process_section(sec, i))

    body_html = '\n'.join(body_parts)

    image_html = ""
    if image_path:
        image_html = f'<img src="{image_path}" alt="{title}" class="unit-banner__img">'

    banner_html = f"""  <div class="unit-banner">
    {image_html}
    <div class="unit-banner__overlay"></div>
    <div class="unit-banner__text">
      <h1 class="page-banner__title">{title}</h1>
      <p class="unit-banner__course">{course_name}</p>
    </div>
  </div>"""

    final_output = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} - {course_name}</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>

{NAV_HTML}

{banner_html}

  <div class="page-content">
{body_html}
  </div>

  <footer class="site-footer">
    mcraesocial.com
  </footer>

  <script src="/js/nav.js"></script>
</body>
</html>
"""

    os.makedirs(output_dir, exist_ok=True)
    with open(os.path.join(output_dir, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(final_output)

    print(f"  OK  Generated {output_dir}/index.html")


if __name__ == "__main__":
    migrate_unit(
        "https://mcraesocial.weebly.com/identity.html",
        "c:/Users/Owner/Desktop/mcraesocial/social-10/identity",
        "Social 10",
        None,
        "/assets/images/social-10/shape-identity.jpg"
    )
