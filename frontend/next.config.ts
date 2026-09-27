import type { NextConfig } from "next";
import path from "path";
import withPWA from "@ducanh2912/next-pwa";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

// Hostname ngrok injecté par start-dev.mjs (change à chaque démarrage)
const NGROK_HOSTNAME = process.env.NGROK_HOSTNAME

const nextConfig: NextConfig = {
  // Build conteneur minimal : .next/standalone/server.js remplace `next start`
  // (pas besoin de node_modules complet dans l'image)
  output: "standalone",

  // Masque le badge d'indicateur de route affiché en permanence en bas de l'écran en dev
  // (infos de rendu statique/dynamique) — Next.js continue quand même de signaler les vraies
  // erreurs de compilation/exécution.
  devIndicators: false,

  turbopack: {
    root: path.resolve(__dirname),
  },

  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
  },

  // Permet au hot-reload (HMR) de fonctionner depuis le domaine ngrok
  ...(NGROK_HOSTNAME ? { allowedDevOrigins: [NGROK_HOSTNAME] } : {}),

  /**
   * Proxy toutes les requêtes /api/v2/* vers le backend Express.
   * Avantages :
   *  - Un seul tunnel ngrok suffit (port 3000 seulement)
   *  - Pas de CORS : le browser voit une seule origine
   *  - Les cookies httpOnly fonctionnent (même domaine ngrok)
   *  - Le téléphone n'a pas besoin d'atteindre localhost:5000 directement
   */
  async rewrites() {
    return [
      {
        source: "/api/v2/:path*",
        destination: `${BACKEND_URL}/api/v2/:path*`,
      },
      {
        source: "/api/master/:path*",
        destination: `${BACKEND_URL}/api/master/:path*`,
      },
    ];
  },

};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
})(nextConfig);
