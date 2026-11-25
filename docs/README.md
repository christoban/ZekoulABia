# ZEKOULABIA — School Management & Learning Management System

ZEKOULABIA is a full-stack **School Management System (SMS)** and **Learning Management System (LMS)** that enables schools to manage academic years, classes, subjects, users (students / teachers / parents / admins), timetables, and exams. It features **AI-powered timetable generation** and **AI-powered exam / quiz generation** via Groq, with background job processing through Inngest. The system provides role-based dashboards, activity logging, and a modern responsive UI.

---

## Table of Contents

1. [Modules](#1-modules)
2. [Tech Stack](#2-tech-stack)
3. [Backend Architecture](#3-backend-architecture)
4. [Background Jobs / Inngest Integration](#4-background-jobs--inngest-integration)
5. [Database Schema](#5-database-schema)
6. [API Endpoints](#6-api-endpoints)
7. [Environment Variables](#7-environment-variables)
8. [How to Run Locally](#8-how-to-run-locally)
9. [Scripts & Ports](#9-scripts--ports)
10. [Deployment Notes](#10-deployment-notes)
11. [Folder Structure](#11-folder-structure)
12. [Key Flows](#12-key-flows)

---

## 1. Modules

| Module | Description | Key Files |
|---|---|---|
| **Academics** | Classes, Subjects, Timetable management | `frontend/src/pages/academics/Classes.tsx`, `Subjects.tsx`, `Timetable.tsx` |
| **LMS** | Exam creation (AI-generated MCQ quizzes), student submissions, auto-grading | `frontend/src/pages/lms/Exams.tsx`, `Exam.tsx` |
| **Users** | Student, Teacher, Parent, Admin CRUD with role-based access | `frontend/src/pages/users/index.tsx` |
| **Settings** | Academic year management (create / set active year) | `frontend/src/pages/settings/academic-year.tsx` |
| **Dashboard** | Role-based statistics, recent activity, AI insight widget | `frontend/src/pages/Dashboard.tsx` |
| **Activity Log** | System-wide activity audit trail | `backend/src/controllers/activitieslog.ts` |

---

## 2. Tech Stack

### Frontend

| Concern | Library / Version |
|---|---|
| Build tool | Vite (`rolldown-vite@7.2.5`) |
| Framework | React 19.2.0 |
| Language | TypeScript 5.9.3 |
| Routing | React Router v7.11.0 |
| Styling | Tailwind CSS v4.1.18 + tw-animate-css |
| Component Library | shadcn/ui (new-york style) + Radix UI primitives |
| Forms | React Hook Form v7.70.0 + Zod v4.3.5 |
| HTTP Client | Axios v1.13.2 (cookie credentials) |
| Charts | Recharts v2.15.4 |
| Toasts | Sonner v2.0.7 |
| Theming | next-themes v0.4.6 (dark mode default) |
| Icons | Lucide React v0.562.0 |

### Backend

| Concern | Library / Version |
|---|---|
| Runtime | Bun (primary) / Node.js |
| Framework | Express v5.2.1 |
| Language | TypeScript 5+ |
| Database | MongoDB via Mongoose v9.4.1 |
| Auth | JWT (`jsonwebtoken` v9.0.3) via httpOnly cookies |
| Password hashing | bcryptjs v3.0.3 |
| Security | Helmet v8.1.0 |
| CORS | cors v2.8.6 |
| Logging | Morgan v1.10.1 (dev only) |
| Background jobs | Inngest v4.2.0 |
| AI | `@ai-sdk/groq` + Vercel AI SDK v6.0.154 |
| AI Model | `llama-3.3-70b-versatile` (Groq) |

---

## 3. Backend Architecture

**Entry point:** `backend/src/server.ts`

### Middleware chain

1. **Helmet** — HTTP security headers
2. **JSON parser** — `express.json()`
3. **URL-encoded parser** — `express.urlencoded({ extended: true })`
4. **Cookie parser** — `cookieParser()`
5. **Morgan logger** — conditional on `STAGE === "development"`
6. **CORS** — origin from `CLIENT_URL` env, credentials enabled

### Route mounting

| Mount path | Router file | Description |
|---|---|---|
| `/api/users` | `routes/user.ts` | User auth & CRUD |
| `/api/activities` | `routes/activitieslog.ts` | Activity log |
| `/api/academic-years` | `routes/academicYear.ts` | Academic year CRUD |
| `/api/classes` | `routes/class.ts` | Class CRUD |
| `/api/subjects` | `routes/subject.ts` | Subject CRUD |
| `/api/timetables` | `routes/timetable.ts` | Timetable generation & viewing |
| `/api/exams` | `routes/exam.ts` | Exam generation, submission, results |
| `/api/dashboard` | `routes/dashboard.ts` | Dashboard statistics |
| `/api/inngest` | Inngest serve middleware | Background job webhook endpoint |

### Global error handler

A catch-all error middleware returns JSON with `message` and `stack` (stack hidden in production via `NODE_ENV`).

### Health check

`GET /` → `{ status: "OK", message: "Server is healthy" }`

### Authentication & Authorization

- **`protect` middleware** — reads JWT from `req.cookies.jwt`, verifies with `JWT_SECRET`, attaches user (minus password) to `req.user`
- **`authorize(roles)` middleware** — checks `req.user.role` against an allowed roles array, returns 403 if not permitted
- **Token generation** — HS512 algorithm, 30-day expiry, httpOnly + secure (production) + sameSite strict cookie
- **Roles:** `admin`, `teacher`, `student`, `parent`

### Activity Logging

Every mutating operation calls `logActivity()` (`utils/activitieslog.ts`), which creates an `ActivitiesLog` document with `userId`, `action`, and optional `details`. Logged from user, class, academic year, subject, exam, and timetable controllers.

### Dashboard Aggregation

Role-based stats from `GET /api/dashboard/stats`:

- **Admin:** `totalStudents`, `totalTeachers`, `activeExams`, `avgAttendance` (mocked "94.5%"), last 5 system-wide activity logs
- **Teacher:** `myClassesCount`, `myClassNames`, `pendingGrading`, `nextClass + nextClassTime` (real timetable lookup for today)
- **Student:** `myAttendance` (mocked "98%"), `studentClassName`, `pendingAssignments`, `nextExam + nextExamDate`

---

## 4. Background Jobs / Inngest Integration

Inngest client ID: `"sms-lms"` — `backend/src/inngest/index.ts`

Three Inngest functions registered at `/api/inngest`:

### `generateTimeTable` (event: `generate/timetable`)

**Steps:**
1. `fetch-class-context` — loads class with subjects, finds qualified teachers
2. `generate-timetable-logic` — sends prompt to Groq AI, normalizes response into daily time slots with proper break/class periods
3. `save-timetable` — deletes existing timetable for class/year, creates new one

**Tracking:** Updates `TimetableGeneration` status (`queued → running → completed/failed`)

### `generateExam` (event: `exam/generate`)

**Steps:**
1. `generate-exam-logic` — sends prompt to Groq AI requesting MCQ questions in JSON
2. `save-exam` — updates the draft exam document with generated questions

**Tracking:** Updates `ExamGeneration` status

### `handleExamSubmission` (event: `exam/submit`)

**Steps:**
1. `process-exam-submission` — checks for duplicate submission, fetches exam with correct answers, calculates score, saves `Submission`

**Prevents:** Duplicate submissions via unique index on `{ exam, student }`

---

## 5. Database Schema

### User

| Field | Type | Notes |
|---|---|---|
| `name` | String | Required |
| `email` | String | Required |
| `password` | String | Required, auto-hashed (bcrypt, salt 10) via pre-save hook |
| `role` | Enum | `admin`, `teacher`, `student`, `parent` (default: `student`) |
| `isActive` | Boolean | Default `true` |
| `studentClass` | ObjectId → Class | For students only |
| `teacherSubject` | ObjectId[] → Subject | For teachers only |
| `timestamps` | auto | `createdAt`, `updatedAt` |

### AcademicYear

| Field | Type | Notes |
|---|---|---|
| `name` | String | e.g. `"2024-2025"` |
| `fromYear` | Date | Start date |
| `toYear` | Date | End date |
| `isCurrent` | Boolean | Only one should be `true` at a time |

### Class

| Field | Type | Notes |
|---|---|---|
| `name` | String | Required, e.g. `"Grade 10"` |
| `academicYear` | ObjectId → AcademicYear | Required |
| `classTeacher` | ObjectId → User | Nullable |
| `subjects` | ObjectId[] → Subject | |
| `students` | ObjectId[] → User | |
| `capacity` | Number | Default 40 |
| **Index** | `{ name, academicYear }` unique | Prevents duplicates |

### Subject

| Field | Type | Notes |
|---|---|---|
| `name` | String | Required, e.g. `"Mathematics"` |
| `code` | String | Required, unique, e.g. `"MATH101"` |
| `teacher` | ObjectId[] → User | Optional array of assigned teachers |
| `isActive` | Boolean | Default `true` |

### Exam

| Field | Type | Notes |
|---|---|---|
| `title` | String | Required |
| `subject` | ObjectId → Subject | Required |
| `class` | ObjectId → Class | Required |
| `teacher` | ObjectId → User | Required |
| `duration` | Number | Minutes |
| `dueDate` | Date | Required |
| `isActive` | Boolean | Default `true` |
| `questions[]` | Embedded | `questionText`, `type` (MCQ/SHORT_ANSWER), `options[]`, `correctAnswer` (select: false), `points` |

### Submission

| Field | Type | Notes |
|---|---|---|
| `exam` | ObjectId → Exam | Required |
| `student` | ObjectId → User | Required |
| `answers[]` | `{ questionId, answer }` | |
| `score` | Number | Default 0 |
| `submittedAt` | Date | Default `Date.now` |
| **Index** | `{ exam, student }` unique | Prevents duplicates |

### Timetable

| Field | Type | Notes |
|---|---|---|
| `class` | ObjectId → Class | Required |
| `academicYear` | ObjectId → AcademicYear | Required |
| `schedule[]` | `{ day, periods[] }` | periods: `{ kind, subject?, teacher?, startTime, endTime }` |
| **Index** | `{ class, academicYear }` unique | One timetable per class/year |

### TimetableGeneration

| Field | Type | Notes |
|---|---|---|
| `class` | ObjectId → Class | |
| `academicYear` | ObjectId → AcademicYear | |
| `status` | Enum | `queued`, `running`, `completed`, `failed` |
| `message` | String | Optional status message |
| `timetable` | ObjectId → Timetable | Nullable, set on completion |

### ExamGeneration

| Field | Type | Notes |
|---|---|---|
| `exam` | ObjectId → Exam | |
| `status` | Enum | `queued`, `running`, `completed`, `failed` |
| `message` | String | Optional |

### ActivitiesLog

| Field | Type | Notes |
|---|---|---|
| `user` | ObjectId → User | Required |
| `action` | String | Required, e.g. `"Created Exam"` |
| `details` | String | Optional |
| `timestamps` | auto | `createdAt`, `updatedAt` |

---

## 6. API Endpoints

### Users

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `POST` | `/api/users/register` | protect | admin, teacher | Register new user |
| `POST` | `/api/users/login` | — | — | Login, returns JWT cookie |
| `POST` | `/api/users/logout` | — | — | Clear JWT cookie |
| `GET` | `/api/users/profile` | protect | any | Current user profile |
| `GET` | `/api/users` | protect | admin, teacher | List users (paginated, filterable) |
| `PUT` | `/api/users/update/:id` | protect | admin, teacher | Update user |
| `DELETE` | `/api/users/delete/:id` | protect | admin, teacher | Delete user |

### Academic Years

| Method | Path | Auth | Roles |
|---|---|---|---|
| `POST` | `/api/academic-years/create` | protect | admin |
| `GET` | `/api/academic-years` | protect | admin, teacher |
| `GET` | `/api/academic-years/current` | protect | any |
| `PATCH` | `/api/academic-years/update/:id` | protect | admin |
| `DELETE` | `/api/academic-years/delete/:id` | protect | admin |

### Classes

| Method | Path | Auth | Roles |
|---|---|---|---|
| `POST` | `/api/classes/create` | protect | admin |
| `GET` | `/api/classes` | protect | admin, teacher |
| `PATCH` | `/api/classes/update/:id` | protect | admin |
| `DELETE` | `/api/classes/delete/:id` | protect | admin |

### Subjects

| Method | Path | Auth | Roles |
|---|---|---|---|
| `POST` | `/api/subjects/create` | protect | admin |
| `GET` | `/api/subjects` | protect | admin, teacher |
| `PATCH` | `/api/subjects/update/:id` | protect | admin |
| `DELETE` | `/api/subjects/delete/:id` | protect | admin |

### Timetables

| Method | Path | Auth | Roles |
|---|---|---|---|
| `POST` | `/api/timetables/generate` | protect | admin |
| `GET` | `/api/timetables/generation/:id` | protect | admin |
| `GET` | `/api/timetables/:classId` | protect | any |

### Exams

| Method | Path | Auth | Roles |
|---|---|---|---|
| `POST` | `/api/exams/generate` | protect | teacher, admin |
| `GET` | `/api/exams` | protect | teacher, student, admin |
| `GET` | `/api/exams/generation/:id` | protect | teacher, admin |
| `GET` | `/api/exams/:id` | protect | teacher, student, admin |
| `POST` | `/api/exams/:id/submit` | protect | student, admin |
| `PATCH` | `/api/exams/:id/status` | protect | teacher, admin |
| `GET` | `/api/exams/:id/result` | protect | student, admin |
| `DELETE` | `/api/exams/:id` | protect | teacher, admin |

### Dashboard

| Method | Path | Auth | Roles |
|---|---|---|---|
| `GET` | `/api/dashboard/stats` | protect | any |

### Activities Log

| Method | Path | Auth | Roles |
|---|---|---|---|
| `GET` | `/api/activities` | protect | admin, teacher |

---

## 7. Environment Variables

### Backend

| Variable | Purpose |
|---|---|
| `PORT` | Server port (default `5000`) |
| `MONGO_URL` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret |
| `CLIENT_URL` | Frontend origin for CORS |
| `STAGE` | `"development"` enables Morgan logging |
| `NODE_ENV` | `"production"` hides error stacks, enables secure cookies |
| `GROQ_API_KEY` | Groq AI API key |
| `INNGEST_EVENT_KEY` | Inngest event key (required by Inngest SDK) |
| `INNGEST_SIGNING_KEY` | Inngest signing key (required by Inngest SDK) |

### Frontend

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Backend API base URL (default `http://localhost:5000/api`) |

---

## 8. How to Run Locally

### Prerequisites

- [Bun](https://bun.sh/) (latest) or Node.js with `nodemon`
- MongoDB instance (local or Atlas)
- [Inngest Dev Server](https://www.inngest.com/docs/local-development): `npx inngest-cli@latest dev`
- Groq API Key (for AI features)

### Backend

```bash
cd backend
bun install
# Create .env with: MONGO_URL, JWT_SECRET, CLIENT_URL, GOOGLE_GENERATIVE_AI_API_KEY, STAGE, PORT
bun run dev      # nodemon + bun (watches for changes)
# OR
bun run start    # bun --watch
```

Default port: **5000**

### Frontend

```bash
cd frontend
npm install      # or bun install
npm run dev      # Starts Vite dev server
npm run build    # tsc -b && vite build
npm run lint     # ESLint
npm run preview  # Preview production build
```

Default port: **5173**

### Inngest Dev Server

```bash
npx inngest-cli@latest dev
```

Runs at `http://localhost:8288`. The backend serves the Inngest webhook at `/api/inngest`.

---

## 9. Scripts & Ports

| Component | Script | Port |
|---|---|---|
| Backend dev | `bun run dev` (nodemon) or `bun run start` (bun --watch) | 5000 |
| Frontend dev | `npm run dev` (Vite) | 5173 |
| Inngest dev server | `npx inngest-cli dev` | 8288 |
| Frontend build | `npm run build` | — |
| Frontend lint | `npm run lint` | — |

---

## 10. Deployment Notes

- No Dockerfile or docker-compose in the repository
- No CI/CD configuration detected
- Production considerations:
  - `NODE_ENV=production` hides error stacks and enables secure cookies
  - `CLIENT_URL` must be set to the production frontend URL
  - MongoDB Atlas recommended for production via `MONGO_URL`
  - Inngest requires production event/signing keys
  - Frontend build output goes to `dist/` (standard Vite output)
  - Frontend API base URL configured via `VITE_API_BASE_URL` at build time

---

## 11. Folder Structure

```
ZEKOULABIA/
├── .gitignore
├── .vscode/
│   └── settings.json
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts                    # Express entry point
│       ├── config/
│       │   └── db.ts                    # MongoDB connection
│       ├── middleware/
│       │   └── auth.ts                  # JWT protect + role authorize
│       ├── utils/
│       │   ├── generateToken.ts         # JWT cookie generation
│       │   └── activitieslog.ts         # Activity logging helper
│       ├── inngest/
│       │   ├── index.ts                 # Inngest client (id: "sms-lms")
│       │   └── functions.ts             # AI timetable/exam generation, exam submission
│       ├── models/
│       │   ├── user.ts
│       │   ├── class.ts
│       │   ├── academicYear.ts
│       │   ├── subject.ts
│       │   ├── exam.ts
│       │   ├── examGeneration.ts
│       │   ├── timetable.ts
│       │   ├── timetableGeneration.ts
│       │   ├── submission.ts
│       │   └── activitieslog.ts
│       ├── controllers/
│       │   ├── user.ts
│       │   ├── class.ts
│       │   ├── academicYear.ts
│       │   ├── subject.ts
│       │   ├── exam.ts
│       │   ├── timetable.ts
│       │   ├── dashboard.ts
│       │   └── activitieslog.ts
│       └── routes/
│           ├── user.ts
│           ├── class.ts
│           ├── academicYear.ts
│           ├── subject.ts
│           ├── exam.ts
│           ├── timetable.ts
│           ├── dashboard.ts
│           └── activitieslog.ts
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
    ├── components.json                  # shadcn/ui config
    ├── index.html
    └── src/
        ├── main.tsx                     # React entry (ThemeProvider + AuthProvider + Router)
        ├── types.ts                     # Shared TypeScript types
        ├── lib/
        │   ├── api.ts                   # Axios instance
        │   └── utils.ts                 # cn() utility
        ├── hooks/
        │   ├── AuthProvider.tsx         # Auth context (user + academic year)
        │   └── use-mobile.ts            # Mobile breakpoint hook
        ├── pages/
        │   ├── Home.tsx                 # Public landing page
        │   ├── Login.tsx                # Login page
        │   ├── Dashboard.tsx            # Role-based dashboard
        │   ├── routes/
        │   │   ├── router.tsx           # Route definitions
        │   │   └── PrivateRoutes.tsx    # Auth guard + sidebar layout
        │   ├── users/index.tsx
        │   ├── settings/academic-year.tsx
        │   ├── academics/
        │   │   ├── Classes.tsx
        │   │   ├── Subjects.tsx
        │   │   └── Timetable.tsx
        │   └── lms/
        │       ├── Exams.tsx
        │       └── Exam.tsx
        └── components/
            ├── ui/                      # shadcn/ui components (50+)
            ├── global/                  # Modal, Search, Pagination, Alert, Select, Input
            ├── sidebar/                 # AppSidebar, nav-main, nav-user, ThemeToggle
            ├── auth/                    # UniversalUserForm
            ├── dashboard/               # dashboard-stats, ai-insight-widget
            ├── home/                    # Landing page sections
            ├── classes/                 # ClassForm, ClassTable, schema
            ├── subjects/                # SubjectForm, SubjectTable, schema
            ├── academic-year/           # AcademicYearForm, table, schema
            ├── timetable/               # TimetableGrid, GeneratorControls
            ├── lms/                     # ExamGenerator, ExamRadio
            ├── users/                   # UserTable, UserDialog
            └── provider/                # ThemeProvider
```

---

## 12. Key Flows

### Login Flow

1. User submits email + password → `POST /api/users/login`
2. Backend finds user, verifies password via `bcrypt.compare`
3. On success, `generateToken()` creates JWT (HS512, 30d) and sets httpOnly cookie named `jwt`
4. Response returns user object
5. Frontend `AuthProvider` fetches `/users/profile` on mount
6. If no user, `PrivateRoutes` redirects to `/login`

### Dashboard Flow

1. Authenticated user navigates to `/dashboard`
2. `Dashboard.tsx` calls `GET /api/dashboard/stats`
3. `getDashboardStats` controller branches on `user.role`:
   - **Admin:** total students/teachers, active exams, recent system-wide activities
   - **Teacher:** assigned classes count, pending submissions, next class from timetable
   - **Student:** class name, pending assignments, next exam date
4. Frontend renders role-appropriate stat cards

### Academic Year Management (Admin only)

1. First-time admin with no academic year → `PrivateRoutes` redirects to `/settings/academic-years`
2. **Create:** `POST /api/academic-years/create` — if `isCurrent: true`, deactivates all other years
3. **Update:** `PATCH /api/academic-years/update/:id` — same `isCurrent` logic
4. **Delete:** blocked if `isCurrent: true`

### Class Management

1. Admin creates class via `ClassForm` → `POST /api/classes/create`
2. Controller checks for duplicate `{ name, academicYear }`
3. Classes populated with `academicYear`, `classTeacher`, `subjects` via Mongoose populate
4. `getAllClasses` also aggregates `studentCount` via MongoDB aggregation pipeline
5. Teachers see only classes containing their assigned subjects

### Subject Management

1. Admin creates subject via `SubjectForm` → `POST /api/subjects/create`
2. `syncSubjectTeachers()` bidirectionally syncs `Subject.teacher ↔ User.teacherSubject`
3. Teachers see only their own subjects
4. `teacherCount` aggregated via pipeline

### Timetable Generation (AI-powered)

1. Admin configures via `GeneratorControls` (start/end time, periods/day, teaching days)
2. `POST /api/timetables/generate` → validates settings via `normalizeSettings()`
3. Creates `TimetableGeneration` record (`status: "queued"`), sends Inngest event `generate/timetable`
4. Frontend polls `GET /api/timetables/generation/:id` every 3 seconds
5. Inngest `generateTimeTable` function:
   - Fetches class subjects and qualified teachers
   - Prompts Groq AI with class context, constraints, and conflict avoidance rules
   - `normalizeSchedule()` rebuilds AI output onto calculated time slots with lunch break
   - Saves timetable (deletes existing one for same class/year first)
6. `TimetableGrid` renders the weekly schedule with color-coded periods

### Exam Generation & Submission (AI-powered)

1. Teacher/Admin opens `ExamGenerator` modal, selects subject, class, topic, difficulty, count
2. `POST /api/exams/generate` creates draft exam (empty questions, `isActive: false`) + `ExamGeneration` record
3. Inngest `generateExam` prompts Groq AI for MCQ questions, saves to exam document
4. Frontend polls `GET /api/exams/generation/:id` every 2.5 s
5. Teacher reviews generated exam, toggles `PATCH /api/exams/:id/status` to publish
6. Students see active exams for their class via `GET /api/exams`
7. Student submits answers → `POST /api/exams/:id/submit` triggers Inngest `exam/submit`
8. `handleExamSubmission` auto-grades by comparing answers to `correctAnswer`, stores `Submission` with score
9. Student views result via `GET /api/exams/:id/result` — returns submission with correct answers

### User Management

1. Admin or Teacher creates users via `UniversalUserForm` → `POST /api/users/register`
2. User form adapts fields based on role: students get class selector, teachers get subjects multi-select
3. `syncTeacherSubjects()` bidirectionally syncs `User.teacherSubject ↔ Subject.teacher` on create/update
4. Users listed with pagination, role filtering, and search across `name`/`email`
5. Separate pages for students, teachers, parents, admins — same component with different `role` prop
