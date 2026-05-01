"""
dropzone_watcher.py
Watches the McRae Dropzone OneDrive folder and automatically processes
new note files (PowerPoint slides, Keynote HTML exports) into the
mcraesocial website, injecting the correct HTML.

Supported file types:
  - .pptx         Ã¢â€ â€™ LibreOffice converts to slide images Ã¢â€ â€™ embedded slideshow
  - folder/       Ã¢â€ â€™ Keynote HTML export Ã¢â€ â€™ hosted as iframe embed
  - .txt          Ã¢â€ â€™ iCloud share link Ã¢â€ â€™ iframe embed

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

# Ã¢â€â‚¬Ã¢â€â‚¬ Config Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

DROPZONE_DIR  = Path(r"C:\Users\Owner\OneDrive - Rocky View Schools\McRae Dropzone")
SITE_DIR      = Path(r"C:\Users\Owner\Desktop\mcraesocial")
ASSETS_SLIDES = SITE_DIR / "assets" / "slides"

# Path to LibreOffice soffice.exe Ã¢â‚¬â€ update if installed to a different location
LIBREOFFICE_PATH = r"C:\Program Files\LibreOffice\program\soffice.exe"

# Valid course directories inside the Dropzone (handles both cases from Mac)
KNOWN_COURSES = {"social-9", "social-10", "social-20", "social-30"}
COURSE_NORMALIZE = {
    "social 9": "social-9", "social 10": "social-10",
    "social 20": "social-20", "social 30": "social-30",
}

# Ã¢â€â‚¬Ã¢â€â‚¬ Helpers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

LOG_FILE = Path(__file__).with_suffix(".log")

def log(msg: str):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as _lf:
            _lf.write(line + "\n")
    except Exception:
        pass


def trigger_onedrive_downloads(files: list):
    """
    Force OneDrive to start downloading online-only files by opening each one.
    Reading even 1 byte is enough to trigger the on-demand download.
    """
    triggered = 0
    for f in files:
        try:
            with open(f, "rb") as fh:
                fh.read(1)
            triggered += 1
        except Exception:
            pass
    if triggered:
        log(f"  Triggered download of {triggered} online-only file(s) â€” OneDrive is now pulling them...")


def wait_for_download(path: Path, timeout: int = 300) -> bool:
    """
    Wait until OneDrive finishes downloading an online-only file.
    Actively triggers the download by reading the file.
    Returns True if file is ready, False if timeout exceeded.
    """
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            # Try reading the file - this triggers OneDrive to download it
            try:
                with open(path, "rb") as fh:
                    fh.read(1)
            except Exception:
                pass
            result = subprocess.run(
                ["attrib", str(path)], capture_output=True, text=True
            )
            # 'O' flag means online-only (not downloaded)
            if " O " not in result.stdout and result.returncode == 0:
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


def wait_for_folder_download(folder: Path, timeout: int = 300) -> bool:
    """
    Wait until every file inside a folder is fully downloaded from OneDrive.
    Actively triggers downloads for any online-only placeholders found.
    Returns True when ready, False if timeout exceeded.
    """
    deadline = time.time() + timeout
    log(f"  Verifying all files in '{folder.name}' are fully synced...")
    while time.time() < deadline:
        try:
            all_files = list(folder.rglob("*"))
            all_files = [f for f in all_files if f.is_file()]

            # Check for any zero-byte files (OneDrive online-only placeholders)
            zero_byte = [f for f in all_files if f.stat().st_size == 0]
            if zero_byte:
                log(f"  Still waiting â€” {len(zero_byte)} file(s) not yet downloaded...")
                # Actively trigger OneDrive to download them
                trigger_onedrive_downloads(zero_byte)
                time.sleep(10)
                continue

            # Check for OneDrive 'O' attribute on any file using attrib /s
            result = subprocess.run(
                ["attrib", "/s", str(folder / "*")],
                capture_output=True, text=True, shell=True
            )
            if " O " in result.stdout:
                online_count = result.stdout.count(" O ")
                log(f"  Still waiting â€” {online_count} online-only file(s) not yet synced...")
                # Trigger downloads for any remaining online-only files
                online_files = [
                    Path(line[4:].strip()) for line in result.stdout.splitlines()
                    if " O " in line
                ]
                trigger_onedrive_downloads(online_files)
                time.sleep(10)
                continue

            # Verify total size is stable (nothing still being written)
            size1 = sum(f.stat().st_size for f in all_files)
            time.sleep(5)
            all_files2 = [f for f in folder.rglob("*") if f.is_file()]
            size2 = sum(f.stat().st_size for f in all_files2)
            if size1 == size2 and len(all_files) == len(all_files2):
                log(f"  Folder fully synced: {len(all_files)} files, {size1 // 1024}KB total.")
                return True
            log(f"  Size still changing ({size1} â†’ {size2}), waiting...")
            time.sleep(5)
        except Exception as e:
            log(f"  Error checking folder sync: {e}")
            time.sleep(10)
    log(f"  Timeout waiting for '{folder.name}' to fully sync. Skipping.")
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
             Ã¢â€ â€™ ("social-10", "historical")
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


# Ã¢â€â‚¬Ã¢â€â‚¬ HTML injection Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

SLIDESHOW_BLOCK = """\
  <section class="unit-section notes-slideshow" style="background: rgba(100,160,140,0.06);" data-slug="{slug}">
    <h2 class="unit-section__title">NOTES Ã¢â‚¬â€ {title}</h2>
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
    <h2 class="unit-section__title">NOTES &mdash; {title}</h2>
    <div class="kn-wrap" id="kn-{slug}">
      <div class="kn-controls">
        <label class="kn-label">Go to slide</label>
        <input class="kn-input" type="number" min="1" value="1" id="kn-input-{slug}">
        <button class="kn-btn" onclick="knGoTo('{slug}')">Go</button>
        <span class="kn-hint">Use Ã¢â€ Â Ã¢â€ â€™ keys inside the viewer to advance slides</span>
      </div>
      <div class="slide-viewer-iframe">
        <iframe src="{src}" id="kn-frame-{slug}" allowfullscreen loading="lazy"></iframe>
      </div>
    </div>
  </section>"""

KN_NAV_JS = """\
<script>
(function() {
  function knStep(frame, forward) {
    try {
      var doc = frame.contentDocument || frame.contentWindow.document;
      if (forward) {
        var stage = doc.getElementById('stage') || doc.getElementById('stageArea') || doc.body;
        stage.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, view: frame.contentWindow}));
      } else {
        var opts = {key: 'ArrowLeft', keyCode: 37, which: 37, bubbles: true, cancelable: true};
        doc.dispatchEvent(new KeyboardEvent('keydown', opts));
        doc.dispatchEvent(new KeyboardEvent('keyup', opts));
      }
    } catch(e) {}
  }
  function knNavigateTo(slug, target) {
    var frame = document.getElementById('kn-frame-' + slug);
    if (!frame) return;
    var tile = frame.closest('[data-slug]');
    var current = tile ? parseInt(tile.dataset.slide || '1', 10) : 1;
    var delta = target - current;
    if (delta === 0) return;
    var forward = delta > 0;
    var steps = Math.abs(delta);
    var i = 0;
    var interval = setInterval(function() {
      if (i >= steps) {
        clearInterval(interval);
        if (tile) tile.dataset.slide = target;
        var cur = document.getElementById('kn-cur-' + slug);
        if (cur) cur.textContent = target;
        var scrubber = tile ? tile.querySelector('.kn-scrubber') : null;
        if (scrubber) scrubber.value = target;
        return;
      }
      knStep(frame, forward);
      i++;
    }, 350);
  }
  window.knGoTo = function(slug) {
    var input = document.getElementById('kn-input-' + slug);
    if (!input) return;
    var target = parseInt(input.value, 10);
    if (isNaN(target) || target < 1) return;
    knNavigateTo(slug, target);
  };
  window.knScrub = function(rangeEl, slug) {
    var target = parseInt(rangeEl.value, 10);
    var input = document.getElementById('kn-input-' + slug);
    if (input) input.value = target;
    knNavigateTo(slug, target);
  };
})();
</script>"""

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

def inject_into_html(html_path: Path, new_section: str, slug: str) -> bool:
    """Inject the new section into the unit page before the footer.
    If a section with the same slug already exists, replace it.
    Returns True if injection/replacement happened, False on error."""
    if not html_path.exists():
        log(f"  HTML not found: {html_path}")
        return False

    content = html_path.read_text(encoding="utf-8")

    # If slug already present, strip the old section out and re-inject fresh
    if f'data-slug="{slug}"' in content:
        log(f"  Slug '{slug}' exists Ã¢â‚¬â€ replacing with updated version.")
        # Remove the old section: from its opening <section to the matching </section>
        import re as _re
        pattern = rf'<section[^>]*data-slug="{_re.escape(slug)}"[^>]*>.*?</section>'
        content = _re.sub(pattern, "", content, flags=_re.DOTALL).strip()
        content += "\n"  # ensure clean trailing newline

    # Insert before the closing </div> of .page-content
    # We look for the footer as the reliable anchor
    anchor = "<footer"
    if anchor not in content:
        log(f"  Could not find insertion anchor in {html_path}")
        return False

    idx = content.index(anchor)
    # Add slideshow JS if not already there (PPTX viewer)
    if "window.slidePrev" not in content and "slide-viewer__track" in new_section:
        new_section = new_section + "\n" + SLIDESHOW_JS
    # Add Keynote nav JS if not already there (iframe viewer)
    if "window.knGoTo" not in content and "kn-frame-" in new_section:
        new_section = new_section + "\n" + KN_NAV_JS

    content = content[:idx] + new_section + "\n\n  " + content[idx:]
    html_path.write_text(content, encoding="utf-8")
    log(f"  Injected into {html_path}")
    return True


def git_commit_and_push(message: str):
    """Stage all changes, commit, and push to origin."""
    try:
        log("  Running git add -A ...")
        subprocess.run(["git", "-C", str(SITE_DIR), "add", "-A"], check=True)
        log(f"  Committing: {message}")
        subprocess.run(["git", "-C", str(SITE_DIR), "commit", "-m", message], check=True)
        log("  Pushing to origin...")
        subprocess.run(["git", "-C", str(SITE_DIR), "push"], check=True)
        log("  Ã¢Å“â€¦ Published to Vercel via git push.")
    except subprocess.CalledProcessError as e:
        log(f"  Ã¢Å¡Â Ã¯Â¸Â  git error: {e}")


# Ã¢â€â‚¬Ã¢â€â‚¬ Processors Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

def process_pptx(src: Path, course: str, unit: str, original_name: str = None):
    title = original_name or Path(src).stem
    slug  = slugify(title)
    dest  = slides_dest_dir(course, unit, slug)
    dest.mkdir(parents=True, exist_ok=True)

    if not Path(LIBREOFFICE_PATH).exists():
        log(f"  LibreOffice not found at {LIBREOFFICE_PATH}. Skipping .pptx conversion.")
        log(f"  Install LibreOffice and re-drop the file to process it.")
        return

    log(f"  Converting {src.name} with LibreOffice Ã¢â€ â€™ PDF...")
    pdf_dir = dest / "_pdf"
    pdf_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        LIBREOFFICE_PATH, "--headless", "--convert-to", "pdf",
        "--outdir", str(pdf_dir), str(src)
    ], check=True)

    pdf_files = list(pdf_dir.glob("*.pdf"))
    if not pdf_files:
        log(f"  No PDF produced from {src.name}")
        return

    log(f"  Converting PDF to slide images...")
    POPPLER_PATH = str(Path(__file__).parent / "poppler" / "poppler-24.08.0" / "Library" / "bin")
    from pdf2image import convert_from_path
    pages = convert_from_path(str(pdf_files[0]), dpi=150, poppler_path=POPPLER_PATH)
    for i, page in enumerate(pages):
        page.save(str(dest / f"slide_{i+1:03d}.png"), "PNG")
    shutil.rmtree(pdf_dir)  # clean up intermediate PDF

    slides = sorted(dest.glob("slide_*.png"))
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

    # Wait until ALL files in the Keynote export are fully downloaded from OneDrive
    if not wait_for_folder_download(src_dir):
        log(f"  Aborting '{title}' Ã¢â‚¬â€ folder never fully synced.")
        return

    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(src_dir, dest)
    log(f"  Copied Keynote HTML to {dest}")

    # Find the entry HTML file
    entry = next((f for f in dest.rglob("*.html")), None)
    if not entry:
        log("  No HTML entry found in Keynote export.")
        return

    # Inject no-animation CSS override into the Keynote player
    no_anim = '<style>*,*::before,*::after{animation-duration:0.001ms!important;animation-delay:0ms!important;transition-duration:0.001ms!important;}</style>'
    html = entry.read_text(encoding="utf-8")
    if "animation-duration:0.001ms" not in html:
        html = html.replace("</head>", f"{no_anim}</head>")
        entry.write_text(html, encoding="utf-8")
        log(f"  Disabled animations in {entry.name}")

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
        ts = int(time.time())
        suffix = src.suffix if src.is_file() else ""
        dest = dest_dir / (src.stem + f"_{ts}" + suffix)
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

    injected = False
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
        injected = True
    elif suffix == ".txt":
        process_icloud_link(path, course, unit)
        archive(path, course, unit)
        injected = True
    elif path.is_dir():
        # Check if it's a Keynote HTML export (contains an .html file)
        if any(path.rglob("*.html")):
            process_keynote_html(path, course, unit)
            archive(path, course, unit)
            injected = True
    else:
        log(f"  Unsupported file type: {suffix} Ã¢â‚¬â€ ignoring.")

    if injected:
        title = path.stem if path.is_file() else path.name
        git_commit_and_push(f"feat: auto-publish '{title}' to {course}/{unit}")


# Ã¢â€â‚¬Ã¢â€â‚¬ Watcher Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

import threading

# Debounce table: unit_key Ã¢â€ â€™ (timer, candidate_path)
_pending = {}
_pending_lock = threading.Lock()
DEBOUNCE_SECONDS = 30  # wait this long after last activity before dispatching


def _debounce_dispatch(unit_key: str, candidate: Path):
    """Called after DEBOUNCE_SECONDS of quiet. Find the best thing to dispatch."""
    with _pending_lock:
        if unit_key not in _pending:
            return
        del _pending[unit_key]

    # candidate is the path that triggered us Ã¢â‚¬â€ walk up to find a dispatchable item
    # For Keynote exports, the top-level folder inside the unit is what we want
    info = parse_unit_path(candidate)
    if not info:
        return
    course, unit = info

    unit_dir = DROPZONE_DIR / course / unit

    # 1. Look for a Keynote HTML folder (a dir containing .html files, not _processed)
    for d in unit_dir.iterdir():
        if d.is_dir() and d.name != "_processed" and any(d.rglob("*.html")):
            log(f"[debounced] Dispatching Keynote folder: {d}")
            dispatch(d)
            return

    # 2. Look for a .pptx
    for f in unit_dir.glob("*.pptx"):
        log(f"[debounced] Dispatching PPTX: {f}")
        dispatch(f)
        return

    # 3. Look for a .txt iCloud link
    for f in unit_dir.glob("*.txt"):
        log(f"[debounced] Dispatching iCloud link: {f}")
        dispatch(f)
        return


class DropzoneHandler(FileSystemEventHandler):
    def _schedule(self, path: Path):
        info = parse_unit_path(path)
        if not info:
            return
        course, unit = info
        if "_processed" in path.parts:
            return

        unit_key = f"{course}/{unit}"
        with _pending_lock:
            # Cancel any existing timer for this unit
            if unit_key in _pending:
                _pending[unit_key][0].cancel()
            t = threading.Timer(DEBOUNCE_SECONDS, _debounce_dispatch, args=[unit_key, path])
            _pending[unit_key] = (t, path)
            t.start()
            log(f"  Activity in {unit_key} Ã¢â‚¬â€ waiting {DEBOUNCE_SECONDS}s for sync to settle...")

    def on_created(self, event):
        self._schedule(Path(event.src_path))

    def on_moved(self, event):
        self._schedule(Path(event.dest_path))



def startup_scan():
    """
    Scan the entire dropzone on startup for any files that arrived while the
    watcher was offline. Dispatches them immediately.
    """
    log("Scanning dropzone for existing unprocessed files...")
    found = 0
    for course_dir in DROPZONE_DIR.iterdir():
        if not course_dir.is_dir():
            continue
        course = course_dir.name.lower().replace(" ", "-")
        for unit_dir in course_dir.iterdir():
            if not unit_dir.is_dir() or unit_dir.name == "_processed":
                continue

            # PPTX files
            for f in unit_dir.glob("*.pptx"):
                log(f"[startup] Found PPTX: {f.name} in {course}/{unit_dir.name}")
                threading.Thread(target=dispatch, args=[f], daemon=True).start()
                found += 1

            # Keynote HTML export folders
            for d in unit_dir.iterdir():
                if d.is_dir() and d.name != "_processed" and any(d.rglob("*.html")):
                    log(f"[startup] Found Keynote folder: {d.name} in {course}/{unit_dir.name}")
                    threading.Thread(target=dispatch, args=[d], daemon=True).start()
                    found += 1

            # iCloud .txt links
            for f in unit_dir.glob("*.txt"):
                log(f"[startup] Found iCloud link: {f.name} in {course}/{unit_dir.name}")
                threading.Thread(target=dispatch, args=[f], daemon=True).start()
                found += 1

    log(f"Startup scan complete - dispatched {found} item(s) in background threads.")

if __name__ == "__main__":
    ASSETS_SLIDES.mkdir(parents=True, exist_ok=True)
    log(f"Watching: {DROPZONE_DIR}")
    log(f"Debounce window: {DEBOUNCE_SECONDS}s Ã¢â‚¬â€ dispatches {DEBOUNCE_SECONDS}s after last file activity.")
    log("Drop a .pptx, Keynote HTML folder, or .txt iCloud link into a unit subfolder.")

    # Process anything that arrived while watcher was offline
    startup_scan()

    observer = Observer()
    observer.schedule(DropzoneHandler(), str(DROPZONE_DIR), recursive=True)
    observer.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
