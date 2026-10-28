# Widget transparent DumbFuckCockpit pour Windows

La version Windows affiche **la carte 3D originale de l’application Chrome** sur le bureau. Le paquet reprend `index.html`, `tasks.js`, `tasks.css` et les autres ressources du cockpit à chaque publication. La scène conserve les treize univers, le style et l’animation du site.

## Utilisation

1. Installez **DumbFuckCockpit Widget** depuis [la dernière version Windows](https://github.com/CEOMELYXJA/DumbFuckCockpit/releases/latest).
2. Lancez le raccourci du menu Démarrer. Le panneau indique si la couche transparente est active.
3. Choisissez le côté opposé à vos icônes et ajustez la transparence ou le mouvement.
4. Fermez le panneau avec **×**. La carte reste animée derrière les icônes et leurs clics continuent de fonctionner.

Pour rouvrir les réglages, relancez le même raccourci ou utilisez `Ctrl+Alt+Espace`. Le bouton **Ouvrir mon cockpit Chrome** ouvre l’application que vous utilisez déjà.

**Aucun univers JSON n’a à être importé pour afficher le widget.** Le compagnon Windows ne présente plus de deuxième gestionnaire de tâches. La progression enregistrée par Chrome reste dans le profil Chrome; le widget utilise son propre profil Windows.

## Comportement du bureau

- Le code de la carte est le même que celui publié sur GitHub Pages; chaque nouvel installateur intègre la version du site disponible lors de sa compilation.
- La zone du widget occupe le côté choisi de chaque écran. Les fenêtres restent derrière les icônes et la scène ne capte aucun clic.
- L’animation tourne à environ 30 images/s lorsque le bureau est visible, ralentit en mouvement réduit et se met en veille lorsque le bureau est couvert.
- Le lancement avec Windows est facultatif et désactivé par défaut.
- L’état indique si Windows a accepté la couche du bureau. Si Explorer ne fournit pas de surface compatible, la scène reste masquée afin de préserver les clics.

## Développement et publication

Depuis le dossier `desktop`, avec Node.js 24 et Visual Studio Build Tools :

```powershell
npm install
npm start
npm run package
```

Le paquet Windows est construit par GitHub Actions et publié dans [Téléchargements](https://github.com/CEOMELYXJA/DumbFuckCockpit/releases/latest). Les mises à jour du site ne modifient pas une installation existante : installez la dernière version Windows pour actualiser son affichage. L’installateur n’est pas signé; Windows peut afficher un avertissement d’éditeur non vérifié.

