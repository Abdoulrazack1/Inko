package app.inko.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Notifications de nouveaux chapitres SANS Firebase.
 *
 * ── Pourquoi ne pas se contenter de FCM ─────────────────────
 *
 * FCM impose de créer un projet Google, d'y rattacher l'application, et de
 * confier au serveur de Google le fait de réveiller le téléphone. Pour un
 * lecteur AUTO-HÉBERGÉ dont le hub est le PC du salon, c'est une dépendance
 * étrange : il faut passer par Mountain View pour apprendre qu'un chapitre est
 * arrivé sur une machine située à trois mètres.
 *
 * Et surtout, elle n'est pas gratuite en pratique : sans les clés de quelqu'un,
 * la fonction n'existe pas du tout.
 *
 * Ici, le téléphone demande lui-même. `WorkManager` réveille ce travailleur au
 * plus toutes les quinze minutes — c'est le minimum imposé par Android, et
 * c'est très bien : un chapitre n'est pas une urgence. Le travail respecte le
 * mode Doze, ne tourne que si le réseau est là, et survit au redémarrage.
 *
 * FCM reste possible en plus : les deux chemins écrivent la même notification.
 * Celui-ci marche sans rien demander à personne.
 *
 * ── Ce que ce travailleur NE fait pas ───────────────────────
 *
 * Il ne scrute pas les sources. Le hub le fait déjà, à son rythme, et range le
 * résultat dans `notifications`. Le téléphone ne fait que LIRE ce qui est déjà
 * décidé — sinon deux logiques de détection cohabiteraient, et diverger serait
 * une question de temps.
 */
public class VeilleWorker extends Worker {

    static final String PREFS = "inko_veille";
    static final String CLE_URL = "hub_url";
    static final String CLE_JETON = "jeton";
    static final String CLE_DERNIER = "dernier_id";
    static final String CANAL = "chapitres";

    public VeilleWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        SharedPreferences p = getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String base = p.getString(CLE_URL, null);
        String jeton = p.getString(CLE_JETON, null);
        // Pas encore appairé, ou notifications coupées : ce n'est pas un échec.
        // Rendre `retry()` ici ferait réessayer indéfiniment un travail qui n'a
        // rien à faire, et WorkManager applique un recul exponentiel qu'on
        // paierait en réveils inutiles.
        if (base == null || jeton == null) return Result.success();

        try {
            JSONArray items = lireNotifications(base, jeton);
            if (items == null) return Result.retry();   // hub injoignable : plus tard

            int dernierVu = p.getInt(CLE_DERNIER, 0);
            int plusGrand = dernierVu;
            int montrees = 0;

            // Les notifications arrivent de la plus RÉCENTE à la plus ancienne.
            // On les parcourt à l'envers pour les afficher dans l'ordre où
            // elles se sont produites — sinon la pile de notifications
            // d'Android présente le plus vieux chapitre en haut.
            for (int i = items.length() - 1; i >= 0; i--) {
                JSONObject n = items.optJSONObject(i);
                if (n == null) continue;
                int id = n.optInt("id", 0);
                if (id <= dernierVu) continue;          // déjà vue
                if (plusGrand < id) plusGrand = id;
                if (n.optInt("is_read", 0) == 1) continue;   // lue ailleurs entre-temps
                // Au plus cinq d'un coup : au retour de vacances, la
                // bibliothèque peut avoir trente chapitres de retard, et trente
                // notifications empilées ne s'utilisent pas — elles se balaient.
                if (montrees >= 5) continue;
                afficher(id, n.optString("title", "Inko"), n.optString("body", ""),
                        n.optString("link", ""));
                montrees++;
            }

            // Le repère avance MÊME si l'on n'a rien affiché (déjà lues,
            // au-delà du plafond) : sans ça, les mêmes notifications
            // reviendraient à chaque réveil, indéfiniment.
            if (plusGrand > dernierVu) p.edit().putInt(CLE_DERNIER, plusGrand).apply();
            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        }
    }

    private JSONArray lireNotifications(String base, String jeton) {
        HttpURLConnection c = null;
        try {
            URL u = new URL(base + "/api/me/notifications?limit=10");
            c = (HttpURLConnection) u.openConnection();
            c.setRequestMethod("GET");
            c.setRequestProperty("Authorization", "Bearer " + jeton);
            c.setRequestProperty("Accept", "application/json");
            // Bornés : un hub qui ne répond pas ne doit pas retenir un
            // travailleur en arrière-plan, qu'Android finirait par tuer.
            c.setConnectTimeout(8000);
            c.setReadTimeout(8000);

            int code = c.getResponseCode();
            // 401 : le jeton a été révoqué depuis le PC. On efface ce qu'on
            // garde ici — continuer d'interroger avec un jeton mort ne réveille
            // le téléphone que pour se faire refuser.
            if (code == 401) {
                getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                        .edit().remove(CLE_JETON).apply();
                return new JSONArray();
            }
            if (code != 200) return null;

            StringBuilder sb = new StringBuilder();
            try (BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"))) {
                String ligne;
                while ((ligne = r.readLine()) != null) sb.append(ligne);
            }
            JSONObject o = new JSONObject(sb.toString());
            return o.optJSONArray("items");
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private void afficher(int id, String titre, String corps, String lien) {
        Context ctx = getApplicationContext();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        // Depuis Android 8, une notification sans canal déclaré est REJETÉE,
        // silencieusement. Le canal est créé ici plutôt qu'au démarrage : ce
        // travailleur peut s'exécuter alors que l'application n'a pas été
        // ouverte depuis des jours.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel canal = new NotificationChannel(
                    CANAL, "Nouveaux chapitres", NotificationManager.IMPORTANCE_DEFAULT);
            canal.setDescription("Quand une série que tu suis publie un chapitre.");
            nm.createNotificationChannel(canal);
        }

        Intent i = new Intent(ctx, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        // Le lien vient du hub, mais il finit dans une intention : on ne
        // transporte qu'un chemin interne. Une URL absolue n'ouvrirait rien de
        // bon, et la page refuserait de la suivre de toute façon.
        if (lien != null && lien.startsWith("/") && !lien.startsWith("//")) {
            i.putExtra(RaccourcisPlugin.EXTRA_LIEN, lien);
        }
        // FLAG_IMMUTABLE : obligatoire depuis Android 12, et correct partout
        // ailleurs — cette intention n'a aucune raison d'être modifiable par
        // qui la reçoit.
        int drapeaux = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getActivity(ctx, id, i, drapeaux);

        Notification.Builder b = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                ? new Notification.Builder(ctx, CANAL)
                : new Notification.Builder(ctx);
        b.setContentTitle(titre)
         .setContentText(corps)
         .setSmallIcon(android.R.drawable.stat_notify_more)
         .setAutoCancel(true)
         .setContentIntent(pi);

        nm.notify(id, b.build());
    }
}
