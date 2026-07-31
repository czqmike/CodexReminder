param(
    [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) "images"
}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

function New-RoundedPath {
    param([float]$X, [float]$Y, [float]$Width, [float]$Height, [float]$Radius)
    $diameter = $Radius * 2
    $path = [Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-Canvas {
    param([int]$Width, [int]$Height, [Drawing.Color]$Background)
    $bitmap = [Drawing.Bitmap]::new($Width, $Height, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $graphics.Clear($Background)
    return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function Draw-Text {
    param(
        [Drawing.Graphics]$Graphics,
        [string]$Text,
        [string]$FontName,
        [float]$FontSize,
        [Drawing.FontStyle]$Style,
        [Drawing.Color]$Color,
        [Drawing.RectangleF]$Bounds,
        [Drawing.StringAlignment]$Alignment = [Drawing.StringAlignment]::Near,
        [Drawing.StringAlignment]$LineAlignment = [Drawing.StringAlignment]::Near
    )
    $font = [Drawing.Font]::new($FontName, $FontSize, $Style, [Drawing.GraphicsUnit]::Pixel)
    $brush = [Drawing.SolidBrush]::new($Color)
    $format = [Drawing.StringFormat]::new()
    $format.Alignment = $Alignment
    $format.LineAlignment = $LineAlignment
    try { $Graphics.DrawString($Text, $font, $brush, $Bounds, $format) }
    finally { $format.Dispose(); $brush.Dispose(); $font.Dispose() }
}

function Save-Canvas {
    param($Canvas, [string]$Path)
    try { $Canvas.Bitmap.Save($Path, [Drawing.Imaging.ImageFormat]::Png) }
    finally { $Canvas.Graphics.Dispose(); $Canvas.Bitmap.Dispose() }
}

# Original marketplace icon: a neutral notification bell and numeric badge.
$icon = New-Canvas 512 512 ([Drawing.Color]::Transparent)
$g = $icon.Graphics
$backgroundPath = New-RoundedPath 16 16 480 480 104
$backgroundBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255, 17, 24, 39))
$borderPen = [Drawing.Pen]::new([Drawing.Color]::FromArgb(255, 56, 189, 248), 10)
try {
    $g.FillPath($backgroundBrush, $backgroundPath)
    $g.DrawPath($borderPen, $backgroundPath)
}
finally { $borderPen.Dispose(); $backgroundBrush.Dispose(); $backgroundPath.Dispose() }

$bellBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255, 241, 245, 249))
$bellAccentPen = [Drawing.Pen]::new([Drawing.Color]::FromArgb(255, 56, 189, 248), 10)
$bellAccentPen.StartCap = [Drawing.Drawing2D.LineCap]::Round
$bellAccentPen.EndCap = [Drawing.Drawing2D.LineCap]::Round
$flare = [Drawing.PointF[]]@(
    [Drawing.PointF]::new(190, 286),
    [Drawing.PointF]::new(150, 340),
    [Drawing.PointF]::new(362, 340),
    [Drawing.PointF]::new(322, 286)
)
try {
    $g.FillEllipse($bellBrush, 190, 122, 132, 188)
    $g.FillRectangle($bellBrush, 190, 214, 132, 96)
    $g.FillPolygon($bellBrush, $flare)
    $g.FillEllipse($bellBrush, 235, 104, 42, 42)
    $g.DrawLine($bellAccentPen, 158, 344, 354, 344)
}
finally { $bellAccentPen.Dispose(); $bellBrush.Dispose() }
$clapperBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255, 241, 245, 249))
try { $g.FillEllipse($clapperBrush, 222, 356, 68, 48) } finally { $clapperBrush.Dispose() }

$badgeBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255, 232, 17, 35))
$badgeBorder = [Drawing.Pen]::new([Drawing.Color]::White, 8)
try {
    $g.FillEllipse($badgeBrush, 326, 70, 138, 138)
    $g.DrawEllipse($badgeBorder, 330, 74, 130, 130)
}
finally { $badgeBorder.Dispose(); $badgeBrush.Dispose() }
Draw-Text $g '3' 'Segoe UI' 78 ([Drawing.FontStyle]::Bold) ([Drawing.Color]::White) ([Drawing.RectangleF]::new(326, 63, 138, 145)) ([Drawing.StringAlignment]::Center) ([Drawing.StringAlignment]::Center)
Save-Canvas $icon (Join-Path $OutputDirectory 'icon.png')

# Anonymized illustration of the Windows taskbar overlay.
$taskbar = New-Canvas 1200 675 ([Drawing.Color]::FromArgb(255, 10, 17, 31))
$g = $taskbar.Graphics
$gradient = [Drawing.Drawing2D.LinearGradientBrush]::new(
    [Drawing.Rectangle]::new(0, 0, 1200, 675),
    [Drawing.Color]::FromArgb(255, 15, 23, 42),
    [Drawing.Color]::FromArgb(255, 30, 64, 105),
    28.0
)
try { $g.FillRectangle($gradient, 0, 0, 1200, 675) } finally { $gradient.Dispose() }
Draw-Text $g 'Windows taskbar badge' 'Segoe UI' 46 ([Drawing.FontStyle]::Bold) ([Drawing.Color]::White) ([Drawing.RectangleF]::new(70, 72, 900, 70))
Draw-Text $g 'Notice a completed reply or input request while VS Code is in the background.' 'Segoe UI' 24 ([Drawing.FontStyle]::Regular) ([Drawing.Color]::FromArgb(255, 203, 213, 225)) ([Drawing.RectangleF]::new(72, 155, 1000, 80))
$cardPath = New-RoundedPath 70 270 1060 190 28
$cardBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(225, 15, 23, 42))
try { $g.FillPath($cardBrush, $cardPath) } finally { $cardBrush.Dispose(); $cardPath.Dispose() }
Draw-Text $g '7 unread Codex replies or questions' 'Segoe UI' 34 ([Drawing.FontStyle]::Bold) ([Drawing.Color]::White) ([Drawing.RectangleF]::new(250, 318, 760, 55))
Draw-Text $g 'The number clears when you return to the active conversation.' 'Segoe UI' 22 ([Drawing.FontStyle]::Regular) ([Drawing.Color]::FromArgb(255, 148, 163, 184)) ([Drawing.RectangleF]::new(250, 382, 760, 45))
$miniIconPath = New-RoundedPath 110 310 96 96 22
$miniIconBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255, 14, 116, 144))
try { $g.FillPath($miniIconBrush, $miniIconPath) } finally { $miniIconBrush.Dispose(); $miniIconPath.Dispose() }
Draw-Text $g '<>' 'Consolas' 38 ([Drawing.FontStyle]::Bold) ([Drawing.Color]::White) ([Drawing.RectangleF]::new(110, 310, 96, 96)) ([Drawing.StringAlignment]::Center) ([Drawing.StringAlignment]::Center)
$taskbarBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(242, 12, 19, 33))
try { $g.FillRectangle($taskbarBrush, 0, 565, 1200, 110) } finally { $taskbarBrush.Dispose() }
$appTilePath = New-RoundedPath 552 581 78 78 18
$appTileBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255, 14, 116, 144))
try { $g.FillPath($appTileBrush, $appTilePath) } finally { $appTileBrush.Dispose(); $appTilePath.Dispose() }
Draw-Text $g '<>' 'Consolas' 30 ([Drawing.FontStyle]::Bold) ([Drawing.Color]::White) ([Drawing.RectangleF]::new(552, 581, 78, 78)) ([Drawing.StringAlignment]::Center) ([Drawing.StringAlignment]::Center)
$smallBadgeBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255, 232, 17, 35))
$smallBadgePen = [Drawing.Pen]::new([Drawing.Color]::White, 3)
try { $g.FillEllipse($smallBadgeBrush, 609, 570, 46, 46); $g.DrawEllipse($smallBadgePen, 611, 572, 42, 42) }
finally { $smallBadgePen.Dispose(); $smallBadgeBrush.Dispose() }
Draw-Text $g '7' 'Segoe UI' 25 ([Drawing.FontStyle]::Bold) ([Drawing.Color]::White) ([Drawing.RectangleF]::new(609, 568, 46, 48)) ([Drawing.StringAlignment]::Center) ([Drawing.StringAlignment]::Center)
Draw-Text $g 'Anonymized illustration' 'Segoe UI' 16 ([Drawing.FontStyle]::Regular) ([Drawing.Color]::FromArgb(255, 100, 116, 139)) ([Drawing.RectangleF]::new(970, 635, 210, 24)) ([Drawing.StringAlignment]::Far)
Save-Canvas $taskbar (Join-Path $OutputDirectory 'taskbar-badge.png')

# Anonymized illustration of the VS Code status bar fallback.
$status = New-Canvas 1200 450 ([Drawing.Color]::FromArgb(255, 30, 30, 30))
$g = $status.Graphics
$topBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255, 50, 50, 50))
$sideBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255, 37, 37, 38))
$editorBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255, 30, 30, 30))
try {
    $g.FillRectangle($topBrush, 0, 0, 1200, 46)
    $g.FillRectangle($sideBrush, 0, 46, 265, 365)
    $g.FillRectangle($editorBrush, 265, 46, 935, 365)
}
finally { $editorBrush.Dispose(); $sideBrush.Dispose(); $topBrush.Dispose() }
Draw-Text $g 'sample-workspace' 'Segoe UI' 18 ([Drawing.FontStyle]::Regular) ([Drawing.Color]::FromArgb(255, 220, 220, 220)) ([Drawing.RectangleF]::new(450, 9, 300, 30)) ([Drawing.StringAlignment]::Center)
Draw-Text $g 'EXPLORER' 'Segoe UI' 14 ([Drawing.FontStyle]::Bold) ([Drawing.Color]::FromArgb(255, 180, 180, 180)) ([Drawing.RectangleF]::new(20, 68, 220, 24))
Draw-Text $g '  src' 'Segoe UI' 18 ([Drawing.FontStyle]::Regular) ([Drawing.Color]::FromArgb(255, 210, 210, 210)) ([Drawing.RectangleF]::new(20, 112, 220, 30))
Draw-Text $g '    extension.js' 'Segoe UI' 18 ([Drawing.FontStyle]::Regular) ([Drawing.Color]::FromArgb(255, 210, 210, 210)) ([Drawing.RectangleF]::new(20, 150, 220, 30))
Draw-Text $g 'extension.js' 'Segoe UI' 18 ([Drawing.FontStyle]::Regular) ([Drawing.Color]::FromArgb(255, 225, 225, 225)) ([Drawing.RectangleF]::new(290, 61, 250, 32))
$lineBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255, 86, 156, 214))
$mutedLineBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255, 90, 90, 90))
try {
    for ($i = 0; $i -lt 7; $i++) {
        $y = 120 + ($i * 38)
        $width = 370 + (($i % 3) * 110)
        $g.FillRectangle($(if ($i % 2 -eq 0) { $lineBrush } else { $mutedLineBrush }), 330, $y, $width, 12)
    }
}
finally { $mutedLineBrush.Dispose(); $lineBrush.Dispose() }
$statusBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255, 0, 122, 204))
try { $g.FillRectangle($statusBrush, 0, 411, 1200, 39) } finally { $statusBrush.Dispose() }
Draw-Text $g 'main*' 'Segoe UI' 16 ([Drawing.FontStyle]::Regular) ([Drawing.Color]::White) ([Drawing.RectangleF]::new(20, 418, 100, 25))
Draw-Text $g 'Ln 24, Col 8     UTF-8' 'Segoe UI' 16 ([Drawing.FontStyle]::Regular) ([Drawing.Color]::White) ([Drawing.RectangleF]::new(770, 418, 250, 25))
Draw-Text $g 'Codex 3' 'Segoe UI' 17 ([Drawing.FontStyle]::Bold) ([Drawing.Color]::White) ([Drawing.RectangleF]::new(1050, 416, 125, 28)) ([Drawing.StringAlignment]::Far)
Save-Canvas $status (Join-Path $OutputDirectory 'status-bar.png')

Write-Output (Join-Path $OutputDirectory 'icon.png')
Write-Output (Join-Path $OutputDirectory 'taskbar-badge.png')
Write-Output (Join-Path $OutputDirectory 'status-bar.png')
