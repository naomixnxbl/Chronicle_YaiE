#!/usr/bin/env python3
"""Generate a 30-second WSTI video from a folder of photos.

Example:
  python3 generate_wsti_video.py \
    --input-folder photos \
    --output wsti_video.mp4 \
    --title "Western Sydney Tech Innovators" \
    --subtitle "Connect. Learn. Build." \
    --action "westernsydneytechinnovators.org"
"""

from __future__ import annotations

import argparse
import math
import os
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
from moviepy import ImageClip, concatenate_videoclips
from PIL import Image, ImageDraw, ImageFont

DEFAULT_SIZE = (1080, 1920)
DEFAULT_BG_COLOR = (12, 19, 31)
TEXT_COLOR = (255, 255, 255)
ACCENT_COLOR = (80, 199, 231)

FONT_NAMES = [
    "Arial-Bold.ttf",
    "Arial.ttf",
    "Helvetica Bold.ttf",
    "Helvetica.ttf",
    "DejaVuSans-Bold.ttf",
    "DejaVuSans.ttf",
]


def find_font() -> Optional[str]:
    for font_name in FONT_NAMES:
        for folder in ["/Library/Fonts", "/usr/share/fonts", "/usr/local/share/fonts"]:
            candidate = Path(folder) / font_name
            if candidate.exists():
                return str(candidate)
    return None


FONT_PATH = find_font()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a short WSTI promo video from photos.")
    parser.add_argument("--input-folder", required=True, help="Folder containing your photos.")
    parser.add_argument("--output", default="wsti_video.mp4", help="Output MP4 file path.")
    parser.add_argument("--title", default="Western Sydney Tech Innovators", help="Main title text.")
    parser.add_argument("--subtitle", default="Connect. Learn. Build.", help="Subtitle text.")
    parser.add_argument("--action", default="westernsydneytechinnovators.org", help="Call-to-action text.")
    parser.add_argument("--width", type=int, default=1080, help="Video width in pixels.")
    parser.add_argument("--height", type=int, default=1920, help="Video height in pixels.")
    parser.add_argument("--duration", type=float, default=30.0, help="Total video duration in seconds.")
    parser.add_argument("--fps", type=int, default=24, help="Output video frame rate.")
    return parser.parse_args()


def load_image_paths(folder: Path) -> List[Path]:
    images = sorted(
        [p for p in folder.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}]
    )
    return images


def scale_and_pad_image(image: Image.Image, target_size: Tuple[int, int]) -> Image.Image:
    target_w, target_h = target_size
    image = image.convert("RGB")
    src_w, src_h = image.size
    ratio = min(target_w / src_w, target_h / src_h)
    resized = image.resize((int(src_w * ratio), int(src_h * ratio)), Image.LANCZOS)
    background = Image.new("RGB", target_size, DEFAULT_BG_COLOR)
    x = (target_w - resized.width) // 2
    y = (target_h - resized.height) // 2
    background.paste(resized, (x, y))
    return background


def draw_text(
    image: Image.Image,
    title: str,
    subtitle: str,
    action: str,
    is_last_slide: bool = False,
) -> Image.Image:
    draw = ImageDraw.Draw(image)
    width, height = image.size
    font_path = FONT_PATH
    if font_path:
        title_font = ImageFont.truetype(font_path, size=84)
        subtitle_font = ImageFont.truetype(font_path, size=56)
        action_font = ImageFont.truetype(font_path, size=52)
    else:
        title_font = ImageFont.load_default()
        subtitle_font = ImageFont.load_default()
        action_font = ImageFont.load_default()

    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    fade_height = int(height * 0.35)
    for i in range(fade_height):
        alpha = int(180 * (i / fade_height))
        overlay_draw.rectangle(
            [(0, height - fade_height + i), (width, height)], fill=(0, 0, 0, alpha)
        )
    image = Image.alpha_composite(image.convert("RGBA"), overlay)

    text_x = int(width * 0.08)
    current_y = int(height * 0.62)

    if is_last_slide:
        current_y = int(height * 0.22)
        overlay = Image.new("RGBA", image.size, (0, 0, 0, 128))
        image = Image.alpha_composite(image.convert("RGBA"), overlay)
        draw = ImageDraw.Draw(image)
        lines = [title, subtitle, action]
        for line in lines:
            font = title_font if line == title else subtitle_font if line == subtitle else action_font
            bbox = draw.textbbox((0, 0), line, font=font)
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]
            draw.text(((width - w) / 2, current_y), line, font=font, fill=TEXT_COLOR)
            current_y += h + 24
        return image.convert("RGB")

    if title:
        draw.text((text_x, current_y), title, font=title_font, fill=TEXT_COLOR)
        bbox = draw.textbbox((0, 0), title, font=title_font)
        current_y += (bbox[3] - bbox[1]) + 24
    if subtitle:
        draw.text((text_x, current_y), subtitle, font=subtitle_font, fill=TEXT_COLOR)
        bbox = draw.textbbox((0, 0), subtitle, font=subtitle_font)
        current_y += (bbox[3] - bbox[1]) + 18
    if action:
        action_y = height - int(height * 0.12)
        draw.text((text_x, action_y), action, font=action_font, fill=ACCENT_COLOR)

    return image.convert("RGB")


def make_image_clip(
    path: Path,
    duration: float,
    size: Tuple[int, int],
    title: str,
    subtitle: str,
    action: str,
    is_last_slide: bool = False,
) -> ImageClip:
    image = Image.open(path) if path else Image.new("RGB", size, DEFAULT_BG_COLOR)
    image = scale_and_pad_image(image, size)
    image = draw_text(image, title, subtitle, action, is_last_slide=is_last_slide)
    clip = ImageClip(np.array(image)).with_duration(duration)
    return clip


def make_end_slide(duration: float, size: Tuple[int, int], title: str, subtitle: str, action: str) -> ImageClip:
    image = Image.new("RGB", size, DEFAULT_BG_COLOR)
    image = draw_text(image, title, subtitle, action, is_last_slide=True)
    return ImageClip(np.array(image)).with_duration(duration)


def build_video(
    image_paths: List[Path],
    output_path: Path,
    duration: float,
    size: Tuple[int, int],
    title: str,
    subtitle: str,
    action: str,
    fps: int,
) -> None:
    if not image_paths:
        raise ValueError("No images found in the input folder.")

    slot_count = len(image_paths) + 1
    base_duration = duration / slot_count
    base_duration = max(2.0, min(5.0, base_duration))
    durations = [base_duration] * (slot_count - 1) + [base_duration]
    extra = duration - sum(durations)
    durations[-1] += extra

    clips = []
    for image_path, image_duration in zip(image_paths, durations[:-1]):
        clip = make_image_clip(image_path, image_duration, size, title, subtitle, action)
        clips.append(clip)

    end_slide = make_end_slide(durations[-1], size, title, subtitle, action)
    clips.append(end_slide)

    final = concatenate_videoclips(clips, method="compose")
    final = final.with_fps(fps)
    final.write_videofile(
        str(output_path),
        fps=fps,
        codec="libx264",
        audio=False,
        preset="medium",
        threads=4,
        ffmpeg_params=["-pix_fmt", "yuv420p"],
    )


def main() -> None:
    args = parse_args()
    folder = Path(args.input_folder)
    if not folder.exists() or not folder.is_dir():
        raise FileNotFoundError(f"Input folder not found: {folder}")

    image_paths = load_image_paths(folder)
    if not image_paths:
        raise FileNotFoundError(f"No supported image files found in: {folder}")

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    build_video(
        image_paths=image_paths,
        output_path=output_path,
        duration=args.duration,
        size=(args.width, args.height),
        title=args.title,
        subtitle=args.subtitle,
        action=args.action,
        fps=args.fps,
    )
    print(f"Video created: {output_path}")


if __name__ == "__main__":
    main()
