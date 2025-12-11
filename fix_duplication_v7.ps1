$path = ".\game_v2.html"
if (-not (Test-Path $path)) {
    Write-Error "File not found: $path"
    exit 1
}
$lines = Get-Content $path -Encoding UTF8
$newLines = $lines[0..950] + $lines[1153..($lines.Count-1)]
Set-Content $path -Value $newLines -Encoding UTF8
