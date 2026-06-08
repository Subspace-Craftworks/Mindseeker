# planning-api: list_goals

## Purpose
List goals in updated order.

## Parameters
- Optional:
  - `status`
  - `limit` (default `20`, min `1`, max `100`)

## Notes
- Returns goals sorted by `updated_at` descending.
- Use this when checking existing goals before creating a new one.
