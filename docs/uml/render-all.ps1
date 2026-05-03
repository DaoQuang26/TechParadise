param(
    [ValidateSet("png", "svg")]
    [string]$Format = "png",
    [string]$PlantUmlJar = "plantuml.jar"
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

$formatArg = "-t$Format"
$plantumlCmd = Get-Command plantuml -ErrorAction SilentlyContinue

if ($plantumlCmd) {
    Write-Host "Using PlantUML CLI: $($plantumlCmd.Source)"
    plantuml $formatArg "-o" $outSeqDir (Join-Path $seqDir "*.puml")
    plantuml $formatArg "-o" $outAnalysisDir (Join-Path $analysisDir "*.puml")
} elseif (Test-Path $PlantUmlJar) {
    Write-Host "Using PlantUML JAR: $PlantUmlJar"
    java -jar $PlantUmlJar $formatArg "-o" $outSeqDir (Join-Path $seqDir "*.puml")
    java -jar $PlantUmlJar $formatArg "-o" $outAnalysisDir (Join-Path $analysisDir "*.puml")
} else {
    throw "Khong tim thay 'plantuml' command va cung khong thay file jar '$PlantUmlJar'."
}

Write-Host "Done."
Write-Host "Sequence images:  $outSeqDir"
Write-Host "Analysis images:  $outAnalysisDir"
