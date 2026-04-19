# CoachPro — Coaching Institute Manager

A clean, mobile-first SaaS MVP for Indian coaching institutes.
**Fee tracking · Attendance · WhatsApp reminders.**

---

## ⚡ Quick Start 

### 1. Install dependencies
```bash
npm install
```

### 2. Configure Supabase
```bash
cp .env.example .env
```
Edit `.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run the SQL schema
- Open [Supabase Dashboard](https://supabase.com/dashboard)
- Go to **SQL Editor → New Query**
- Paste contents of `schema.sql` and run

### 4. Start dev server
```bash
npm run dev
```

### 5. Deploy
```bash
npm run build
# Deploy /dist to Vercel, Cloudflare Pages, or Netlify
```

---

## 📁 Folder Structure

```
src/
├── lib/
│   └── supabase.ts         All DB queries + TypeScript types
├── components/
│   ├── Layout.tsx          Sidebar (desktop) + bottom nav (mobile)
│   ├── StatCard.tsx        Dashboard metric cards
│   ├── Toast.tsx           Toast notifications + useToast hook
│   ├── EmptyState.tsx      Empty list placeholder
│   └── PageHeader.tsx      Page title + action slot
└── pages/
    ├── Dashboard.tsx       Stats overview + quick actions
    ├── Students.tsx        Add/list/delete students by batch
    ├── Fees.tsx            Assign fees, mark paid, WhatsApp remind
    └── Attendance.tsx      Mark present/absent, save, notify
```

---

## 🔑 Features

| Feature | How |
|---|---|
| Add Students | Name, phone, batch (Morning/Afternoon/Evening/Weekend) |
| Fee Reminders | Opens WhatsApp pre-filled with student name + amount |
| Mark Attendance | Tap to toggle present/absent per student |
| Notify Absentees | Opens WhatsApp for each absent student |
| Overdue Fees | Automatically highlighted in red |
| Attendance Rate | Visual progress bar per batch |

---

## 🚀 v2 Ideas (after first 10 customers)

- [ ] Supabase Auth + per-institute data isolation (RLS)
- [ ] Monthly fee reports (PDF export)
- [ ] SMS reminders via Twilio / MSG91
- [ ] Student attendance history view
- [ ] Fee collection analytics

---

## 💰 Pricing Suggestion

| Plan | Price | Limit |
|---|---|---|
| Starter | ₹499/month | 1 institute, 100 students |
| Growth | ₹999/month | 1 institute, 500 students |
| Pro | ₹1999/month | Unlimited students + reports |
