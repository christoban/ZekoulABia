import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    'DATABASE_URL non défini. Lancez les tests avec : bun test --env-file .env.test ...'
  );
}

if (!url.includes('_test')) {
  throw new Error(
    `Les tests d'intégration doivent utiliser une base de test.\nURL reçue : ${url}`
  );
}

export const prismaTest = new PrismaClient({
  datasourceUrl: url,
  log: [],
});
