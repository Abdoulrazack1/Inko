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

**N'attrape pas** : le comportement réel des API d'Android, les ressources
(`R.*`), le manifeste, ProGuard. Ceux-là relèvent de la compilation réelle,
faite en CI et par le démarrage sur émulateur.

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
