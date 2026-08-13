' Lanzador Silencioso del MSG Viewer
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptPath = WScript.ScriptFullName
appDir = fso.GetParentFolderName(scriptPath)
WshShell.CurrentDirectory = appDir

' Ejecutar Iniciar-Visor.cmd en modo 100% transparente (0 = SW_HIDE)
cmdFile = """" & appDir & "\Iniciar-Visor.cmd"""
WshShell.Run "cmd /c " & cmdFile, 0, True
