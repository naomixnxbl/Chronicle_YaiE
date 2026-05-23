# WSTI Reel Maker

Turn a folder of photos into a polished, on-brand WSTI reel — Brut-style: bold
animated text, slow Ken Burns photo motion, snappy transitions, intro + outro
cards, a progress bar, and optional music. **No video-editing skill needed.**

You use it through a little web page in your browser: drop photos in, type
captions, pick a format, hit render, download the MP4. The styling is identical
every time, so every reel looks like WSTI.

---

## One-time setup

You need [Node.js](https://nodejs.org) (already installed on this machine).

```bash
cd reel-maker
npm install        # already done — only needed again if you move the folder
```

The first render downloads a small headless browser automatically (~90 MB, once).

---

## Everyday use

```bash
cd reel-maker
npm start
```

Then open **http://localhost:4321** in your browser and:

1. **Photos** — click the box (or drag photos in). Reorder with ↑ ↓, add an
   optional caption under each. Order is top → bottom.
2. **Intro & outro text** — the title, subtitle, closing line, website, handle.
   Pre-filled with WSTI defaults; tweak per video.
3. **Look & format** — pick the output shape, seconds per photo, accent colour,
   and (optional) background music.
4. Hit **Render my reel**, watch the progress bar, then **Download MP4**.

To stop the server: press `Ctrl + C` in the terminal.

### How long will it be?

Each photo shows for ~3s, plus a 2.5s intro and 3.5s outro.
**7–8 photos at 3s each ≈ 30 seconds.** The form shows a live estimate.

### Formats (use one tool for everything)

| Option | Size | Best for |
|--------|------|----------|
| Reels / Stories | 1080×1920 (9:16) | Instagram Reels, TikTok, Stories |
| LinkedIn / Meetup | 1080×1080 (1:1) | LinkedIn feed, Meetup |
| YouTube / Web | 1920×1080 (16:9) | YouTube, website embeds |

### Music

Drop `.mp3` files into [public/music/](public/music/) and they appear in the
dropdown. Use royalty-free tracks (YouTube Audio Library, Pixabay Music, Uppbeat).
Music fades in at the start and out at the end automatically.

---

## Tweaking the look

The default brand colours and copy live in
[src/schema.ts](src/schema.ts) (`defaultProps`). Change them once and every new
reel picks them up.

The visual design — fonts, animations, intro/outro layout — is in
[src/WstiReel.tsx](src/WstiReel.tsx). Headlines use **Anton** (the bold Brut
look); body text uses **Inter**.

### Live preview while editing the design

```bash
npm run studio
```

Opens Remotion Studio (a visual editor) where you can scrub the timeline and see
changes to the template instantly — handy if you want to adjust the style.

### Quick command-line test render (no browser form)

```bash
npm run test-render   # renders the demo photos → out/test.mp4
```

---

## How it works (for the curious)

- **[Remotion](https://remotion.dev)** renders React components to video frame by
  frame, so the whole reel is just code + your photos. That's why it's perfectly
  repeatable.
- `server.mjs` is a small local web server (Express) that serves the form, takes
  your uploads, runs the render, and hands back the MP4. Nothing leaves your
  computer.
- `src/schema.ts` computes the video size and duration from your inputs;
  `src/WstiReel.tsx` is the actual on-screen design.

Output files land in [out/](out/).
