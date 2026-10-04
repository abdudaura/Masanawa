# Masanawa brand asset helper.
#
# The approved agent-conversation artwork is canonical. This script never
# redraws or reinterprets the mark; it only produces compatibility copies for
# launcher/splash tooling that still expects the older filenames.
#
#   PowerShell -ExecutionPolicy Bypass -File tool/generate_brand_assets.ps1

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'assets\brand'
$source = Join-Path $outDir 'masanawa_agent_logo.png'

if (-not (Test-Path $source)) {
    throw "Missing approved source artwork: $source"
}

function Save-Resized([string]$path, [int]$size) {
    $src = [System.Drawing.Image]::FromFile($source)
    try {
        $bmp = New-Object System.Drawing.Bitmap -ArgumentList $size, $size
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        try {
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $g.DrawImage($src, 0, 0, $size, $size)
            $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $g.Dispose()
            $bmp.Dispose()
        }
    } finally {
        $src.Dispose()
    }
    Write-Host "wrote $path"
}

Save-Resized (Join-Path $outDir 'icon.png') 1024
Save-Resized (Join-Path $outDir 'icon_foreground.png') 1024
Save-Resized (Join-Path $outDir 'splash_mark.png') 512
