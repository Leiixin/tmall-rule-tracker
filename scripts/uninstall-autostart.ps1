$ErrorActionPreference = "Stop"

$taskName = "TmallRuleTrackerAutostart"

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Write-Output "Removed scheduled task: $taskName"
