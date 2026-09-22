# MCAT Prep Calculator

A Java Swing planner that turns UWorld and AAMC coverage targets into a dated MCAT study calendar.

## Run

Requires JDK 11 or newer.

```bash
javac -d out MCATPrepPlanner.java
java -cp out MCATPrepPlanner
```

## Included

- Exam date validation and days remaining
- Separate Overview, UWorld, AAMC, Full Lengths, and Calendar tabs
- Dedicated Progress tab for completed UWorld and AAMC questions by subsection
- Today dashboard opens after generation with today's checklist on the left and summary analytics on the right
- Month-by-month calendar with larger day blocks and scrollable daily assignments
- Calendar month navigation with left and right arrow controls
- Calendar progress summary reflects entries made in the Progress tab
- Day blocks use compact text and show all assignments together without an internal scrolling pane
- Blue UWorld and amber AAMC task colors with a calendar legend
- One weekday selector for all seven practice full-lengths, placed in the final seven-week sequence
- On short timelines, earlier full lengths are omitted automatically so the latest full lengths are preserved
- On short timelines, CARS increases above three passages per day when necessary to finish the selected target
- Black Update Calendar button in Progress recalculates the remaining workload after progress changes
- Today tab with a current-day checklist and days-until-exam counter
- Generate Calendar action in the main navigation and setup footer
- Direct links to the UWorld MCAT platform and AAMC MCAT Prep Hub in their respective tabs
- UWorld C/P, B/B, and P/S totals with 0%, 25%, 50%, 75%, and 100% targets
- AAMC Biology, C/P, and Independent QBank totals with the same target choices
- UWorld CARS percentage target scheduled backward from the exam at up to three passages per available study day
- Weekly recurring break days and specific unavailable dates
- Fixed full-length schedule: Unscored at exam minus 49 days, FL1 through FL6 weekly afterward at minus 42 through minus 7 days, and the MCAT on exam day
- UWorld duration is based on remaining questions at roughly 75 questions per day, keeping a full target to a little over one month and below 80 questions per day; AAMC begins during the final UWorld week and stays concentrated late
- UWorld and AAMC subsections balanced across their phase so daily work includes multiple sections instead of one section per day
- Generated calendar with daily checkboxes and separate full-length, break, and unavailable days

The current version keeps the generated plan in memory and resets when the app is restarted.

After entering your exam date and targets, click **Generate Calendar**. The app switches to the Calendar tab and fills the date grid with UWorld/AAMC assignments, full-length exams, break days, and unavailable days.

## Static Netlify website

The browser version is `index.html`, `styles.css`, and `app.js`. It does not require Java, npm, or a server. Progress is saved in the browser's local storage.

To deploy with Netlify:

1. Create a GitHub repository containing these files.
2. In Netlify, choose **Add new site** and **Import an existing project**.
3. Select the repository.
4. Set the publish directory to `.` and leave the build command empty.
5. Deploy.

The included `netlify.toml` already sets the publish directory to the project root. The Java Swing file remains available for desktop use; it is not used by the static website.

## Accounts and cloud sync (Supabase)

The static site now requires signing in before it saves anything, so each person's calendar and progress follow their account instead of one shared browser. Auth and storage run on [Supabase](https://supabase.com) (free tier), called directly from the browser — no server code to host.

1. Create a free Supabase project.
2. In the Supabase SQL editor, run:
   ```sql
   create table plans (
     user_id uuid primary key references auth.users (id) on delete cascade,
     data jsonb not null default '{}'::jsonb,
     updated_at timestamptz not null default now()
   );

   alter table plans enable row level security;

   create policy "Users manage their own plan"
     on plans for all
     using (auth.uid() = user_id)
     with check (auth.uid() = user_id);
   ```
3. In Supabase, go to **Project Settings > API** and copy the **Project URL** and **anon public** key.
4. Paste those values into `supabase-config.js` (`SUPABASE_URL` and `SUPABASE_ANON_KEY`). The anon key is safe to publish; the RLS policy above keeps every user's row private.
5. By default Supabase requires email confirmation for new signups. You can turn that off in **Authentication > Providers > Email** for easier testing, or leave it on for production.
6. Redeploy the site (or reload locally). Visitors now see a sign in / sign up screen; once authenticated, their plan is saved to `localStorage` for speed and mirrored to the `plans` table so it follows them to any device.

