# IELTS Teaching Hub

A modern, production-ready web application for independent IELTS educators and students. Built with Vite, React 18, TypeScript, TailwindCSS, and integrated with Supabase (Authentication, PostgreSQL, Row Level Security, and Realtime).

---

## 🌟 Key Features

1. **Production-Ready Supabase Authentication & Multi-Tenant Access**
   - Real email/password registration with explicit role selection (`teacher` vs `student`).
   - Strict Row Level Security (RLS) enforcing multi-tenant isolation: teachers only view and manage their own courses and authorized students; students only access enrolled courses and their own submissions/statements.
   - Clean initial state: zero hardcoded mock personas or fake student data in production. New teachers start with 0 courses and new students start with 0 enrollments.

2. **Course Enrollment & Cross-Device Realtime Sync**
   - Discovery code workflow: Teacher creates course -> generates unique code -> Student searches by code -> Student submits enrollment request -> Teacher approves/rejects with audit log -> Student roster immediately updates across all devices.
   - Supabase Realtime subscriptions on `enrollments`, `submissions`, `tuition_statements`, and `monthly_assessments`.

3. **Complete English & Vietnamese (EN / VI) Localization**
   - Full bilingual interface (navigation, dashboard cards, forms, rubrics, notifications, empty states).
   - Dynamic language switcher in the top navigation bar and in **Settings**.
   - User language preference automatically synced to PostgreSQL `profiles.language_preference` and restored across devices upon login.
   - User-authored content (essays, comments, course descriptions) preserved without accidental machine translation.

4. **Transparent Tuition Management & Multi-Language PDF Statement Export**
   - 4 supported billing models: Fixed Monthly, Per Session, Hourly, and Course Package.
   - Automatic proration, early payment discounts, and payment history settlement tracking.
   - Export individual printable statements with **PDF Language Mode Switcher** (`English`, `Vietnamese`, or `Bilingual / Song ngữ EN - VI`).
   - Stored financial calculations, transaction references, and currency amounts remain 100% exact and uncorrupted.

5. **Diagnostic Monthly Learning Assessments & AI Assistant**
   - Formative monthly reporting workflow: Gather student submission evidence -> Review AI-drafted observations -> Teacher professional review & evaluation -> Sign-off & Publish.
   - Guarded AI Teaching Assistant: strictly private drafts requiring teacher approval; flags evidence gaps when student submissions are insufficient.

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ and npm
- A free [Supabase](https://supabase.com) account & project

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/zacpham0611/ieltswithbaos-hub.git
cd ielts-teaching-hub
npm install
```

### 3. Environment Variables
Create a `.env.local` file in the project root (see `.env.example`):
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_or_publishable_key
```

> **Note:** `.env` and `.env.local` are excluded from Git by `.gitignore`. Never commit service role secret keys to client-side repositories.

### 4. Database Setup (Supabase SQL Migration)
1. Go to your Supabase Project Dashboard -> **SQL Editor**.
2. Click **New Query**.
3. Copy the entire contents of [`supabase/migrations/20261020000000_init_ielts_hub_schema.sql`](supabase/migrations/20261020000000_init_ielts_hub_schema.sql) and paste it into the editor.
4. Click **Run**.

This script sets up:
- 12 normalized relational tables (`profiles`, `courses`, `enrollments`, `assignments`, `submissions`, `monthly_assessments`, `tuition_settings`, `tuition_statements`, `payment_records`, `class_sessions`, `resources`, `activity_logs`).
- Database trigger `on_auth_user_created` to automatically populate the `profiles` table on signup with role, email, avatar, and default language.
- Row Level Security (RLS) policies for strict tenant boundaries.
- Supabase Realtime publication on `enrollments`, `submissions`, `tuition_statements`, and `monthly_assessments`.

### 5. Supabase Auth Configuration
In your Supabase Dashboard -> **Authentication** -> **Providers** -> **Email**:
- Enable **Email provider**.
- If testing locally without an email SMTP server, you can toggle **Confirm email** OFF for immediate login upon registration, or configure your SMTP provider.

### 6. Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 7. Production Build
```bash
npm run build
```
Verify the build output generated in `dist/`.

---

## 🌐 Deploy to Vercel

1. Push your repository to GitHub.
2. Go to [Vercel](https://vercel.com) and import the repository.
3. In **Project Settings** -> **Environment Variables**, add:
   - `VITE_SUPABASE_URL`: Your Supabase URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: Your Supabase anon or publishable key
4. Deploy! Any push to `main` will trigger automatic builds and deployments.

---

## 🛡️ Security & Architecture

| Concept | Implementation |
|---|---|
| **Identity & Authentication** | Supabase Auth (JWT session tokens stored in secure local storage). |
| **Data Boundary** | PostgreSQL Row Level Security (RLS). Teachers can only access courses they created (`teacher_id = auth.uid()`). Students can only view their own submissions and enrolled courses. |
| **Role Escalation Protection** | Profiles enforce check constraints (`role IN ('teacher', 'student')`). Users cannot alter their role or elevate to administrative privileges. |
| **Realtime Updates** | WebSockets via `supabase.channel` with automatic cleanup in React `useEffect`. Gracefully falls back to manual refresh if Realtime is interrupted. |
| **Localization Persistence** | Stored in `profiles.language_preference` on Supabase, syncing across all browsers and devices. |
| **Clean Initial State** | Statistics, counters, and rosters are derived strictly from database records belonging to `currentUser.id`. Zero hardcoded demo accounts. |

---

## 📄 License
MIT License. Created for the IELTS Teaching Hub community.
