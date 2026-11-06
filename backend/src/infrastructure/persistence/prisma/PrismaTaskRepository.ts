import type { PrismaClient, Prisma, Task as PrismaTask } from '@prisma/client';
import type { TaskRepository } from '@domain/ports/repositories/TaskRepository';
import type { Task, TaskComment, TaskStatus } from '@domain/entities/Task';
import { Task as TaskEntity } from '@domain/entities/Task';

function toDomain(data: PrismaTask): Task {
  return TaskEntity.reconstituer({
    id: data.id,
    schoolId: data.schoolId,
    title: data.title,
    description: data.description,
    assignedById: data.assignedById,
    assignedToId: data.assignedToId,
    dueDate: data.dueDate,
    status: data.status,
    attachments: data.attachments,
    comments: Array.isArray(data.comments) ? (data.comments as unknown as TaskComment[]) : [],
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  });
}

export class PrismaTaskRepository implements TaskRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string, schoolId: string): Promise<Task | null> {
    const data = await this.prisma.task.findFirst({ where: { id, schoolId } });
    return data ? toDomain(data) : null;
  }

  async findByAssignedTo(assignedToId: string, schoolId: string): Promise<Task[]> {
    const data = await this.prisma.task.findMany({
      where: { assignedToId, schoolId },
      orderBy: { createdAt: 'desc' },
    });
    return data.map(toDomain);
  }

  async findBySchool(schoolId: string, status?: TaskStatus): Promise<Task[]> {
    const data = await this.prisma.task.findMany({
      where: { schoolId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    return data.map(toDomain);
  }

  async save(task: Task): Promise<void> {
    const obj = task.toObject();
    await this.prisma.task.create({
      data: {
        id: obj.id,
        schoolId: obj.schoolId,
        title: obj.title,
        description: obj.description,
        assignedById: obj.assignedById,
        assignedToId: obj.assignedToId,
        dueDate: obj.dueDate,
        status: obj.status,
        attachments: obj.attachments,
        comments: obj.comments as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async update(task: Task): Promise<void> {
    const obj = task.toObject();
    await this.prisma.task.update({
      where: { id: obj.id },
      data: {
        title: obj.title,
        description: obj.description,
        assignedToId: obj.assignedToId,
        dueDate: obj.dueDate,
        status: obj.status,
        attachments: obj.attachments,
        comments: obj.comments as unknown as Prisma.InputJsonValue,
        updatedAt: obj.updatedAt,
      },
    });
  }

  async delete(id: string, schoolId: string): Promise<void> {
    await this.prisma.task.deleteMany({ where: { id, schoolId } });
  }
}