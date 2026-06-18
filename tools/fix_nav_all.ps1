$files = Get-ChildItem -Path '.' -Filter 'index.html' -Recurse | Where-Object { $_.FullName -notlike '*node_modules*' -and $_.FullName -notlike '*mcrae-submit*' }
foreach ($f in $files) {
    $c = Get-Content $f.FullName -Raw
    $old = '<a href="/social-10/global-citizenship/" class="site-nav__dropdown-item">Global Citizenship</a>'
    $new = $old + "`n            " + '<a href="/social-10/socratic-seminars/" class="site-nav__dropdown-item">Socratic Seminars</a>'
    if ($c.Contains($old) -and -not $c.Contains('socratic-seminars/" class="site-nav__dropdown-item"')) {
        $c = $c.Replace($old, $new)
        Set-Content $f.FullName $c -NoNewline
        Write-Host "Updated: $($f.FullName)"
    } else {
        Write-Host "Skipped: $($f.FullName)"
    }
}
