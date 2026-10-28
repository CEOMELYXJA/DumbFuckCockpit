# QG – Cockpit de vie

Cockpit spatial animé, servi comme site statique par GitHub Pages.

- **Tâches :** bouton « Mes tâches » pour créer et organiser sa liste, importer un fichier `.txt`/`.md`, ou restaurer une copie `.json`. Les lignes sans section reconnue arrivent dans « À trier »; aucune tâche n’est attribuée au hasard.
- **Installation :** ouvrez le site dans Microsoft Edge et choisissez **Applications → Installer ce site comme une application**. Le site peut ensuite s’ouvrir dans une fenêtre autonome et continuer hors ligne après sa première visite.
- **Données :** tâches et progression sont conservées dans le stockage local du navigateur. Elles ne sont pas synchronisées entre appareils; téléchargez une copie JSON avant de changer d’appareil.

Le projet fonctionne sans compilation. Le service worker met en cache les fichiers locaux de l’application; la police distante reprend la police de système hors ligne.
