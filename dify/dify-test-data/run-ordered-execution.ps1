param()

$scriptRoot = $PSScriptRoot
$fixtureRoot = Join-Path $scriptRoot 'chat-messages'
$runner = Join-Path $scriptRoot 'run-dify-test-case.ps1'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$resultsRoot = Join-Path $scriptRoot ('results\ordered-execution\' + $timestamp)

New-Item -ItemType Directory -Force -Path $resultsRoot | Out-Null

$state = [ordered]@{
  GoalId = $null
  SubjectId = $null
  IssueId = $null
  TaskId = $null
}

$steps = @(
  @{ Name = '01_list_goals'; File = 'list_goals.json'; Capture = $false; Action = 'list_goals' },
  @{ Name = '02_create_goal'; File = 'create_goal.json'; Capture = $true; Action = 'create_goal' },
  @{ Name = '03_list_goals'; File = 'list_goals.json'; Capture = $false; Action = 'list_goals' },
  @{ Name = '04_get_goal'; File = 'get_goal.json'; Capture = $false; Action = 'get_goal' },
  @{ Name = '05_update_goal'; File = 'update_goal.json'; Capture = $false; Action = 'update_goal' },
  @{ Name = '06_summarize_context'; File = 'summarize_context.json'; Capture = $false; Action = 'summarize_context' },
  @{ Name = '07_create_subject'; File = 'create_subject.json'; Capture = $true; Action = 'create_subject' },
  @{ Name = '08_get_subject'; File = 'get_subject.json'; Capture = $false; Action = 'get_subject' },
  @{ Name = '09_update_subject'; File = 'update_subject.json'; Capture = $false; Action = 'update_subject' },
  @{ Name = '10_create_issue'; File = 'create_issue.json'; Capture = $true; Action = 'create_issue' },
  @{ Name = '11_update_issue'; File = 'update_issue.json'; Capture = $false; Action = 'update_issue' },
  @{ Name = '12_create_task'; File = 'create_task.json'; Capture = $true; Action = 'create_task' },
  @{ Name = '13_update_task'; File = 'update_task.json'; Capture = $false; Action = 'update_task' },
  @{ Name = '14_list_subjects'; File = 'list_subjects.json'; Capture = $false; Action = 'list_subjects' },
  @{ Name = '15_list_issues'; File = 'list_issues.json'; Capture = $false; Action = 'list_issues' },
  @{ Name = '16_list_tasks'; File = 'list_tasks.json'; Capture = $false; Action = 'list_tasks' },
  @{ Name = '17_create_event'; File = 'create_event.json'; Capture = $false; Action = 'create_event' },
  @{ Name = '18_list_events'; File = 'list_events.json'; Capture = $false; Action = 'list_events' },
  @{ Name = '19_complete_goal'; File = 'complete_goal.json'; Capture = $false; Action = 'complete_goal' }
)

function Replace-IdsInText {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Text,
    [hashtable]$State
  )

  $result = $Text
  if ($State.GoalId) {
    $result = $result.Replace('11111111-1111-1111-1111-111111111111', $State.GoalId)
  }
  if ($State.SubjectId) {
    $result = $result.Replace('22222222-2222-2222-2222-222222222222', $State.SubjectId)
  }
  if ($State.IssueId) {
    $result = $result.Replace('33333333-3333-3333-3333-333333333333', $State.IssueId)
  }
  if ($State.TaskId) {
    $result = $result.Replace('44444444-4444-4444-4444-444444444444', $State.TaskId)
  }

  return $result
}

function Update-FixtureForRun {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FixturePath,
    [Parameter(Mandatory = $true)]
    [string]$DestinationPath,
    [Parameter(Mandatory = $true)]
    [hashtable]$State,
    [string]$CustomQuery
  )

  $fixture = Get-Content -Raw -Encoding utf8 $FixturePath | ConvertFrom-Json
  if (-not $fixture.body) {
    throw "Fixture must contain a body: $FixturePath"
  }

  if ($CustomQuery) {
    $fixture.body.query = $CustomQuery
  }

  if ($fixture.body.query) {
    $fixture.body.query = Replace-IdsInText -Text ([string]$fixture.body.query) -State $State
  }

  $fixture | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 $DestinationPath
}

function Extract-CreatedId {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Text,
    [Parameter(Mandatory = $true)]
    [string]$Action
  )

  $pattern = 'tool_call_input":{"action":"' + [regex]::Escape($Action) + '".*?"tool_response":"tool response: (\{.*?\})"'
  $match = [regex]::Match($Text, $pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if ($match.Success) {
    $toolResponseText = $match.Groups[1].Value
    $toolResponseText = $toolResponseText -replace '\\u003c', '<'
    $toolResponseText = $toolResponseText -replace '\\u003e', '>'
    $toolResponseText = $toolResponseText -replace '\\u0026', '&'
    $toolResponseText = $toolResponseText -replace '\\"', '"'

    try {
      $toolResponse = $toolResponseText | ConvertFrom-Json
      if ($toolResponse.data -and $toolResponse.data.id) {
        return [string]$toolResponse.data.id
      }
      if ($toolResponse.id) {
        return [string]$toolResponse.id
      }
    } catch {
      return $null
    }
  }

  return $null
}

$summary = New-Object System.Collections.Generic.List[object]

foreach ($step in $steps) {
  $sourcePath = Join-Path $fixtureRoot $step.File
  $runInputPath = Join-Path $resultsRoot ($step.Name + '.input.json')
  $logPath = Join-Path $resultsRoot ($step.Name + '.log')

  $customQuery = $null
  if ($step.Action -eq 'create_goal') {
    $goalTitle = 'DifyGoalOrdered_' + $timestamp
    $customQuery = 'Create a new goal. Title: "' + $goalTitle + '", Description: "Ordered execution test for create_goal".'
  }

  Update-FixtureForRun -FixturePath $sourcePath -DestinationPath $runInputPath -State $state -CustomQuery $customQuery

  Start-Transcript -Path $logPath -Force | Out-Null
  try {
    & $runner -DataFile $runInputPath
  } finally {
    Stop-Transcript | Out-Null
  }

  $raw = Get-Content -Raw -Encoding utf8 $logPath

  if ($step.Capture) {
    $createdId = Extract-CreatedId -Text $raw -Action $step.Action
    switch ($step.Action) {
      'create_goal' { $state.GoalId = $createdId }
      'create_subject' { $state.SubjectId = $createdId }
      'create_issue' { $state.IssueId = $createdId }
      'create_task' { $state.TaskId = $createdId }
    }
  }

  $summary.Add([pscustomobject]@{
    Step = $step.Name
    Action = $step.Action
    Log = $logPath
    GoalId = $state.GoalId
    SubjectId = $state.SubjectId
    IssueId = $state.IssueId
    TaskId = $state.TaskId
  }) | Out-Null
}

$summaryPath = Join-Path $resultsRoot 'summary.json'
$summary | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 $summaryPath

Write-Host ('Results saved to: ' + $resultsRoot)
Write-Host ''
Write-Host ($summary | Format-Table -AutoSize | Out-String)
