/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Deux serveurs Next qui partagent le même dossier de build se corrompent
  // l'un l'autre : les tests s'en donnent donc un bien à eux. En temps
  // normal, la variable est absente et rien ne change.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // Le formulaire est servi dans une iframe posée sur le site WordPress.
  // On autorise explicitement ces parents-là, et personne d'autre.
  async headers() {
    const parents = (process.env.ALLOWED_EMBED_ORIGINS ?? 'https://in-love.fr https://www.in-love.fr')
      .split(/[\s,]+/)
      .filter(Boolean)
      .join(' ');
    return [
      {
        // Couvre /embed/court et tout parcours ajouté ensuite
        source: '/embed/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: `frame-ancestors 'self' ${parents};` },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        source: '/embed',
        headers: [
          { key: 'Content-Security-Policy', value: `frame-ancestors 'self' ${parents};` },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        source: '/embed.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=300, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
};

export default nextConfig;
