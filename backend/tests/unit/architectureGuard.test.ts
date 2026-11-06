import { describe, it, expect } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * GARDE-FOU HEXAGONAL CONSOLIDÉ (§4.3, §4.12 AGENTS.md)
 * ======================================================
 *
 * Remplace/fusionne :
 *   - architecture-guard.test.ts (règles 1-4 : direction des imports + controllers)
 *   - p1-application-no-prisma.test.ts (règle prisma dans application/)
 *
 * PRINCIPE DE CONCEPTION (pour éviter la régression qui a motivé ce fichier) :
 * Les anciens tests ne détectaient que des CHAÎNES FIXES connues à l'avance
 * (ex: "this.prisma"). Une fuite d'infra qui prend une forme légèrement
 * différente (this.cache.getPrisma(), prisma: any, getRawClient(), etc.)
 * passait à travers. Ce fichier détecte donc des PATTERNS STRUCTURELS :
 *   - tout type de retour/paramètre `any` dans domain/ ou application/
 *     (le mécanisme même du contournement, pas le nom de la variable)
 *   - toute méthode nommée comme un "escape hatch" vers l'infra
 *     (getPrisma, getClient, getRawClient, getConnection, getDb, rawQuery...)
 *   - tout import (statique OU dynamique) vers infra/prisma/frameworks
 *     concrets depuis domain/ ou application/
 *   - tout accès `this.prisma` / `ctx.prisma` / `req.prisma` où que ce soit
 *     hors infrastructure/ (pas seulement dans les controllers)
 *
 * ÉCHAPPATOIRE EXPLICITE AUTORISÉE :
 * Si un `any` est réellement nécessaire et justifié (cas rarissime), il doit
 * être marqué en fin de ligne par `// hex-allow-any: <raison>`. Sans ce
 * commentaire, le test échoue. Ça transforme un contournement silencieux en
 * décision explicite et grep-able.
 */

const ROOT = join(import.meta.dir, '../../src');
const DOMAIN = join(ROOT, 'domain');
const DOMAIN_PORTS = join(ROOT, 'domain/ports');
const APP = join(ROOT, 'application');
const CONTROLLERS = join(ROOT, 'infrastructure/http/controllers');
const INFRA = join(ROOT, 'infrastructure');

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function existsSync(p: string): boolean {
  try { statSync(p); return true; } catch { return false; }
}

function listerFichiersTs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const result: string[] = [];
  for (const entry of readdirSync(dir)) {
    const chemin = join(dir, entry);
    const s = statSync(chemin);
    if (s.isDirectory()) result.push(...listerFichiersTs(chemin));
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) result.push(chemin);
  }
  return result;
}

function extraireImports(contenu: string): string[] {
  // Capture import statique ET dynamique (import('...')) ET require('...')
  const specs: string[] = [];
  const re = /(?:from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\))/g;
  for (const m of contenu.matchAll(re)) {
    specs.push(m[1] ?? m[2] ?? m[3] ?? '');
  }
  return specs;
}

// Une ligne est couverte par l'échappatoire explicite si elle porte le marqueur
function ligneEstJustifiee(ligne: string): boolean {
  return /\/\/\s*hex-allow-any\s*:\s*\S+/.test(ligne);
}

const isInfraDep = (spec: string): boolean =>
  spec.includes('@infrastructure') || spec.includes('/infrastructure/') || spec.includes('../../infrastructure');

const isAppDep = (spec: string): boolean =>
  spec.includes('@application') || spec.includes('/application/');

const isDomainDep = (spec: string): boolean =>
  spec.includes('@domain') || spec.includes('/domain/');

// Librairies concrètes qui ne doivent JAMAIS être importées depuis domain/ ou application/ :
// seule infrastructure/ a le droit de connaître ces packages (ce sont les adapters).
const LIBS_INFRA_INTERDITES = [
  '@prisma/client',
  '.prisma/client',
  'express',
  'socket.io',
  'inngest',
  'groq-sdk',
  '@google/generative-ai', // Gemini
  'ioredis',
  'redis',
  'nodemailer',
  'twilio',
  '@aws-sdk',
  'bullmq',
];

// Noms de méthodes qui, dans un PORT (domain/ports/), sentent l'escape hatch
// vers un client concret plutôt qu'une opération métier.
const NOMS_ESCAPE_HATCH = [
  'getprisma',
  'getclient',
  'getrawclient',
  'getconnection',
  'getdb',
  'getdatabase',
  'rawquery',
  'executeraw',
  '$queryraw',
  '$executeraw',
];

// ---------------------------------------------------------------------------
// Détection lexicale de tout "any" utilisé dans le code. Les commentaires et
// chaînes sont retirés avant analyse ; l'unique exception de code est le
// marqueur explicite hex-allow-any porté par la même ligne.
// ---------------------------------------------------------------------------

interface OccurrenceAny {
  fichier: string;
  ligneNo: number;
  ligne: string;
}

function trouverAnyNonJustifies(dir: string, racineRelative: string): OccurrenceAny[] {
  const violations: OccurrenceAny[] = [];
  for (const fichier of listerFichiersTs(dir)) {
    const lignes = readFileSync(fichier, 'utf8').split('\n');
    lignes.forEach((ligne, idx) => {
      if (ligneEstJustifiee(ligne)) return;
      const code = ligne
        .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '')
        .replace(/\/\*.*?\*\//g, '')
        .replace(/\/\/.*$/, '');
      if (/^\s*(?:\/\/|\/\*|\*|\*\/)/.test(ligne) || !/\bany\b/.test(code)) return;
      if (/\bany\b/.test(code)) {
        violations.push({ fichier: relative(racineRelative, fichier), ligneNo: idx + 1, ligne: ligne.trim() });
      }
    });
  }
  return violations;
}

// ---------------------------------------------------------------------------
// SUITE
// ---------------------------------------------------------------------------

describe('Garde-fou hexagonal — direction des dépendances', () => {
  it('domain/ n\'importe jamais application/ (le domaine est la couche la plus profonde)', () => {
    const violations: string[] = [];
    for (const fichier of listerFichiersTs(DOMAIN)) {
      const contenu = readFileSync(fichier, 'utf8');
      for (const spec of extraireImports(contenu)) {
        if (isAppDep(spec)) violations.push(`${relative(DOMAIN, fichier)} → "${spec}"`);
      }
    }
    expect(violations, `domain/ → application/ interdite :\n${violations.join('\n')}`).toEqual([]);
  });

  it('domain/ n\'importe jamais infrastructure/ (statique OU dynamique)', () => {
    const violations: string[] = [];
    for (const fichier of listerFichiersTs(DOMAIN)) {
      const contenu = readFileSync(fichier, 'utf8');
      for (const spec of extraireImports(contenu)) {
        if (isInfraDep(spec)) violations.push(`${relative(DOMAIN, fichier)} → "${spec}"`);
      }
    }
    expect(violations, `domain/ → infrastructure/ interdite :\n${violations.join('\n')}`).toEqual([]);
  });

  it('application/ n\'importe aucune dépendance infrastructure (statique OU dynamique)', () => {
    const violations: string[] = [];
    for (const fichier of listerFichiersTs(APP)) {
      const contenu = readFileSync(fichier, 'utf8');
      for (const spec of extraireImports(contenu)) {
        if (isInfraDep(spec)) violations.push(`${relative(APP, fichier)} → "${spec}"`);
      }
    }
    expect(violations, `application/ → infrastructure/ interdite :\n${violations.join('\n')}`).toEqual([]);
  });

  for (const lib of LIBS_INFRA_INTERDITES) {
    it(`domain/ et application/ n'importent jamais "${lib}" directement`, () => {
      const violations: string[] = [];
      for (const dir of [DOMAIN, APP]) {
        for (const fichier of listerFichiersTs(dir)) {
          const contenu = readFileSync(fichier, 'utf8');
          for (const spec of extraireImports(contenu)) {
            if (spec === lib || spec.startsWith(`${lib}/`)) {
              violations.push(`${relative(ROOT, fichier)} → "${spec}"`);
            }
          }
        }
      }
      expect(violations, `Import direct de lib concrète interdit :\n${violations.join('\n')}`).toEqual([]);
    });
  }
});

describe('Garde-fou hexagonal — aucune fuite de client concret (prisma, db...)', () => {
  it('application/ ne fait jamais this.prisma / ctx.prisma / req.prisma', () => {
    const violations: string[] = [];
    const motifs = ['this.prisma', 'ctx.prisma', 'req.prisma', 'this.db.', 'ctx.db.'];
    for (const fichier of listerFichiersTs(APP)) {
      const contenu = readFileSync(fichier, 'utf8');
      for (const motif of motifs) {
        if (contenu.includes(motif)) violations.push(`${relative(APP, fichier)} → "${motif}"`);
      }
    }
    expect(violations, `Accès client concret dans application/ :\n${violations.join('\n')}`).toEqual([]);
  });

  it('domain/ports/ n\'expose aucune méthode "escape hatch" vers un client concret', () => {
    const violations: string[] = [];
    for (const fichier of listerFichiersTs(DOMAIN_PORTS)) {
      const contenu = readFileSync(fichier, 'utf8').toLowerCase();
      for (const nom of NOMS_ESCAPE_HATCH) {
        if (contenu.includes(nom)) {
          violations.push(`${relative(DOMAIN_PORTS, fichier)} → méthode/motif "${nom}"`);
        }
      }
    }
    expect(
      violations,
      `Un port expose un accès direct à un client concret plutôt qu'une opération métier :\n${violations.join('\n')}\n` +
      `→ Remplacer par une méthode métier typée (ex: countPresences(), getMoyenne()) implémentée par l'adapter.`,
    ).toEqual([]);
  });

  it('aucun constructeur/paramètre de application/ ou domain/ n\'est typé "PrismaClient"', () => {
    const violations: string[] = [];
    for (const dir of [DOMAIN, APP]) {
      for (const fichier of listerFichiersTs(dir)) {
        const contenu = readFileSync(fichier, 'utf8');
        if (/:\s*PrismaClient\b/.test(contenu)) {
          violations.push(relative(ROOT, fichier));
        }
      }
    }
    expect(violations, `Type PrismaClient utilisé hors infrastructure/ :\n${violations.join('\n')}`).toEqual([]);
  });
});

describe('Garde-fou hexagonal — aucun "any" non justifié comme échappatoire de type', () => {
  it('domain/ ne contient aucun "any" non justifié', () => {
    const violations = trouverAnyNonJustifies(DOMAIN, DOMAIN);
    const message = violations.map(v => `${v.fichier}:${v.ligneNo} → ${v.ligne}`).join('\n');
    expect(
      violations,
      `"any" non justifié dans domain/ (ajoutez "// hex-allow-any: <raison>" si vraiment nécessaire) :\n${message}`,
    ).toEqual([]);
  });

  it('application/ ne contient aucun "any" non justifié', () => {
    const violations = trouverAnyNonJustifies(APP, APP);
    const message = violations.map(v => `${v.fichier}:${v.ligneNo} → ${v.ligne}`).join('\n');
    expect(
      violations,
      `"any" non justifié dans application/ (ajoutez "// hex-allow-any: <raison>" si vraiment nécessaire) :\n${message}`,
    ).toEqual([]);
  });

  it('infrastructure/ ne contient aucun "any" non justifié', () => {
    const violations = trouverAnyNonJustifies(INFRA, INFRA);
    const message = violations.map(v => `${v.fichier}:${v.ligneNo} → ${v.ligne}`).join('\n');
    expect(
      violations,
      `"any" non justifié dans infrastructure/ (ajoutez "// hex-allow-any: <raison>" si vraiment nécessaire) :\n${message}`,
    ).toEqual([]);
  });
});

describe('Garde-fou hexagonal — controllers HTTP passent par les use cases/ports', () => {
  it('controllers HTTP ne font aucun accès direct this.prisma/ctx.prisma (hors AssistantController)', () => {
    const violations: string[] = [];
    const motifs = ['this.prisma', 'ctx.prisma', 'req.prisma'];
    for (const fichier of listerFichiersTs(CONTROLLERS)) {
      const contenu = readFileSync(fichier, 'utf8');
      const nom = relative(CONTROLLERS, fichier);
      if (nom.includes('AssistantController')) continue; // exception documentée (ActionContext.prisma requis par le catalogue copilot)
      for (const motif of motifs) {
        if (contenu.includes(motif)) violations.push(`${nom} → "${motif}"`);
      }
    }
    expect(violations, `this.prisma dans controllers (hors AssistantController) :\n${violations.join('\n')}`).toEqual([]);
  });

  it('controllers HTTP n\'importent jamais @prisma/client directement', () => {
    const violations: string[] = [];
    for (const fichier of listerFichiersTs(CONTROLLERS)) {
      const contenu = readFileSync(fichier, 'utf8');
      const nom = relative(CONTROLLERS, fichier);
      if (nom.includes('AssistantController')) continue;
      for (const spec of extraireImports(contenu)) {
        if (spec === '@prisma/client') violations.push(nom);
      }
    }
    expect(violations, `@prisma/client importé directement dans un controller :\n${violations.join('\n')}`).toEqual([]);
  });
});

describe('Garde-fou hexagonal — cohérence de placement des ports', () => {
  it('aucune interface nommée *Port n\'est déclarée en dehors de domain/ports/', () => {
    const violations: string[] = [];
    for (const dir of [APP, INFRA]) {
      for (const fichier of listerFichiersTs(dir)) {
        const contenu = readFileSync(fichier, 'utf8');
        const matches = [...contenu.matchAll(/\binterface\s+(\w*Port)\b/g)];
        for (const m of matches) {
          violations.push(`${relative(ROOT, fichier)} → interface "${m[1]}"`);
        }
      }
    }
    expect(
      violations,
      `Un contrat de port doit vivre uniquement dans domain/ports/ :\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});
