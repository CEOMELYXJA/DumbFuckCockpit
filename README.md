# DumbFuckCockpit — cockpit de vie

Cockpit spatial animé, servi comme site statique par GitHub Pages.

## Quelle version ouvrir ?

- **Le site web** est la version complète et interactive. Utilisez-le pour ouvrir les menus, gérer vos tâches et voir les mises à jour du site.
- **Le widget Windows** affiche le visuel animé sur le bureau, derrière les icônes. Il laisse passer les clics; les menus et les tâches du site ne sont pas utilisables dans cette couche.
- Pour voir le widget, lancez le widget et fermez la fenêtre du site. Vous n’avez pas besoin d’ouvrir les deux en même temps.
- Les deux utilisent les visuels du même projet; les tâches sauvegardées dans le site ne sont pas copiées dans le widget.

## Installer le widget Windows

1. Ouvrez [les téléchargements Windows](https://github.com/CEOMELYXJA/DumbFuckCockpit/releases/latest) et enregistrez le fichier **DumbFuckCockpit-Widget-…-x64.exe** dans **Téléchargements**.
2. Double-cliquez le fichier. Il s’installe automatiquement dans le dossier des applications Windows, crée **un seul raccourci** sur le Bureau et démarre le widget.
3. Fermez la fenêtre du site web pour voir le visuel sur le bureau.
4. Pour les réglages, double-cliquez de nouveau sur le raccourci du Bureau. Fermer les réglages laisse le widget actif.

Le fichier téléchargé est l’installateur. Il ne faut pas le décompresser ni choisir un dossier sur le Bureau. L’installation ne crée aucun dossier sur le Bureau; elle y place seulement le raccourci du widget.

## Fonctions du site web

- **Carte :** zoom, déplacement et menus des univers.
- **Tâches :** ajouter, classer, prioriser, estimer et suivre des tâches; importer des fichiers `.txt` et `.md`; exporter une sauvegarde `.json`.
- **Classement :** les catégories reconnues sont proposées à l’import; les sections inconnues restent « À trier ».
- **Conservation :** les tâches du site sont enregistrées dans le navigateur et ne se synchronisent pas entre appareils. Exportez une sauvegarde JSON pour les déplacer.

## Mises à jour

Le widget Windows prend une copie du visuel du site lors de sa publication. Les changements du site ne mettent pas à jour une installation Windows déjà faite; téléchargez la nouvelle version Windows pour actualiser le widget.

Le site fonctionne sans compilation. Il utilise GitHub Pages et un service worker pour son fonctionnement hors ligne.

