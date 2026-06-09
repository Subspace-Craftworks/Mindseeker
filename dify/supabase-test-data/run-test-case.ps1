param(
  [Parameter(Mandatory = $true)]
  [string]$DataFile
)

$resolvedDataFile = Resolve-Path $DataFile
$testCase = Get-Content -Raw $resolvedDataFile | ConvertFrom-Json

if (-not $testCase.api -or -not $testCase.action) {
  throw "The data file must contain 'api' and 'action' fields."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$secretPath = Join-Path $repoRoot '.secrets\planning_api_key'
if (-not (Test-Path $secretPath)) {
  throw "Missing planning API key file: $secretPath"
}

$planningApiKey = (Get-Content -Raw $secretPath).Trim()
if (-not $planningApiKey) {
  throw "The planning API key file is empty."
}

$baseUrl = 'https://bwyamrnvijnwzgljhwqo.supabase.co/functions/v1'
$endpoint = switch ($testCase.api) {
  'planning-api' { "$baseUrl/planning-api" }
  'context-api' { "$baseUrl/context-api" }
  default { throw "Unknown api value: $($testCase.api)" }
}

$body = @{
  action = $testCase.action
  params = $testCase.params
} | ConvertTo-Json -Depth 20

$headers = @{
  'X-Planning-Api-Key' = $planningApiKey
  'Content-Type' = 'application/json'
}

Write-Host "POST $endpoint"
Write-Host "File: $resolvedDataFile"
Write-Host ""

$response = Invoke-WebRequest -Method Post -Uri $endpoint -Headers $headers -Body $body -SkipHttpErrorCheck

Write-Host "Status: $($response.StatusCode)"
Write-Host ""
Write-Host $response.Content

