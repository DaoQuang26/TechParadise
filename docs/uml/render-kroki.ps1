param(
    [ValidateSet("png", "svg")]
    [string]$Format = "png",
    [string]$KrokiBaseUrl = "https://kroki.io"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$seqDir = Join-Path $root "sequence"
$analysisDir = Join-Path $root "analysis"
$outDir = Join-Path $root "out"
$outSeqDir = Join-Path $outDir "sequence"
$outAnalysisDir = Join-Path $outDir "analysis"

New-Item -ItemType Directory -Force $outSeqDir | Out-Null
New-Item -ItemType Directory -Force $outAnalysisDir | Out-Null

$endpoint = "$($KrokiBaseUrl.TrimEnd('/'))/plantuml/$Format"

function Render-Folder {
    param(
        [string]$SourceDir,
        [string]$TargetDir,
        [string]$ApiEndpoint,
        [string]$FileExt
    )

    $files = Get-ChildItem -Path $SourceDir -File -Filter "*.puml" | Sort-Object Name
    foreach ($file in $files) {
        $targetPath = Join-Path $TargetDir ($file.BaseName + "." + $FileExt)
        Invoke-WebRequest `
            -Uri $ApiEndpoint `
            -Method Post `
            -ContentType "text/plain; charset=utf-8" `
            -InFile $file.FullName `
            -OutFile $targetPath | Out-Null
        Write-Host "Rendered: $($file.Name) -> $targetPath"
    }
}

Render-Folder -SourceDir $seqDir -TargetDir $outSeqDir -ApiEndpoint $endpoint -FileExt $Format
Render-Folder -SourceDir $analysisDir -TargetDir $outAnalysisDir -ApiEndpoint $endpoint -FileExt $Format

Write-Host "Done."
Write-Host "Sequence images:  $outSeqDir"
Write-Host "Analysis images:  $outAnalysisDir"
