# ============================================================
# deploy-local.ps1 - Met a jour l'app Inko INSTALLEE avec la
# build fraiche, pour que le raccourci du bureau lance toujours
# la derniere version. Lance automatiquement apres "npm run dist"
# (script postdist) ; peut aussi etre lance seul via "npm run deploy".
#
# Raison : "npm run dist" ne fait que regenerer dist\ ; il ne
# touche PAS l'app installee dans %LOCALAPPDATA%\Programs\Inko.
# Sans cette etape, l'utilisateur relance l'ancien build fige.
# ============================================================
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$distDir = Join-Path $PSScriptRoot '..\dist'
$installDir = Join-Path $env:LOCALAPPDATA 'Programs\Inko'

# 1. Trouver l'installeur le plus recent
$setup = Get-ChildItem -Path $distDir -Filter 'Inko-Setup-*.exe' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $setup) {
    Write-Host "[deploy] Aucun installeur Inko-Setup-*.exe dans $distDir - rien a deployer." -ForegroundColor Yellow
    exit 0
}
Write-Host "[deploy] Installeur : $($setup.Name) ($([math]::Round($setup.Length/1MB,1)) Mo)"

# 2. Arreter les instances Inko en cours (sinon fichiers verrouilles)
$running = Get-Process -Name Inko -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "[deploy] Arret de $($running.Count) instance(s) Inko en cours..."
    $running | Stop-Process -Force
    Start-Sleep -Seconds 2
}

# 3. Installation silencieuse (ecrase l'install existante, garde les raccourcis)
Write-Host "[deploy] Installation silencieuse de la nouvelle version..."
$proc = Start-Process -FilePath $setup.FullName -ArgumentList '/S' -PassThru -Wait
if ($proc.ExitCode -ne 0) {
    Write-Host "[deploy] ECHEC de l'installeur (code $($proc.ExitCode))." -ForegroundColor Red
    exit 1
}
Start-Sleep -Seconds 2

# 4. Verification : l'app installee doit contenir le code frais
$installedExe = Join-Path $installDir 'Inko.exe'
$freshExe     = Join-Path $distDir 'win-unpacked\Inko.exe'
$marker       = Join-Path $installDir 'resources\frontend\assets\js\userdata.js'

if (-not (Test-Path $installedExe)) {
    Write-Host "[deploy] Inko.exe introuvable apres install : $installedExe" -ForegroundColor Red
    exit 1
}
$instTime = (Get-Item $installedExe).LastWriteTime
$ok = $true
if (Test-Path $freshExe) {
    $freshTime = (Get-Item $freshExe).LastWriteTime
    Write-Host "[deploy] Installe : $instTime"
    Write-Host "[deploy] Build    : $freshTime"
    if ([math]::Abs(($instTime - $freshTime).TotalSeconds) -gt 180) { $ok = $false }
}
if (-not (Test-Path $marker)) { $ok = $false }

if ($ok) {
    Write-Host "[deploy] OK - l'app installee (%LOCALAPPDATA%\Programs\Inko) est a jour." -ForegroundColor Green
} else {
    Write-Host "[deploy] ATTENTION - l'install ne semble pas a jour, verifie manuellement." -ForegroundColor Yellow
    exit 1
}
