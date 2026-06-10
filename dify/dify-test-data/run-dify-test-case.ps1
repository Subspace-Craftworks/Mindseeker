param(
  [Parameter(Mandatory = $true)]
  [string]$DataFile
)

$resolvedDataFile = Resolve-Path $DataFile
$testCase = Get-Content -Raw -Encoding utf8 $resolvedDataFile | ConvertFrom-Json

if (-not $testCase.method -or -not $testCase.path) {
  throw "The data file must contain 'method' and 'path' fields."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$secretPath = Join-Path $repoRoot '.secrets\api-key'
if (-not (Test-Path $secretPath)) {
  throw "Missing Dify API key file: $secretPath"
}

$difyApiKey = (Get-Content -Raw -Encoding utf8 $secretPath).Trim()
if (-not $difyApiKey) {
  throw "The Dify API key file is empty."
}

$baseUrl = 'https://api.dify.ai/v1'
$method = [string]$testCase.method
$path = [string]$testCase.path
$url = "$baseUrl$path"

if ($testCase.query) {
  $queryParts = @()
  foreach ($prop in $testCase.query.PSObject.Properties) {
    if ($null -eq $prop.Value -or [string]$prop.Value -eq '') {
      continue
    }
    $queryParts += ('{0}={1}' -f [uri]::EscapeDataString($prop.Name), [uri]::EscapeDataString([string]$prop.Value))
  }
  if ($queryParts.Count -gt 0) {
    $url = "$url?$(($queryParts -join '&'))"
  }
}

$headers = @{
  Authorization = "Bearer $difyApiKey"
  'Content-Type' = 'application/json'
}

if ($testCase.headers) {
  foreach ($prop in $testCase.headers.PSObject.Properties) {
    $headers[$prop.Name] = [string]$prop.Value
  }
}

$body = $null
if ($testCase.body) {
  $body = $testCase.body | ConvertTo-Json -Depth 20
}

Write-Host "METHOD: $method"
Write-Host "URL: $url"
Write-Host "FILE: $resolvedDataFile"
Write-Host ""

Add-Type -AssemblyName System.Net.Http

$handler = New-Object System.Net.Http.HttpClientHandler
$client = New-Object System.Net.Http.HttpClient($handler)
try {
  $request = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::$method, $url)

  foreach ($prop in $headers.GetEnumerator()) {
    $request.Headers.TryAddWithoutValidation([string]$prop.Key, [string]$prop.Value) | Out-Null
  }

  if ($body) {
    $request.Content = New-Object System.Net.Http.StringContent($body, [System.Text.Encoding]::UTF8, 'application/json')
  }

  $response = $client.SendAsync($request).GetAwaiter().GetResult()
  $responseContent = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()

  Write-Host "Status: $([int]$response.StatusCode)"
  Write-Host ""
  Write-Host $responseContent
} finally {
  if ($request) { $request.Dispose() }
  if ($client) { $client.Dispose() }
  if ($handler) { $handler.Dispose() }
}
