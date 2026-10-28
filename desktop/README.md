# DumbFuckCockpit Widget — scène transparente Windows

DumbFuckCockpit Widget ajoute une scène spatiale animée et transparente directement au bureau Windows. Elle reste derrière les icônes et laisse leurs clics intacts. Au lancement manuel du programme, le panneau de réglages s’ouvre pour montrer que l’application a bien démarré.

## La règle d’interface

**La couche 01 ne prend jamais les clics.** Un processus de rendu dédié reçoit une fenêtre Electron transparente par écran. Le petit module Win32 cherche l’hôte wallpaper `WorkerW`, place cette fenêtre dans la couche de fond d’Explorer et la configure comme non activante. L’isolement évite que le changement de contexte DPI qu’impose parfois un parent Explorer ne déforme la fenêtre de commande. Explorer conserve donc la priorité d’affichage de ses icônes et de leurs libellés. Si cette hôte n’est pas trouvée ou si la greffe échoue, la scène est détruite au lieu de retomber sur une fenêtre toujours au premier plan.

**La couche 02 est la surface de commande.** Le bouton « ⚙ Réglages » ouvre les préférences du widget. `Ctrl+Alt+Espace` ouvre le panneau sur l’écran du pointeur. Le menu de l’icône DumbFuckCockpit près de l’horloge donne aussi accès aux réglages, à l’affichage et à la reconstruction de la couche après un redémarrage d’Explorer. Fermer le panneau le masque sans arrêter le widget.

La carte canvas reprend les treize univers du cockpit. Elle n’affiche pas de fausses tâches : les volumes et le noyau utilisent uniquement le fichier local. Le mouvement est plafonné à environ 30 images/s lorsque le bureau est actif, passe à 1 image/s en mouvement réduit et se suspend quand une autre fenêtre est au premier plan ou quand Windows suspend le processus.

Le statut du panneau indique si le widget est visible, en démarrage, masqué ou bloqué par Windows. Si la couche ne peut pas être attachée derrière les icônes, elle reste masquée afin de ne pas intercepter leurs clics.

## Reprise des tâches

- Import direct de `.txt`, `.md`, `.markdown` et des sauvegardes JSON du cockpit.
- Aperçu et comptage des doublons avant ajout; 500 tâches au maximum.
- Les en-têtes de catégories ne sont reconnus que par nom ou alias exact. Un titre ambigu reste « À trier »; un en-tête inconnu est gardé dans l’aperçu comme élément à vérifier.
- Une tâche peut recevoir un univers, une durée, une priorité et un critère « terminé quand… ». Aucun texte importé ne remplace une tâche existante.
- Le stockage est local à `userData/qg/tasks.json`; les remplacements de fichier sont atomiques. L’export produit le format `qg-personal-tasks` que le site sait réimporter.
- Le site DumbFuckCockpit dans Chrome et le widget Windows gardent des stockages séparés. Les tâches circulent entre les deux par export/import JSON; le programme Windows ne lit pas le stockage du navigateur.

## Démarrage local

Depuis ce dossier, avec Node.js 24 et les outils C++ de Visual Studio Build Tools installés :

```powershell
npm install
npm start
```

L’application cible Windows 10 et 11. Le lancement avec Windows reste désactivé par défaut et peut être activé dans Préférences. Les règles Electron refusent les navigations distantes dans les fenêtres locales; seul le bouton explicite « Ouvrir le cockpit web » ouvre le site dans le navigateur.

## Paquet Windows

La tâche GitHub Actions `DumbFuckCockpit Widget package` produit un installateur NSIS Windows. Le dernier installateur est conservé dans [Téléchargements](https://github.com/CEOMELYXJA/DumbFuckCockpit/releases/latest); l’artefact temporaire de compilation reste disponible 30 jours. Le paquet n’est pas signé; Windows peut afficher l’avertissement d’éditeur non vérifié.

## Limites à résoudre avant diffusion

Explorer n’offre pas d’API publique stable pour la surface `WorkerW`. Le mécanisme de création d’hôte varie selon la version et la configuration du bureau; la couche Win32 est volontairement isolée dans `native/` et revérifiée périodiquement après redémarrage d’Explorer. Si la surface de fond ne peut pas être établie, le widget reste masqué pour protéger les clics sur les icônes. Son état est maintenant affiché dans le panneau.

Les nouvelles versions du programme Windows ne s’installent pas automatiquement avec les mises à jour du site. Téléchargez le dernier installateur et lancez-le pour remplacer le programme.

