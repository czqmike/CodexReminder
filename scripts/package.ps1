param(
    [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$package = Get-Content -LiteralPath (Join-Path $projectRoot "package.json") -Raw |
    ConvertFrom-Json

if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $projectRoot "dist"
}

$resolvedProjectRoot = [IO.Path]::GetFullPath($projectRoot)
$resolvedOutput = [IO.Path]::GetFullPath($OutputDirectory)
$temporaryRoot = [IO.Path]::GetFullPath(
    (Join-Path ([IO.Path]::GetTempPath()) ("codex-reminder-vsix-" + [Guid]::NewGuid()))
)
$temporaryBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())

if (-not $temporaryRoot.StartsWith($temporaryBase, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to use a staging directory outside the system temporary directory."
}

$extensionRoot = Join-Path $temporaryRoot "extension"
$archivePath = Join-Path $temporaryRoot "codex-reminder.zip"
$vsixName = "codex-reminder-$($package.version).vsix"
$vsixPath = Join-Path $resolvedOutput $vsixName

New-Item -ItemType Directory -Force -Path $extensionRoot | Out-Null
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null

try {
    foreach ($relativePath in @(
        "package.json",
        "README.md",
        "LICENSE",
        "src",
        "scripts\set-taskbar-badge.ps1"
    )) {
        $destination = Join-Path $extensionRoot $relativePath
        $destinationParent = Split-Path -Parent $destination
        New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
        Copy-Item -LiteralPath (Join-Path $resolvedProjectRoot $relativePath) `
            -Destination $destination -Recurse -Force
    }

    Copy-Item -LiteralPath (Join-Path $resolvedProjectRoot "build\extension.vsixmanifest") `
        -Destination (Join-Path $temporaryRoot "extension.vsixmanifest")
    Copy-Item -LiteralPath (Join-Path $resolvedProjectRoot "build\[Content_Types].xml") `
        -Destination (Join-Path $temporaryRoot "[Content_Types].xml")

    Compress-Archive -LiteralPath @(
        (Join-Path $temporaryRoot "[Content_Types].xml"),
        (Join-Path $temporaryRoot "extension.vsixmanifest"),
        $extensionRoot
    ) -DestinationPath $archivePath -CompressionLevel Optimal

    Copy-Item -LiteralPath $archivePath -Destination $vsixPath -Force
    Write-Output $vsixPath
}
finally {
    if (
        (Test-Path -LiteralPath $temporaryRoot) -and
        $temporaryRoot.StartsWith($temporaryBase, [StringComparison]::OrdinalIgnoreCase)
    ) {
        Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
    }
}
