$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$pythonScript = Join-Path $root "scripts\build_trainer_package.py"

$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if ($null -eq $pythonCmd) {
  throw "python command not found."
}

& $pythonCmd.Source $pythonScript
exit $LASTEXITCODE
