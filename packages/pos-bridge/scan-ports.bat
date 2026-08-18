@echo off
echo Scanez porturile pe 192.168.20.113 ...
echo Rezultate: > result.txt
for %%p in (80 443 8080 8443 20002 20009 7001 7002 9000 9001 10000 23 4242) do (
  echo Testez portul %%p ...
  curl -s -o NUL -w "Port %%p: %%{http_code}" --connect-timeout 2 http://192.168.20.113:%%p/ >> result.txt 2>&1
  echo. >> result.txt
)
echo.
echo === GATA! Rezultatele sunt in result.txt ===
type result.txt
pause
