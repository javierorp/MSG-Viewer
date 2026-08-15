' Silent Launcher for MSG Viewer
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptPath = WScript.ScriptFullName
appDir = fso.GetParentFolderName(scriptPath)
WshShell.CurrentDirectory = appDir

args = ""
If WScript.Arguments.Count > 0 Then
    For i = 0 To WScript.Arguments.Count - 1
        args = args & " """ & WScript.Arguments(i) & """"
    Next
End If

' Execute Start-MSG-Viewer.cmd in 100% transparent mode (0 = SW_HIDE)
cmdFile = """" & appDir & "\Start-MSG-Viewer.cmd""" & args
WshShell.Run "cmd /c " & cmdFile, 0, False
