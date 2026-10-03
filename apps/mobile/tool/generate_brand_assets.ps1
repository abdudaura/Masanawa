# Renders the UNigeria brand mark (gradient tile + white chat bubble + gradient
# map pin, mirroring lib/src/ui/components/logo.dart) into the PNG assets used
# by flutter_launcher_icons / flutter_native_splash / the web PWA.
#
#   PowerShell -ExecutionPolicy Bypass -File tool/generate_brand_assets.ps1
#
# Outputs (all PNG):
#   assets/brand/icon.png                1024 full-bleed launcher icon
#   assets/brand/icon_foreground.png     1024 adaptive-icon foreground (transparent)
#   assets/brand/splash_mark.png          512 mark on transparent for native splash

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'assets\brand'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$GREEN_FROM = [System.Drawing.ColorTranslator]::FromHtml('#059669')
$GREEN_TO = [System.Drawing.ColorTranslator]::FromHtml('#10B981')
$WHITE = [System.Drawing.Color]::White

function New-RoundedRectPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = 2.0 * $r
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-BubblePath([float]$s) {
    $path = New-RoundedRectPath (0.14 * $s) (0.13 * $s) (0.72 * $s) (0.61 * $s) (0.16 * $s)
    $tail = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF -ArgumentList (0.30 * $s), (0.70 * $s)),
        (New-Object System.Drawing.PointF -ArgumentList (0.16 * $s), (0.96 * $s)),
        (New-Object System.Drawing.PointF -ArgumentList (0.54 * $s), (0.74 * $s))
    )
    $path.AddPolygon($tail)
    $path.CloseFigure()
    return $path
}

function New-PinPath([float]$s) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse((0.35 * $s), (0.25 * $s), (0.30 * $s), (0.30 * $s))
    $point = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF -ArgumentList (0.36 * $s), (0.48 * $s)),
        (New-Object System.Drawing.PointF -ArgumentList (0.64 * $s), (0.48 * $s)),
        (New-Object System.Drawing.PointF -ArgumentList (0.50 * $s), (0.66 * $s))
    )
    $path.AddPolygon($point)
    $path.CloseFigure()
    return $path
}

# angle 135 == LinearGradientMode.ForwardDiagonal (top-left -> bottom-right)
function New-BrandBrush($rect, [System.Drawing.Color]$c1, [System.Drawing.Color]$c2) {
    return New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList $rect, $c1, $c2, 135.0
}

function Draw-Mark($g, [float]$canvas, [float]$scale, [bool]$drawTile, [bool]$roundedTile) {
    $s = $canvas * $scale
    $ox = ($canvas - $s) / 2.0
    $oy = ($canvas - $s) / 2.0
    $g.TranslateTransform($ox, $oy)

    if ($drawTile) {
        $tileRect = New-Object System.Drawing.RectangleF -ArgumentList 0.0, 0.0, $s, $s
        if ($roundedTile) {
            $tilePath = New-RoundedRectPath 0.0 0.0 $s $s (0.24 * $s)
        } else {
            $tilePath = New-Object System.Drawing.Drawing2D.GraphicsPath
            $tilePath.AddRectangle($tileRect)
        }
        $tileBrush = New-BrandBrush $tileRect $GREEN_FROM $GREEN_TO
        $g.FillPath($tileBrush, $tilePath)
        $tileBrush.Dispose()
        $tilePath.Dispose()
    }

    $bubblePath = New-BubblePath $s
    $whiteBrush = New-Object System.Drawing.SolidBrush -ArgumentList $WHITE
    $g.FillPath($whiteBrush, $bubblePath)
    $bubblePath.Dispose()

    $pinPath = New-PinPath $s
    $pinRect = New-Object System.Drawing.RectangleF -ArgumentList 0.0, 0.0, $s, $s
    $pinBrush = New-BrandBrush $pinRect $GREEN_FROM $GREEN_TO
    $g.FillPath($pinBrush, $pinPath)
    $pinBrush.Dispose()
    $pinPath.Dispose()

    $g.FillEllipse($whiteBrush, (0.445 * $s), (0.345 * $s), (0.11 * $s), (0.11 * $s))
    $whiteBrush.Dispose()

    $g.ResetTransform()
}

function Save-Mark($path, [float]$canvas, [float]$scale, [bool]$drawTile, [bool]$roundedTile) {
    $size = [int]$canvas
    $bmp = New-Object System.Drawing.Bitmap -ArgumentList $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    Draw-Mark $g $canvas $scale $drawTile $roundedTile
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "wrote $path"
}

# 1. Full-bleed launcher icon (no transparency; OS masks it).
Save-Mark (Join-Path $outDir 'icon.png') 1024 1.0 $true $false

# 2. Adaptive-icon foreground: mark in the inner 66% safe zone, transparent bg.
Save-Mark (Join-Path $outDir 'icon_foreground.png') 1024 0.62 $false $false

# 3. Native-splash mark on transparent (white rounded tile pops on #047857).
Save-Mark (Join-Path $outDir 'splash_mark.png') 512 0.80 $true $true