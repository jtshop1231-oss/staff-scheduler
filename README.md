# Staff Shift Scheduler

A hospital shift request scheduling app with admin control panel and real-time request tracking.

## Features

- **Admin Dashboard** — Set scheduling weeks, view live shift requests
- **Staff Calendar** — Request shifts by selecting ON/OFF for each day
- **Real-time Updates** — See requests as they come in
- **Multi-week Support** — Configure 1-20 weeks ahead for staff to request

## Default Login Credentials

**Admin:**
- Username: `admin`
- Password: `admin123`

**Staff:**
- Select any name from the dropdown

## How to Deploy on Vercel

1. Go to https://github.com and create a new account (if needed)
2. Create a new repository called `staff-scheduler`
3. Upload these files:
   - `page.jsx`
   - `package.json`
   - `.gitignore`
   - `README.md`
4. Go to https://vercel.com and sign in with GitHub
5. Click "New Project" → Select your `staff-scheduler` repository
6. Click Deploy
7. Get your live URL (like: `staff-scheduler.vercel.app`)

## Local Development (Optional)

```bash
npm install
npm run dev
```

Then open http://localhost:3000

## Files Explained

- **page.jsx** — Main app with all the code (login, admin dashboard, staff calendar)
- **package.json** — Lists what libraries the app needs
- **.gitignore** — Files to ignore when uploading to GitHub
- **README.md** — This file

## Features

### Admin Controls
- Set how many weeks staff can request shifts
- View all shift requests in real-time
- See summary of requests per staff member

### Staff Interface
- Login with your name
- View available weeks
- Click ON/OFF for each shift you want or don't want
- Save requests with one click
- See confirmation when saved

---

Built for Memorial Hermann telemetry scheduling.
