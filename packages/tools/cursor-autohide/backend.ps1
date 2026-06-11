param([int]$Seconds = 5, [int]$DeadZone = 4, [string]$StopFile = "$env:TEMP\cursor_stop.txt")

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class CursorMgr {
    [DllImport("user32.dll")] public static extern bool SystemParametersInfo(uint a, uint b, IntPtr c, uint d);
    [DllImport("user32.dll")] public static extern IntPtr CreateCursor(IntPtr h, int x, int y, int w, int ht, byte[] andM, byte[] xorM);
    [DllImport("user32.dll")] public static extern bool SetSystemCursor(IntPtr cur, uint id);
    [DllImport("user32.dll")] public static extern IntPtr CopyIcon(IntPtr cur);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
    public struct POINT { public int X, Y; }
    static uint[] IDs = {32512,32513,32514,32515,32516,32640,32641,32642,32643,32644,32645,32646,32648,32649,32650,32651};
    public static POINT GetPos() { POINT p; GetCursorPos(out p); return p; }
    public static void Hide() {
        byte[] a = new byte[128], x = new byte[128];
        for (int i = 0; i < 128; i++) a[i] = 0xFF;
        IntPtr blank = CreateCursor(IntPtr.Zero, 0, 0, 32, 32, a, x);
        if (blank == IntPtr.Zero) return;
        foreach (uint id in IDs) { IntPtr c = CopyIcon(blank); if (c != IntPtr.Zero) SetSystemCursor(c, id); }
    }
    public static void Show() { SystemParametersInfo(0x57, 0, IntPtr.Zero, 3); }
}
"@ -ErrorAction Stop

$hidden = $false
$lastPos = [CursorMgr]::GetPos()
$lastMove = [DateTime]::Now

if (Test-Path $StopFile) { Remove-Item $StopFile -Force }

while (-not (Test-Path $StopFile)) {
    Start-Sleep -Milliseconds 100
    $pos = [CursorMgr]::GetPos()
    $dx = [Math]::Abs($pos.X - $lastPos.X)
    $dy = [Math]::Abs($pos.Y - $lastPos.Y)

    if ($dx -gt $DeadZone -or $dy -gt $DeadZone) {
        $lastPos = $pos
        $lastMove = [DateTime]::Now
        if ($hidden) { [CursorMgr]::Show(); $hidden = $false }
    }

    if (-not $hidden -and ([DateTime]::Now - $lastMove).TotalSeconds -ge $Seconds) {
        [CursorMgr]::Hide()
        $hidden = $true
    }
}

[CursorMgr]::Show()
Remove-Item $StopFile -Force
