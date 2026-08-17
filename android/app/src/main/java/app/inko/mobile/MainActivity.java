package app.inko.mobile;

import android.content.Intent;
import android.os.Bundle;
import android.view.KeyEvent;
import com.getcapacitor.BridgeActivity;

/**
 * Audit IX.8 — tourner les pages avec les touches de volume.
 *
 * Aucun greffon Capacitor officiel ne l'expose, et c'est logique : ces touches
 * appartiennent au système. Il faut donc les intercepter au niveau de
 * l'activité, et prévenir la page.
 *
 * Pourquoi ça vaut la peine : c'est le seul moyen de tourner une page SANS
 * regarder l'écran ni changer de prise — dans les transports, une main sur la
 * barre, ou couché dans le noir. Les lecteurs de manga l'attendent, et son
 * absence se remarque immédiatement chez qui l'a connu ailleurs.
 *
 * ── Trois précautions, chacune pour une raison précise ──────
 *
 * 1. On n'intercepte QUE quand le lecteur le demande (`VolumePlugin.actif`).
 *    Ailleurs, le volume doit rester le volume : le confisquer sur la page
 *    d'accueil ferait passer l'application pour cassée, et personne ne
 *    devinerait pourquoi le son ne change plus.
 *
 * 2. On traite `ACTION_DOWN` et on avale aussi `ACTION_UP`. Ne consommer que la
 *    descente laisserait le système afficher son curseur de volume par-dessus
 *    la planche.
 *
 * 3. Une exception pendant l'appel à la page est ignorée : le lecteur peut
 *    être en cours de chargement. Une touche perdue n'est pas un défaut — une
 *    exception qui remonte à l'activité, si.
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Enregistré AVANT super.onCreate, et ce n'est pas un détail : c'est
        // `onCreate` qui construit le pont à partir du `Bridge.Builder`.
        // Enregistrer après reviendrait à ajouter le greffon à un constructeur
        // déjà consommé — il n'existerait jamais côté page, sans la moindre
        // erreur pour le signaler.
        registerPlugin(VolumePlugin.class);
        registerPlugin(DecouvertePlugin.class);
        registerPlugin(RaccourcisPlugin.class);
        registerPlugin(VeillePlugin.class);
        super.onCreate(savedInstanceState);
        // L'intention de lancement est DÉPOSÉE ici ; c'est la page qui viendra
        // la chercher quand elle sera prête. Naviguer depuis `onCreate`
        // partirait dans le vide : le WebView n'a encore rien chargé.
        RaccourcisPlugin.deposer(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Le raccourci touché alors que l'application tourne déjà : Android ne
        // relance pas l'activité, il livre une nouvelle intention. Sans ce
        // second point d'entrée, le raccourci ne marcherait qu'au tout premier
        // lancement — et paraîtrait cassé ensuite.
        RaccourcisPlugin.deposer(intent);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();
        boolean volume = code == KeyEvent.KEYCODE_VOLUME_UP || code == KeyEvent.KEYCODE_VOLUME_DOWN;

        if (!volume || !VolumePlugin.actif
                || getBridge() == null || getBridge().getWebView() == null) {
            return super.dispatchKeyEvent(event);
        }

        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            // Volume BAS = page suivante. C'est le sens de tous les lecteurs :
            // la touche du bas avance, comme le pouce descend sur une liste.
            final String sens = (code == KeyEvent.KEYCODE_VOLUME_DOWN) ? "suivant" : "precedent";
            // La vue est capturée MAINTENANT : au moment où le message sera
            // dépilé, l'activité peut avoir été détruite et `getBridge()`
            // rendre null.
            final android.webkit.WebView vue = getBridge().getWebView();
            vue.post(() -> {
                try {
                    vue.evaluateJavascript(
                        "window.INKO_toucheVolume && window.INKO_toucheVolume('" + sens + "')", null);
                } catch (Exception ignore) {
                    // Page en cours de chargement : on laisse passer.
                }
            });
        }
        return true;
    }
}
