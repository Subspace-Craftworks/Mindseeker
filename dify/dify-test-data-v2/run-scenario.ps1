param(
  [string]$ScenarioFile = "scenarios/goal-and-tasks.json",
  [string]$UserId = "678ea7b6-e79e-4f2c-ae35-4af35b650071"
)

$scriptRoot = $PSScriptRoot
# Resolve the scenario file path
$resolvedScenario = Resolve-Path (Join-Path $scriptRoot $ScenarioFile)
if (-not (Test-Path $resolvedScenario)) {
  throw "Scenario file not found: $resolvedScenario"
}

$scenario = Get-Content -Raw -Encoding utf8 $resolvedScenario | ConvertFrom-Json

$repoRoot = Resolve-Path (Join-Path $scriptRoot '..')
$secretPath = Join-Path $repoRoot '.secrets\api-key'
if (-not (Test-Path $secretPath)) {
  throw "Missing Dify API key file: $secretPath"
}

$difyApiKey = (Get-Content -Raw -Encoding utf8 $secretPath).Trim()
if (-not $difyApiKey) {
  throw "The Dify API key file is empty."
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$resultsRoot = Join-Path $scriptRoot ("results\scenario-run\" + $timestamp)
New-Item -ItemType Directory -Force -Path $resultsRoot | Out-Null

$baseUrl = 'https://api.dify.ai/v1'
$url = "$baseUrl/chat-messages"

Write-Host "Starting Scenario: $($scenario.name)"
Write-Host "Results will be saved to: $resultsRoot"
Write-Host "----------------------------------------"

$conversationId = ""

function Extract-ConversationId {
  param([string]$responseText)
  $lines = $responseText -split "\r?\n"
  foreach ($line in $lines) {
    if ($line.StartsWith("data:")) {
      $jsonText = $line.Substring(5).Trim()
      if ($jsonText.StartsWith("{") -and $jsonText.EndsWith("}")) {
        try {
          $json = $jsonText | ConvertFrom-Json
          if ($json.conversation_id) {
            return [string]$json.conversation_id
          }
        } catch {}
      }
    }
  }
  if ($responseText.Trim().StartsWith("{")) {
    try {
      $json = $responseText | ConvertFrom-Json
      if ($json.conversation_id) {
        return [string]$json.conversation_id
      }
    } catch {}
  }
  return $null
}

function Extract-Answer {
  param([string]$responseText)
  $answer = ""
  $lines = $responseText -split "\r?\n"
  foreach ($line in $lines) {
    if ($line.StartsWith("data:")) {
      $jsonText = $line.Substring(5).Trim()
      if ($jsonText.StartsWith("{") -and $jsonText.EndsWith("}")) {
        try {
          $json = $jsonText | ConvertFrom-Json
          if ($json.answer) {
            $answer += $json.answer
          }
        } catch {}
      }
    }
  }
  if ($answer) {
    return $answer.Trim()
  }
  if ($responseText.Trim().StartsWith("{")) {
    try {
      $json = $responseText | ConvertFrom-Json
      if ($json.answer) {
        return $json.answer
      }
    } catch {}
  }
  return ""
}

Add-Type -AssemblyName System.Net.Http

$steps = $scenario.steps
for ($i = 0; $i -lt $steps.Count; $i++) {
  $step = $steps[$i]
  $stepName = $step.name
  $query = $step.query

  Write-Host "Step $($i + 1)/$($steps.Count): $stepName"
  Write-Host "Query: $query"
  if ($conversationId) {
    Write-Host "Conversation ID: $conversationId"
  } else {
    Write-Host "Conversation ID: (New Conversation)"
  }


  $bodyObj = [ordered]@{
    inputs = @{}
    query = $query
    response_mode = "blocking"
    conversation_id = $conversationId
    user = $UserId
    auto_generate_name = $true
  }
  $bodyJson = $bodyObj | ConvertTo-Json -Depth 20

  # Save request payload for reference
  $requestFile = Join-Path $resultsRoot ("$stepName.request.json")
  $bodyJson | Set-Content -Encoding utf8 $requestFile

  $handler = New-Object System.Net.Http.HttpClientHandler
  $client = New-Object System.Net.Http.HttpClient($handler)
  
  $responseContent = ""
  $status = 0
  try {
    $request = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Post, $url)
    $request.Headers.TryAddWithoutValidation("Authorization", "Bearer $difyApiKey") | Out-Null
    $request.Headers.TryAddWithoutValidation("Content-Type", "application/json") | Out-Null
    $request.Content = New-Object System.Net.Http.StringContent($bodyJson, [System.Text.Encoding]::UTF8, 'application/json')

    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    $status = [int]$response.StatusCode
    $responseContent = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  } catch {
    Write-Error "HTTP Request failed: $_"
    $responseContent = $_.ToString()
  } finally {
    if ($request) { $request.Dispose() }
    if ($client) { $client.Dispose() }
    if ($handler) { $handler.Dispose() }
  }

  # Save raw response
  $logFile = Join-Path $resultsRoot ("$stepName.response.log")
  $responseContent | Set-Content -Encoding utf8 $logFile

  Write-Host "HTTP Status: $status"
  if ($status -eq 200) {
    $nextConversationId = Extract-ConversationId -responseText $responseContent
    if ($nextConversationId) {
      $conversationId = $nextConversationId
    }

    $answer = Extract-Answer -responseText $responseContent
    Write-Host "Answer: $answer"
  } else {
    Write-Host "Error Response: $responseContent"
    Write-Host "Aborting scenario due to non-200 status code."
    break
  }
  Write-Host "----------------------------------------"
}

Write-Host "Scenario completed. Results saved to $resultsRoot"
