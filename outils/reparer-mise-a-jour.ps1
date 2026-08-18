# ============================================================
# reparer-mise-a-jour.ps1 — debloquer une mise a jour qui reste
#                            « au desinstallement »
# ------------------------------------------------------------
# A QUI CA S'ADRESSE
#
# Aux installations d'Inko en version 2.6.0 ou anterieure. Leur
# desinstalleur contient un defaut : il arrete « tout ce qui s'execute
# depuis le dossier d'installation »… et il s'execute lui-meme depuis ce
# dossier. Il se tue donc avant d'avoir rien fait, et l'installeur revient
# indefiniment a la page de desinstallation, sans message.
#
# La 2.6.1 corrige le defaut, mais un correctif ne peut pas remonter dans un
# binaire deja installe : c'est l'ANCIEN desinstalleur qui tourne. D'ou ce
# script, a passer UNE FOIS.
#
# CE QU'IL FAIT, EXACTEMENT
#
#   1. arrete Inko (et son serveur embarque) ;
#   2. sauvegarde puis retire la cle qui declenche l'ancien desinstalleur ;
#   3. lance l'installeur, qui pose alors la nouvelle version par-dessus.
#
# CE QU'IL NE TOUCHE PAS
#
# Aucune donnee. La bibliotheque, la progression et les reglages vivent dans
# %APPDATA%\Inko (ou dans un MySQL externe selon la configuration), jamais
# dans le dossier programme. La cle retiree ne sert qu'a la desinstallation,
# et l'installeur la reecrit a la fin.
#
# USAGE
#   .\reparer-mise-a-jour.ps1                    (cherche l'installeur)
#   .\reparer-mise-a-jour.ps1 -Installeur "C:\...\Inko_2.6.1_x64-setup.exe"
#   .\reparer-mise-a-jour.ps1 -SansLancer        (prepare seulement)
# ============================================================
[CmdletBinding()]
param(
    [string] $Installeur,
    [switch] $SansLancer
)

$ErrorActionPreference = 'Stop'
$CLE = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Inko'

function Dire($texte) { Write-Host $texte }
function Bien($texte) { Write-Host "  $texte" -ForegroundColor Green }
function Alerte($texte) { Write-Host "  $texte" -ForegroundColor Yellow }

Dire ''
Dire 'Reparation de la mise a jour d''Inko'
Dire '-----------------------------------'

# ── 1. Ou est installe Inko ? ───────────────────────────────
# On lit le dossier dans la base de registres plutot que de le supposer :
# l'installation « pour cet utilisateur » peut avoir ete deplacee.
$dossier = $null
if (Test-Path $CLE) {
    $p = Get-ItemProperty $CLE
    if ($p.InstallLocation) { $dossier = $p.InstallLocation.Trim('"') }
}
if (-not $dossier) { $dossier = Join-Path $env:LOCALAPPDATA 'Inko' }

if (-not (Test-Path $dossier)) {
    Alerte "Aucune installation trouvee dans $dossier."
    Alerte "Rien a reparer : lance simplement l'installeur."
    exit 0
}
Dire "Installation : $dossier"

# ── 2. Arreter Inko ─────────────────────────────────────────
# Par CHEMIN, jamais par nom : un « node.exe » personnel ne doit pas etre
# emporte au passage.
$vises = @(Get-CimInstance Win32_Process |
           Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($dossier, 'OrdinalIgnoreCase') })
if ($vises.Count) {
    Dire ''
    Dire 'Arret d''Inko :'
    foreach ($v in $vises) {
        Dire "  - $($v.Name) (PID $($v.ProcessId))"
        Stop-Process -Id $v.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 1200
    $reste = @(Get-CimInstance Win32_Process |
               Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($dossier, 'OrdinalIgnoreCase') })
    if ($reste.Count) {
        Alerte "$($reste.Count) processus resiste(nt). Ferme Inko a la main, puis relance ce script."
        exit 1
    }
    Bien 'Inko est arrete.'
} else {
    Bien 'Inko ne tournait pas.'
}

# ── 3. Retirer la cle, apres sauvegarde ─────────────────────
if (Test-Path $CLE) {
    $sauve = Join-Path $env:TEMP 'inko-uninstall-key.reg'
    & reg.exe export 'HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Inko' $sauve /y | Out-Null
    Dire ''
    Dire "Sauvegarde de la cle : $sauve"
    Dire '  (pour revenir en arriere : double-clic sur ce fichier)'
    Remove-Item $CLE -Recurse -Force
    Bien 'Cle retiree — l''installeur ne passera plus par l''ancien desinstalleur.'
} else {
    Bien 'La cle est deja absente.'
}

# ── 4. Lancer l'installeur ──────────────────────────────────
if ($SansLancer) {
    Dire ''
    Bien 'Pret. Lance maintenant l''installeur d''Inko.'
    exit 0
}

if (-not $Installeur) {
    # Le plus recent des installeurs presents dans les telechargements.
    $Installeur = Get-ChildItem (Join-Path $env:USERPROFILE 'Downloads') -Filter 'Inko*setup*.exe' -ErrorAction SilentlyContinue |
                  Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
}

if (-not $Installeur -or -not (Test-Path $Installeur)) {
    Dire ''
    Alerte 'Installeur introuvable dans le dossier Telechargements.'
    Alerte 'Telecharge la derniere version, puis lance-la :'
    Alerte '  https://github.com/Abdoulrazack1/Inko/releases/latest'
    exit 0
}

Dire ''
Dire "Lancement de : $(Split-Path $Installeur -Leaf)"
Start-Process -FilePath $Installeur
Bien 'L''installation devrait maintenant aller au bout.'
