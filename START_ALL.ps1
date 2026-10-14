# Hospital Portal - Start All Services
# Starts: Auth Service (5073), Counselling API (7071), Inventory API (7072),
#         IP Management (5074), Notification Service (7073), CCMS API (7075),
#         Laboratory API (7076), Frontend (3000)

$root = $PSScriptRoot

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Hospital Portal - Starting All Services" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Kill any existing processes on service ports
$ports = @(5073, 5074, 7071, 7072, 7073, 7075, 7076, 3000)
Write-Host "[1/10] Freeing ports: $($ports -join ', ')..." -ForegroundColor Yellow
foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) {
        $procId = $conn[0].OwningProcess
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        Write-Host "      Killed PID $procId on port $port" -ForegroundColor DarkYellow
    }
}
Write-Host "      Ports ready" -ForegroundColor Green
Write-Host ""

# --- 0. Azurite (Azure Storage Emulator — required by all Azure Functions services) ---
Write-Host "[2/10] Starting Azurite           -> 127.0.0.1:10000/10001/10002" -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$root'; `$host.UI.RawUI.WindowTitle = 'Azurite :10000'; npx azurite --location '$root\azurite-data' --silent"
# Give Azurite a moment to bind its ports before Functions services start
Start-Sleep -Seconds 3
Write-Host "      Azurite started" -ForegroundColor Green
Write-Host ""

# --- 1. Auth Service (ASP.NET Core, port 5073) ---
Write-Host "[3/10] Starting Auth Service      -> http://localhost:5073" -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$root\microservices\auth-service\AuthService'; `$host.UI.RawUI.WindowTitle = 'Auth Service :5073'; dotnet run --launch-profile http"

# --- 2. Counselling API (Azure Functions, port 7071) ---
Write-Host "[4/10] Starting Counselling API   -> http://localhost:7071" -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$root\microservices\counselling-service\CounsellingApi'; `$host.UI.RawUI.WindowTitle = 'Counselling API :7071'; func start"

# --- 3. Inventory API (Azure Functions, port 7072) ---
Write-Host "[5/10] Starting Inventory API     -> http://localhost:7072" -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$root\microservices\inventory-service\InventoryApi'; `$host.UI.RawUI.WindowTitle = 'Inventory API :7072'; func start"

# --- 4. IP Management Service (Azure Functions, port 5074) ---
Write-Host "[6/10] Starting IP Mgmt Service   -> http://localhost:5074" -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$root\microservices\ip-management-service\IpManagementService'; `$host.UI.RawUI.WindowTitle = 'IP Mgmt :5074'; func start"

# --- 5. Notification Service (Azure Functions, port 7073) ---
Write-Host "[7/10] Starting Notification Svc  -> http://localhost:7073" -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$root\microservices\notification-service\NotificationService'; `$host.UI.RawUI.WindowTitle = 'Notification Svc :7073'; func start"

# --- 6. CCMS API (Azure Functions, port 7075) ---
Write-Host "[8/10] Starting CCMS API          -> http://localhost:7075" -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$root\microservices\ccms-service\CcmsApi'; `$host.UI.RawUI.WindowTitle = 'CCMS API :7075'; func start"

# --- 7. Laboratory API / Enterprise LMS (Azure Functions, port 7076) ---
Write-Host "[9/10] Starting Laboratory API    -> http://localhost:7076" -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$root\microservices\laboratory-service\LaboratoryApi'; `$host.UI.RawUI.WindowTitle = 'Laboratory API :7076'; func start"

# --- 8. Frontend (Next.js, port 3000) ---
Write-Host "[10/10] Starting Frontend          -> http://localhost:3000" -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$root\apps\hospital-portal-web'; `$host.UI.RawUI.WindowTitle = 'Frontend :3000'; pnpm dev"

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  All 9 services launched in new windows!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Service            URL" -ForegroundColor White
Write-Host "  -----------------------------------------" -ForegroundColor DarkGray
Write-Host "  Azurite Storage    127.0.0.1:10000/10001/10002" -ForegroundColor DarkCyan
Write-Host "  Auth Service       http://localhost:5073" -ForegroundColor Cyan
Write-Host "  Auth Swagger       http://localhost:5073/swagger" -ForegroundColor Cyan
Write-Host "  Counselling API    http://localhost:7071" -ForegroundColor Cyan
Write-Host "  Inventory API      http://localhost:7072" -ForegroundColor Cyan
Write-Host "  IP Mgmt Service    http://localhost:5074" -ForegroundColor Cyan
Write-Host "  Notification Svc   http://localhost:7073" -ForegroundColor Cyan
Write-Host "  CCMS API           http://localhost:7075" -ForegroundColor Cyan
Write-Host "  Laboratory API     http://localhost:7076/api/lms" -ForegroundColor Cyan
Write-Host "  Frontend           http://localhost:3000" -ForegroundColor Green
Write-Host ""
