# ============================================================
# deploy-local.ps1 - Met a jour l'app Inko INSTALLEE avec la
# build fraiche, pour que le raccourci du bureau lance toujours
# la derniere version. Lance automatiquement apres "npm run dist"
# (script postdist) ; peut aussi etre lance seul via "npm run deploy".
#
# Methode : COPIE DIRECTE de dist\win-unpacked par-dessus l'install
# (%LOCALAPPDATA%\Programs\Inko). On NE lance PAS l'installeur en
# reinstallation : ca evite l'etape de desinstallation qui affichait
# "Echec de la desinstallation" quand l'app tournait encore.
# Les raccourcis (Bureau + Menu Demarrer) pointent deja vers ce
# dossier : ils continuent de fonctionner. Le desinstalleur est
# conserve (copie sans purge).
# ============================================================
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$distDir = Join-Path $PSScriptRoot '..\dist'
$src     = Join-Path $distDir 'win-unpacked'
$dst     = Join-Path $env:LOCALAPPDATA 'Programs\Inko'

if (-not (Test-Path (Join-Path $src 'Inko.exe'))) {
    Write-Host "[deploy] build win-unpacked introuvable ($src) - rien a deployer." -ForegroundColor Yellow
    exit 0
}

# 1. Arreter TOUTES les instances d'Inko et attendre la liberation des fichiers
for ($i = 0; $i -lt 12; $i++) {
    $procs = Get-Process -Name Inko -ErrorAction SilentlyContinue
    if (-not $procs) { break }
    Write-Host "[deploy] Arret de $($procs.Count) instance(s) Inko..."
    $procs | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 700
}
Start-Sleep -Seconds 1

# 2. Premiere installation absente ? -> installeur silencieux (cree les raccourcis)
if (-not (Test-Path (Join-Path $dst 'Inko.exe'))) {
    $setup = Get-ChildItem -Path $distDir -Filter 'Inko-Setup-*.exe' -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($setup) {
        Write-Host "[deploy] Premiere installation (silencieuse)..."
        Start-Process -FilePath $setup.FullName -ArgumentList '/S' -Wait
        Start-Sleep -Seconds 2
    }
}

# 3. Copie directe de la build fraiche par-dessus l'install (sans desinstallation)
Write-Host "[deploy] Mise a jour par copie directe (sans desinstallation)..."
$args = @("`"$src`"", "`"$dst`"", '/E', '/R:4', '/W:1', '/NJH', '/NJS', '/NDL', '/NFL', '/NP')
$rc = Start-Process -FilePath 'robocopy.exe' -ArgumentList $args -Wait -PassThru -WindowStyle Hidden
# robocopy : 0-7 = succes, >=8 = echec
if ($rc.ExitCode -ge 8) {
    Write-Host "[deploy] ECHEC robocopy (code $($rc.ExitCode)) - fichiers peut-etre verrouilles." -ForegroundColor Red
    exit 1
}

# 4. Verification
$installedExe = Join-Path $dst 'Inko.exe'
$marker       = Join-Path $dst 'resources\frontend\assets\js\userdata.js'
if ((Test-Path $installedExe) -and (Test-Path $marker)) {
    Write-Host "[deploy] OK - l'app installee est a jour : $((Get-Item $installedExe).LastWriteTime)" -ForegroundColor Green
} else {
    Write-Host "[deploy] ATTENTION - verification incomplete (Inko.exe ou resources manquants)." -ForegroundColor Yellow
    exit 1
}
