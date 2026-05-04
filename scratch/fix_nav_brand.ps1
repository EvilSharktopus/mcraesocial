$root = 'C:\Users\Owner\Desktop\mcraesocial'
$old  = '<a href="/" class="site-nav__brand"><img src="/assets/images/logo.png" alt="McRae Social Studies" class="site-nav__logo"></a>'
$new  = '<a href="/" class="site-nav__brand">McRae''s Social Studies</a>'

Get-ChildItem -Path $root -Recurse -Filter 'index.html' | ForEach-Object {
  $content = [System.IO.File]::ReadAllText($_.FullName, [System.Text.Encoding]::UTF8)
  if ($content -match [regex]::Escape($old)) {
    $content = $content.Replace($old, $new)
    [System.IO.File]::WriteAllText($_.FullName, $content, [System.Text.Encoding]::UTF8)
    Write-Host "FIXED: $($_.FullName)"
  }
}
Write-Host "Done."
