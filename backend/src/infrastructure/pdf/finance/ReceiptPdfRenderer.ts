/**
 * INFRASTRUCTURE LAYER — Renderer PDF officiel bilingue (FR/EN) pour les reçus de paiement.
 * Inclut : numéro séquentiel REC-YYYY-00001, référence provisoire offline PROV-...,
 * remises, échéancier des tranches, frais opérateur, solde avoir et filigranes DUPLICATA / ANNULÉ.
 */
import PDFDocument from 'pdfkit';
import type { ReceiptPdfRendererPort, RenderReceiptOptions } from '@domain/ports/services/ReceiptPdfRendererPort';

const METHOD_LABELS_BILINGUAL: Record<string, string> = {
  CASH: 'Espèces / Cash',
  MTN_MOMO: 'MTN Mobile Money',
  ORANGE_MONEY: 'Orange Money',
  BANK_TRANSFER: 'Virement bancaire / Bank Transfer',
  EXPRESS_UNION: 'Express Union',
};

const fmtFcfa = (value: number): string =>
  `${new Intl.NumberFormat('fr-FR').format(Math.round(value))} XAF`;

export class ReceiptPdfRenderer implements ReceiptPdfRendererPort {
  async renderReceiptPdf(options: RenderReceiptOptions): Promise<Buffer> {
    const { payment, isDuplicate } = options;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 45, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const schoolName = payment.school?.name ?? 'ZEKOULABIA';
      const studentName = `${payment.student?.firstName ?? ''} ${payment.student?.lastName ?? ''}`.trim();
      const matricule = payment.student?.studentProfile?.matricule ?? '-';
      const className = payment.student?.studentProfile?.enrollmentsYearScoped?.[0]?.class?.name ?? '-';
      const invoiceLabel = payment.invoice?.feePlan?.name ?? payment.invoice?.description ?? 'Frais de scolarité / Tuition';
      const netTotal = payment.invoice?.amount ?? payment.amount;
      const grossTotal = payment.invoice?.grossAmount ?? netTotal;
      const discountTotal = payment.invoice?.discountTotal ?? 0;

      const successfulPayments = (payment.invoice?.payments ?? []).filter(
        (p) => !p.status || p.status === 'SUCCESS',
      );
      const cumulativePaid = successfulPayments.reduce((s, p) => s + p.amount, 0);
      const soldeRestant = Math.max(0, netTotal - cumulativePaid);

      const txDate = new Date(payment.paidAt ?? payment.createdAt);
      const year = txDate.getFullYear();
      const receiptNum = payment.receiptNumber ?? `REC-${year}-${payment.id.slice(-8).toUpperCase()}`;
      const dateStr = txDate.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const isCancelled = payment.status === 'REFUNDED' || Boolean(payment.cancellationReason);

      // En-tête républicain & établissement
      doc.fontSize(9).font('Helvetica')
        .text('République du Cameroun  |  Republic of Cameroon', { align: 'center' })
        .text('Paix – Travail – Patrie  |  Peace – Work – Fatherland', { align: 'center' });
      doc.moveDown(0.4);
      doc.fontSize(14).font('Helvetica-Bold').text(schoolName.toUpperCase(), { align: 'center' });
      if (payment.school?.city || payment.school?.phone) {
        doc.fontSize(9).font('Helvetica').text(
          [payment.school?.city, payment.school?.phone].filter(Boolean).join(' • '),
          { align: 'center' },
        );
      }
      doc.moveDown(0.8);

      // Filigranes (ANNULÉ prioritaire sur DUPLICATA)
      if (isCancelled) {
        doc.save();
        doc.fillColor('#dc2626').fontSize(18).font('Helvetica-Bold')
          .text('ANNULÉ / CANCELLED', { align: 'center' });
        if (payment.cancellationReason) {
          doc.fontSize(9).font('Helvetica')
            .text(`Motif / Reason: ${payment.cancellationReason}`, { align: 'center' });
        }
        doc.restore();
        doc.moveDown(0.5);
      } else if (isDuplicate) {
        doc.save();
        doc.fillColor('#b45309').fontSize(14).font('Helvetica-Bold')
          .text('DUPLICATA / DUPLICATE COPY', { align: 'center' });
        doc.restore();
        doc.moveDown(0.4);
      }

      doc.fillColor('black').fontSize(15).font('Helvetica-Bold')
        .text('REÇU OFFICIEL DE PAIEMENT / OFFICIAL PAYMENT RECEIPT', { align: 'center' });
      doc.moveDown(0.5);

      doc.fontSize(10).font('Helvetica-Bold').text(`N° ${receiptNum}`, { align: 'right' });
      if (payment.provisionalReceiptNumber) {
        doc.fontSize(9).font('Helvetica')
          .text(`Réf. Provisoire Offline / Provisional Ref.: ${payment.provisionalReceiptNumber}`, { align: 'right' });
      }
      doc.fontSize(10).font('Helvetica').text(`Date : ${dateStr}`, { align: 'right' });
      doc.moveDown(0.7);
      doc.moveTo(45, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.6);

      // Élève & payeur
      doc.fontSize(10).font('Helvetica-Bold').text('ÉLÈVE & PAYEUR / STUDENT & PAYER');
      doc.font('Helvetica')
        .text(`Élève / Student : ${studentName}`)
        .text(`Matricule / Reg. ID : ${matricule}   |   Classe / Class : ${className}`);
      if (payment.paidBy) {
        doc.text(`Payeur / Payer : ${payment.paidBy.firstName} ${payment.paidBy.lastName}`.trim());
      }
      if (payment.recordedBy) {
        doc.text(`Enregistré par / Recorded by : ${payment.recordedBy.firstName} ${payment.recordedBy.lastName}`.trim());
      }
      doc.moveDown(0.7);

      // Objet
      doc.font('Helvetica-Bold').text('OBJET / PAYMENT DETAILS');
      doc.font('Helvetica')
        .text(`Facture / Invoice : ${invoiceLabel}`)
        .text(`Mode de paiement / Method : ${METHOD_LABELS_BILINGUAL[payment.method] ?? payment.method}`);
      if (payment.campayRef) doc.text(`Réf. Campay : ${payment.campayRef}`);
      if (payment.operatorRef) doc.text(`Réf. Opérateur / Operator Ref. : ${payment.operatorRef}`);
      if (payment.operatorFee && payment.operatorFee > 0) {
        doc.text(`Frais opérateur / Operator fee : ${fmtFcfa(payment.operatorFee)} (${payment.feeBearer ?? 'PARENT'})`);
      }
      doc.moveDown(0.7);
      doc.moveTo(45, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.6);

      // Montants
      doc.font('Helvetica-Bold').text('MONTANTS / AMOUNTS (FCFA)');
      doc.font('Helvetica');
      if (discountTotal > 0) {
        doc.text(`Montant brut / Gross amount : ${fmtFcfa(grossTotal)}`);
        doc.text(`Remises accordées / Discounts : -${fmtFcfa(discountTotal)}`);
      }
      doc.text(`Net à payer / Net payable : ${fmtFcfa(netTotal)}`);
      doc.font('Helvetica-Bold').text(`Montant encaissé / Amount paid : ${fmtFcfa(payment.amount)}`);
      doc.font('Helvetica').text(`Total cumulé payé / Cumulative paid : ${fmtFcfa(cumulativePaid)}`);

      if (isCancelled) {
        doc.fillColor('#dc2626').font('Helvetica-Bold').text('STATUT : PAIEMENT ANNULÉ / PAYMENT CANCELLED');
      } else if (soldeRestant === 0) {
        doc.fillColor('#15803d').font('Helvetica-Bold')
          .text(`Solde restant / Remaining balance : ${fmtFcfa(0)} — PAYÉ INTÉGRALEMENT / FULLY PAID`);
      } else {
        doc.fillColor('#b91c1c').font('Helvetica-Bold')
          .text(`Solde restant / Remaining balance : ${fmtFcfa(soldeRestant)}`);
      }
      doc.fillColor('black').font('Helvetica');

      if (payment.studentCreditBalance && payment.studentCreditBalance > 0) {
        doc.text(`Avoir disponible élève / Student credit balance : ${fmtFcfa(payment.studentCreditBalance)}`);
      }

      // Échéancier des tranches si présent
      const installments = payment.invoice?.installments ?? [];
      if (installments.length > 0) {
        doc.moveDown(0.7);
        doc.font('Helvetica-Bold').text('ÉCHÉANCIER / INSTALLMENT SCHEDULE');
        doc.fontSize(9).font('Helvetica');
        for (const tr of installments) {
          const due = new Date(tr.dueDate).toLocaleDateString('fr-FR');
          doc.text(
            `• ${tr.label} (T${tr.trancheNumber}) — Éch. ${due} : ${fmtFcfa(tr.paidAmount)} / ${fmtFcfa(tr.amount)} [${tr.status}]`,
          );
        }
        doc.fontSize(10);
      }

      doc.moveDown(1.8);
      doc.moveTo(45, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(9)
        .text('Ce document tient lieu de reçu officiel de paiement. / This document serves as an official payment receipt.', { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(10).text('Le Responsable Financier / The Finance Officer', { align: 'right' });
      doc.moveDown(1.8);
      doc.text('___________________________', { align: 'right' });

      doc.end();
    });
  }
}

