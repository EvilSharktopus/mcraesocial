$files = Get-ChildItem -Path "assets/slides" -Recurse -File
$sum = ($files | Measure-Object -Property Length -Sum).Sum
$mb = [math]::Round($sum / 1MB, 1)
Write-Host "Slide files: $($files.Count)"
Write-Host "Total size: $mb MB"

# Also show top-level course breakdown
$files | Group-Object { $_.DirectoryName.Split("\")[-3] } | Sort-Object Count -Descending | ForEach-Object {
    Write-Host "  $($_.Name): $($_.Count) files"
}
