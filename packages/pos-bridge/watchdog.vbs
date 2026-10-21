Set ws = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")

' ─── 1. Monitorizare Deterministă POS Bridge pe Portul 40499 ─────────────────
' Testăm direct dacă procesul master POS Bridge ascultă și răspunde pe 127.0.0.1:40499.
' Nu ne bazăm pe WMI sau nume de procese (care dau rateuri de securitate în Windows).
cmdTest = "powershell -NoProfile -ExecutionPolicy Bypass -Command ""$c = New-Object System.Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1', 40499); $s = $c.GetStream(); $s.ReadTimeout = 1200; $b = New-Object byte[] 64; $r = $s.Read($b, 0, $b.Length); $c.Close(); if ($r -gt 0) { exit 0 } else { exit 1 } } catch { exit 2 }"""

bridgeAlive = False
ret = ws.Run(cmdTest, 0, True)
If ret = 0 Then
    bridgeAlive = True
Else
    ' Dacă prima încercare a eșuat (posibil restart în curs), așteptăm 3s și reîncercăm
    WScript.Sleep 3000
    ret2 = ws.Run(cmdTest, 0, True)
    If ret2 = 0 Then
        bridgeAlive = True
    End If
End If

' Dacă bridge-ul master este viu și răspunde, NU deschidem nicio a doua instanță!
If Not bridgeAlive Then
    ' Bridge-ul este cu adevărat oprit sau blocat. Curățăm orice orfan și pornim curat.
    ws.Run "taskkill /F /IM node.exe", 0, True
    WScript.Sleep 1000
    ws.CurrentDirectory = currentDir
    ws.Run "cmd.exe /c """ & currentDir & "\start-windows.bat""", 0, False
End If


' ─── 2. Monitorizare & Menținere Ecran Kiosk (Chrome / Edge) ───────────────────
Set colBrowser = objWMIService.ExecQuery("Select * from Win32_Process Where Name = 'chrome.exe' Or Name = 'msedge.exe'")
browserRunning = False
If colBrowser.Count > 0 Then
    browserRunning = True
End If

If Not browserRunning Then
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

' ─── 3. Menținere Taskbar Ascuns (SW_HIDE) ──────────────────────────────────
On Error Resume Next
hideCmd = "powershell -NoProfile -WindowStyle Hidden -Command ""Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class KioskWin { [DllImport(\""user32.dll\"")] public static extern IntPtr FindWindow(string c, string n); [DllImport(\""user32.dll\"")] public static extern bool ShowWindow(IntPtr h, int s); }'; $t=[KioskWin]::FindWindow('Shell_TrayWnd',$null); if($t -ne [IntPtr]::Zero){ [KioskWin]::ShowWindow($t,0) }"""
ws.Run hideCmd, 0, False
On Error GoTo 0
