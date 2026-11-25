export type ClassBlock = {
  classId: string;
  className: string;
  studentCount: number;
};

export type MemberAssignment = {
  assignedClassIds: string[];
  classSliceStart?: number;
  classSliceEnd?: number;
};

export function splitClassesAmongMembers(
  classes: ClassBlock[],
  memberCount: number,
): MemberAssignment[] {
  if (memberCount < 1) {
    throw new Error('memberCount doit être >= 1');
  }
  if (classes.length === 0) {
    throw new Error('Aucune classe à répartir');
  }

  const assignments: MemberAssignment[] = Array.from({ length: memberCount }, () => ({
    assignedClassIds: [],
  }));

  if (classes.length === 1 && memberCount > 1) {
    const total = classes[0].studentCount;
    const base = Math.floor(total / memberCount);
    let reste = total % memberCount;
    let cursor = 1;
    for (let i = 0; i < memberCount; i++) {
      const size = base + (reste > 0 ? 1 : 0);
      if (reste > 0) reste -= 1;
      if (size === 0) continue;
      assignments[i] = {
        assignedClassIds: [classes[0].classId],
        classSliceStart: cursor,
        classSliceEnd: cursor + size - 1,
      };
      cursor += size;
    }
    return assignments.filter((a) => a.assignedClassIds.length > 0);
  }

  classes.forEach((c, idx) => {
    const target = idx % memberCount;
    assignments[target].assignedClassIds.push(c.classId);
  });

  return assignments.filter((a) => a.assignedClassIds.length > 0);
}