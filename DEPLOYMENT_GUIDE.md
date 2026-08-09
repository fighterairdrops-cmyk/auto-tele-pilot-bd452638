# Deployment Guide - Auto Tele Pilot

This guide covers deploying your app from Lovable to Railway and then to Vercel.

## Prerequisites
- GitHub account with this repository
- Railway account (railway.app)
- Vercel account (vercel.com)
- Your Supabase URL and Publishable Key

## Step 1: Prepare Environment Variables

Your app uses these Supabase environment variables:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Your Supabase publishable key

Get these from your Supabase dashboard: Settings > API

## Step 2: Deploy to Railway

### Option A: Using Railway Dashboard (Recommended)

1. Go to [railway.app](https://railway.app)
2. Click "Create Project" → "Deploy from GitHub repo"
3. Select your `fighterairdrops-cmyk/auto-tele-pilot` repository
4. Railway will automatically detect it as a Node.js project
5. Add variables in the Railway dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
6. Click "Deploy"

### Option B: Using Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Add environment variables
railway variables add VITE_SUPABASE_URL=your_url
railway variables add VITE_SUPABASE_PUBLISHABLE_KEY=your_key

# Deploy
railway up
```

## Step 3: Verify Railway Deployment

- Railway will provide a URL like `https://auto-tele-pilot-production-*.railway.app`
- Test your app:
  - Visit the URL
  - Check if Supabase authentication works
  - Verify data loads correctly

## Step 4: Deploy to Vercel (Optional)

Once Railway is working, you can also deploy to Vercel:

### Option A: Using Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Select "Other" as framework (Vercel detects Vite)
4. Add the same environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
5. Click "Deploy"

### Option B: Using Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Follow the prompts and add your environment variables
```

## Step 5: Configure Supabase for Both Deployments

In your Supabase dashboard, add both URLs to allowed redirect URLs:

**Settings > Authentication > URL Configuration > Redirect URLs:**
- `https://your-railway-app.railway.app`
- `https://your-vercel-app.vercel.app`

## Troubleshooting

### Issue: Environmental variables not loading
- Ensure variable names start with `VITE_` (required by Vite)
- Check that they're added in Railway/Vercel dashboard
- Rebuild the app after adding variables

### Issue: Supabase auth not working
- Verify URLs are added to Supabase redirect URLs
- Check browser console for CORS errors
- Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are correct

### Issue: Old bots not connecting
- Database schema and data should sync automatically from Supabase
- Verify Supabase connection strings match across all deployments
- Check that authentication tokens are still valid

## Notes

- The app is built for production in Docker
- Node.js 20 Alpine is used for minimal image size
- All old bots will work as long as they use the same Supabase credentials
- Data persists in Supabase across deployments
- No local database needed - everything is in Supabase

## Support

For issues:
1. Check Railway/Vercel deployment logs
2. Verify environment variables are set
3. Check Supabase status page
4. Review app console for errors