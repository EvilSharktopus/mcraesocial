# update_nav.ps1 (v2)
# Uses regex to replace the old Workbooks dropdown with logo links across all HTML files.

$root = "C:\Users\Owner\Desktop\mcraesocial"

# Get all HTML files, excluding mcrae-submit and node_modules
$files = Get-ChildItem -Path $root -Recurse -Include "*.html" |
    Where-Object { $_.FullName -notmatch '\\mcrae-submit\\' -and $_.FullName -notmatch '\\node_modules\\' }

# Regex pattern: matches the old Workbooks dropdown <li> block (flexible whitespace)
$oldPattern = '(?s)<li class="site-nav__dropdown">\r?\n\s+<span class="site-nav__link" style="cursor: pointer;">Workbooks &#x25BE;</span>\r?\n\s+<div class="site-nav__dropdown-menu">\r?\n\s+<a href="https://mcraesocial\.vercel\.app/workbooks/10-2" class="site-nav__dropdown-item" target="_blank">10-2 Digital Workbook</a>\r?\n\s+</div>\r?\n\s+</li>'

# New Workbooks + Desk logo links
$newLinks = @'
        <li>
          <a href="https://mcraesocial.vercel.app/workbooks/10-2" class="site-nav__link site-nav__link--logo" target="_blank" aria-label="McRae's Workbooks">
            <picture>
              <source srcset="/assets/images/workbooks-logo.webp" type="image/webp">
              <img src="/assets/images/workbooks-logo.jpg" alt="McRae's Workbooks" class="site-nav__inline-logo" width="2065" height="753" loading="eager">
            </picture>
          </a>
        </li>
        <li>
          <a href="https://desk.mcraesocial.com/" class="site-nav__link site-nav__link--logo" target="_blank" aria-label="Desk">
            <img src="/assets/images/DESK.png" alt="Desk" class="site-nav__inline-logo" loading="eager">
          </a>
        </li>
'@

# Also remove the old Home link (with flexible whitespace)
$oldHomePattern = '\s*<li><a href="/" class="site-nav__link">Home</a></li>'

$updatedCount = 0
$skippedCount = 0

foreach ($file in $files) {
    # Skip the home page (index.html at root) — already updated
    if ($file.FullName -eq "$root\index.html") {
        Write-Host "SKIP (home): $($file.FullName)"
        $skippedCount++
        continue
    }

    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    $content = [System.Text.Encoding]::UTF8.GetString($bytes)
    $original = $content

    # 1. Remove the "Home" text link
    $content = [regex]::Replace($content, $oldHomePattern, '')

    # 2. Replace old Workbooks dropdown with new logo links
    $content = [regex]::Replace($content, $oldPattern, $newLinks)

    if ($content -ne $original) {
        $newBytes = [System.Text.Encoding]::UTF8.GetBytes($content)
        [System.IO.File]::WriteAllBytes($file.FullName, $newBytes)
        Write-Host "UPDATED: $($file.FullName)"
        $updatedCount++
    } else {
        Write-Host "NO CHANGE: $($file.FullName)"
        $skippedCount++
    }
}

Write-Host ""
Write-Host "Done. Updated: $updatedCount files. Skipped/unchanged: $skippedCount files."
