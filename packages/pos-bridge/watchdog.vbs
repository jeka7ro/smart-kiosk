Set ws = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")

' ─── 1. Monitorizare & Repornire Automată POS Bridge ────────────────────────
' Verificăm dacă rulează deja cmd.exe cu start-windows.bat
Set colCmd = objWMIService.ExecQuery("Select * from Win32_Process Where Name = 'cmd.exe'")
scriptRunning = False
For Each proc in colCmd
    cmdLine = ""
    On Error Resume Next
    cmdLine = proc.CommandLine
    On Error GoTo 0
    If InStr(1, cmdLine, "start-windows.bat", 1) > 0 Then
        scriptRunning = True
        Exit For
    End If
Next

' Verificăm dacă rulează node.exe
Set colProcesses = objWMIService.ExecQuery("Select * from Win32_Process Where Name = 'node.exe'")
nodeRunning = False
If colProcesses.Count > 0 Then
    nodeRunning = True
End If

' Pornim DOAR DACĂ NICI node.exe ȘI NICI start-windows.bat NU rulează!
If Not nodeRunning And Not scriptRunning Then
    ws.CurrentDirectory = currentDir
    ws.Run "cmd.exe /c """ & currentDir & "\start-windows.bat""", 0, False
End If


' ─── 2. Monitorizare & Repornire Automată Ecran Kiosk (Chrome / Edge) ───────
Set colBrowser = objWMIService.ExecQuery("Select * from Win32_Process Where Name = 'chrome.exe' Or Name = 'msedge.exe'")
browserRunning = False
For Each proc in colBrowser
    cmdLine = ""
    On Error Resume Next
    cmdLine = proc.CommandLine
    On Error GoTo 0
    If InStr(1, cmdLine, "--kiosk", 1) > 0 Or InStr(1, cmdLine, "kiosk-smashme", 1) > 0 Then
        browserRunning = True
        Exit For
    End If
Next

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

