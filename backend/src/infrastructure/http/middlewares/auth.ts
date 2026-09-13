import { type Request, type Response, type NextFunction } from 'express'
import type { ParamsDictionary } from 'express-serve-static-core'
import jwt from 'jsonwebtoken'

export interface AuthPayload {
  userId:      string
  schoolId:    string
  role:        string
  permissions: string[]
  mustChangePassword?: boolean
  tokenType:   "access" | "refresh"
  isMasterUser?: boolean
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
    }
  }
}

export const requireAuth = <P = ParamsDictionary>(
  req: Request<P>,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies?.access_token
    if (!token) return res.status(401).json({ error: 'Non authentifié' })

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload

    if (payload.tokenType !== "access") {
      return res.status(401).json({ error: 'Token de mauvais type' })
    }

    if (payload.mustChangePassword && !req.path.endsWith('/auth/change-password')) {
      return res.status(403).json({ error: 'MUST_CHANGE_PASSWORD', mustChangePassword: true })
    }

    req.user = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' })
  }
}

export const requireRole = (...args: (string | string[])[]) =>
  <P = ParamsDictionary>(req: Request<P>, res: Response, next: NextFunction) => {
    const roles = args.flat().map((r) => r.toUpperCase())
    if (!req.user || !roles.includes(req.user.role.toUpperCase())) {
      return res.status(403).json({ error: 'Accès refusé' })
    }
    next()
  }

export const requireRoleOrPermission = (roles: string[], permission: string) =>
  <P = ParamsDictionary>(req: Request<P>, res: Response, next: NextFunction) => {
    const upperRoles = roles.map((r) => r.toUpperCase())
    const roleMatch = !!req.user && upperRoles.includes(req.user.role.toUpperCase())
    const permissionMatch = !!req.user?.permissions?.includes(permission)
    if (!roleMatch && !permissionMatch) {
      return res.status(403).json({ error: 'Accès refusé' })
    }
    next()
  }

/** ADMIN (Proviseur) = super-set école ; sinon au moins une permission listée. */
export const requirePermission = (...perms: string[]) =>
  <P = ParamsDictionary>(req: Request<P>, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' })
    }
    if (req.user.role?.toUpperCase() === 'ADMIN') {
      return next()
    }
    const userPerms = req.user.permissions ?? []
    const ok = perms.some((p) => userPerms.includes(p))
    if (!ok) {
      return res.status(403).json({ error: 'Accès refusé' })
    }
    next()
  }

export const requireSchool = <P = ParamsDictionary>(
  req: Request<P>,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.schoolId) {
    return res.status(403).json({ error: 'Aucun établissement associé' })
  }
  next()
}

export const protect = requireAuth;
export const authorize = requireRole;