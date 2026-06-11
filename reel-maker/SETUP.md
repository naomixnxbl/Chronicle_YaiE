# Setup guide — WSTI Reel Maker

This guide is for anyone — even if you've never touched a terminal before. Follow each step in order. **Don't skip anything.** Every command is copy-paste-able (click the little copy icon on the right of each code block on GitHub, or just select the text).

If something doesn't work, scroll to **"When things go wrong"** at the bottom — most problems are listed there with the fix.

---

## What you're setting up

A web app that lives on **your** laptop (not on the internet). You open your web browser, go to a special address (`http://localhost:4321`), and the app lets you:
- Make branded reels from photos
- Make photo posts with text overlays
- Post them to Instagram / LinkedIn / Facebook automatically

When you close the app, it stops working. When you open it again, you start it back up with one command.

---

## What you need before starting

You need three things on your laptop:

1. **A Mac or a PC with Windows.** This guide is written for **Mac**. Windows is similar but a couple of commands are different.
2. **An internet connection.** The setup downloads about 1 GB of files.
3. **About 30 minutes of patience.** Most of the time is just waiting for things to download.

---

## Step 1 — Open the Terminal

**Terminal** is a built-in app on your Mac that lets you type commands to your computer. Think of it like texting the computer instructions.

1. Hold the **Command (⌘) key** and press **Spacebar** at the same time. A search bar pops up in the middle of the screen.
2. Type the word `Terminal` and press **Enter**.
3. A window opens with a text prompt that looks something like this:

   ```
   yourname@MacBook ~ %
   ```

   The `%` (or `$`) at the end is where you type. **Don't worry if it looks different — every Mac shows a slightly different prompt.**

You'll spend the rest of this guide typing commands into this window.

> 💡 **How to "type" a command**: Copy the whole line from this guide (highlight it with your mouse, then press **Command + C**). Click into the Terminal window and press **Command + V**. Then press **Enter**.
>
> Commands only run when you press **Enter** at the end.

---

## Step 2 — Install Homebrew

**Homebrew** is a free helper that downloads software for you with one command. Without it, installing things on Mac is a hassle.

Copy and paste this **whole** line into your Terminal, then press **Enter**:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

You'll see:
- "Press RETURN/ENTER to continue" — **press Enter**.
- A prompt for your Mac login password — **type it** (it won't show as you type, that's normal) **and press Enter**.
- About 5 minutes of text scrolling. Just wait.
- At the end, **"==> Installation successful!"**

> 🍺 **Already have Homebrew?** Skip this step. If you're not sure, run this command — if it prints a version number, you have it: `brew --version`

> 🧑‍💻 **At the very end**, Homebrew may print "Next steps:" with a couple of lines that start with `(echo` — copy and paste each of those lines into the Terminal one at a time and press Enter for each. This tells your Mac where Homebrew lives. Then close the Terminal window and open a new one before continuing.

---

## Step 3 — Install Node.js, ffmpeg, and Git

These are the three things the app needs to run.

- **Node.js** — runs the app's code (JavaScript).
- **ffmpeg** — assembles the video files.
- **Git** — downloads the project code from the internet.

Copy and paste this **whole line** into the Terminal and press **Enter**:

```bash
brew install node ffmpeg git
```

You'll see a few minutes of text scrolling — downloads happening. Be patient. When the Terminal returns to the `%` prompt with no errors at the bottom, it's done.

**Check it actually worked.** Run each of these commands one at a time:

```bash
node --version
```

You should see something like `v22.x.x` or `v23.x.x` or `v25.x.x`. If you see `v20` or lower, ask for help — we need v22 or newer.

```bash
ffmpeg -version
```

You should see a line starting with `ffmpeg version 6.x` or higher, then a bunch of technical text.

```bash
git --version
```

You should see `git version 2.x.x`.

If all three printed a version, you're good. **Continue to Step 4.**

---

## Step 4 — Download the project

Now we'll pull the code from the internet onto your laptop.

Pick a place to put it. The Desktop is easy because you can see the folder. Run this command to go to your Desktop:

```bash
cd ~/Desktop
```

`cd` means "change directory" — basically "go to this folder". `~` means your home folder, `~/Desktop` is your Desktop.

Now download the project. Copy and paste:

```bash
git clone https://github.com/naomixnxbl/Chronicle_YaiE.git WSTI_PROJECT
```

You'll see a few lines about cloning, receiving objects, and a percent counter. Wait until it finishes — usually 30 seconds.

**You should now have a folder called `WSTI_PROJECT` on your Desktop.** Open Finder and check — you'll see it there.

Go into that folder and then into the reel-maker subfolder:

```bash
cd WSTI_PROJECT/reel-maker
```

Now you're inside the project. **Every command from here on assumes you're in this folder.** If you ever close the Terminal and re-open, you'll need to run `cd ~/Desktop/WSTI_PROJECT/reel-maker` again to get back here.

---

## Step 5 — Install the project's parts

The project depends on lots of small libraries. This command downloads them all into a folder called `node_modules`.

```bash
npm install
```

**This is the slowest step.** It downloads:
- About 800 MB of JavaScript libraries
- A copy of Chromium (the browser engine that renders the videos)
- A native image processor (sharp)

Expect **3–10 minutes** depending on your internet. You'll see a wall of green/yellow text scrolling — that's normal. **Don't close the Terminal window during this step.**

When it's done, you'll be back at the `%` prompt with a message about "added 800 packages" or similar.

> ⚠️ **If you see red error messages**: the most common cause is your Mac's Xcode tools aren't installed. Run this: `xcode-select --install` — a popup appears, click "Install" and wait ~10 minutes. Then re-run `npm install`.

---

## Step 6 — Add your secret keys

The app needs **API keys** to do AI things and to post to social media. These are like passwords for the AI services. They're **not** stored in the project (security reason) — you have to add them yourself.

Create the secrets file by running:

```bash
nano .env
```

A simple text editor opens **inside the Terminal**. Now copy this whole block, paste it into the editor, and **replace the `PASTE_YOUR_KEY_HERE` parts** with your actual keys:

```env
OPENAI_API_KEY=PASTE_YOUR_KEY_HERE
BLOTATO_API_KEY=PASTE_YOUR_KEY_HERE
BLOTATO_LINKEDIN_ACCOUNT_ID=16494
BLOTATO_INSTAGRAM_ACCOUNT_ID=38239
BLOTATO_FACEBOOK_ACCOUNT_ID=24876
JAMENDO_CLIENT_ID=c3e0222e
```

**Where do the keys come from?**
- **OPENAI_API_KEY** — get it from [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys) (you need to sign up + add a credit card; spending is usually under $5/month for this app).
- **BLOTATO_API_KEY** — get it from your Blotato dashboard at [https://blotato.com](https://blotato.com). Sign in, find "API Keys" in settings, create a new one, paste the value.
- The three Blotato account IDs are **already filled in for you** (16494 / 38239 / 24876) — these are WSTI's connected social accounts. Leave them as they are unless you're setting up for a different brand.
- **JAMENDO_CLIENT_ID** — optional, this is for finding free music. The default (`c3e0222e`) usually works; leave it as-is.

When the keys are pasted in, **save and exit the editor**:
1. Press **Ctrl + O** (the letter O, not zero) — "write out"
2. Press **Enter** to confirm the filename
3. Press **Ctrl + X** to exit

You're back at the `%` prompt. The keys are saved in a hidden file called `.env`.

---

## Step 7 — Start the app

This is the moment of truth. Run:

```bash
node server.mjs
```

After about 5–10 seconds, you should see:

```
  Western Sydney Tech Innovators Reel Maker running →  http://localhost:4321

Bundling Remotion project (one-time)...
Bundle ready.
```

🎉 **The app is running!**

**Don't close this Terminal window.** As long as it stays open, the app stays running.

---

## Step 8 — Open the app in your browser

Open Safari, Chrome, or any browser. In the address bar type:

```
http://localhost:4321
```

…and press **Enter**.

The WSTI Reel Maker page loads. You should see "What are you making today?" with two big cards (Reel and Post).

**You're done.** Use the app like normal.

---

## How to stop the app

Click into the Terminal window and press **Ctrl + C** (the Control key, not Command). The app stops. The Terminal returns to the `%` prompt.

## How to start the app again later

1. Open Terminal (Cmd + Space, type "Terminal", Enter).
2. Run these two commands:

   ```bash
   cd ~/Desktop/WSTI_PROJECT/reel-maker
   node server.mjs
   ```

3. Wait for "Bundle ready." then open `http://localhost:4321` in your browser.

That's the only thing you need to remember day-to-day.

---

## How to pull in new updates

If someone (me, or another developer) pushes improvements to the project, you can pull them in with:

```bash
cd ~/Desktop/WSTI_PROJECT
git pull
cd reel-maker
npm install        # only needed if package.json changed; safe to always run
```

Then start the app again with `node server.mjs`.

---

## When things go wrong

### "command not found: brew"

Homebrew didn't install or its path isn't set. **Close all Terminal windows, open a new one, and try `brew --version` again.** If it still says "not found", re-run Step 2.

### "command not found: node"

Node didn't install. Re-run `brew install node`, then try `node --version` again.

### `npm install` fails with red errors

Usually means Xcode tools missing on Mac. Run:

```bash
xcode-select --install
```

A popup appears — click "Install", wait ~10 minutes for it to finish, then re-run `npm install`.

### "port 4321 is already in use" or "EADDRINUSE"

Another copy of the app is already running. Find it and kill it:

```bash
lsof -ti :4321 | xargs kill
```

Then try `node server.mjs` again.

### The page loads but says "Caption AI needs OPENAI_API_KEY"

The `.env` file is missing or the OpenAI key is wrong. Run `nano .env` again, check that `OPENAI_API_KEY=` is followed by your real key (starting with `sk-proj-...`), save, restart the app.

### "Blotato GET /users/me/accounts → 401 Unauthorized"

Your Blotato key has expired or been revoked. Log into your Blotato dashboard, regenerate the API key, paste the new one into `.env`, save, restart the app. The rest of the app still works — only the **publishing** step is blocked while Blotato is down.

### Black screen on the live preview

The render finished but the in-memory record was lost (e.g. you restarted the app). The video file is still on disk — just **reload the browser tab**, the app will pick it up automatically.

### Anything else

Take a screenshot of the Terminal showing the error and the browser showing the symptom. Send both to whoever set this up for you. Don't try random fixes from Google — they often make things worse.

---

## Files to know about

| File / folder | What it is | OK to delete? |
| --- | --- | --- |
| `reel-maker/.env` | Your secret keys. **NEVER share this file.** | No — you'd lose your keys |
| `reel-maker/brand.config.json` | The brand voice / colours / defaults | No — but you can edit it |
| `reel-maker/public/brand/wsti-logo.png` | The WSTI logo shown on every reel | No (unless replacing the logo) |
| `reel-maker/public/music/*.mp3` | Background music tracks | Yes — drop new mp3s here any time |
| `reel-maker/public/uploads/` | Photos you've uploaded for past renders | Yes — frees disk space |
| `reel-maker/out/*.mp4` | Rendered video files | Yes — but you'll lose the videos |
| `reel-maker/node_modules/` | Installed dependencies | Yes if running out of space — but you'll need to re-run `npm install` |

---

That's it. Welcome to the project. 🎬
