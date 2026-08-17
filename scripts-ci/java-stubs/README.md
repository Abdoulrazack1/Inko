# Stubs Java — vérifier le code Android SANS le SDK

Ces fichiers ne sont **jamais compilés dans l'APK**. Ils existent pour une
seule raison : permettre de compiler `android/app/src/main/java/**` sur une
machine qui n'a pas le SDK Android.

## Pourquoi ils sont nécessaires

Installer le SDK Android suppose d'accepter les conditions de licence de
Google — un acte qui engage la personne qui l'accepte, et qui n'a donc pas à
être fait automatiquement. Sans SDK, `gradlew` ne peut pas tourner, et le code
Java n'était vérifié qu'en intégration continue : un retour de plusieurs
minutes, après un `push`, pour une erreur de signature qui se voit en trois
secondes.

## Ce que la vérification attrape, et ce qu'elle n'attrape pas

**Attrape** : erreurs de syntaxe, types, signatures d'`@Override`, cibles
d'annotation, génériques, exceptions vérifiées. C'est exactement la catégorie
d'erreurs qu'on commet en écrivant du Java sans le compiler.

**Attrape aussi les ressources** depuis le widget (P3.5). Un `R.java` est
**dérivé de `android/app/src/main/res/`** à chaque exécution : noms de gabarits,
identifiants `@+id/…`, chaînes, couleurs, drawables. Ce n'est pas le `R` d'aapt
— les valeurs sont arbitraires — mais ce sont les **noms** qu'on se trompe à
écrire, et c'est là que la faute est invisible : `R.id.widget_titre` écrit pour
un identifiant qui n'existe pas ne lève rien à l'exécution, le widget se pose
simplement vide ou inerte. Vérifié en cassant volontairement un identifiant :
la compilation échoue.

**N'attrape pas** : le comportement réel des API d'Android, le manifeste,
ProGuard, et la correspondance entre le `R` dérivé et celui qu'aapt produira.
Ceux-là relèvent de la compilation réelle, faite en CI et par le démarrage sur
émulateur.

## D'où viennent les signatures

Les stubs Capacitor sont relevés dans les **sources réelles** livrées avec le
paquet — `node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/`.
Ce n'est donc pas une reconstitution de mémoire : une signature qui change chez
Capacitor fera échouer la vérification, ce qui est le comportement voulu.

Les stubs Android reprennent les signatures publiées par la documentation, pour
les seules méthodes que ce projet appelle. Ajouter un appel à une API absente
d'ici demande d'ajouter le stub correspondant — c'est volontaire : ça force à
regarder la signature exacte.

## Utilisation

```
npm run verif-java
```

`JAVA_HOME` est cherché automatiquement (voir `scripts-ci/verifier-java-android.js`).
