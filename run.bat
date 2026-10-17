@echo off
title FixedRAG Launcher
cls
echo ========================================================
echo       FixedRAG - Enterprise Knowledge Retrieval & RAG
echo ========================================================
echo.
echo [1/4] Checking environment and dependencies...
python -c "import uvicorn, fastapi, greenlet, asyncpg" 2>nul || pip install fastapi uvicorn greenlet asyncpg
if not exist "rag-ui\node_modules" (
    echo Installing frontend dependencies...
    cd rag-ui && cmd /c npm install && cd ..
)

echo [2/4] Starting Monitoring Services (Prometheus 9092 + Grafana 3000)...
if exist "tools\prometheus\prometheus.exe" (
    start "FixedRAG Prometheus" /min cmd /c "%~dp0tools\prometheus\prometheus.exe --config.file=%~dp0tools\prometheus\local_prometheus.yml --web.listen-address=0.0.0.0:9092 --storage.tsdb.path=%~dp0tools\prometheus\data"
)
if exist "tools\grafana\bin\grafana-server.exe" (
    start "FixedRAG Grafana" /min cmd /c "cd /d %~dp0tools\grafana && bin\grafana-server.exe"
)

echo [3/4] Starting FixedRAG Backend Monolith (Port 8012)...
start "FixedRAG Monolith" cmd /k "cd /d %~dp0services\monolith && python -m uvicorn main:app --host 0.0.0.0 --port 8012"

echo [4/4] Starting FixedRAG Vite UI (Port 3012)...
start "FixedRAG UI" cmd /k "cd /d %~dp0rag-ui && cmd /c npm run dev"

timeout /t 5 /nobreak >nul
start http://localhost:3012
echo.
echo ========================================================
echo  FixedRAG is running!
echo    Frontend UI        : http://localhost:3012
echo    Backend API Gateway: http://localhost:8012
echo    Grafana Dashboards : http://localhost:3000 (admin / admin)
echo    Prometheus Metrics : http://localhost:9092
echo.
echo    Dev Login:
echo      Admin   : admin
echo      Manager : manager
echo      User    : user
echo      Viewer  : viewer
echo ========================================================
echo.
echo Press any key to stop all FixedRAG processes...
pause >nul
taskkill /fi "WINDOWTITLE eq FixedRAG Monolith*" /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq FixedRAG UI*" /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq FixedRAG Prometheus*" /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq FixedRAG Grafana*" /f >nul 2>&1
echo Done.
