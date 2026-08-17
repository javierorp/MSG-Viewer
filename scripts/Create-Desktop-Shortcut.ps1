# Script to create a Desktop shortcut for MSG Viewer with custom icon
$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath "MSG Viewer.lnk"
$AppDir = Split-Path $PSScriptRoot -Parent

$ExePath = Join-Path $AppDir "dist\MSG-Viewer.exe"
$RootExePath = Join-Path $AppDir "MSG-Viewer.exe"
$VbsPath = Join-Path $AppDir "MSG-Viewer.vbs"
$IconPath = Join-Path $AppDir "docs\images\msg-viewer-icon.ico"
if (-not (Test-Path $IconPath)) {
    $IconPath = Join-Path $AppDir "favicon.ico"
}

# Function to ensure MSG-Viewer.exe exists or compile/copy automatically
function Ensure-MSGViewerExe {
    param([string]$Dir)
    
    $Root = Join-Path $Dir "MSG-Viewer.exe"
    $Dist = Join-Path $Dir "dist\MSG-Viewer.exe"
    $Icon = Join-Path $Dir "docs\images\msg-viewer-icon.ico"
    if (-not (Test-Path $Icon)) { $Icon = Join-Path $Dir "favicon.ico" }
    
    if (Test-Path $Root) {
        return $Root
    }
    
    if (Test-Path $Dist) {
        try {
            Copy-Item $Dist $Root -Force -ErrorAction SilentlyContinue
            return $Root
        } catch {
            return $Dist
        }
    }
    
    # Try compiling lightweight native launcher with Windows built-in csc.exe
    $cscPaths = @(
        "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
        "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
    )
    $cscExe = $cscPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
    
    if ($cscExe) {
        $csCode = @"
using System;
using System.Diagnostics;
using System.IO;

namespace MSGViewerLauncher {
    class Program {
        static void Main(string[] args) {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string vbsPath = Path.Combine(baseDir, "MSG-Viewer.vbs");
            string cmdPath = Path.Combine(baseDir, "Start-MSG-Viewer.cmd");
            string argStr = "";
            if (args != null && args.Length > 0) {
                foreach (string arg in args) {
                    argStr += " \"" + arg.Replace("\"", "\\\"") + "\"";
                }
            }
            ProcessStartInfo psi;
            if (File.Exists(vbsPath)) {
                psi = new ProcessStartInfo("wscript.exe", "\"" + vbsPath + "\"" + argStr);
            } else {
                psi = new ProcessStartInfo("cmd.exe", "/c \"" + cmdPath + "\"" + argStr);
            }
            psi.WorkingDirectory = baseDir;
            psi.WindowStyle = ProcessWindowStyle.Hidden;
            psi.CreateNoWindow = true;
            psi.UseShellExecute = false;
            try { Process.Start(psi); } catch {}
        }
    }
}
"@
        $tempCs = Join-Path ([System.IO.Path]::GetTempPath()) "msg_launcher_$PID.cs"
        try {
            [System.IO.File]::WriteAllText($tempCs, $csCode, [System.Text.Encoding]::UTF8)
            $cscArgs = @("/nologo", "/target:winexe", "/out:$Root")
            if (Test-Path $Icon) {
                $cscArgs += "/win32icon:$Icon"
            }
            $cscArgs += $tempCs
            
            $proc = Start-Process -FilePath $cscExe -ArgumentList $cscArgs -NoNewWindow -Wait -PassThru
            if ($proc.ExitCode -eq 0 -and (Test-Path $Root)) {
                return $Root
            }
        } catch {} finally {
            if (Test-Path $tempCs) { Remove-Item $tempCs -Force -ErrorAction SilentlyContinue }
        }
    }
    
    return $null
}

$ResolvedExe = Ensure-MSGViewerExe -Dir $AppDir

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
if ($ResolvedExe -and (Test-Path $ResolvedExe)) {
    $Shortcut.TargetPath = $ResolvedExe
    $Shortcut.Arguments = ""
    $Shortcut.WorkingDirectory = $AppDir
    $Shortcut.IconLocation = "$ResolvedExe,0"
} elseif (Test-Path $VbsPath) {
    $Shortcut.TargetPath = "wscript.exe"
    $Shortcut.Arguments = "`"$VbsPath`""
    $Shortcut.WorkingDirectory = $AppDir
    if (Test-Path $IconPath) {
        $Shortcut.IconLocation = "$IconPath,0"
    }
} else {
    $CmdPath = Join-Path $AppDir "Start-MSG-Viewer.cmd"
    $Shortcut.TargetPath = $CmdPath
    $Shortcut.Arguments = ""
    $Shortcut.WorkingDirectory = $AppDir
    if (Test-Path $IconPath) {
        $Shortcut.IconLocation = "$IconPath,0"
    }
}

$Shortcut.Description = "MSG Viewer - Offline .msg & .eml File Viewer"
$Shortcut.Save()

Write-Host "Desktop shortcut created successfully with custom icon at: $ShortcutPath" -ForegroundColor Green
