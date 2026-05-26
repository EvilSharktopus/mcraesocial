$files = Get-ChildItem -Path "assets\slides" -Recurse -File
$files | Sort-Object Length -Descending | Select-Object -First 20 | ForEach-Object {
    $mb = [math]::Round($_.Length / 1MB, 2)
    Write-Host "$mb MB  $($_.FullName.Replace((Get-Location).Path + '\', ''))"
}
