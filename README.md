# QG – Cockpit de vie

Cockpit spatial animé, servi comme site statique par GitHub Pages.

- **Carte :** le rendu, les contrôles de zoom et les menus d’univers restent dans leur script original.
- **Tâches :** le bouton « Mes tâches » ouvre un panneau indépendant pour ajouter, classer, prioriser, estimer et suivre des tâches. Les fichiers .txt et .md s’importent avec un aperçu; une copie .json peut être exportée ou restaurée.
- **Classement :** les catégories reconnues par titre de section sont proposées à l’import. Toute section inconnue reste « À trier »; rien n’est deviné.
- **Conservation :** le gestionnaire utilise sa propre clé locale qg-personal-tasks-v2. Il ne remplace pas la progression sauvegardée sous qg-v3. Les tâches de l’essai précédent sont copiées automatiquement si aucune nouvelle sauvegarde n’existe; l’ancienne valeur reste intacte.
- **Installation :** ouvrez le site dans Microsoft Edge et choisissez **Applications → Installer ce site comme une application**. Après la première visite, les fichiers de l’application restent disponibles hors ligne.
- **Limite :** les données restent dans le navigateur et ne sont pas synchronisées entre appareils. Exportez une copie .json pour la déplacer.

Le site fonctionne sans compilation. Le service worker vérifie le réseau avant d’utiliser sa copie hors ligne pour que les changements publiés soient chargés rapidement.

## Prototype Windows séparé

La branche `desktop/orchestrator-layer-prototype-2026-10-28` contient un prototype d’application de bureau à deux couches : une scène transparente placée derrière les icônes Windows et un plan de travail qui s’ouvre à la demande. Le site publié reste indépendant. Voir [desktop/README.md](desktop/README.md) pour l’architecture, la reprise des tâches et le paquet Windows.
