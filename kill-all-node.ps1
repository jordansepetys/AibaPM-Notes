Write-Output "Finding all Node.js processes..."
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    foreach ($proc in $nodeProcesses) {
        Write-Output "Killing Node process PID: $($proc.Id)"
        Stop-Process -Id $proc.Id -Force
    }
    Write-Output "All Node processes killed"
} else {
    Write-Output "No Node processes found"
}
