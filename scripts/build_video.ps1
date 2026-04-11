$ErrorActionPreference = "Stop"

$root = "D:\FY003"
$today = Get-Date -Format "yyyyMMdd"
$outDir = Join-Path $root "output"
$scriptFile = Join-Path $outDir ("script_today_" + $today + ".txt")
$bundleDir = Join-Path $outDir ("publish_bundle_" + $today)
$vttFile = Join-Path $bundleDir "subtitles.vtt"
$videoOut = Join-Path $bundleDir ("finance_brief_" + $today + ".mp4")
$audioOut = Join-Path $bundleDir ("voice_" + $today + ".wav")

function Find-FFmpeg {
  $cmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
  if ($null -ne $cmd) { return $cmd.Source }

  $candidates = @(
    "D:\ffmpeg\bin\ffmpeg.exe",
    "D:\tools\ffmpeg\bin\ffmpeg.exe",
    "C:\ffmpeg\bin\ffmpeg.exe",
    "C:\Program Files\ffmpeg\bin\ffmpeg.exe",
    "C:\ProgramData\chocolatey\bin\ffmpeg.exe"
  )
  foreach ($path in $candidates) {
    if (Test-Path $path) { return $path }
  }
  return $null
}

function Find-FFprobe([string]$ffmpegPath) {
  if ([string]::IsNullOrWhiteSpace($ffmpegPath)) { return $null }
  $candidate = Join-Path (Split-Path $ffmpegPath -Parent) "ffprobe.exe"
  if (Test-Path $candidate) { return $candidate }
  $cmd = Get-Command ffprobe -ErrorAction SilentlyContinue
  if ($null -ne $cmd) { return $cmd.Source }
  return $null
}

function New-TtsAudio([string[]]$textLines, [string]$wavPath) {
  try {
    Add-Type -AssemblyName System.Speech -ErrorAction Stop
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $synth.Rate = 0
    $synth.Volume = 100
    $synth.SetOutputToWaveFile($wavPath)
    foreach ($line in $textLines) {
      if (-not [string]::IsNullOrWhiteSpace($line)) {
        $synth.Speak($line)
      }
    }
    $synth.Dispose()
    return (Test-Path $wavPath)
  } catch {
    return $false
  }
}

if (!(Test-Path $scriptFile)) {
  throw "Not found script file: $scriptFile"
}

New-Item -ItemType Directory -Path $bundleDir -Force | Out-Null
Copy-Item $scriptFile (Join-Path $bundleDir "script.txt") -Force

# Build subtitle file from script lines.
$lines = Get-Content -Path $scriptFile -Encoding UTF8 | Where-Object { $_.Trim() -ne "" }
$vtt = @("WEBVTT", "")
$startSec = 0
foreach ($line in $lines) {
  $endSec = $startSec + 3
  $start = [TimeSpan]::FromSeconds($startSec).ToString("hh\:mm\:ss") + ".000"
  $end = [TimeSpan]::FromSeconds($endSec).ToString("hh\:mm\:ss") + ".000"
  $vtt += "$start --> $end"
  $vtt += $line
  $vtt += ""
  $startSec = $endSec
}
$vtt | Set-Content -Path $vttFile -Encoding UTF8

# Build local TTS wav by Windows Speech API when available.
$hasAudio = New-TtsAudio -textLines $lines -wavPath $audioOut
if ($hasAudio) {
  Write-Host "[OK] TTS audio generated: $audioOut"
} else {
  Write-Host "[WARN] TTS audio unavailable, continue without voice."
}

# Try ffmpeg: generate simple vertical video with subtitles and optional audio.
$ffmpegPath = Find-FFmpeg
if ($null -ne $ffmpegPath) {
  $duration = [Math]::Max($startSec, 6)
  if ($hasAudio) {
    $ffprobePath = Find-FFprobe -ffmpegPath $ffmpegPath
    if ($null -ne $ffprobePath) {
      $probeArgs = @("-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",$audioOut)
      $audioDur = & $ffprobePath @probeArgs 2>$null
      if ($audioDur) {
        $duration = [Math]::Max([int][Math]::Ceiling([double]$audioDur), 6)
      }
    }
  }
  $subPath = $vttFile.Replace("\", "/").Replace(":", "\:")
  $vf = "subtitles='$subPath':force_style='FontName=Microsoft YaHei,FontSize=28,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2,Shadow=0,Alignment=2'"
  if ($hasAudio) {
    & $ffmpegPath -y `
      -f lavfi -i "color=c=black:s=1080x1920:d=$duration" `
      -i $audioOut `
      -vf $vf `
      -c:v libx264 -pix_fmt yuv420p `
      -c:a aac -b:a 128k -shortest `
      $videoOut | Out-Null
  } else {
    & $ffmpegPath -y `
      -f lavfi -i "color=c=black:s=1080x1920:d=$duration" `
      -vf $vf `
      -c:v libx264 -pix_fmt yuv420p `
      $videoOut | Out-Null
  }
  if (Test-Path $videoOut) {
    Write-Host "[OK] Video generated: $videoOut"
  } else {
    Write-Host "[WARN] ffmpeg ran but video not found: $videoOut"
  }
} else {
  @(
    "ffmpeg not found, skip video rendering.",
    "Install ffmpeg and rerun this script.",
    "Script bundle is ready in: $bundleDir"
  ) | Set-Content -Path (Join-Path $bundleDir "video_todo.txt") -Encoding UTF8
  Write-Host "[WARN] ffmpeg not found. Bundle generated only: $bundleDir"
}

Write-Host "[OK] Build video step done."
