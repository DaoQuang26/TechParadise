param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$Username = "admin",
    [string]$Password = "Admin@123",
    [bool]$StartServer = $true,
    [int]$StartupTimeoutSec = 300
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[GEARVN-FULL] $Message"
}

function Wait-ApiReady {
    param(
        [string]$Url,
        [int]$TimeoutSec
    )

    $deadline = (Get-Date).AddSeconds([Math]::Max(10, $TimeoutSec))
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-WebRequest -UseBasicParsing -Uri "$Url/api/public/categories" -TimeoutSec 5
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
                return $true
            }
        } catch {
            Start-Sleep -Seconds 3
        }
    }
    return $false
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$importScript = Join-Path $PSScriptRoot "import_gearvn_products.ps1"

if (-not (Test-Path $importScript)) {
    throw "Khong tim thay script import: $importScript"
}

$serverProcess = $null
$serverOutLog = Join-Path $projectRoot "gearvn_full_import_server.out.log"
$serverErrLog = Join-Path $projectRoot "gearvn_full_import_server.err.log"

try {
    if ($StartServer) {
        $ready = Wait-ApiReady -Url $BaseUrl -TimeoutSec 10
        if ($ready) {
            Write-Step "Phat hien server da chay tai $BaseUrl, su dung luon."
        } else {
            if (Test-Path $serverOutLog) {
                Remove-Item $serverOutLog -Force
            }
            if (Test-Path $serverErrLog) {
                Remove-Item $serverErrLog -Force
            }

            Write-Step "Khoi dong server local..."
            $serverProcess = Start-Process `
                -FilePath (Join-Path $projectRoot "mvnw.cmd") `
                -ArgumentList "spring-boot:run" `
                -WorkingDirectory $projectRoot `
                -RedirectStandardOutput $serverOutLog `
                -RedirectStandardError $serverErrLog `
                -PassThru

            Write-Step "PID server: $($serverProcess.Id)"
            $ready = Wait-ApiReady -Url $BaseUrl -TimeoutSec $StartupTimeoutSec
            if (-not $ready) {
                throw "Server khong san sang trong $StartupTimeoutSec giay. Kiem tra log: $serverOutLog / $serverErrLog"
            }
        }
    } else {
        Write-Step "Bo qua buoc khoi dong server (StartServer=false)."
        $ready = Wait-ApiReady -Url $BaseUrl -TimeoutSec 10
        if (-not $ready) {
            throw "Khong ket noi duoc server tai $BaseUrl."
        }
    }

    Write-Step "Chay import GearVN..."
    & powershell -ExecutionPolicy Bypass -File $importScript -BaseUrl $BaseUrl -Username $Username -Password $Password
    if ($LASTEXITCODE -ne 0) {
        throw "Import script ket thuc voi ma loi $LASTEXITCODE"
    }

    Write-Step "Hoan tat import GearVN."
}
finally {
    if ($null -ne $serverProcess) {
        $running = Get-Process -Id $serverProcess.Id -ErrorAction SilentlyContinue
        if ($null -ne $running) {
            Write-Step "Dung server PID $($serverProcess.Id)..."
            Stop-Process -Id $serverProcess.Id -Force
        }
        Write-Step "Log server: $serverOutLog / $serverErrLog"
    }
}
