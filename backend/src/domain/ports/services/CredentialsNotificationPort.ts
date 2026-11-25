export type CredentialsChannel = 'EMAIL' | 'SMS' | 'PHYSICAL' | 'TERMINAL';

export interface CredentialsNotificationPort {
  sendCredentials(params: {
    schoolId: string;
    email: string | null;
    phone: string | null;
    os?: string | null;
    temporaryPassword: string;
    roleLabel: string;
    loginIdentifier: string;
    schoolName?: string;
  }): Promise<CredentialsChannel>;
}