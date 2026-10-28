# DumbFuckCockpit Widget 0.4.1

Correction du démarrage de la couche transparente : Windows reçoit maintenant la poignée de fenêtre au format natif attendu. Le widget ne doit plus rester bloqué sur « non disponible » quand Explorer fournit la surface du bureau.

Le panneau de réglages ne s’ouvre plus automatiquement. La scène démarre directement sur le bureau; les réglages restent accessibles depuis l’icône de notification ou `Ctrl+Alt+Espace`.

La fenêtre PWA de Chrome ne peut pas être transformée en couche du bureau par Windows. Fermez cette fenêtre pour ne garder que le visuel transparent. Les clics continuent de passer aux icônes; les données locales de Chrome ne sont pas synchronisées avec le widget.

Compatible avec Windows 10 et Windows 11. L’installateur n’est pas signé et Windows peut afficher un avertissement d’éditeur non vérifié.
