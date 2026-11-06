import { type ActionContext, norm } from '../catalogShared';

/** Résolution nom → employé (enseignant OU staff), pour le domaine RH. */
export async function resolveEmployee(ctx: ActionContext, name: string): Promise<{ id: string; name: string }> {
  const employees = await ctx.prisma.user.findMany({
    where: { schoolId: ctx.schoolId, role: { in: ['TEACHER', 'STAFF'] } },
    select: { id: true, firstName: true, lastName: true },
  });
  const full = (e: { firstName: string | null; lastName: string | null }) =>
    `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim();
  const target = norm(name);
  let matches = employees.filter((e) => norm(full(e)) === target);
  if (matches.length === 0)
    matches = employees.filter((e) => norm(e.lastName ?? '') === target || norm(full(e)).includes(target));
  if (matches.length === 0) throw new Error(`Aucun employé nommé « ${name} » n'a été trouvé.`);
  if (matches.length > 1) throw new Error(`Plusieurs employés correspondent à « ${name} ». Précisez le nom complet.`);
  const m = matches[0];
  return { id: m.id, name: full(m) };
}

export async function resolvePlanFrais(
  ctx: ActionContext,
  name: string,
): Promise<{ id: string; name: string; amount: number }> {
  const plans = await ctx.prisma.feePlan.findMany({
    where: { schoolId: ctx.schoolId },
    select: { id: true, name: true, amount: true },
  });
  const target = norm(name);
  let matches = plans.filter((p) => norm(p.name) === target);
  if (matches.length === 0) matches = plans.filter((p) => norm(p.name).includes(target));
  if (matches.length === 0)
    throw new Error(`Aucun plan de frais nommé « ${name} » n'existe dans votre établissement.`);
  if (matches.length > 1)
    throw new Error(`Plusieurs plans de frais correspondent à « ${name} ». Précisez le nom exact.`);
  return matches[0];
}

export async function resolveEntranceExamSession(
  ctx: ActionContext,
  name: string,
): Promise<{ id: string; name: string }> {
  const sessions = await ctx.prisma.entranceExamSession.findMany({
    where: { schoolId: ctx.schoolId },
    select: { id: true, name: true },
  });
  const target = norm(name);
  let matches = sessions.filter((s) => norm(s.name) === target);
  if (matches.length === 0) matches = sessions.filter((s) => norm(s.name).includes(target));
  if (matches.length === 0)
    throw new Error(`Aucune session de concours nommée « ${name} » n'existe dans votre établissement.`);
  if (matches.length > 1)
    throw new Error(`Plusieurs sessions de concours correspondent à « ${name} ». Précisez le nom exact.`);
  return matches[0];
}

export async function resolvePebsSession(ctx: ActionContext, name: string): Promise<{ id: string; name: string }> {
  const sessions = await ctx.prisma.pebsExamSession.findMany({
    where: { schoolId: ctx.schoolId },
    select: { id: true, name: true },
  });
  const target = norm(name);
  let matches = sessions.filter((s) => norm(s.name) === target);
  if (matches.length === 0) matches = sessions.filter((s) => norm(s.name).includes(target));
  if (matches.length === 0)
    throw new Error(`Aucune session PEBS nommée « ${name} » n'existe dans votre établissement.`);
  if (matches.length > 1)
    throw new Error(`Plusieurs sessions PEBS correspondent à « ${name} ». Précisez le nom exact.`);
  return matches[0];
}
