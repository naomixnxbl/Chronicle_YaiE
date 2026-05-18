# Chronicle by WSTI

> The social media content tool for Western Sydney Tech Innovators.

Chronicle takes raw event photos and videos, organises them into a story, and drafts a complete platform-specific post — ready to publish. Built exclusively for the WSTI volunteer team.

---

## What It Does

| Step | What happens |
|---|---|
| 1 | Volunteer uploads photos from an event |
| 2 | Google Vision automatically labels every photo |
| 3 | User searches photos by describing what they want |
| 4 | User adds short notes on key photos |
| 5 | Claude drafts a full post in WSTI's voice |
| 6 | User reviews and approves |
| 7 | Blotato publishes to Instagram, LinkedIn, Facebook |

---

## Tech Stack

| Layer | Tool | Purpose |
|---|---|---|
| Framework | Next.js 14 (App Router) | Frontend and API routes |
| Styling | Tailwind CSS | UI styling |
| Deployment | Vercel | Hosting |
| Database | Supabase (Postgres) | Events, photos, post memory |
| Media storage | Cloudinary | Photo and video upload |
| AI brain | Claude API | Post drafting in WSTI's voice |
| Photo intelligence | Google Cloud Vision API | Face detection, image labeling |
| Video rendering | Shotstack API | Reel editing from existing clips |
| Publishing | Blotato API | Post to Instagram, LinkedIn, Facebook |
| Auth | Supabase Auth + Google OAuth | Volunteer sign-in |

---

## Project Structure

```
chronicle/
├── app/
│   ├── login/
│   │   └── page.jsx              # Google Sign-In page
│   ├── home/
│   │   └── page.jsx              # Event library + prompt bar
│   ├── event/
│   │   └── [id]/
│   │       └── page.jsx          # Event detail, photos, post drafting
│   ├── api/
│   │   ├── events/
│   │   │   └── route.js          # GET and POST events
│   │   ├── upload/
│   │   │   └── route.js          # Upload photos to Cloudinary
│   │   ├── vision/
│   │   │   └── route.js          # Google Vision photo labeling
│   │   └── draft-post/
│   │       └── route.js          # Claude API post drafting
│   ├── layout.jsx
│   └── page.jsx                  # Redirects to /home
├── components/
│   ├── AddEventModal.jsx          # Create new event
│   ├── PhotoUploader.jsx          # Upload and display photos
│   └── PostDrafter.jsx            # Draft, review, publish post
├── lib/
│   ├── supabase.js                # Supabase client
│   └── prompt.js                  # WSTI Claude system prompt
├── middleware.js                  # Auth protection
├── .env.local                     # Environment variables
└── google-credentials.json        # Google Cloud service account key
```

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/your-username/chronicle.git
cd chronicle
npm install
```

### 2. Set up environment variables

Create a `.env.local` file in the project root:

```bash
# Claude AI
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Google Cloud Vision
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json

# Blotato
BLOTATO_API_KEY=your-blotato-key
```

### 3. Set up Supabase tables

Run this SQL in your Supabase SQL Editor:

```sql
create table events (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  date date,
  event_type text,
  created_at timestamp default now()
);

create table photos (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  cloudinary_url text not null,
  vision_labels jsonb,
  vision_faces jsonb,
  user_notes text,
  section text,
  taken_at timestamp,
  created_at timestamp default now()
);

create table posts (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  platform text not null,
  content text not null,
  angle text,
  created_at timestamp default now()
);
```

### 4. Set up Google OAuth

- Go to `console.cloud.google.com`
- Create a project named `chronicle`
- Enable **Cloud Vision API**
- Create a **Service Account** and download the JSON key
- Rename the JSON file to `google-credentials.json`
- Place it in the project root
- Create **OAuth 2.0 credentials** for web application
- Add to Authorised JavaScript origins: `http://localhost:3000`
- Add to Authorised redirect URIs: `https://your-project.supabase.co/auth/v1/callback`
- Add the Client ID and Secret to Supabase → Authentication → Providers → Google

### 5. Set up Cloudinary

- Create a free account at `cloudinary.com`
- Go to Settings → Upload → Add upload preset
- Name it `chronicle_uploads`
- Set signing mode to `Unsigned`
- Save

### 6. Run the app

```bash
npm run dev
```

Open `http://localhost:3000`

---

## Environment Variable Sources

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API Keys → Publishable |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API Keys → Secret |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary → Dashboard |
| `CLOUDINARY_API_KEY` | Cloudinary → Settings → Access Keys |
| `CLOUDINARY_API_SECRET` | Cloudinary → Settings → Access Keys |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to `google-credentials.json` |
| `BLOTATO_API_KEY` | shotstack.io → Dashboard |

---

## WSTI Context

Chronicle is built with deep knowledge of WSTI baked into the Claude system prompt.

**Organisation:** Western Sydney Tech Innovators — grassroots, not-for-profit AI community  
**Founder:** Lailei Huang — started WSTI at Parramatta Library, now 3,200+ members  
**Home:** Western Sydney Startup Hub, Spacecubed, 5 Fleet Street, North Parramatta  
**Mission:** Cultivating Western Sydney Through Community-Led, AI-Powered Innovation, Education and Collaboration  
**Partners:** City of Parramatta Council · UNSW Business School · LaunchPad WSU · Investment NSW · Google

**Event types Chronicle knows:**
- AI Shed — weekly Thursday drop-in at 6PM
- Hackathons — weekend build events
- AI Innovation Summit — 12-event series
- Young AI Engineers Club
- Bootcamps
- VIP and government visits
- Build with AI x Google days

**WSTI voice:**  
Warm · Community-first · Western Sydney proud · Never corporate · Accessible to everyone

**Standard hashtags:**  
`#WSTI` `#WesternSydney` `#AIShed` `#WesternSydneyTechInnovators` `#AIcommunity` `#Parramatta` `#AIforAll` `#BuildWithAI`

---

## Platform Rules

### LinkedIn — Primary
- 150–220 words
- Professional but warm and story-driven
- Hook in first 210 characters
- Hashtags inline at end — 3 to 5 only
- Audience: MPs, Google, council leaders, universities

### Instagram — Secondary
- 60–90 words plus hashtags
- Hook in first 125 characters
- Hashtags on new lines after the caption
- Carousel order always specified
- Image formats: Square 1080×1080 · Portrait 1080×1350 · Story 1080×1920

### Facebook — Secondary
- 100–140 words
- Warm, community announcement feel
- Good for tagging partners and council

---

## Features

### Post Drafting
Upload photos → Google Vision labels them → user adds notes → Claude drafts a full post → review → publish

### Photo Search
Type what you want — "photos where Lailei is speaking on stage" — and Chronicle finds the best matches using Vision labels and face detection

### Post Memory
Chronicle remembers every post generated per event and always suggests angles not yet used. One event can produce multiple posts over weeks.

### Video Reel Editor *(coming in v2)*
Upload existing video clips → add notes per clip → pick transition style → Shotstack renders a 9:16 MP4 reel → publish to Instagram Reels

### Google Drive Sync *(coming in v2)*
Connect the WSTI shared Google Drive folder so photos land in Chronicle automatically after every event

---

## Deployment

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Or connect your GitHub repo directly at `vercel.com`.

Add all environment variables in Vercel → Settings → Environment Variables.

**Important:** Add `google-credentials.json` content as an environment variable in production. Do not commit the file to GitHub.

---

## Cut From v1 — Coming in v2

- Google Drive sync
- Auto post-event reminders
- PDF export
- Direct Instagram and LinkedIn API posting
- Multi-organisation support
- Video reel editor

---

## Built With

- [Next.js](https://nextjs.org)
- [Supabase](https://supabase.com)
- [Cloudinary](https://cloudinary.com)
- [Anthropic Claude](https://anthropic.com)
- [Google Cloud Vision](https://cloud.google.com/vision)
- [Shotstack](https://shotstack.io)
- [Blotato](https://blotato.com)
- [Tailwind CSS](https://tailwindcss.com)
- [Vercel](https://vercel.com)

---

*Built for Western Sydney Tech Innovators — wsti.org.au*
