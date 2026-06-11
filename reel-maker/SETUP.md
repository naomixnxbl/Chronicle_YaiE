# Setup guide — WSTI Reel Maker

This guide is for anyone, including someone who's never opened a Terminal / Command Prompt before. **Don't skip steps.** Every command is copy-paste-able.

---

## Pick your operating system

**Are you on a Mac or a Windows PC?** Click the matching section:

- 🍎 **[Mac (macOS)](#mac-macos)** — for any MacBook or iMac.
- 🪟 **[Windows](#windows)** — for any PC running Windows 10 or 11.

Each section has two paths:

- ✅ **Easy way (recommended)** — download, double-click two files. No commands to type.
- 🔧 **Manual way** — type commands yourself. Use this if the easy way fails.

If anything goes wrong, scroll to **[When things go wrong](#when-things-go-wrong)** at the bottom.

---

# Mac (macOS)

You need three things to start:

1. A Mac running macOS 12 or newer.
2. An internet connection.
3. **20–30 minutes** (mostly waiting).

---

## 🍎 Mac — Easy way

### Step 1 — Download the project

Open Safari (or any browser) and go to:

```
https://github.com/naomixnxbl/Chronicle_YaiE
```

Click the green **"Code"** button → **"Download ZIP"**.

A file called `Chronicle_YaiE-main.zip` lands in your Downloads folder.

**Double-click it** to unzip. You get a folder called `Chronicle_YaiE-main`. **Drag that folder to your Desktop** so it's easy to find.

Open the folder — you'll see three things that matter:
- `install.command` (the installer)
- `start.command` (the launcher)
- a `reel-maker` folder (the app itself)

### Step 2 — Double-click `install.command`

Find **`install.command`** in the folder. **Double-click it.**

⚠️ **First time only — macOS may block it:**

If you see *"install.command can't be opened because Apple cannot check it for malicious software"*:

1. Click **OK** to dismiss.
2. Open **System Settings** (Apple menu → System Settings).
3. Go to **Privacy & Security**.
4. Scroll down to the bottom — you'll see *"install.command was blocked…"*. Click **"Open Anyway"**.
5. A confirmation pops up. Click **"Open"**.

A Terminal window appears with a welcome banner. Press **Enter** to start.

The script then does everything automatically:

- Installs **Homebrew** if missing (asks for your Mac password — invisible while typing, that's normal).
- Installs **Node.js, ffmpeg, git**.
- Downloads the app's libraries (**~800 MB — the slow part, 3–10 minutes**).
- Creates a `.env` file and opens it in TextEdit for you.

**Don't close the window during install.** You'll see lots of text scroll — that's correct.

### Step 3 — Paste your secret keys

TextEdit opens with a file that looks like this:

```env
OPENAI_API_KEY=PASTE_YOUR_KEY_HERE
BLOTATO_API_KEY=PASTE_YOUR_KEY_HERE
BLOTATO_LINKEDIN_ACCOUNT_ID=16494
BLOTATO_INSTAGRAM_ACCOUNT_ID=38239
BLOTATO_FACEBOOK_ACCOUNT_ID=24876
JAMENDO_CLIENT_ID=c3e0222e
```

Replace **`PASTE_YOUR_KEY_HERE`** on the first two lines with your real keys:

- **OPENAI_API_KEY** — get it from [platform.openai.com/api-keys](https://platform.openai.com/api-keys). Starts with `sk-proj-…`
- **BLOTATO_API_KEY** — get it from [blotato.com](https://blotato.com) → settings → API. Starts with `blt_…`

**Save** (press **Cmd + S**), then **close TextEdit**.

Go back to the Terminal window and press **Enter** to finish setup.

### Step 4 — Double-click `start.command`

This launches the app. A Terminal window opens, the server starts, and your browser opens to `http://localhost:4321` after about 7 seconds.

🎉 **Done.** Use the app like normal.

- **To stop**: close the Terminal window, or click into it and press **Ctrl + C** (the **Control** key, not Command).
- **To start again later**: just double-click `start.command`. You don't need to run install again unless you set up on a new computer.

---

## 🍎 Mac — Manual way (step by step)

Use this if the easy way fails or you want to understand each step.

### Step 1 — Open the Terminal

The Terminal is a built-in Mac app for typing commands.

1. Press **Cmd + Spacebar** (Spotlight pops up).
2. Type `Terminal` and press **Enter**.

A window opens with a prompt ending in `%` or `$`. That's where you type.

### Step 2 — Install Homebrew

Homebrew is a free helper that downloads software with one command. Copy and paste this whole line, press **Enter**:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

- Press **Enter** when it says "Press RETURN to continue".
- Type your Mac password when asked (invisible — that's normal).
- Wait ~5 minutes for downloads.
- It finishes with **"Installation successful!"**.

> Already have Homebrew? Run `brew --version` — if it prints a number, skip this step.

> At the end, Homebrew prints "Next steps:" with `(echo ...)` lines. Run each one in the Terminal so brew is findable. Then close and reopen the Terminal window.

### Step 3 — Install Node.js, ffmpeg, and git

```bash
brew install node ffmpeg git
```

Verify each one with these (run them one at a time):

```bash
node --version
```
Should print `v22.x.x` or higher.

```bash
ffmpeg -version
```
Should print `ffmpeg version 6.x` or higher.

```bash
git --version
```
Should print `git version 2.x.x`.

### Step 4 — Download the project

```bash
cd ~/Desktop
git clone https://github.com/naomixnxbl/Chronicle_YaiE.git WSTI_PROJECT
cd WSTI_PROJECT/reel-maker
```

You're now inside the project folder.

### Step 5 — Install the project's libraries

```bash
npm install
```

This is the slow step — 3 to 10 minutes. Don't close the Terminal.

> ⚠️ Red errors? Run `xcode-select --install`, wait for it to finish, then `npm install` again.

### Step 6 — Create the secrets file

```bash
nano .env
```

Paste this (then replace `PASTE_YOUR_KEY_HERE` with your real keys):

```env
OPENAI_API_KEY=PASTE_YOUR_KEY_HERE
BLOTATO_API_KEY=PASTE_YOUR_KEY_HERE
BLOTATO_LINKEDIN_ACCOUNT_ID=16494
BLOTATO_INSTAGRAM_ACCOUNT_ID=38239
BLOTATO_FACEBOOK_ACCOUNT_ID=24876
JAMENDO_CLIENT_ID=c3e0222e
```

Save: **Ctrl + O**, **Enter**, then **Ctrl + X** to exit.

### Step 7 — Start the app

```bash
node server.mjs
```

Wait for `Bundle ready.`, then open `http://localhost:4321` in your browser.

To stop: **Ctrl + C** in the Terminal.

To start again later:
```bash
cd ~/Desktop/WSTI_PROJECT/reel-maker
node server.mjs
```

---

# Windows

You need three things to start:

1. A PC running **Windows 10 (version 1809 or newer)** or **Windows 11**.
2. An internet connection.
3. **20–30 minutes** (mostly waiting).

---

## 🪟 Windows — Easy way

### Step 1 — Download the project

Open Edge (or any browser) and go to:

```
https://github.com/naomixnxbl/Chronicle_YaiE
```

Click the green **"Code"** button → **"Download ZIP"**.

A file called `Chronicle_YaiE-main.zip` lands in your **Downloads** folder.

**Right-click the ZIP → "Extract All..."** → choose your Desktop as the destination → click **"Extract"**.

You get a folder called `Chronicle_YaiE-main` on your Desktop. Open it — you'll see:
- `install.bat` (the installer)
- `start.bat` (the launcher)
- a `reel-maker` folder (the app itself)

### Step 2 — Double-click `install.bat`

Find **`install.bat`** and **double-click it**.

⚠️ **First time only — Windows may block it:**

If a blue popup appears saying *"Windows protected your PC"* / *"SmartScreen blocked..."*:

1. Click **"More info"** (small link in the popup).
2. A new button appears: **"Run anyway"** — click it.

A black Command Prompt window opens with a welcome banner. Press any key to start.

The script then does everything automatically:

- Uses **winget** (Windows' built-in installer) to add **Node.js, ffmpeg, git**.
- You may see Windows asking *"Do you want to allow this app to make changes?"* — click **Yes** each time.
- Downloads the app's libraries (**~800 MB — 3–10 minutes**).
- Creates a `.env` file and opens it in Notepad for you.

**Don't close the window during install.**

> ⚠️ If the script shows *"Node.js isn't visible in this window yet"* — that's normal after the first run. **Close the window and double-click `install.bat` one more time.** It picks up where it left off.

### Step 3 — Paste your secret keys

Notepad opens with a file that looks like this:

```env
OPENAI_API_KEY=PASTE_YOUR_KEY_HERE
BLOTATO_API_KEY=PASTE_YOUR_KEY_HERE
BLOTATO_LINKEDIN_ACCOUNT_ID=16494
BLOTATO_INSTAGRAM_ACCOUNT_ID=38239
BLOTATO_FACEBOOK_ACCOUNT_ID=24876
JAMENDO_CLIENT_ID=c3e0222e
```

Replace **`PASTE_YOUR_KEY_HERE`** on the first two lines with your real keys:

- **OPENAI_API_KEY** — get it from [platform.openai.com/api-keys](https://platform.openai.com/api-keys). Starts with `sk-proj-…`
- **BLOTATO_API_KEY** — get it from [blotato.com](https://blotato.com) → settings → API. Starts with `blt_…`

**Save** (press **Ctrl + S**), then **close Notepad**.

Go back to the Command Prompt window and press any key to finish.

### Step 4 — Double-click `start.bat`

This launches the app. A Command Prompt window opens, the server starts, and your browser opens to `http://localhost:4321` after about 7 seconds.

🎉 **Done.** Use the app like normal.

- **To stop**: close the Command Prompt window.
- **To start again later**: just double-click `start.bat`. You don't need to run install again unless you set up on a new computer.

---

## 🪟 Windows — Manual way (step by step)

Use this if the easy way fails or you want to understand each step.

### Step 1 — Open the Command Prompt

1. Press the **Windows key** (or click the Start button).
2. Type `cmd` and press **Enter**.

A black window opens. That's the Command Prompt. You type commands and press Enter to run them.

### Step 2 — Install Node.js, ffmpeg, and git via winget

Copy and paste these one at a time. Press **Enter** after each, and click **Yes** on any "do you want to allow this app?" popup:

```cmd
winget install OpenJS.NodeJS.LTS
```

```cmd
winget install Gyan.FFmpeg
```

```cmd
winget install Git.Git
```

> ⚠️ Each install takes 1–3 minutes. Wait for the `C:\>` prompt to come back before pasting the next one.

> If `winget` says "not recognized": open **Microsoft Store**, search for **App Installer**, install it. Then restart the Command Prompt and try again.

**Close the Command Prompt window and open a new one** — Windows needs a fresh window to "see" the newly-installed tools.

Verify:

```cmd
node --version
```
Should print `v22.x.x` or higher.

```cmd
ffmpeg -version
```
Should print `ffmpeg version 6.x` or higher.

```cmd
git --version
```
Should print `git version 2.x.x`.

### Step 3 — Download the project

```cmd
cd %USERPROFILE%\Desktop
```

```cmd
git clone https://github.com/naomixnxbl/Chronicle_YaiE.git WSTI_PROJECT
```

```cmd
cd WSTI_PROJECT\reel-maker
```

You're now inside the project folder.

### Step 4 — Install the project's libraries

```cmd
npm install
```

This is the slow step — 3 to 10 minutes. Don't close the window.

### Step 5 — Create the secrets file

```cmd
notepad .env
```

A new Notepad window opens. Paste this (then replace `PASTE_YOUR_KEY_HERE` with your real keys):

```env
OPENAI_API_KEY=PASTE_YOUR_KEY_HERE
BLOTATO_API_KEY=PASTE_YOUR_KEY_HERE
BLOTATO_LINKEDIN_ACCOUNT_ID=16494
BLOTATO_INSTAGRAM_ACCOUNT_ID=38239
BLOTATO_FACEBOOK_ACCOUNT_ID=24876
JAMENDO_CLIENT_ID=c3e0222e
```

Save: **Ctrl + S**. When asked "Save as type", make sure it's set to "All Files (\*.\*)" and the filename is exactly `.env` (with the dot, no `.txt` after).

Close Notepad.

### Step 6 — Start the app

```cmd
node server.mjs
```

Wait for `Bundle ready.`, then open `http://localhost:4321` in your browser.

To stop: close the Command Prompt window, or press **Ctrl + C**.

To start again later:
```cmd
cd %USERPROFILE%\Desktop\WSTI_PROJECT\reel-maker
node server.mjs
```

---

# Where to get the API keys

Both setups need two real keys you have to fetch yourself:

### 1. OpenAI API key

Used for the AI captions, story ordering, brand-voice extraction.

1. Go to [platform.openai.com](https://platform.openai.com).
2. Sign in (or create an account).
3. Click your profile (top-right) → **API keys**.
4. Click **"+ Create new secret key"** → name it something like "WSTI Reel Maker" → click **Create**.
5. **Copy the key immediately** (you only see it once). Starts with `sk-proj-…`
6. Paste it after `OPENAI_API_KEY=` in your `.env` file.

You also need to add a credit card to your OpenAI account in **Billing**. Usage is typically under $5/month for this app.

### 2. Blotato API key

Used for actually posting reels and photos to Instagram, LinkedIn, and Facebook.

1. Go to [blotato.com](https://blotato.com).
2. Sign in.
3. Make sure your IG / LinkedIn / Facebook accounts are connected (under **Accounts**).
4. Go to **Settings → API Keys**.
5. Generate a new key. **Copy it.** Starts with `blt_…`
6. Paste it after `BLOTATO_API_KEY=` in your `.env` file.

If the app shows *"Blotato 401 Unauthorized"* later, your key was revoked. Generate a new one and paste it in.

---

# Common day-to-day stuff

### How to start the app
- Mac: double-click `start.command`
- Windows: double-click `start.bat`
- Browser opens automatically.

### How to stop the app
- Close the Terminal / Command Prompt window. That's it.

### How to update to the newest version

Open Terminal (Mac) / Command Prompt (Windows). Run these:

**Mac:**
```bash
cd ~/Desktop/WSTI_PROJECT
git pull
cd reel-maker
npm install
```

**Windows:**
```cmd
cd %USERPROFILE%\Desktop\WSTI_PROJECT
git pull
cd reel-maker
npm install
```

Then double-click `start.command` / `start.bat` to launch the updated version.

### How to add background music

Drop `.mp3` files into:
- Mac: `~/Desktop/WSTI_PROJECT/reel-maker/public/music/`
- Windows: `%USERPROFILE%\Desktop\WSTI_PROJECT\reel-maker\public\music\`

They appear in the music dropdown on the app's step 2.

---

# When things go wrong

### Mac: "install.command can't be opened" / "Apple cannot check it for malicious software"

System Settings → Privacy & Security → scroll to the bottom → click **"Open Anyway"** → re-double-click `install.command`.

### Mac: `npm install` fails with red errors

Most likely Xcode tools missing. Run in Terminal:

```bash
xcode-select --install
```

Popup appears → click **Install** → wait ~10 minutes → re-run `npm install` (or re-double-click `install.command`).

### Mac: "command not found: brew"

Homebrew installed but isn't on PATH yet. Close ALL Terminal windows, open a fresh one, try `brew --version` again. If still missing, re-run the Homebrew install line from Step 2 of the manual section.

### Windows: SmartScreen blocked the script

When the "Windows protected your PC" popup appears, click **"More info"** → **"Run anyway"**.

### Windows: "winget is not recognized"

Open the **Microsoft Store**, search for **"App Installer"**, click **Install**. Once it's installed, restart your PC, then run `install.bat` again.

### Windows: `install.bat` says "Node.js isn't visible in this window yet"

Normal after winget installs Node. **Close the window and double-click `install.bat` one more time.** It will continue where it left off.

### Windows: Notepad saved the file as `.env.txt` instead of `.env`

By default Windows hides file extensions and adds `.txt`. To fix:

1. Open File Explorer in your `reel-maker` folder.
2. Click the **View** menu at the top → check **File name extensions**.
3. Find `.env.txt`, right-click → **Rename** → change to `.env` exactly (with the leading dot). Click **Yes** when warned.

Or, in Notepad's Save dialog, change "Save as type" to **"All Files (\*.\*)"** and put quotes around the filename: `".env"`.

### "Port 4321 is already in use" / "EADDRINUSE"

Another copy of the app is still running.

**Mac:**
```bash
lsof -ti :4321 | xargs kill
```

**Windows:**
```cmd
for /f "tokens=5" %a in ('netstat -ano ^| findstr :4321 ^| findstr LISTENING') do taskkill /F /PID %a
```

Then try starting again.

### App opens, but says "Caption AI needs OPENAI_API_KEY"

Your `.env` file is missing or the OPENAI key is wrong. Open `.env`, double-check the line starts with `OPENAI_API_KEY=sk-proj-...` (no quotes, no spaces), save, restart the app.

### App says "Blotato 401 Unauthorized" on the post page

Your Blotato key has expired or been revoked. Log into [blotato.com](https://blotato.com), regenerate the key, paste the new one into `.env`, save, restart the app. The rest of the app still works — only posting is blocked.

### Black screen on the live preview after restart

Normal. The video file is still on disk. **Reload the browser tab** — the app picks it up automatically.

### Anything else

Take a screenshot of the Terminal / Command Prompt showing the error AND the browser showing the symptom. Send both to whoever set this up for you.

---

# Files to know about

| File / folder | What it is | OK to delete? |
| --- | --- | --- |
| `reel-maker/.env` | Your secret keys. **NEVER share this file.** | No — you'd lose your keys |
| `reel-maker/brand.config.json` | The brand voice / colours / defaults | No — but you can edit it |
| `reel-maker/public/brand/wsti-logo.png` | The WSTI logo shown on every reel | No (unless replacing the logo) |
| `reel-maker/public/music/*.mp3` | Background music tracks | Yes — drop new mp3s here any time |
| `reel-maker/public/uploads/` | Photos you've uploaded for past renders | Yes — frees disk space |
| `reel-maker/out/*.mp4` | Rendered video files | Yes — but you'll lose the videos |
| `reel-maker/node_modules/` | Installed libraries | Yes if running out of space — but then re-run install |
| `install.command` / `install.bat` | The one-time installer | Yes after first successful install (keep it though, for fresh setups) |
| `start.command` / `start.bat` | The daily launcher | No — you double-click this to use the app |

---

That's it. Welcome to the project. 🎬
