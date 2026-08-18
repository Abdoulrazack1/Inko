; ============================================================
; installer-hooks.nsh — arret du serveur embarque avant ecriture
; ------------------------------------------------------------
; NSIS sait fermer l'application qu'il installe : il cherche « inko.exe ».
; Mais Inko ne tient pas ses fichiers avec inko.exe — il les tient avec son
; SIDECAR, un « node.exe » lance depuis le dossier d'installation. Ce
; processus-la, l'installeur ne le connaissait pas.
;
; Resultat, constate a l'installation de la 2.5.1 puis de la 2.5.3 :
;
;   Erreur lors de l'ouverture du fichier en ecriture :
;   "C:\Users\...\AppData\Local\Inko\node.exe"
;   [Abandonner] [Recommencer] [Ignorer]
;
; « Ignorer » est le piege : l'installation se poursuit avec l'ancien
; node.exe et les nouvelles resources — deux versions dans la meme app.
;
; La croix REDUIT Inko dans la zone de notification (audit AMEL-93) : on
; croit l'avoir ferme alors qu'il tourne toujours. Ce cas n'est donc pas
; rare, c'est le cas NORMAL — et la mise a jour integree lance justement cet
; installeur pendant que l'app tourne.
;
; On filtre par CHEMIN : seuls les processus lances depuis le dossier
; d'installation sont arretes. Jamais le Node ni le MariaDB personnels de
; l'utilisateur — meme precaution que dans main.rs (audit DESK-04).
;
; ---- 2.6.1 : le hook se TUAIT LUI-MEME a la desinstallation ----
;
; Tauri lance l'ancien desinstalleur avec `_?=$INSTDIR` : uninstall.exe tourne
; donc DEPUIS le dossier d'installation. Le filtre « tout ce qui s'execute sous
; $INSTDIR » le visait donc lui aussi, et Stop-Process le tuait avant qu'il
; n'ait rien fait — avant meme d'ecrire sa trace.
;
; Vu de l'utilisateur : la mise a jour 2.5.7 -> 2.6.0 « bloque au
; desinstallement ». L'installeur parent attend un processus mort, retrouve
; inko.exe toujours present, et revient a la page de desinstallation. En
; boucle, sans message.
;
; Reproduit sur un faux dossier d'installation avant correction :
;   ACTUEL  : sidecar.exe/8560, uninstall.exe/15608   <- il se vise lui-meme
;   CORRIGE : sidecar.exe/8560
;
; La parade n'ajoute PAS de liste de noms (ce serait fragile) : on remonte la
; chaine des ancetres du PowerShell qui execute le filtre, et on les epargne.
; Le desinstalleur est l'un d'eux, par construction.
; ============================================================

; LogicLib se protege lui-meme contre la double inclusion : on ne depend pas
; du fait que le modele Tauri l'inclue deja.
!include LogicLib.nsh

!macro ArreterProcessusInko
    DetailPrint "Arret du serveur embarque d'Inko..."

    ; Chaine delimitee par des BACKTICKS. Premiere version ecrite avec des
    ; apostrophes : en NSIS, doubler une apostrophe ne l'echappe pas, elle
    ; termine la chaine. Les backticks laissent utiliser " et ' sans conflit.
    ;
    ; `$$` produit un `$` litteral : sans cela NSIS tenterait d'interpreter
    ; `$avant` ou `$_` comme SES propres variables.
    ;
    ; `Get-CimInstance Win32_Process` et NON `Get-Process` : un installeur NSIS
    ; est un binaire 32 bits, donc nsExec lance le PowerShell de SysWOW64. Un
    ; processus 32 bits ne peut pas lire le chemin d'un processus 64 bits —
    ; `Get-Process().Path` rendait null, le filtre par chemin ne trouvait rien,
    ; et le hook s'achevait avec un code 0 rassurant pendant que le sidecar
    ; tenait toujours node.exe. C'est la trace ci-dessous qui l'a montre :
    ; « avant: » etait vide alors que node tournait. WMI, lui, repond
    ; independamment du bitness.
    ;
    ; On filtre sur le seul CHEMIN, sans liste de noms : ce qui doit s'arreter,
    ; c'est tout ce qui tourne depuis le dossier d'installation, quel que soit
    ; son nom. Et rien d'autre — c'est ce qui protege le Node et le MariaDB
    ; personnels de l'utilisateur.
    ;
    ; `$$anc` : la chaine des ancetres de CE PowerShell. Le desinstalleur en
    ; fait partie par construction — c'est lui qui nous lance — et l'epargner
    ; est ce qui empeche le hook de se suicider. On remonte par
    ; ParentProcessId, avec une garde anti-boucle : un PID recycle peut se
    ; designer lui-meme comme parent, et la boucle ne s'arreterait jamais.
    ;
    ; Le code de retour est rendu SIGNIFIANT : 1 si — et seulement si — un
    ; processus tient encore le dossier apres la tentative d'arret. Les
    ; ancetres sont exclus du constat aussi : uninstall.exe tiendra toujours
    ; $INSTDIR pendant qu'il s'execute, et le compter rendrait le hook
    ; perpetuellement en echec.
    nsExec::ExecToStack `powershell -NoProfile -NonInteractive -Command "$$tous = Get-CimInstance Win32_Process; $$par = @{}; $$tous | ForEach-Object { $$par[[int]$$_.ProcessId] = [int]$$_.ParentProcessId }; $$anc = @(); $$p = $$PID; while ($$p -and $$par.ContainsKey($$p)) { $$anc += $$p; $$p = $$par[$$p]; if ($$anc -contains $$p) { break } }; $$anc += $$p; $$sel = { @(Get-CimInstance Win32_Process | Where-Object { $$_.ExecutablePath -like '$INSTDIR\*' -and $$anc -notcontains [int]$$_.ProcessId }) }; $$avant = @(& $$sel); Write-Output ('ancetres: ' + ($$anc -join ',')); Write-Output ('avant: ' + (($$avant | ForEach-Object { $$_.Name + '/' + $$_.ProcessId }) -join ',')); $$avant | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 700; $$apres = @(& $$sel); Write-Output ('apres: ' + (($$apres | ForEach-Object { $$_.Name + '/' + $$_.ProcessId }) -join ',')); if ($$apres.Count -gt 0) { exit 1 } else { exit 0 }"`
    Pop $0
    Pop $2

    ; Trace dans %TEMP%\inko-installeur.log. Un hook qui echoue en silence est
    ; exactement ce qui a fait croire deux fois que le probleme etait corrige :
    ; l'installeur rendait 0 et le sidecar tournait toujours.
    FileOpen $3 "$TEMP\inko-installeur.log" w
    FileWrite $3 "INSTDIR=[$INSTDIR]$\r$\ncode=$0$\r$\n$2$\r$\n"
    FileClose $3

    ${If} $0 != 0
        DetailPrint "ATTENTION : un processus tient encore $INSTDIR (code $0)."
        DetailPrint "Detail dans %TEMP%\inko-installeur.log"
    ${Else}
        DetailPrint "Serveur embarque arrete."
    ${EndIf}

    ; Le temps que Windows libere reellement les handles : sans cette pause,
    ; l'ecriture peut encore echouer juste apres l'arret.
    Sleep 1500
!macroend

!macro NSIS_HOOK_PREINSTALL
    !insertmacro ArreterProcessusInko
!macroend

; La desinstallation se heurte au meme verrou, avec en prime un dossier qui
; ne peut pas etre supprime.
!macro NSIS_HOOK_PREUNINSTALL
    !insertmacro ArreterProcessusInko
!macroend
