Add-Type -AssemblyName System.Drawing

$logoPath = Resolve-Path "public/devfinity.png"
if (-not (Test-Path $logoPath)) {
    Write-Error "Logo file not found at $logoPath"
    exit 1
}

$sourceImg = [System.Drawing.Image]::FromFile($logoPath)
$srcWidth = $sourceImg.Width
$srcHeight = $sourceImg.Height
$srcAspect = $srcWidth / $srcHeight

Write-Host "Loaded source logo: $($srcWidth)x$($srcHeight) (Aspect ratio: $([math]::Round($srcAspect, 2)))"

function CreateSquareBitmap($source, $size, $paddingRatio = 0.05) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $availSize = $size * (1.0 - ($paddingRatio * 2))
    if ($srcAspect -ge 1.0) {
        $destWidth = $availSize
        $destHeight = $availSize / $srcAspect
    } else {
        $destHeight = $availSize
        $destWidth = $availSize * $srcAspect
    }

    $destX = ($size - $destWidth) / 2.0
    $destY = ($size - $destHeight) / 2.0

    $destRect = New-Object System.Drawing.RectangleF $destX, $destY, $destWidth, $destHeight
    $g.DrawImage($source, $destRect)
    $g.Dispose()

    return $bmp
}

# Sizes to generate
$sizes = @(
    @{ Name = "favicon-16x16.png"; Size = 16 },
    @{ Name = "favicon-32x32.png"; Size = 32 },
    @{ Name = "apple-touch-icon.png"; Size = 180 },
    @{ Name = "android-chrome-192x192.png"; Size = 192 },
    @{ Name = "android-chrome-512x512.png"; Size = 512 }
)

$targetDirs = @("public/favicons", "public/icons")
foreach ($dir in $targetDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

foreach ($item in $sizes) {
    $bmp = CreateSquareBitmap $sourceImg $item.Size 0.05
    foreach ($dir in $targetDirs) {
        $outPath = Join-Path $dir $item.Name
        $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Host "Generated: $outPath ($($item.Size)x$($item.Size))"
    }
    $bmp.Dispose()
}

# Also generate a multi-frame ICO (16x16, 32x32, 48x48)
function GenerateIcoFile($outputPath, $source) {
    $icoSizes = @(16, 32, 48)
    $pngStreams = @()

    foreach ($s in $icoSizes) {
        $bmp = CreateSquareBitmap $source $s 0.05
        $ms = New-Object System.IO.MemoryStream
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        $pngStreams += @{ Size = $s; Bytes = $ms.ToArray() }
        $ms.Dispose()
    }

    $fileStream = [System.IO.File]::Create($outputPath)
    $bw = New-Object System.IO.BinaryWriter $fileStream

    # ICONDIR header: 2 bytes reserved (0), 2 bytes type (1 for ico), 2 bytes image count
    $bw.Write([uint16]0)
    $bw.Write([uint16]1)
    $bw.Write([uint16]$pngStreams.Count)

    # Offset to image data = 6 + (16 * count)
    $offset = 6 + (16 * $pngStreams.Count)

    # ICONDIRENTRY for each image
    foreach ($img in $pngStreams) {
        $widthByte = if ($img.Size -ge 256) { 0 } else { [byte]$img.Size }
        $heightByte = if ($img.Size -ge 256) { 0 } else { [byte]$img.Size }

        $bw.Write([byte]$widthByte)         # Width
        $bw.Write([byte]$heightByte)        # Height
        $bw.Write([byte]0)                  # Color count (0 if >= 8bpp)
        $bw.Write([byte]0)                  # Reserved
        $bw.Write([uint16]1)                # Color planes (1)
        $bw.Write([uint16]32)               # Bits per pixel (32 for PNG)
        $bw.Write([uint32]$img.Bytes.Length)# Size of image data
        $bw.Write([uint32]$offset)          # Offset in file

        $offset += $img.Bytes.Length
    }

    # Write actual PNG data blocks
    foreach ($img in $pngStreams) {
        $bw.Write($img.Bytes, 0, $img.Bytes.Length)
    }

    $bw.Flush()
    $bw.Close()
    $fileStream.Close()

    Write-Host "Generated ICO: $outputPath (with sizes: $($icoSizes -join ', '))"
}

GenerateIcoFile "public/favicons/favicon.ico" $sourceImg
GenerateIcoFile "public/icons/favicon.ico" $sourceImg
GenerateIcoFile "public/favicon.ico" $sourceImg
GenerateIcoFile "src/app/favicon.ico" $sourceImg

$sourceImg.Dispose()
Write-Host "All favicons generated successfully from devfinity.png!"
