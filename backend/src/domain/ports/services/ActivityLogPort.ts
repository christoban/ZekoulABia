export interface ActivityLogPort {
  log(params: { userId: string; schoolId: string; action: string; details?: string }): Promise<void>;
}
