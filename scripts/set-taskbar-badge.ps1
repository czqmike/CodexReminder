param(
    [ValidateRange(0, 10000)]
    [int]$Count = 0,

    [ValidateRange(1, 999)]
    [int]$MaxCount = 99,

    [string]$WorkspaceName = "",

    [int]$ExtensionHostPid = 0,

    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.Runtime.InteropServices;

namespace CodexReminder.Native {
    internal enum TBPFLAG {
        TBPF_NOPROGRESS = 0,
        TBPF_INDETERMINATE = 0x1,
        TBPF_NORMAL = 0x2,
        TBPF_ERROR = 0x4,
        TBPF_PAUSED = 0x8
    }

    [ComImport]
    [Guid("C43DC798-95D1-4BEA-9030-BB99E2983A1A")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface ITaskbarList4 {
        [PreserveSig] int HrInit();
        void AddTab(IntPtr hwnd);
        void DeleteTab(IntPtr hwnd);
        void ActivateTab(IntPtr hwnd);
        void SetActiveAlt(IntPtr hwnd);
        void MarkFullscreenWindow(IntPtr hwnd, [MarshalAs(UnmanagedType.Bool)] bool fullscreen);
        void SetProgressValue(IntPtr hwnd, ulong completed, ulong total);
        void SetProgressState(IntPtr hwnd, TBPFLAG flags);
        void RegisterTab(IntPtr tab, IntPtr mdi);
        void UnregisterTab(IntPtr tab);
        void SetTabOrder(IntPtr tab, IntPtr insertBefore);
        void SetTabActive(IntPtr tab, IntPtr mdi, uint reserved);
        void ThumbBarAddButtons(IntPtr hwnd, uint buttonCount, IntPtr buttons);
        void ThumbBarUpdateButtons(IntPtr hwnd, uint buttonCount, IntPtr buttons);
        void ThumbBarSetImageList(IntPtr hwnd, IntPtr imageList);
        void SetOverlayIcon(
            IntPtr hwnd,
            IntPtr icon,
            [MarshalAs(UnmanagedType.LPWStr)] string description
        );
        void SetThumbnailTooltip(
            IntPtr hwnd,
            [MarshalAs(UnmanagedType.LPWStr)] string tooltip
        );
        void SetThumbnailClip(IntPtr hwnd, IntPtr clip);
        void SetTabProperties(IntPtr tab, uint flags);
    }

    [ComImport]
    [Guid("56FDF344-FD6D-11d0-958A-006097C9A090")]
    internal class TaskbarList {
    }

    public static class Badge {
        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool DestroyIcon(IntPtr icon);

        public static void Probe() {
            ITaskbarList4 taskbar = (ITaskbarList4)new TaskbarList();
            try {
                int result = taskbar.HrInit();
                if (result != 0) {
                    Marshal.ThrowExceptionForHR(result);
                }
            }
            finally {
                Marshal.FinalReleaseComObject(taskbar);
            }
        }

        public static void Set(IntPtr windowHandle, int count, int maxCount) {
            ITaskbarList4 taskbar = (ITaskbarList4)new TaskbarList();
            try {
                int result = taskbar.HrInit();
                if (result != 0) {
                    Marshal.ThrowExceptionForHR(result);
                }

                if (count <= 0) {
                    taskbar.SetOverlayIcon(windowHandle, IntPtr.Zero, "");
                    return;
                }

                string label = count > maxCount ? maxCount.ToString() + "+" : count.ToString();
                using (Bitmap bitmap = new Bitmap(32, 32, PixelFormat.Format32bppArgb))
                using (Graphics graphics = Graphics.FromImage(bitmap))
                using (Brush background = new SolidBrush(Color.FromArgb(232, 17, 35)))
                using (Brush foreground = new SolidBrush(Color.White))
                using (Pen border = new Pen(Color.FromArgb(245, 245, 245), 1.5f))
                using (StringFormat format = new StringFormat()) {
                    graphics.Clear(Color.Transparent);
                    graphics.SmoothingMode = SmoothingMode.AntiAlias;
                    graphics.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
                    graphics.FillEllipse(background, 1.5f, 1.5f, 29.0f, 29.0f);
                    graphics.DrawEllipse(border, 2.0f, 2.0f, 28.0f, 28.0f);

                    float fontSize = label.Length == 1 ? 19.0f :
                                     label.Length == 2 ? 15.0f : 10.5f;
                    using (Font font = new Font(
                        "Segoe UI",
                        fontSize,
                        FontStyle.Bold,
                        GraphicsUnit.Pixel
                    )) {
                        format.Alignment = StringAlignment.Center;
                        format.LineAlignment = StringAlignment.Center;
                        RectangleF bounds = new RectangleF(0.0f, -1.0f, 32.0f, 32.0f);
                        graphics.DrawString(label, font, foreground, bounds, format);
                    }

                    IntPtr icon = bitmap.GetHicon();
                    try {
                        taskbar.SetOverlayIcon(windowHandle, icon, "Unread Codex messages: " + count);
                    }
                    finally {
                        DestroyIcon(icon);
                    }
                }
            }
            finally {
                Marshal.FinalReleaseComObject(taskbar);
            }
        }
    }
}
"@

function Get-CodeWindowProcesses {
    $windows = @(
        Get-Process Code -ErrorAction SilentlyContinue |
            Where-Object { $_.MainWindowHandle -ne 0 }
    )
    if ($windows.Count -eq 0) {
        return @()
    }

    $ancestorIds = [System.Collections.Generic.HashSet[int]]::new()
    $currentPid = $ExtensionHostPid
    for ($depth = 0; $depth -lt 16 -and $currentPid -gt 0; $depth++) {
        [void]$ancestorIds.Add($currentPid)
        $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $currentPid" -ErrorAction SilentlyContinue
        if ($null -eq $processInfo -or $processInfo.ParentProcessId -eq $currentPid) {
            break
        }
        $currentPid = [int]$processInfo.ParentProcessId
    }

    $ancestorWindows = @($windows | Where-Object { $ancestorIds.Contains([int]$_.Id) })
    if ($ancestorWindows.Count -gt 0) {
        return $ancestorWindows
    }

    if ($WorkspaceName) {
        $escapedName = [WildcardPattern]::Escape($WorkspaceName)
        $workspaceWindows = @(
            $windows | Where-Object { $_.MainWindowTitle -like "*$escapedName*" }
        )
        if ($workspaceWindows.Count -gt 0) {
            return $workspaceWindows
        }
    }

    if ($windows.Count -eq 1) {
        return $windows
    }

    return $windows
}

$targets = @(Get-CodeWindowProcesses)

if ($DryRun) {
    [CodexReminder.Native.Badge]::Probe()
}
else {
    foreach ($target in $targets) {
        [CodexReminder.Native.Badge]::Set(
            $target.MainWindowHandle,
            $Count,
            $MaxCount
        )
    }
}

[pscustomobject]@{
    count = $Count
    dryRun = [bool]$DryRun
    matchedWindows = $targets.Count
    processIds = @($targets | ForEach-Object { $_.Id })
} | ConvertTo-Json -Compress
