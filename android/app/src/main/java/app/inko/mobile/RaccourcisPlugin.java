package app.inko.mobile;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Raccourcis de l'icône de lancement (audit IX/P3.5).
 *
 * Un appui long sur l'icône d'Inko ne montrait RIEN. Les raccourcis PWA
 * existaient déjà — mais ils ne valent que pour le site installé depuis un
 * navigateur ; Android ne les lit pas dans l'APK. Il faut les déclarer une
 * seconde fois, en XML.
 *
 * ── Pourquoi la page est DEMANDÉE et non poussée ────────────
 *
 * Le premier réflexe est de faire naviguer le WebView depuis `onCreate`. Mais
 * à cet instant la page n'est pas chargée : la navigation part dans le vide, ou
 * se fait écraser par le chargement qui suit. Ajouter un délai marche « la
 * plupart du temps » — c'est-à-dire pas sur un téléphone lent, celui-là même
 * où le raccourci sert le plus.
 *
 * Le sens est donc inversé : Android dépose l'intention, et la PAGE vient la
 * chercher quand elle est prête. Elle ne peut pas arriver trop tôt.
 *
 * L'intention est CONSOMMÉE à la lecture : sans ça, revenir à l'accueil et
 * recharger renverrait indéfiniment sur la page du raccourci, et l'utilisateur
 * se croirait bloqué.
 */
@CapacitorPlugin(name = "InkoRaccourcis")
public class RaccourcisPlugin extends Plugin {

    static final String EXTRA = "inko_page";
    /** Chemin complet déposé par une notification (VeilleWorker). */
    static final String EXTRA_LIEN = "inko_lien";

    /** Déposée par l'intention de lancement, retirée à la première lecture. */
    private static volatile String enAttente = null;

    static void deposer(Intent intent) {
        if (intent == null) return;

        // Deux sources, deux formes. Le raccourci d'icône désigne une PAGE
        // (« bibliotheque.html ») ; une notification désigne un CHEMIN complet
        // avec ses paramètres (« /chapitre.html?manga=...&chapter=... »).
        // Les valider pareil rejetterait l'un ou laisserait passer l'autre.
        String lien = intent.getStringExtra(EXTRA_LIEN);
        if (lien != null && lien.startsWith("/") && !lien.startsWith("//")
                // Le tiret est placé EN DERNIER dans la classe : il n'y a alors
                // rien à échapper, et `"\-"` est justement un échappement
                // illégal en Java (contrairement aux regex écrites en JS).
                && lien.matches("/[A-Za-z0-9_./?=&%-]*")) {
            enAttente = lien.substring(1);
            return;
        }

        String page = intent.getStringExtra(EXTRA);
        if (page == null || page.isEmpty()) return;
        // Le raccourci vient de NOTRE manifeste, mais une application tierce
        // peut fabriquer la même intention. On n'accepte donc qu'un nom de
        // fichier simple : ni chemin, ni schéma, ni hôte.
        if (!page.matches("[A-Za-z0-9_-]+\\.html")) return;
        enAttente = page;
    }

    @PluginMethod
    public void pageDemandee(PluginCall call) {
        JSObject r = new JSObject();
        r.put("page", enAttente);
        enAttente = null;   // consommée : un rechargement ne doit pas la rejouer
        call.resolve(r);
    }
}
