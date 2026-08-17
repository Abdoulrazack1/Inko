package app.inko.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/**
 * Widget d'écran d'accueil « Reprendre » (audit P3.5).
 *
 * Reprendre sa lecture demandait quatre gestes : ouvrir Inko, attendre le
 * chargement, trouver la série, retrouver le chapitre. Le widget les remplace
 * par un seul appui, depuis l'écran d'accueil — et il AFFICHE où on en est,
 * ce qui suffit souvent sans même ouvrir l'application.
 *
 * ── Pourquoi il ne va pas chercher les données lui-même ─────
 *
 * Un widget ne peut pas appeler l'API : il n'a ni session, ni cookie, ni
 * l'adresse du hub — celle-ci vit dans le stockage du WebView, auquel un
 * `AppWidgetProvider` n'a pas accès. Et il tourne dans un processus qui peut
 * être réveillé alors que l'application n'a jamais démarré.
 *
 * Le sens est donc inversé, comme pour {@link RaccourcisPlugin} : c'est la PAGE
 * qui pousse son état dans les `SharedPreferences` quand elle lit, et le widget
 * se contente de peindre ce qu'il y trouve. Il n'a aucune logique, donc rien
 * qui puisse diverger de l'application.
 *
 * ── Pourquoi l'appui réutilise l'intention des notifications ─
 *
 * Ouvrir le bon chapitre demande de faire naviguer une page pas encore
 * chargée. Ce problème est déjà résolu : {@link RaccourcisPlugin} reçoit un
 * chemin via `EXTRA_LIEN`, le valide, et la page vient le chercher quand elle
 * est prête. Le widget dépose exactement la même intention — un seul chemin
 * d'entrée à sécuriser, et un seul à maintenir.
 */
public class WidgetReprise extends AppWidgetProvider {

    /** Espace propre au widget : il survit à la désinstallation du hub, pas à celle de l'app. */
    static final String PREFS = "inko_widget";
    static final String CLE_TITRE = "titre";
    static final String CLE_SOUS_TITRE = "sous_titre";
    static final String CLE_LIEN = "lien";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager gestionnaire, int[] ids) {
        for (int id : ids) peindre(ctx, gestionnaire, id);
    }

    /** Repeint tous les exemplaires posés sur l'écran d'accueil. */
    static void rafraichirTout(Context ctx) {
        AppWidgetManager g = AppWidgetManager.getInstance(ctx);
        int[] ids = g.getAppWidgetIds(new ComponentName(ctx, WidgetReprise.class));
        if (ids == null) return;
        for (int id : ids) peindre(ctx, g, id);
    }

    private static void peindre(Context ctx, AppWidgetManager gestionnaire, int id) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String titre = p.getString(CLE_TITRE, null);
        String sousTitre = p.getString(CLE_SOUS_TITRE, "");
        String lien = p.getString(CLE_LIEN, null);

        RemoteViews vues = new RemoteViews(ctx.getPackageName(), R.layout.widget_reprise);

        // Un widget vide ne doit pas ressembler à un widget cassé : il DIT
        // pourquoi il est vide, et reste cliquable pour ouvrir l'application.
        boolean vide = titre == null || titre.isEmpty();
        vues.setTextViewText(R.id.widget_titre, vide ? "Rien en cours" : titre);
        vues.setTextViewText(R.id.widget_sous_titre,
                vide ? "Ouvrir Inko pour commencer" : sousTitre);

        Intent i = new Intent(ctx, MainActivity.class);
        i.setAction(Intent.ACTION_MAIN);
        i.addCategory(Intent.CATEGORY_LAUNCHER);
        // `singleTask` + CLEAR_TOP : un appui alors que l'app est déjà ouverte
        // doit atterrir sur le chapitre, pas empiler une seconde activité.
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (!vide && lien != null && !lien.isEmpty()) {
            i.putExtra(RaccourcisPlugin.EXTRA_LIEN, lien);
        }

        // FLAG_IMMUTABLE est OBLIGATOIRE à partir d'Android 12 : sans lui,
        // `getActivity` lève et le widget reste inerte. Il est disponible
        // depuis l'API 23, donc sûr sur notre plancher (API 26).
        int drapeaux = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        // Le code de requête doit changer avec le LIEN : à code égal,
        // FLAG_UPDATE_CURRENT réutilise l'intention précédente et le widget
        // rouvrirait éternellement le premier chapitre lu.
        int code = lien == null ? 0 : lien.hashCode();
        PendingIntent pi = PendingIntent.getActivity(ctx, code, i, drapeaux);
        vues.setOnClickPendingIntent(R.id.widget_racine, pi);

        gestionnaire.updateAppWidget(id, vues);
    }
}
