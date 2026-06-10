# Dify Test Data V2 (Conversation Context-Aware)

This directory contains integration test scenarios and a runner that leverage Dify's **conversation context** to maintain state (parent-child relationships of goals, subjects, issues, tasks, and events) without hardcoding UUIDs or wrangling them in the script.

## The Core Concept

In Dify Test V1 (`dify-test-data/`), every request was sent with `conversation_id: ""` (starting a new conversation). 
Because of this, Dify had no memory of what it did in the previous step. We had to pass target UUIDs directly in the user prompts (e.g., `Goal ID 11111111-... に Subject を作ってください`), and the PowerShell runner had to intercept responses and regex-replace these placeholders.

In **V2**, we do it the natural way:
1. We send the first prompt (e.g., "Create a Goal...") with `conversation_id: ""`.
2. The runner captures the `conversation_id` returned in Dify's SSE streaming payload.
3. For subsequent steps, we send the prompt to Dify **using that captured `conversation_id`**.
4. Dify maintains context, so we can refer to objects naturally (e.g., "Create a Subject inside the Goal we just created"). Dify will automatically query the DB or resolve the ID internally.

This eliminates all UUID-manipulation in scripts and keeps test scenario files extremely clean.

---

## Directory Structure

```text
dify-test-data-v2/
├── README.md               # This documentation
├── run-scenario.ps1        # The test runner script
├── scenarios/              # JSON test scenario files
│   └── goal-and-tasks.json # Creates a Goal -> Subject -> Issue -> Task -> Event hierarchy
└── results/                # Log and request artifacts generated after test execution
```

---

## How to Run

Open PowerShell in the workspace directory and execute:

```powershell
# Navigate to test folder
cd dify/dify-test-data-v2

# Run the default scenario
.\run-scenario.ps1
```

You can customize the scenario or the target Supabase user ID:

```powershell
# Run with a custom scenario and custom Supabase user ID
.\run-scenario.ps1 -ScenarioFile scenarios/goal-and-tasks.json -UserId "your-supabase-user-uuid"
```

The script will:
- Dynamically create a folder inside `results/scenario-run/YYYYMMDD-HHMMSS/`.
- Record both `.request.json` (the payload sent to Dify) and `.response.log` (the streaming log response from Dify) for each step.
- Print Dify's textual answers to the console.

---

## How to Write New Scenarios

Scenarios are defined in JSON format. Just describe the conversation steps naturally:

```json
{
  "name": "My Custom Scenario",
  "steps": [
    {
      "name": "01_create_goal",
      "query": "Difyテスト用目標「新しい目標」を作成してください。"
    },
    {
      "name": "02_create_subject",
      "query": "さきほどの「新しい目標」の中に「新しいサブジェクト」を作成してください。"
    }
  ]
}
```
