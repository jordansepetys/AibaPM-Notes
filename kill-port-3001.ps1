$connections = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue

if ($connections) {
    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $pids) {
        Write-Output "Killing PID: $pid"
        Stop-Process -Id $pid -Force
    }
    Write-Output "Processes killed"
} else {
    Write-Output "No process found on port 3001"
}
