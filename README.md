# WSTI Video Generator

A small reusable tool to make a 30-second WSTI promo video from photos.

## Setup

1. Install Python dependencies:

```bash
python3 -m pip install -r requirements.txt
```

2. Install `ffmpeg` if you do not already have it:

```bash
brew install ffmpeg
```

3. Place your images in a folder, for example `photos/`.

## Usage

```bash
python3 generate_wsti_video.py \
  --input-folder photos \
  --output wsti_video.mp4 \
  --title "Western Sydney Tech Innovators" \
  --subtitle "Connect. Learn. Build." \
  --action "westernsydneytechinnovators.org"
```

## Notes

- The default output is vertical `1080x1920`, ideal for reels.
- The script automatically fills a 30-second video using all images in the folder.
- You can change the size with `--width` and `--height`.
- Update `--title`, `--subtitle`, and `--action` for each new video.
