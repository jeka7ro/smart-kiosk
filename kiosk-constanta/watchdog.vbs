Set ws = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")
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
    ws.Run """" & currentDir & "\start-windows.bat""", 0, False
End If
