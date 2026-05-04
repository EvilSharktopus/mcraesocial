import shutil
from pathlib import Path

DROPZONE = Path(r"C:\Users\Owner\OneDrive - Rocky View Schools\McRae Dropzone")

files_to_restore = [
    "social-10/historical/_processed/Slave Trade.pptx",
    "social-10/identity/_processed/Trade and Containers",
    "social-10/modern-globalization/_processed/Econ Global.pptx",
    "social-30/democracy/_processed/Democracy",
    "social-30/dictatorships/_processed/Fascism",
    "social-30/dictatorships/_processed/Intro Dictators",
    "social-30/economics/_processed/Econ Part 1",
    "social-30/economics/_processed/Econ Part 2",
    "social-30/illiberalism/_processed/Liberalism in Action",
    "social-30/imposition/_processed/Cold War Intro.pptx",
    "social-30/imposition/_processed/Brinkmanship",
    "social-30/imposition/_processed/End of Cold War",
    "social-30/intro-to-ideologies/_processed/Philosophers",
]

for f in files_to_restore:
    src = DROPZONE / f
    if src.exists():
        dest = src.parent.parent / src.name
        if dest.exists():
            if dest.is_dir():
                shutil.rmtree(dest)
            else:
                dest.unlink()
        print(f"Restoring {src.name} to {dest.parent.name}")
        shutil.move(str(src), str(dest))
    else:
        print(f"Not found: {src}")

print("Done restoring files.")
