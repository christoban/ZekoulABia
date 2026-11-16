'use client'

import AttendanceManagementView from '@/features/attendance/AttendanceManagementView'

export default function SectionAdminAttendance({ onToast }: { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  return <AttendanceManagementView onToast={onToast} namespace="admin" />
}
