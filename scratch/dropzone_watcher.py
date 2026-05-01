"""
dropzone_watcher.py
Watches the McRae Dropzone OneDrive folder and automatically processes
new note files (PowerPoint slides, Keynote HTML exports) into the
mcraesocial website, injecting the correct HTML.

Supported file types:
  - .pptx         → LibreOffice converts to slide images → embedded slideshow
  - folder/       → Keynote HTML export → hosted as iframe embed
  - .txt          → iCloud share link → iframe embed

Run this script at startup. It runs silently in the background.
"""

import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

# ── Config ────────────────────────────────────────────────────────────────────

DROPZONE_DIR  = Path(r"C:\Users\Owner\OneDrive - Rocky View Schools\McRae Dropzone")
SITE_DIR      = Path(r"C:\Users\Owner\Desktop\mcraesocial")
ASSETS_SLIDES = SITE_DIR / "assets" / "slides"

# Path to LibreOffice soffice.exe — update if installed to a different location
LIBREOFFICE_PATH = r"C:\Program Files\LibreOffice\program\soffice.exe"

# Valid course directories inside the Dropzone (handles both cases from Mac)
KNOWN_COURSES = {"social-9", "social-10", "social-20", "social-30"}
COURSE_NORMALIZE = {
    "social 9": "social-9", "social 10": "social-10",
    "social 20": "social-20", "social 30": "social-30",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def log(msg: str):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def wait_for_download(path: Path, timeout: int = 120) -> bool:
    """
    Wait until OneDrive finishes downloading an online-only file.
    Returns True if file is ready, False if timeout exceeded.
    """
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            result = subprocess.run(
                ["attrib", str(path)], capture_output=True, text=True
            )
            # 'O' flag means online-only (not downloaded)
            if " O " not in result.stdout and result.returncode == 0:
                # Also verify file size is non-zero and stable
                size1 = path.stat().st_size
                time.sleep(2)
                size2 = path.stat().st_size
                if size1 == size2 and size1 > 0:
                    return True
        except Exception:
            pass
        log(f"  Waiting for OneDrive to download {path.name}...")
        time.sleep(5)
    return False


def slugify(name: str) -> str:
    """Turn a filename into a clean HTML-safe id."""
    name = Path(name).stem
    name = re.sub(r"[^a-zA-Z0-9 _-]", "", name).strip()
    return re.sub(r"\s+", "-", name).lower()


def parse_unit_path(abs_path: Path):
    """
    Given an absolute path inside the Dropzone, return (course, unit) or None.
    Handles both 'social-10' and 'Social 10' folder names from Mac.
    Example: .../McRae Dropzone/social-10/historical/notes.pptx
             → ("social-10", "historical")
    """
    try:
        rel = abs_path.relative_to(DROPZONE_DIR)
    except ValueError:
        return None
    parts = rel.parts
    if len(parts) < 2:
        return None
    course_raw = parts[0]
    unit = parts[1]
    # Normalize course name (handle Mac capitalisation)
    course = COURSE_NORMALIZE.get(course_raw.lower(), course_raw.lower())
    if course not in KNOWN_COURSES:
        return None
    return course, unit


def unit_html_path(course: str, unit: str) -> Path:
    return SITE_DIR / course / unit / "index.html"


def slides_dest_dir(course: str, unit: str, slug: str) -> Path:
    return ASSETS_SLIDES / course / unit / slug


# ── HTML injection ────────────────────────────────────────────────────────────

SLIDESHOW_BLOCK = """\
  <section class="unit-section notes-slideshow" style="background: rgba(100,160,140,0.06);" data-slug="{slug}">
    <h2 class="unit-section__title">NOTES — {title}</h2>
    <div class="slide-viewer" id="viewer-{slug}">
      <div class="slide-viewer__track" id="track-{slug}">
{slide_imgs}
      </div>
      <div class="slide-viewer__controls">
        <button class="slide-btn" onclick="slidePrev('{slug}')">&#8592;</button>
        <span class="slide-counter" id="counter-{slug}">1 / {count}</span>
        <button class="slide-btn" onclick="slideNext('{slug}')">&#8594;</button>
      </div>
    </div>
  </section>"""

IFRAME_BLOCK = """\
  <section class="unit-section notes-slideshow" style="background: rgba(100,160,140,0.06);" data-slug="{slug}">
    <h2 class="unit-section__title">NOTES — {title}</h2>
    <div class="slide-viewer-iframe">
      <iframe src="{src}" allowfullscreen loading="lazy"></iframe>
    </div>
  </section>"""

SLIDESHOW_JS = """\
<script>
(function(){
  var viewers = {};
  document.querySelectorAll('.slide-viewer').forEach(function(v){
    var id = v.id.replace('viewer-','');
    viewers[id] = { idx: 0, slides: v.querySelectorAll('.slide-viewer__slide') };
  });
  window.slidePrev = function(id){
    var v = viewers[id]; if(!v) return;
    v.idx = (v.idx - 1 + v.slides.length) % v.slides.length;
    updateViewer(id, v);
  };
  window.slideNext = function(id){
    var v = viewers[id]; if(!v) return;
    v.idx = (v.idx + 1) % v.slides.length;
    updateViewer(id, v);
  };
  function updateViewer(id, v){
    document.getElementById('track-'+id).style.transform = 'translateX(-' + (v.idx * 100) + '%)';
    document.getElementById('counter-'+id).textContent = (v.idx+1) + ' / ' + v.slides.length;
  }
})();
</script>"""

def inject_into_html(html_path: Path, new_section: str, slug: str):
    """Inject the new section into the unit page before </div> that closes page-content."""
    if not html_path.exists():
        log(f"  HTML not found: {html_path}")
        return

    content = html_path.read_text(encoding="utf-8")

    # Don't double-inject
    if f'data-slug="{slug}"' in content:
        log(f"  Already injected slug '{slug}', skipping.")
        return

    # Insert before the closing </div> of .page-content
    # We look for the footer as the reliable anchor
    anchor = "<footer"
    if anchor not in content:
        log(f"  Could not find insertion anchor in {html_path}")
        return

    idx = content.index(anchor)
    # Add slideshow JS if not already there
    if "window.slidePrev" not in content and "slide-viewer__track" in new_section:
        new_section = new_section + "\n" + SLIDESHOW_JS

    content = content[:idx] + new_section + "\n\n  " + content[idx:]
    html_path.write_text(content, encoding="utf-8")
    log(f"  Injected into {html_path}")


# ── Processors ────────────────────────────────────────────────────────────────

def process_pptx(src: Path, course: str, unit: str, original_name: str = None):
    title = original_name or Path(src).stem
    slug  = slugify(title)
    dest  = slides_dest_dir(course, unit, slug)
    dest.mkdir(parents=True, exist_ok=True)

    if not Path(LIBREOFFICE_PATH).exists():
        log(f"  LibreOffice not found at {LIBREOFFICE_PATH}. Skipping .pptx conversion.")
        log(f"  Install LibreOffice and re-drop the file to process it.")
        return

    log(f"  Converting {src.name} with LibreOffice...")
    subprocess.run([
        LIBREOFFICE_PATH, "--headless", "--convert-to", "png",
        "--outdir", str(dest), str(src)
    ], check=True)

    slides = sorted(dest.glob("*.png"))
    if not slides:
        log(f"  No slides produced from {src.name}")
        return

    web_paths = [
        f"/assets/slides/{course}/{unit}/{slug}/{s.name}"
        for s in slides
    ]
    slide_imgs = "\n".join(
        f'        <img class="slide-viewer__slide" src="{p}" alt="Slide {i+1}" loading="lazy">'
        for i, p in enumerate(web_paths)
    )
    section = SLIDESHOW_BLOCK.format(
        slug=slug, title=title,
        slide_imgs=slide_imgs, count=len(slides)
    )
    inject_into_html(unit_html_path(course, unit), section, slug)


def process_keynote_html(src_dir: Path, course: str, unit: str):
    title = src_dir.name
    slug  = slugify(title)
    dest  = slides_dest_dir(course, unit, slug)
    dest.parent.mkdir(parents=True, exist_ok=True)

    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(src_dir, dest)
    log(f"  Copied Keynote HTML to {dest}")

    # Find the entry HTML file
    entry = next((f for f in dest.rglob("*.html")), None)
    if not entry:
        log("  No HTML entry found in Keynote export.")
        return

    web_src = "/assets/slides/" + "/".join([course, unit, slug, entry.name])
    section = IFRAME_BLOCK.format(slug=slug, title=title, src=web_src)
    inject_into_html(unit_html_path(course, unit), section, slug)


def process_icloud_link(src: Path, course: str, unit: str):
    url = src.read_text(encoding="utf-8").strip()
    title = src.stem
    slug  = slugify(title)
    section = IFRAME_BLOCK.format(slug=slug, title=title, src=url)
    inject_into_html(unit_html_path(course, unit), section, slug)


def archive(src: Path, course: str, unit: str):
    dest_dir = DROPZONE_DIR / course / unit / "_processed"
    dest_dir.mkdir(exist_ok=True)
    dest = dest_dir / src.name
    if dest.exists():
        dest = dest_dir / (src.stem + f"_{int(time.time())}" + src.suffix)
    shutil.move(str(src), str(dest))
    log(f"  Archived to {dest}")


def dispatch(path: Path):
    info = parse_unit_path(path)
    if not info:
        return
    course, unit = info

    # Skip anything inside _processed
    if "_processed" in path.parts:
        return

    log(f"New file detected: {path}")

    # Wait for OneDrive to finish downloading before processing
    if path.is_file() and not wait_for_download(path):
        log(f"  Timed out waiting for {path.name} to download. Skipping.")
        return

    suffix = path.suffix.lower()
    if suffix == ".pptx":
        # Copy to a no-spaces temp path to avoid LibreOffice argument issues
        tmp_dir = Path(r"C:\Users\Owner\Desktop\mcraesocial\scratch\temp_convert")
        tmp_dir.mkdir(exist_ok=True)
        tmp_file = tmp_dir / "convert.pptx"
        shutil.copy2(str(path), str(tmp_file))
        process_pptx(tmp_file, course, unit, original_name=path.stem)
        tmp_file.unlink(missing_ok=True)
        archive(path, course, unit)
    elif suffix == ".txt":
        process_icloud_link(path, course, unit)
        archive(path, course, unit)
    elif path.is_dir():
        # Check if it's a Keynote HTML export (contains an .html file)
        if any(path.rglob("*.html")):
            process_keynote_html(path, course, unit)
            archive(path, course, unit)
    else:
        log(f"  Unsupported file type: {suffix} — ignoring.")


# ── Watcher ───────────────────────────────────────────────────────────────────

class DropzoneHandler(FileSystemEventHandler):
    def on_created(self, event):
        path = Path(event.src_path)
        # Small delay so OneDrive finishes syncing the file fully
        time.sleep(3)
        if path.exists():
            dispatch(path)

    def on_moved(self, event):
        path = Path(event.dest_path)
        time.sleep(2)
        if path.exists():
            dispatch(path)


if __name__ == "__main__":
    ASSETS_SLIDES.mkdir(parents=True, exist_ok=True)
    log(f"Watching: {DROPZONE_DIR}")
    log("Drop a .pptx, Keynote HTML folder, or .txt iCloud link into a unit subfolder.")

    observer = Observer()
    observer.schedule(DropzoneHandler(), str(DROPZONE_DIR), recursive=True)
    observer.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
