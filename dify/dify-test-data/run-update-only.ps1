param()

$scriptRoot = $PSScriptRoot
$fixtureRoot = Join-Path $scriptRoot 'chat-messages'
$runner = Join-Path $scriptRoot 'run-dify-test-case.ps1'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$resultsRoot = Join-Path $scriptRoot ('results\update-only\' + $timestamp)

New-Item -ItemType Directory -Force -Path $resultsRoot | Out-Null

$state = [ordered]@{
  GoalId = '8747ea03-2430-43c1-b3ff-283701f492ec'
  SubjectId = '725d7a3c-ee51-4a17-9bed-d61c732db584'
  IssueId = '3da6eed7-d8fd-4ef4-8ee5-3531d8692395'
  TaskId = 'ae30435d-77e1-4591-9b47-a7544c9595e8'
}

$steps = @(
  @{
    Name = '01_update_goal'
    File = 'update_goal.json'
    Action = 'update_goal'
    CustomQuery = 'Goal ID 11111111-1111-1111-1111-111111111111 のタイトルを「Difyテスト用Goal updated 2」に変更し、説明も「Ordered update-only scenario」で更新してください。'
  },
  @{
    Name = '02_update_subject'
    File = 'update_subject.json'
    Action = 'update_subject'
    CustomQuery = 'Subject ID 22222222-2222-2222-2222-222222222222 のタイトルを「Difyテスト用Subject updated 2」に変更してください。'
  },
  @{
    Name = '03_update_issue'
    File = 'update_issue.json'
    Action = 'update_issue'
    CustomQuery = 'Issue ID 33333333-3333-3333-3333-333333333333 のタイトルと説明を更新してください。'
  },
  @{
    Name = '04_update_task'
    File = 'update_task.json'
    Action = 'update_task'
    CustomQuery = 'Task ID 44444444-4444-4444-4444-444444444444 の内容を更新し、更新済みであることが分かる文面にしてください。'
  }
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

$summary = New-Object System.Collections.Generic.List[object]

foreach ($step in $steps) {
  $sourcePath = Join-Path $fixtureRoot $step.File
  $runInputPath = Join-Path $resultsRoot ($step.Name + '.input.json')
  $logPath = Join-Path $resultsRoot ($step.Name + '.log')

  Update-FixtureForRun -FixturePath $sourcePath -DestinationPath $runInputPath -State $state -CustomQuery $step.CustomQuery

  Start-Transcript -Path $logPath -Force | Out-Null
  try {
    & $runner -DataFile $runInputPath
  } finally {
    Stop-Transcript | Out-Null
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
