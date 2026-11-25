import type { NextConfig } from 'next'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

const nextConfig: NextConfig = {
  // Même pattern que frontend/next.config.ts : proxy /api/v2/* vers le backend Express,
  // pour que le seul appel réseau de ce site (DemoModal → /api/v2/public/demo-request) reste
  // un chemin relatif, sans CORS à configurer côté backend malgré le domaine séparé.
  async rewrites() {
    return [
      {
        source: '/api/v2/:path*',
        destination: `${BACKEND_URL}/api/v2/:path*`,
      },
    ]
  },
}

export default nextConfig
