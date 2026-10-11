Set ws = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")

' ─── 1. Monitorizare & Repornire Automată POS Bridge ────────────────────────
Set colProcesses = objWMIService.ExecQuery("Select * from Win32_Process Where Name = 'node.exe'")
nodeRunning = False
For Each proc in colProcesses
    cmdLine = ""
    On Error Resume Next
    cmdLine = proc.CommandLine
    On Error GoTo 0
    If InStr(1, cmdLine, "index.js", 1) > 0 Then
        nodeRunning = True
        Exit For
    End If
Next

If Not nodeRunning Then
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
    startupFolder = ws.SpecialFolders("Startup")
    kioskLnk = startupFolder & "\SmartKiosk.lnk"
    If fso.FileExists(kioskLnk) Then
        ws.Run """" & kioskLnk & """", 1, False
    End If
End If
