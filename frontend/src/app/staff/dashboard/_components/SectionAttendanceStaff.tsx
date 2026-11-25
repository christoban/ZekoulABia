'use client'

import AttendanceManagementView from '@/features/attendance/AttendanceManagementView'

export default function SectionAttendanceStaff({ onToast }: { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  return <AttendanceManagementView onToast={onToast} namespace="staff" />
}
