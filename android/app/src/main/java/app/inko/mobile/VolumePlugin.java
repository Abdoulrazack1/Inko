package app.inko.mobile;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Le seul rôle de ce greffon est de laisser la PAGE dire si elle veut les
 * touches de volume.
 *
 * On aurait pu interroger la page à chaque appui — mais `evaluateJavascript`
 * est asynchrone, et `dispatchKeyEvent` doit répondre TOUT DE SUITE si
 * l'événement est consommé. Attendre la réponse voudrait dire laisser passer
 * la touche d'abord, donc afficher le curseur de volume du système par-dessus
 * la planche à chaque page tournée.
 *
 * Le sens est donc inversé : la page DÉCLARE son intention en entrant dans le
 * lecteur et la retire en sortant, et Java n'a plus qu'un booléen à lire.
 *
 * `static` assumé : il n'y a qu'une activité et qu'un WebView. Une instance
 * par appel de plugin ne servirait qu'à compliquer la lecture depuis
 * `dispatchKeyEvent`, qui n'a pas de référence au greffon.
 */
@CapacitorPlugin(name = "InkoVolume")
public class VolumePlugin extends Plugin {

    /** Lu par `MainActivity.dispatchKeyEvent`, à chaque appui. */
    public static volatile boolean actif = false;

    @PluginMethod
    public void setActif(PluginCall call) {
        actif = Boolean.TRUE.equals(call.getBoolean("actif", false));
        call.resolve();
    }

    /**
     * Filet de sécurité : si la page est rechargée ou remplacée pendant que le
     * lecteur était ouvert, personne n'aurait remis le drapeau à zéro et les
     * touches de volume resteraient confisquées pour toute la session — un
     * défaut qu'on attribuerait au téléphone, pas à l'application.
     */
    @Override
    public void handleOnPause() {
        actif = false;
    }
}
