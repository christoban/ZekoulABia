/**
 * DOMAIN LAYER — Port Repository CareerEvent (événement carrière)
 */
export interface CareerEventData {
  id: string;
  userId: string;
  schoolId: string;
  type: string;
  date: Date;
  observation: string | null;
  createdAt: Date;
}

export interface CareerEventRepository {
  findByUserOrdered(userId: string, schoolId: string): Promise<CareerEventData[]>;
  create(data: { userId: string; schoolId: string; type: string; date: Date; observation?: string }): Promise<CareerEventData>;
  findByUser(userId: string, schoolId: string, order?: 'asc' | 'desc'): Promise<CareerEventData[]>;
}
