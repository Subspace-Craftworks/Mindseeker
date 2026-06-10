param()

$scriptRoot = $PSScriptRoot
$fixtureRoot = Join-Path $scriptRoot 'chat-messages'
$runner = Join-Path $scriptRoot 'run-dify-test-case.ps1'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$resultsRoot = Join-Path $scriptRoot ('results\create-tests\' + $timestamp)

New-Item -ItemType Directory -Force -Path $resultsRoot | Out-Null

$state = [ordered]@{
  GoalId = '8747ea03-2430-43c1-b3ff-283701f492ec'
  SubjectId = $null
  IssueId = $null
  TaskId = $null
}

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
    [Parameter(Mandatory = $true)]
    [string]$CustomQuery
  )

  $fixture = Get-Content -Raw -Encoding utf8 $FixturePath | ConvertFrom-Json
  if (-not $fixture.body) {
    throw "Fixture must contain a body: $FixturePath"
  }

  $fixture.body.response_mode = 'blocking'
  $fixture.body.query = Replace-IdsInText -Text $CustomQuery -State $State
  $fixture | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 $DestinationPath
}

function Extract-FirstUuid {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Text
  )

  $match = [regex]::Match($Text, '\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b')
  if ($match.Success) {
    return $match.Value
  }

  return $null
}

$steps = @(
  @{
    Name = '01_create_subject'
    File = 'create_subject.json'
    CustomQuery = 'Goal ID 11111111-1111-1111-1111-111111111111 に Subject を作ってください。タイトルは「Difyテスト用Subject」です。作成した Subject ID も必ず返してください。'
    Capture = 'SubjectId'
  },
  @{
    Name = '02_create_issue'
    File = 'create_issue.json'
    CustomQuery = 'Subject ID 22222222-2222-2222-2222-222222222222 に Issue を作ってください。タイトルは「Difyテスト用Issue」です。作成した Issue ID も必ず返してください。'
    Capture = 'IssueId'
  },
  @{
    Name = '03_create_task'
    File = 'create_task.json'
    CustomQuery = 'Subject ID 22222222-2222-2222-2222-222222222222 に Task を作ってください。タイトルは「Difyテスト用Task」です。作成した Task ID も必ず返してください。'
    Capture = 'TaskId'
  }
)

$summary = New-Object System.Collections.Generic.List[object]

foreach ($step in $steps) {
  $sourcePath = Join-Path $fixtureRoot $step.File
  $runInputPath = Join-Path $resultsRoot ($step.Name + '.input.json')
  $logPath = Join-Path $resultsRoot ($step.Name + '.log')

  Update-FixtureForRun -FixturePath $sourcePath -DestinationPath $runInputPath -State $state -CustomQuery $step.CustomQuery

  Start-Transcript -Path $logPath -Force | Out-Null
  try {
    $rawOutput = & $runner -DataFile $runInputPath 2>&1 | Tee-Object -FilePath $logPath -Append
  } finally {
    Stop-Transcript | Out-Null
  }

  $rawText = ($rawOutput | Out-String)
  $uuid = Extract-FirstUuid -Text $rawText
  switch ($step.Capture) {
    'SubjectId' { $state.SubjectId = $uuid }
    'IssueId' { $state.IssueId = $uuid }
    'TaskId' { $state.TaskId = $uuid }
  }

  $summary.Add([pscustomobject]@{
    Step = $step.Name
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
