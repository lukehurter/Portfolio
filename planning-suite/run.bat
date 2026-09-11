@echo off
REM Axim Planning Suite -- start the dashboard and open it.
REM
REM Nothing to configure. The app serves an in-memory dataset unless you set
REM PA_DEMO=0 and point it at a SQL Server, so this is the whole setup.

cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (set PYCMD=python) else (set PYCMD=py)

echo Checking dependencies...
%PYCMD% -m pip install --quiet --disable-pip-version-check fastapi "uvicorn[standard]"
if errorlevel 1 (
    echo.
    echo Could not install fastapi/uvicorn. Is Python on your PATH?
    pause
    exit /b 1
)

REM Open the browser a moment after the server starts listening.
start "" cmd /c "timeout /t 3 >nul && start http://127.0.0.1:8080"

echo.
echo   Axim Planning Suite  ->  http://127.0.0.1:8080
echo   Ctrl+C to stop.
echo.
%PYCMD% -m uvicorn app:app --host 127.0.0.1 --port 8080

pause
