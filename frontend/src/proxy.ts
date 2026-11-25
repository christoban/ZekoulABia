import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const MASTER_SECRET = process.env.MASTER_SECRET_PATH ?? ''

function isJwtValid(token: string): boolean {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded)) as { exp?: number }
    return typeof payload.exp === 'number' && payload.exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── 1. Chemin secret → entry point super admin ──────────────────────────
  if (MASTER_SECRET && pathname === MASTER_SECRET) {
    const masterJwt = req.cookies.get('master_jwt')?.value

    if (masterJwt && isJwtValid(masterJwt)) {
      return NextResponse.redirect(new URL('/master/dashboard', req.url))
    }

    const res = NextResponse.redirect(new URL('/master/login', req.url))
    res.cookies.set('master_access', '1', {
      httpOnly: true,
      maxAge: 300,
      path: '/',
      sameSite: 'strict',
    })
    return res
  }

  // ── 2. Protéger /master/login — inaccessible sans passer par le chemin secret ──
  if (pathname === '/master/login') {
    const masterJwt  = req.cookies.get('master_jwt')?.value
    const hasAccess  = req.cookies.get('master_access')?.value
    const isLogout   = req.nextUrl.searchParams.get('logout') === '1'

    // Logout forcé : effacer le JWT et afficher la page de login
    if (isLogout) {
      const res = NextResponse.next()
      res.cookies.set('master_access', '1', { httpOnly: true, maxAge: 300, path: '/', sameSite: 'strict' })
      res.cookies.delete('master_jwt')
      return res
    }

    if (masterJwt && isJwtValid(masterJwt)) {
      return NextResponse.redirect(new URL('/master/dashboard', req.url))
    }
    if (!hasAccess) {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  // ── 3. Protéger /master/dashboard — session valide obligatoire ─────────
  if (pathname.startsWith('/master/dashboard')) {
    const masterJwt = req.cookies.get('master_jwt')?.value

    if (!masterJwt || !isJwtValid(masterJwt)) {
      // Rediriger vers login (pas la landing) + donner l'accès à la page login
      const res = NextResponse.redirect(new URL('/master/login', req.url))
      res.cookies.set('master_access', '1', { httpOnly: true, maxAge: 300, path: '/', sameSite: 'strict' })
      return res
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|api/).*)',
  ],
}
