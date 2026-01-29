# Beehiiv Newsletter Integration Setup

This guide will walk you through setting up the automated Beehiiv newsletter for your Smash Bros daily reports.

## Overview

The daily report is automatically converted into a beautiful HTML newsletter and sent via Beehiiv to all your subscribers. The integration runs as part of the GitHub Actions workflow after the daily report is generated.

## Features

- 🎨 Beautiful HTML email with gradient headers and styled tables
- 📊 Includes player stats, rivalries, perfect games, and highlights
- 🔗 Link to full interactive report
- 📱 Mobile-responsive design
- 🚀 Automatically published to both email and web
- ⏰ Runs daily at 8 AM PST

## Setup Steps

### 1. Create a Beehiiv Account

1. Go to [beehiiv.com](https://www.beehiiv.com)
2. Sign up for a free **Launch plan** (supports up to 2,500 subscribers)
3. Create your publication (e.g., "Smash Leaderboard Daily")

### 2. Get Your API Credentials

#### Get API Key:
1. Log into your Beehiiv account
2. Go to **Settings** → **Integrations** → **API**
3. Click **"Create API Key"**
4. Copy the API key (you won't be able to see it again!)

#### Get Publication ID:
1. In Beehiiv, go to **Settings** → **General**
2. Look for your **Publication ID** (format: `pub_xxxxxxxx`)
3. Or find it in the URL when viewing your publication settings

### 3. Add Secrets to GitHub

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Add two secrets:

   **Secret 1:**
   - Name: `BEEHIIV_API_KEY`
   - Value: Your API key from Beehiiv

   **Secret 2:**
   - Name: `BEEHIIV_PUBLICATION_ID`
   - Value: Your publication ID (format: `pub_xxxxxxxx`)

### 4. Test the Integration

You can test the integration in two ways:

#### Option A: Dry Run (Recommended First)
Run locally to preview without actually sending:

```bash
# Make sure you have the required dependencies
pip install requests

# Set environment variables
export BEEHIIV_API_KEY="your_api_key_here"
export BEEHIIV_PUBLICATION_ID="pub_your_pub_id"

# Run in dry-run mode
python send_to_beehiiv.py --dry-run
```

#### Option B: Manual Workflow Trigger
1. Go to **Actions** tab in your GitHub repo
2. Select **"Daily Smash Report"** workflow
3. Click **"Run workflow"**
4. The workflow will generate a report and send it via Beehiiv

### 5. Customize (Optional)

You can customize the newsletter by editing `send_to_beehiiv.py`:

#### Change Newsletter Status
By default, newsletters are published immediately. To save as draft instead:

```python
post_data = {
    # ... other fields ...
    "status": "draft",  # Change from "confirmed" to "draft"
}
```

#### Customize Styling
Edit the HTML in the `format_html_email()` function:
- Change gradient colors
- Adjust fonts and spacing
- Modify table styles
- Update footer text

#### Customize Subject Line
Edit line 191 in `send_to_beehiiv.py`:

```python
subject_line = f"{report['headline']} - {report['date']}"  # Customize this format
```

## Email Preview

The newsletter includes:

1. **Hero Section**: Gradient banner with date and headline
2. **Main Report**: Full sports-style narrative
3. **Player of the Day**: Highlighted callout with gradient background
4. **Key Highlights**: Bulleted list of top moments
5. **Perfect Games**: Gold-highlighted section for 3-0 performances
6. **Player Stats Table**: Sortable table with win rates and K/D ratios
7. **Rivalries**: Top head-to-head matchups
8. **CTA Button**: Link to full interactive report
9. **Footer**: Branding and unsubscribe info

## Managing Subscribers

### Add Subscribers
You can add subscribers through:
1. **Beehiiv UI**: Settings → Subscribers → Add manually
2. **API**: Use Beehiiv's subscriber API endpoint
3. **Signup Form**: Embed Beehiiv's form on your website

### View Analytics
In Beehiiv dashboard:
- Open rates
- Click rates
- Subscriber growth
- Most engaged readers

## Troubleshooting

### Newsletter Not Sending

1. **Check GitHub Actions logs**:
   - Go to Actions tab
   - Click on the failed run
   - Look for errors in "Send newsletter to Beehiiv" step

2. **Verify secrets are set**:
   - Settings → Secrets and variables → Actions
   - Both `BEEHIIV_API_KEY` and `BEEHIIV_PUBLICATION_ID` should be listed

3. **Common error messages**:

   - `ERROR: BEEHIIV_API_KEY environment variable not set`
     → Add the secret to GitHub

   - `Status: 401 Unauthorized`
     → API key is invalid, regenerate in Beehiiv

   - `Status: 404 Not Found`
     → Publication ID is incorrect, check Beehiiv settings

### No Matches Today

If there are no matches in the 24-hour window, the script will skip sending to avoid empty newsletters. This is expected behavior.

### Testing Locally

```bash
# Install dependencies
pip install pandas numpy anthropic requests

# Export data (requires DATABASE_URL)
export DATABASE_URL="your_postgres_connection_string"
python export_data.py

# Generate report (requires ANTHROPIC_API_KEY)
export ANTHROPIC_API_KEY="your_anthropic_key"
python generate_daily_report.py

# Send to Beehiiv (dry run)
export BEEHIIV_API_KEY="your_beehiiv_key"
export BEEHIIV_PUBLICATION_ID="pub_xxxxxxxx"
python send_to_beehiiv.py --dry-run

# Actually send (remove --dry-run flag)
python send_to_beehiiv.py
```

## Pricing & Limits

### Beehiiv Free Plan (Launch)
- ✅ Up to 2,500 subscribers
- ✅ Unlimited emails sent
- ✅ API access included
- ✅ Web archive of all posts
- ✅ Basic analytics

### When to Upgrade
You'll need to upgrade to Scale ($49/month) or higher when:
- You exceed 2,500 subscribers
- You want advanced features like A/B testing
- You need automation workflows

## Support

- **Beehiiv API Docs**: [developers.beehiiv.com](https://developers.beehiiv.com)
- **Beehiiv Support**: [beehiiv.com/support](https://www.beehiiv.com/support)
- **Script Issues**: Check GitHub Actions logs or run locally with `--dry-run`

## Next Steps

1. ✅ Complete setup (API key + Publication ID added to GitHub)
2. 📧 Test with dry-run mode
3. 🚀 Trigger a manual workflow run
4. 📊 Check your first newsletter in Beehiiv dashboard
5. 👥 Start growing your subscriber list!
6. 📈 Monitor analytics in Beehiiv

---

**That's it!** Your daily Smash Bros leaderboard report will now automatically be sent as a newsletter every day at 8 AM PST. 🎮📬
