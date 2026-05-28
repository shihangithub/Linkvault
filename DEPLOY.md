# Deploying LinkVault

## Prerequisites
- A [Supabase](https://supabase.com) account (free tier is fine)
- A [Vercel](https://vercel.com) account
- A GitHub account (Vercel deploys from GitHub)

---

## 1. Set up Supabase

1. Create a new Supabase project (choose the region closest to you).
2. Go to **SQL Editor** and run the contents of [`supabase/schema.sql`](./supabase/schema.sql).
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role (secret)** key → `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
gh repo create linkvault --private --source=. --push
# or: git remote add origin https://github.com/YOU/linkvault.git && git push -u origin main
```

---

## 3. Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repo.
2. Under **Environment Variables**, add all four:

| Name | Value |
|------|-------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service_role key) |
| `LINKVAULT_PIN` | your chosen 4–8 digit PIN |
| `LINKVAULT_SESSION_SECRET` | a random 32+ char string |

   Generate the session secret with: `openssl rand -base64 32`

3. Click **Deploy**. Vercel will build and publish the app.

---

## 4. Change the PIN later

1. Go to **Vercel → Project → Settings → Environment Variables**.
2. Update `LINKVAULT_PIN` to a new value.
3. Trigger a redeploy (Vercel dashboard → **Deployments → Redeploy**).

Existing sessions are invalidated automatically because they're HMAC-signed against the old PIN hash.

---

## Local development

```bash
cp .env.example .env.local   # fill in real or placeholder values
npm install
npm run dev                  # http://localhost:3000
```

The app works without real Supabase credentials in dev — links won't persist, but the full UI is functional.
