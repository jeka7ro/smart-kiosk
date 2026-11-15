Set ws = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")

' ─── SINGLETON GUARD: Asigurăm că rulează o singură instanță de watchdog ───
On Error Resume Next
Set colWatchdogs = objWMIService.ExecQuery("Select * from Win32_Process Where Name = 'wscript.exe'")
wCount = 0
For Each p in colWatchdogs
    If InStr(1, p.CommandLine, "watchdog.vbs", vbTextCompare) > 0 Then
        wCount = wCount + 1
    End If
Next
On Error GoTo 0
If wCount > 1 Then WScript.Quit 0

' ─── WATCHDOG PASIV: Supraveghere proces node.exe (fără comenzi pe ecran sau touch) ───
Do
    WScript.Sleep 30000
    Set colNode = objWMIService.ExecQuery("Select * from Win32_Process Where Name = 'node.exe'")
    If colNode.Count = 0 Then
        ws.CurrentDirectory = currentDir
        ws.Run "cmd.exe /c """ & currentDir & "\start-windows.bat""", 0, False
        WScript.Sleep 15000
    End If
Loop
