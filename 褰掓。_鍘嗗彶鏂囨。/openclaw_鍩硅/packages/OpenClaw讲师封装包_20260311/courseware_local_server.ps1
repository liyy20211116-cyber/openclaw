param(
  [Parameter(Mandatory = $true)]
  [string]$RootPath,
  [int]$Port = 8019
)

$ErrorActionPreference = "Stop"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $requestPath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($requestPath)) {
      $requestPath = "openclaw-feishu-training.html"
    }

    $filePath = Join-Path $RootPath $requestPath
    if (Test-Path $filePath -PathType Leaf) {
      $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
      $contentType = switch ($extension) {
        ".html" { "text/html; charset=utf-8" }
        ".txt" { "text/plain; charset=utf-8" }
        ".md" { "text/plain; charset=utf-8" }
        ".json5" { "application/json; charset=utf-8" }
        ".png" { "image/png" }
        ".ico" { "image/x-icon" }
        default { "application/octet-stream" }
      }

      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $context.Response.StatusCode = 200
      $context.Response.ContentType = $contentType
      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $notFound = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
      $context.Response.StatusCode = 404
      $context.Response.ContentType = "text/plain; charset=utf-8"
      $context.Response.ContentLength64 = $notFound.Length
      $context.Response.OutputStream.Write($notFound, 0, $notFound.Length)
    }

    $context.Response.OutputStream.Close()
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
