$root = 'C:\Users\Owner\Desktop\mcraesocial'
$unitPages = @(
  'social-9\ccrf', 'social-9\collective-rights', 'social-9\consumerism',
  'social-9\economics', 'social-9\federal-political-systems', 'social-9\immigration',
  'social-9\mock-election', 'social-9\pat-prep', 'social-9\textbook', 'social-9\ycja',
  'social-10\global-citizenship', 'social-10\historical', 'social-10\identity', 'social-10\modern-globalization',
  'social-20\challenges-to-canada', 'social-20\contending-loyalties', 'social-20\create-a-country',
  'social-20\factors-of-nationalism', 'social-20\internationalism', 'social-20\model-un',
  'social-20\national-interest', 'social-20\ultranationalism',
  'social-30\democracy', 'social-30\dictatorships', 'social-30\economics',
  'social-30\illiberalism', 'social-30\imposition', 'social-30\intro-to-ideologies'
)

$widgetDiv = '    <div id="submit-widget"></div>'
$cssLink   = '  <link rel="stylesheet" href="/css/submit-badge.css">'
$scriptTag = '  <script src="/assets/js/submit-widget.js"></script>'

foreach ($page in $unitPages) {
  $file = "$root\$page\index.html"

  if (-not (Test-Path $file)) { Write-Host "SKIP (not found): $file"; continue }

  $content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

  if ($content -match 'submit-widget') { Write-Host "ALREADY DONE: $page"; continue }

  $content = $content -replace '(<h2 class="unit-section__title">ASSIGNMENTS</h2>)', "`$1`n$widgetDiv"
  $content = $content -replace '(</head>)', "$cssLink`n`$1"
  $content = $content -replace '(</body>)', "$scriptTag`n`$1"

  [System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
  Write-Host "PATCHED: $page"
}
Write-Host "Done."
