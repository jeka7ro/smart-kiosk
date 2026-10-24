Set ws = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")

' ─── SINGLETON GUARD PENTRU WATCHDOG ─────────────────────────────────────────
' Asigurăm că rulează o singură instanță de watchdog.vbs în fundal
Set colWatchdogs = objWMIService.ExecQuery("Select * from Win32_Process Where Name = 'wscript.exe' and CommandLine Like '%watchdog.vbs%'")
If colWatchdogs.Count > 1 Then
    WScript.Quit 0
End If

' ─── BUCLĂ CONTINUĂ TANC BLINDAT (Verificare la fiecare 5 secunde) ────────────
Do
    ' ─── 1. Monitorizare Deterministă POS Bridge pe Portul 40499 ─────────────
    cmdTest = "powershell -NoProfile -ExecutionPolicy Bypass -Command ""$c = New-Object System.Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1', 40499); $s = $c.GetStream(); $s.ReadTimeout = 1500; $b = New-Object byte[] 128; $r = $s.Read($b, 0, $b.Length); $c.Close(); if ($r -gt 0) { $txt = [System.Text.Encoding]::UTF8.GetString($b, 0, $r); if ($txt -match 'ALIVE:OK') { exit 0 } else { exit 1 } } else { exit 1 } } catch { exit 2 }"""

    ret = ws.Run(cmdTest, 0, True)
    If ret <> 0 Then
        ' Dacă prima încercare a eșuat (posibil restart în curs), așteptăm 1.5s și reîncercăm
        WScript.Sleep 1500
        ret2 = ws.Run(cmdTest, 0, True)
        If ret2 <> 0 Then
            ' Bridge-ul este cu adevărat oprit, blocat sau zombie. Curățăm orice orfan și pornim curat!
            ws.Run "taskkill /F /IM node.exe", 0, True
            WScript.Sleep 1500
            Set colNodeCheck = objWMIService.ExecQuery("Select * from Win32_Process Where Name = 'node.exe'")
            If colNodeCheck.Count = 0 Then
                ws.CurrentDirectory = currentDir
                ws.Run "cmd.exe /c """ & currentDir & "\start-windows.bat""", 0, False
            End If
        End If
    End If

    ' ─── 2. Monitorizare & Menținere Ecran Kiosk (Chrome / Edge) ─────────────
    Set colBrowser = objWMIService.ExecQuery("Select * from Win32_Process Where Name = 'chrome.exe' Or Name = 'msedge.exe'")
    If colBrowser.Count = 0 Then
        regCmd = ""
        On Error Resume Next
        regCmd = ws.RegRead("HKCU\Software\Microsoft\Windows\CurrentVersion\Run\SmartKioskScreen")
        On Error GoTo 0
        If regCmd <> "" Then
            ws.Run regCmd, 1, False
        Else
            desktopFolder = ws.SpecialFolders("Desktop")
            deskLnk = desktopFolder & "\Smart Kiosk Fullscreen.lnk"
            If fso.FileExists(deskLnk) Then
                ws.Run """" & deskLnk & """", 1, False
            Else
                startupFolder = ws.SpecialFolders("Startup")
                kioskLnk = startupFolder & "\SmartKiosk.lnk"
                If fso.FileExists(kioskLnk) Then
                    ws.Run """" & kioskLnk & """", 1, False
                End If
            End If
        End If
    End If

    ' ─── 3. Menținere Taskbar Ascuns (SW_HIDE) ──────────────────────────────
    On Error Resume Next
    hideCmd = "powershell -NoProfile -WindowStyle Hidden -Command ""Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class KioskWin { [DllImport(\""user32.dll\"")] public static extern IntPtr FindWindow(string c, string n); [DllImport(\""user32.dll\"")] public static extern bool ShowWindow(IntPtr h, int s); }'; $t=[KioskWin]::FindWindow('Shell_TrayWnd',$null); if($t -ne [IntPtr]::Zero){ [KioskWin]::ShowWindow($t,0) }"""
    ws.Run hideCmd, 0, False
    On Error GoTo 0

    WScript.Sleep 5000 ' Reverificare la fiecare 5 secunde!
Loop
