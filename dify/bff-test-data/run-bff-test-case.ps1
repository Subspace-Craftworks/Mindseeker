param(
  [Parameter(Mandatory = $true)]
  [string]$DataFile
)

$resolvedDataFile = Resolve-Path $DataFile
$testCase = Get-Content -Raw $resolvedDataFile | ConvertFrom-Json

if (-not $testCase.method -or -not $testCase.path) {
  throw "The data file must contain 'method' and 'path' fields."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$secretPath = Join-Path $repoRoot '.secrets\dify_api_key'
if (-not (Test-Path $secretPath)) {
  throw "Missing Dify API key file: $secretPath"
}

$difyApiKey = (Get-Content -Raw $secretPath).Trim()
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

$invokeParams = @{
  Method = $method
  Uri = $url
  Headers = $headers
  SkipHttpErrorCheck = $true
}
if ($body) {
  $invokeParams.Body = $body
}

$response = Invoke-WebRequest @invokeParams

Write-Host "Status: $($response.StatusCode)"
Write-Host ""
Write-Host $response.Content

