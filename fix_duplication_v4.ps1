$path = 'd:\遊戲\arpg\game_v2.html'
$lines = Get-Content $path -Encoding UTF8
$newLines = $lines[0..950] + $lines[1153..($lines.Count-1)]
Set-Content $path -Value $newLines -Encoding UTF8
