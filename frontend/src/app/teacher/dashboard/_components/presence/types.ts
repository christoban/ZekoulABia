export type PresenceMode = 'QR' | 'GPS' | 'MANUEL'

export interface GpsCoords {
  lat: number
  lng: number
}

export interface TeacherAttendanceStatusData {
  hasCheckedIn: boolean
  attendance: {
    id: string
    statut: 'PRESENT' | 'ABSENT' | 'RETARD' | 'A_VERIFIER'
    mode: PresenceMode | null
    date: string
    createdAt?: string
    roomId?: string | null
    timetableSlotId?: string | null
  } | null
  settings: {
    gpsConfigured: boolean
    gpsRadiusMeters: number
    schoolLatitude: number | null
    schoolLongitude: number | null
    qrConfigured: boolean
  }
  rooms: { id: string; name: string; qrEnabled: boolean }[]
  currentSlot: {
    id: string
    subjectName: string | null
    className: string | null
    roomId: string | null
    roomName: string | null
    qrEnabled: boolean
  } | null
  recommendedMode: PresenceMode
}
