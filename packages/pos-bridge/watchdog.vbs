Set ws = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")

' ─── SINGLETON GUARD PENTRU WATCHDOG ─────────────────────────────────────────
' Asigurăm că rulează o singură instanță de watchdog.vbs în fundal
On Error Resume Next
Set colWatchdogs = objWMIService.ExecQuery("Select * from Win32_Process Where Name = 'wscript.exe'")
wCount = 0
For Each p in colWatchdogs
    If InStr(1, p.CommandLine, "watchdog.vbs", vbTextCompare) > 0 Then
        wCount = wCount + 1
    End If
Next
On Error GoTo 0
If wCount > 1 Then
    WScript.Quit 0
End If

' ─── BUCLĂ CONTINUĂ WATCHDOG REZILIENT (Verificare la fiecare 10 secunde) ─────
consecutiveFailures = 0

Do
    ' ─── 1. Monitorizare Deterministă POS Bridge pe Portul 40499 ─────────────
    cmdTest = "powershell -NoProfile -ExecutionPolicy Bypass -Command ""$c = New-Object System.Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1', 40499); $s = $c.GetStream(); $s.ReadTimeout = 1500; $b = New-Object byte[] 128; $r = $s.Read($b, 0, $b.Length); $c.Close(); if ($r -gt 0) { $txt = [System.Text.Encoding]::UTF8.GetString($b, 0, $r); if ($txt -match 'ALIVE:OK') { exit 0 } else { exit 1 } } else { exit 1 } } catch { exit 2 }"""

    ret = ws.Run(cmdTest, 0, True)
    If ret = 0 Then
        ' Bridge-ul este activ și sănătos
        consecutiveFailures = 0
    Else
        consecutiveFailures = consecutiveFailures + 1
        ' Doar dacă bridge-ul a eșuat timp de 30-40 de secunde continuu (4 verificări consecutive):
        If consecutiveFailures >= 4 Then
            ' Curățăm orice instanță blocată de node.exe doar dacă există
            Set colNodeCheck = objWMIService.ExecQuery("Select * from Win32_Process Where Name = 'node.exe'")
            If colNodeCheck.Count > 0 Then
                ws.Run "taskkill /F /IM node.exe", 0, True
                WScript.Sleep 2000
            End If

            ' Pornim supervizorul start-windows.bat
            ws.CurrentDirectory = currentDir
            ws.Run "cmd.exe /c """ & currentDir & "\start-windows.bat""", 0, False
            consecutiveFailures = 0

            ' Perioadă de grație de 20 de secunde ca Node să poată descărca și porni complet
            WScript.Sleep 20000
        End If
    End If

    ' ─── 2. Monitorizare & Menținere Ecran Kiosk (Anti-Minimizare & Anti-Închidere) ───
    Set colBrowser = objWMIService.ExecQuery("Select * from Win32_Process Where Name = 'chrome.exe' Or Name = 'msedge.exe'")
    If colBrowser.Count = 0 Then
        ' Dacă browserul este complet închis, îl repornim garantat din scurtătură sau Registry
        startupFolder = ws.SpecialFolders("Startup")
        kioskLnk = startupFolder & "\SmartKiosk.lnk"
        If fso.FileExists(kioskLnk) Then
            ws.Run """" & kioskLnk & """", 1, False
        Else
            desktopFolder = ws.SpecialFolders("Desktop")
            deskLnk = desktopFolder & "\Smart Kiosk.lnk"
            If fso.FileExists(deskLnk) Then
                ws.Run """" & deskLnk & """", 1, False
            End If
        End If
    Else
        ' Browserul rulează: dacă este minimizat (coborât în bară) sau acoperit, îl aducem forțat în prim-plan
        On Error Resume Next
        focusCmd = "powershell -NoProfile -WindowStyle Hidden -Command ""Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class KioskWin { [DllImport(\""user32.dll\"")] public static extern IntPtr FindWindow(string c, string n); [DllImport(\""user32.dll\"")] public static extern bool ShowWindow(IntPtr h, int s); [DllImport(\""user32.dll\"")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport(\""user32.dll\"")] public static extern bool IsIconic(IntPtr h); [DllImport(\""user32.dll\"")] public static extern IntPtr GetForegroundWindow(); }'; $w=[KioskWin]::FindWindow('Chrome_WidgetWin_1',$null); if($w -ne [IntPtr]::Zero){ if([KioskWin]::IsIconic($w)){ [KioskWin]::ShowWindow($w,3); [KioskWin]::SetForegroundWindow($w) } else { $fg=[KioskWin]::GetForegroundWindow(); if($fg -ne $w -and $fg -ne [IntPtr]::Zero){ [KioskWin]::ShowWindow($w,3); [KioskWin]::SetForegroundWindow($w) } } }; Get-Process -Name 'iiko*','Syrve*','Resto*','TapX*','Ordero*' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue"""
        ws.Run focusCmd, 0, False
        On Error GoTo 0
    End If

    ' ─── 3. Menținere Taskbar Ascuns (SW_HIDE) ──────────────────────────────
    On Error Resume Next
    hideCmd = "powershell -NoProfile -WindowStyle Hidden -Command ""Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class KioskWin { [DllImport(\""user32.dll\"")] public static extern IntPtr FindWindow(string c, string n); [DllImport(\""user32.dll\"")] public static extern bool ShowWindow(IntPtr h, int s); }'; $t=[KioskWin]::FindWindow('Shell_TrayWnd',$null); if($t -ne [IntPtr]::Zero){ [KioskWin]::ShowWindow($t,0) }; $s=[KioskWin]::FindWindow('Shell_SecondaryTrayWnd',$null); if($s -ne [IntPtr]::Zero){ [KioskWin]::ShowWindow($s,0) }"""
    ws.Run hideCmd, 0, False
    On Error GoTo 0

    WScript.Sleep 5000 ' Reverificare la fiecare 5 secunde
Loop
