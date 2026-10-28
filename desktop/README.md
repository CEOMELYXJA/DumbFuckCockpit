# QG Desktop — prototype à deux couches

QG Desktop explore une autre façon d’habiter le bureau Windows : le cockpit spatial existe comme champ translucide en arrière-plan, derrière les icônes, et son plan de travail apparaît dans une fenêtre distincte à la demande.

## La règle d’interface

**La couche 01 ne prend jamais les clics.** Un processus de rendu dédié reçoit une fenêtre Electron transparente par écran. Le petit module Win32 cherche l’hôte wallpaper `WorkerW`, place cette fenêtre dans la couche de fond d’Explorer et la configure comme non activante. L’isolement évite que le changement de contexte DPI qu’impose parfois un parent Explorer ne déforme la fenêtre de commande. Explorer conserve donc la priorité d’affichage de ses icônes et de leurs libellés. Si cette hôte n’est pas trouvée ou si la greffe échoue, la scène est détruite au lieu de retomber sur une fenêtre toujours au premier plan.

**La couche 02 est une vraie surface de commande.** `Ctrl+Alt+Espace` ouvre le plan de travail sur l’écran du pointeur. Le panneau ne vit pas au-dessus du bureau en permanence. Sa position est retenue; le raccourci peut être relancé lorsqu’il est masqué. `Ctrl+Alt+Maj+Espace` demande à Explorer de reconstruire la couche de fond.

La carte canvas reprend les treize univers du cockpit. Elle n’affiche pas de fausses tâches : les volumes et le noyau utilisent uniquement le fichier local. Le mouvement est plafonné à environ 30 images/s lorsque le bureau est actif, passe à 1 image/s en mouvement réduit et se suspend quand une autre fenêtre est au premier plan ou quand Windows suspend le processus.

La scène peut être masquée depuis les préférences ou le menu de la zone de notification. L’application arrête alors son processus de rendu; le plan de travail et ses tâches continuent de fonctionner. Le raccourci `Ctrl+Alt+Maj+Espace` reconstruit une scène visible après un redémarrage d’Explorer.

## Reprise des tâches

- Import direct de `.txt`, `.md`, `.markdown` et des sauvegardes JSON du cockpit.
- Aperçu et comptage des doublons avant ajout; 500 tâches au maximum.
- Les en-têtes de catégories ne sont reconnus que par nom ou alias exact. Un titre ambigu reste « À trier »; un en-tête inconnu est gardé dans l’aperçu comme élément à vérifier.
- Une tâche peut recevoir un univers, une durée, une priorité et un critère « terminé quand… ». Aucun texte importé ne remplace une tâche existante.
- Le stockage est local à `userData/qg/tasks.json`; les remplacements de fichier sont atomiques. L’export produit le format `qg-personal-tasks` que le site sait réimporter.
- Le navigateur et l’application de bureau ont des stockages séparés. La circulation entre les deux se fait par l’export/import JSON; le stockage local du navigateur n’est jamais lu directement.

## Démarrage local

Depuis ce dossier, avec Node.js 24 et les outils C++ de Visual Studio Build Tools installés :

```powershell
npm install
npm start
```

L’application cible Windows 10 et 11. Le lancement avec Windows reste désactivé par défaut et peut être activé dans Préférences. Les règles Electron refusent les navigations distantes dans les fenêtres locales; seul le bouton explicite « Ouvrir le cockpit web » ouvre le site dans le navigateur.

## Paquet Windows

La tâche GitHub Actions `QG Desktop package` produit un installateur NSIS et une archive ZIP de l’application portable. Le paquet de ce prototype n’est pas signé; Windows peut afficher l’avertissement habituel pour un éditeur non vérifié. Aucun programme n’est installé tant que l’utilisateur ne lance pas l’installateur.

## Limites à résoudre avant diffusion

Explorer n’offre pas d’API publique stable pour la surface `WorkerW`. Le mécanisme de création d’hôte varie selon la version et la configuration du bureau; la couche Win32 est volontairement isolée dans `native/` et revérifiée périodiquement après redémarrage d’Explorer. La réussite du build ne prouve pas encore le bon comportement sur le PC de l’utilisatrice : il faut y vérifier le placement derrière les icônes, l’échelle DPI, les écrans multiples, la veille/reprise et l’état « Afficher le bureau ». Le processus de rendu séparé ajoute une empreinte mémoire au prototype. Si la surface de fond ne peut pas être établie, le widget reste masqué et ses tâches restent accessibles depuis le raccourci ou la zone de notification.

La première version garde la liste de tâches locale à l’application. Une synchronisation automatique en direct avec le navigateur demanderait un pont local sécurisé et son propre flux d’autorisation; elle n’est pas simulée ici.
