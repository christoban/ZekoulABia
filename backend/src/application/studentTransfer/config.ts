export const STUDENT_TRANSFER_CONFIG = {
  ageMajoriteCivile: 21,
  sourceAutoApprovalDelayDays: 7,
  parentExpirationDelayDays: 30,
  parentReminderDelaysDays: [3, 10],
  consentLinkTtlHours: 48,
  consentTextVersion: 'student-transfer-v1',
} as const;
