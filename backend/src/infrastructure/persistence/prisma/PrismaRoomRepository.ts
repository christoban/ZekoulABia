import type { PrismaClient, Room as PrismaRoom } from '@prisma/client';
import { Room } from '@domain/entities/Room';
import type { RoomRepository } from '@domain/ports/repositories/RoomRepository';
import type { RoomType, RoomStatus } from '@domain/types/enums';

export class PrismaRoomRepository implements RoomRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Room | null> {
    const data = await this.prisma.room.findUnique({ where: { id } });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findBySchool(schoolId: string): Promise<Room[]> {
    const data = await this.prisma.room.findMany({ where: { schoolId } });
    return data.map(d => this.toDomain(d));
  }

  async existsByName(schoolId: string, name: string, excludeId?: string): Promise<boolean> {
    const existing = await this.prisma.room.findFirst({
      where: {
        schoolId,
        name,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    return existing !== null;
  }

  async save(room: Room): Promise<void> {
    const data = room.toObject();
    await this.prisma.room.create({
      data: {
        id: data.id,
        schoolId: data.schoolId,
        name: data.name,
        type: data.type,
        status: data.status,
        capacity: data.capacity,
        equipment: data.equipment,
        createdAt: data.createdAt,
      },
    });
  }

  async update(room: Room): Promise<void> {
    const data = room.toObject();
    await this.prisma.room.update({
      where: { id: data.id },
      data: {
        name: data.name,
        type: data.type,
        status: data.status,
        capacity: data.capacity,
        equipment: data.equipment,
      },
    });
  }

  async supprimerAvecCascade(roomId: string, deletedById?: string): Promise<void> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, select: { id: true } });
    if (!room) return;
    await this.prisma.room.update({
      where: { id: roomId },
      data: { deletedAt: new Date(), deletedById: deletedById ?? null },
    });
  }

  async restaurer(roomId: string): Promise<void> {
    await this.prisma.room.update({
      where: { id: roomId, deletedAt: { not: null } },
      data: { deletedAt: null, deletedById: null },
    });
  }

  private toDomain(data: PrismaRoom): Room {
    return Room.reconstituer({
      id: data.id,
      schoolId: data.schoolId,
      name: data.name,
      type: data.type as RoomType,
      status: data.status as RoomStatus,
      capacity: data.capacity,
      equipment: data.equipment,
      createdAt: data.createdAt,
    });
  }
}
