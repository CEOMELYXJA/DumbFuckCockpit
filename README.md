# DumbFuckCockpit — cockpit de vie

Cockpit spatial animé, servi comme site statique par GitHub Pages.

- **Carte :** le rendu, les contrôles de zoom et les menus d’univers restent dans leur script original.
- **Tâches :** le bouton « Mes tâches » ouvre un panneau indépendant pour ajouter, classer, prioriser, estimer et suivre des tâches. Les fichiers .txt et .md s’importent avec un aperçu; une copie .json peut être exportée ou restaurée.
- **Classement :** les catégories reconnues par titre de section sont proposées à l’import. Toute section inconnue reste « À trier »; rien n’est deviné.
- **Conservation :** le gestionnaire utilise sa propre clé locale qg-personal-tasks-v2. Il ne remplace pas la progression sauvegardée sous qg-v3. Les tâches de l’essai précédent sont copiées automatiquement si aucune nouvelle sauvegarde n’existe; l’ancienne valeur reste intacte.
- **Installation :** ouvrez le site dans Microsoft Edge et choisissez **Applications → Installer ce site comme une application**. Après la première visite, les fichiers de l’application restent disponibles hors ligne.
- **Limite :** les données restent dans le navigateur et ne sont pas synchronisées entre appareils. Exportez une copie .json pour la déplacer.

Le site fonctionne sans compilation. Le service worker vérifie le réseau avant d’utiliser sa copie hors ligne pour que les changements publiés soient chargés rapidement.

## Application Windows

**[Télécharger le widget transparent DumbFuckCockpit pour Windows](https://github.com/CEOMELYXJA/DumbFuckCockpit/releases/latest)** — le programme ouvre son panneau de réglages, place la scène derrière les icônes et ne bloque pas leurs clics. L’accès aux préférences est le bouton « ⚙ Réglages »; `Ctrl+Alt+Espace` est un raccourci secondaire.

L’application et le site gardent des sauvegardes séparées. Les tâches se déplacent par export et import JSON; le navigateur n’est jamais lu directement par l’application.

