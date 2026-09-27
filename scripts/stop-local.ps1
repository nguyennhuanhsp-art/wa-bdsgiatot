$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$pidFile=Join-Path $projectRoot '.local/app-processes.json'
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Output 'Khong co tien trinh do launcher quan ly.'; exit 0 }
$records=Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
foreach ($record in $records) {
 $entry=[IO.Path]::GetFullPath($record.entry)
 if (-not $entry.StartsWith($projectRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Process entry outside project' }
 $running=Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$record.id)"
 if ($running -and $running.Name -eq 'node.exe' -and $running.CommandLine.Contains($entry)) {
  Stop-Process -Id $running.ProcessId -ErrorAction Stop
 }
}
Write-Output 'Da dung cac tien trinh cua ban app local.'
