Set ws = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")

' ─── 1. Monitorizare & Repornire Automată POS Bridge ────────────────────────
Set colProcesses = objWMIService.ExecQuery("Select * from Win32_Process Where Name = 'node.exe'")
nodeRunning = False
If colProcesses.Count > 0 Then
    nodeRunning = True
End If

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

' ─── 3. Menținere Taskbar Ascuns (SW_HIDE) ──────────────────────────────────
On Error Resume Next
hideCmd = "powershell -NoProfile -WindowStyle Hidden -Command ""Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class KioskWin { [DllImport(\""user32.dll\"")] public static extern IntPtr FindWindow(string c, string n); [DllImport(\""user32.dll\"")] public static extern bool ShowWindow(IntPtr h, int s); }'; $t=[KioskWin]::FindWindow('Shell_TrayWnd',$null); if($t -ne [IntPtr]::Zero){ [KioskWin]::ShowWindow($t,0) }"""
ws.Run hideCmd, 0, False
On Error GoTo 0

