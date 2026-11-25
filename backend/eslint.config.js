import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // Avertissement seulement (pas d'erreur bloquante) — la masse existante de ~800
      // occurrences (inventoriée, en cours de nettoyage par lots) empêcherait tout de compiler
      // si ça bloquait dès maintenant. Objectif : empêcher que la masse grossisse pendant qu'on
      // la réduit, pas la corriger d'un coup.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
