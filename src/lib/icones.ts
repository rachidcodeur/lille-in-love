/**
 * La version des icônes.
 *
 * L'hébergeur sert les fichiers de public/ avec un an de cache, et iOS fige
 * l'icône d'un raccourci au moment où on le pose sur l'écran d'accueil.
 * Les deux s'additionnent : changer le dessin sans changer l'adresse laisse
 * l'ancienne image en place, même après avoir supprimé puis réinstallé.
 *
 * On change donc l'adresse. Incrémente ce nombre à chaque fois que les
 * fichiers crush-*.png changent — c'est la seule chose à faire.
 */
export const VERSION_ICONES = 2;

export const iconeCrush = (fichier: string) => `/${fichier}?v=${VERSION_ICONES}`;
