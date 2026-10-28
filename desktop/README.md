# Widget transparent DumbFuckCockpit pour Windows

Le widget Windows affiche la scène spatiale du cockpit en transparence, intégrée à la couche du bureau et derrière les icônes. Le paquet reprend les fichiers du site à chaque publication.

Windows ne permet pas de transformer directement une fenêtre PWA de Chrome en fond de bureau. Le petit programme Windows fournit donc la couche transparente. Une fois le widget lancé, fermez la fenêtre Chrome si vous voulez ne garder que le visuel du bureau. Le panneau de réglages ne s’ouvre que sur demande.

## Utilisation

1. Installez **DumbFuckCockpit Widget** depuis [la dernière version Windows](https://github.com/CEOMELYXJA/DumbFuckCockpit/releases/latest).
2. Lancez le raccourci du menu Démarrer. La scène transparente se place sur le bureau; aucune fenêtre de réglages ne s’ouvre.
3. Fermez la fenêtre PWA de Chrome pour ne garder que le bureau avec la scène.
4. Ouvrez les réglages avec un double-clic sur l’icône près de l’horloge ou avec `Ctrl+Alt+Espace`.

Le bouton **Ouvrir mon cockpit Chrome** ouvre le site interactif dans Chrome. Ce dernier reste une application distincte du widget de bureau.

**Aucun univers JSON n’a à être importé pour afficher le widget.** La progression et les tâches enregistrées par le site restent dans le profil Chrome; elles ne sont pas synchronisées avec cette couche de bureau. Les clics traversent la scène et continuent de viser les icônes.

## Comportement du bureau

- La zone du widget occupe le côté choisi de chaque écran. Les fenêtres restent derrière les icônes et la scène ne capte aucun clic.
- L’animation tourne à environ 30 images/s lorsque le bureau est visible, ralentit en mouvement réduit et se met en veille lorsque le bureau est couvert.
- Le lancement avec Windows est facultatif et désactivé par défaut.
- L’état des réglages indique si Windows a accepté la couche du bureau. Si Explorer ne fournit pas de surface compatible, la scène reste masquée afin de préserver les clics.

## Développement et publication

Depuis le dossier `desktop`, avec Node.js 24 et Visual Studio Build Tools :

```powershell
npm install
npm start
npm run package
```

Le paquet Windows est construit par GitHub Actions et publié dans [Téléchargements](https://github.com/CEOMELYXJA/DumbFuckCockpit/releases/latest). Les mises à jour du site ne modifient pas une installation existante : installez la dernière version Windows pour actualiser son affichage. L’installateur n’est pas signé; Windows peut afficher un avertissement d’éditeur non vérifié.
