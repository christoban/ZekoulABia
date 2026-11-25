import prisma from "../../../config/prisma.ts";

export const logActivity = async ({
  userId,
  action,
  details,
  schoolId,
}: {
  userId: string;
  action: string;
  details?: string;
  schoolId?: string | null;
}) => {
  try {
    await prisma.activitiesLog.create({
      data: {
        userId,
        action,
        description: details,
        schoolId,
      },
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};