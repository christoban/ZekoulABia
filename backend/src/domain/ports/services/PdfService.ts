/**
 * DOMAIN LAYER — Port Service PDF
 * Génération des bulletins scolaires via PDFKit.
 */
import type { BulletinTemplate } from '@domain/types/enums';
import type { BulletinProps } from '@domain/entities/Bulletin';

export interface ContexteBulletin {
  bulletin: BulletinProps;
  nomEleve: string;
  nomClasse: string;
  nomEtablissement: string;
  logoUrl?: string;
  anneeAcademique: string;
  nomPeriode: string;
  nomProfesseurPrincipal?: string;
  moyenneClasse?: number;
  moyennePremier?: number;
  moyenneDernier?: number;
  nbAdmis?: number;
  tauxReussite?: number;
  /** Langue de rendu (templates partagés PRIMARY/ANNUAL). Résolue via resolveLanguage(). Défaut "fr". */
  langue?: "fr" | "en";
  verifyUrl?: string;
  seq1Label?: string;
  seq2Label?: string;
}

export interface TableauHonneurLigne {
  lastName: string;
  firstName: string;
  generalAverage: number;
  mention?: string | null;
}

export interface TableauHonneurAnnuelLigne {
  name: string;
  annualAvg: number;
}

export interface PdfService {
  genererBulletin(contexte: ContexteBulletin): Promise<Buffer>;
  genererBulletinsEnMasse(contextes: ContexteBulletin[]): Promise<{
    bulletinId: string;
    pdf: Buffer;
  }[]>;
  genererTableauHonneur(params: {
    className: string;
    periodName: string;
    yearName: string;
    schoolName: string;
    schoolCity?: string;
    reportCards: TableauHonneurLigne[];
  }): Promise<Buffer>;
  genererTableauHonneurAnnuel(params: {
    className: string;
    yearName: string;
    schoolName: string;
    schoolCity?: string;
    ranked: TableauHonneurAnnuelLigne[];
  }): Promise<Buffer>;
}
