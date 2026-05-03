param(
    [int]$Port = 8080
)

$ErrorActionPreference = "Stop"

function Stop-PortProcess {
    param([int]$TargetPort)

    $listeners = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue
    if (-not $listeners) {
        Write-Host "Port $TargetPort is free."
        return
    }

    $pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $pids) {
        try {
            $proc = Get-Process -Id $pid -ErrorAction Stop
            Write-Host "Stopping PID $pid ($($proc.ProcessName)) on port $TargetPort..."
            Stop-Process -Id $pid -Force
        } catch {
            Write-Warning "Cannot stop PID $pid: $($_.Exception.Message)"
        }
    }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Stop-PortProcess -TargetPort $Port

Write-Host "Starting Techstore on port $Port..."
$env:SERVER_PORT = [string]$Port
& ".\mvnw.cmd" "spring-boot:run"
