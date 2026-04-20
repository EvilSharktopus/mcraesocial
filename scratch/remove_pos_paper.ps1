$file = 'C:\Users\Owner\Desktop\mcraesocial\social-10\historical\index.html'
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

# Remove the Position Paper assignment-block using regex
$pattern = '(?s)\s*<div class="assignment-block">\s*<div class="assignment-block__label">Position Paper</div>.*?</div>\s*</div>'
$content = [regex]::Replace($content, $pattern, '')

[System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
Write-Host 'Done'
