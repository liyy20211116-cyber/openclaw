param(
  [Parameter(Mandatory = $true)]
  [string]$SourcePath,

  [string]$OutputStem,

  [switch]$Overwrite
)

$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$inboxDir = Join-Path $workspaceRoot "workspace\libreoffice_safe\inbox"
$pdfDir = Join-Path $workspaceRoot "workspace\libreoffice_safe\pdf"
$tmpRoot = Join-Path $workspaceRoot "workspace\libreoffice_safe\tmp"
$profileDir = Join-Path $workspaceRoot "workspace\libreoffice_safe\profile"

$allowedExtensions = @(
  ".doc", ".docx", ".odt", ".rtf", ".txt",
  ".ppt", ".pptx", ".odp",
  ".xls", ".xlsx", ".ods"
)

function Write-JsonAndExit {
  param(
    [hashtable]$Payload,
    [int]$ExitCode = 0
  )

  $Payload["timestamp"] = (Get-Date).ToString("s")
  $Payload | ConvertTo-Json -Depth 6
  exit $ExitCode
}

function Resolve-SofficePath {
  $cmd = Get-Command soffice -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) {
    return $cmd.Source
  }

  $candidates = @(
    "C:\Program Files\LibreOffice\program\soffice.exe",
    "C:\Program Files (x86)\LibreOffice\program\soffice.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return $null
}

function Get-NormalizedPath {
  param([string]$PathValue)
  return [System.IO.Path]::GetFullPath($PathValue)
}

function Test-IsUnderDirectory {
  param(
    [string]$ParentDir,
    [string]$TargetPath
  )

  $parent = (Get-NormalizedPath $ParentDir).TrimEnd('\\') + '\\'
  $target = Get-NormalizedPath $TargetPath
  return $target.StartsWith($parent, [System.StringComparison]::OrdinalIgnoreCase)
}

function Get-SafeStem {
  param([string]$RawStem)

  if ([string]::IsNullOrWhiteSpace($RawStem)) {
    return $null
  }

  $safe = $RawStem.Trim()
  $safe = [System.Text.RegularExpressions.Regex]::Replace($safe, "[^A-Za-z0-9._-]", "_")
  $safe = $safe.Trim(".")
  if ([string]::IsNullOrWhiteSpace($safe)) {
    return $null
  }

  return $safe
}

try {
  New-Item -ItemType Directory -Force -Path $inboxDir, $pdfDir, $tmpRoot, $profileDir | Out-Null

  $sofficePath = Resolve-SofficePath
  if (-not $sofficePath) {
    Write-JsonAndExit -Payload @{
      ok = $false
      code = "soffice_not_found"
      message = "LibreOffice is not installed, or soffice.exe is not on PATH or in a common install path."
      expectedPaths = @(
        "C:\Program Files\LibreOffice\program\soffice.exe",
        "C:\Program Files (x86)\LibreOffice\program\soffice.exe"
      )
    } -ExitCode 2
  }

  $resolvedSource = Get-NormalizedPath $SourcePath
  if (-not (Test-Path $resolvedSource -PathType Leaf)) {
    Write-JsonAndExit -Payload @{
      ok = $false
      code = "source_not_found"
      message = "Source file was not found."
      source = $resolvedSource
      inbox = $inboxDir
    } -ExitCode 3
  }

  if (-not (Test-IsUnderDirectory -ParentDir $inboxDir -TargetPath $resolvedSource)) {
    Write-JsonAndExit -Payload @{
      ok = $false
      code = "source_outside_inbox"
      message = "For safety, only files inside the inbox directory can be converted."
      source = $resolvedSource
      inbox = $inboxDir
    } -ExitCode 4
  }

  $sourceExt = [System.IO.Path]::GetExtension($resolvedSource).ToLowerInvariant()
  if ($allowedExtensions -notcontains $sourceExt) {
    Write-JsonAndExit -Payload @{
      ok = $false
      code = "unsupported_extension"
      message = "File extension is not allowed."
      source = $resolvedSource
      extension = $sourceExt
      allowedExtensions = $allowedExtensions
    } -ExitCode 5
  }

  $safeStem = Get-SafeStem $OutputStem
  if (-not $safeStem) {
    $safeStem = Get-SafeStem ([System.IO.Path]::GetFileNameWithoutExtension($resolvedSource))
  }
  if (-not $safeStem) {
    Write-JsonAndExit -Payload @{
      ok = $false
      code = "invalid_output_stem"
      message = "Could not produce a safe output file name."
      source = $resolvedSource
    } -ExitCode 6
  }

  $targetPdf = Join-Path $pdfDir ($safeStem + ".pdf")
  if ((Test-Path $targetPdf) -and (-not $Overwrite)) {
    Write-JsonAndExit -Payload @{
      ok = $false
      code = "target_exists"
      message = "Target PDF already exists. Pass -Overwrite to replace it."
      output = $targetPdf
    } -ExitCode 7
  }

  $jobDir = Join-Path $tmpRoot ("job_" + (Get-Date -Format "yyyyMMdd_HHmmss") + "_" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Force -Path $jobDir | Out-Null

  $jobSource = Join-Path $jobDir ($safeStem + $sourceExt)
  Copy-Item -LiteralPath $resolvedSource -Destination $jobSource -Force

  $profileUri = ([System.Uri]$profileDir).AbsoluteUri
  $args = @(
    "--headless",
    "--nologo",
    "--nodefault",
    "--nofirststartwizard",
    ("-env:UserInstallation=" + $profileUri),
    "--convert-to",
    "pdf",
    "--outdir",
    $jobDir,
    $jobSource
  )

  & $sofficePath @args | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-JsonAndExit -Payload @{
      ok = $false
      code = "convert_failed"
      message = "LibreOffice conversion failed."
      source = $resolvedSource
      soffice = $sofficePath
      exitCode = $LASTEXITCODE
    } -ExitCode 8
  }

  $producedPdf = Join-Path $jobDir ($safeStem + ".pdf")
  if (-not (Test-Path $producedPdf -PathType Leaf)) {
    Write-JsonAndExit -Payload @{
      ok = $false
      code = "pdf_missing"
      message = "Conversion finished but no PDF output was produced."
      source = $resolvedSource
      expectedOutput = $producedPdf
    } -ExitCode 9
  }

  if (Test-Path $targetPdf) {
    Remove-Item -LiteralPath $targetPdf -Force
  }
  Move-Item -LiteralPath $producedPdf -Destination $targetPdf -Force

  $pdfItem = Get-Item -LiteralPath $targetPdf
  Write-JsonAndExit -Payload @{
    ok = $true
    code = "ok"
    message = "PDF export completed successfully."
    source = $resolvedSource
    output = $targetPdf
    bytes = $pdfItem.Length
    soffice = $sofficePath
    inbox = $inboxDir
  }
} catch {
  Write-JsonAndExit -Payload @{
    ok = $false
    code = "unexpected_error"
    message = $_.Exception.Message
    source = $SourcePath
  } -ExitCode 10
}
