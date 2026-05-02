$desktopLink = Get-ChildItem -LiteralPath 'C:\Users\Lenovo\Desktop' -Filter 'OpenClaw*.lnk' | Select-Object -First 1
if (-not $desktopLink) {
  throw 'Desktop OpenClaw shortcut not found'
}

$launcher = Get-ChildItem -LiteralPath 'D:\FY003' -Filter 'OpenClaw*.bat' |
  Where-Object { $_.Name -notlike '*Reauth*' -and $_.Name -notlike '*重新登录*' -and $_.Name -notlike '*Console*' } |
  Select-Object -First 1
if (-not $launcher) {
  throw 'Root OpenClaw launcher not found'
}

$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($desktopLink.FullName)
$icon = $sc.IconLocation
if (-not $icon -or $icon -eq ',0') {
  $icon = 'D:\FY003\assets\openclaw_crayfish_icon.ico,0'
}

$sc.TargetPath = 'C:\Windows\System32\cmd.exe'
$sc.Arguments = ('/c start "" "{0}"' -f $launcher.FullName)
$sc.WorkingDirectory = 'D:\FY003'
$sc.IconLocation = $icon
$sc.Description = 'OpenClaw Console'
$sc.Save()

[PSCustomObject]@{
  FullName = $desktopLink.FullName
  TargetPath = $sc.TargetPath
  Arguments = $sc.Arguments
  WorkingDirectory = $sc.WorkingDirectory
  IconLocation = $sc.IconLocation
} | ConvertTo-Json -Compress
