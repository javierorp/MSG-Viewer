' Silent Launcher for MSG Viewer
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptPath = WScript.ScriptFullName
appDir = fso.GetParentFolderName(scriptPath)
WshShell.CurrentDirectory = appDir

' Execute Iniciar-Visor.cmd in 100% transparent mode (0 = SW_HIDE)
cmdFile = """" & appDir & "\Iniciar-Visor.cmd"""
WshShell.Run "cmd /c " & cmdFile, 0, True

