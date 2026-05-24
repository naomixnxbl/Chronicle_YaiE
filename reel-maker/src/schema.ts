import { staticFile } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import brand from "../brand.config.json";

export { brand };

export const FPS = 30;

export const INTRO_SECONDS = 2.5;
export const OUTRO_SECONDS = 3.5;
export const TRANSITION_FRAMES = 14;
export const DEFAULT_PER_PHOTO_SECONDS = 2.5;

export type FormatKey = "reels" | "square" | "landscape";

export const FORMATS: Record<FormatKey, { width: number; height: number; label: string }> = {
  reels: { width: 1080, height: 1920, label: "Reels / Stories (9:16)" },
  square: { width: 1080, height: 1080, label: "LinkedIn / Meetup (1:1)" },
  landscape: { width: 1920, height: 1080, label: "YouTube / Web (16:9)" },
};

// A slide shows one image, or two related images split with the caption between.
export type Slide = { images: string[]; caption?: string };

export type ReelProps = {
  format: FormatKey;
  slides: Slide[];
  kicker: string;
  title: string;
  subtitle: string;
  ctaHeadline: string;
  ctaSub: string;
  website: string;
  handle: string;
  accent: string;
  bg: string;
  // brand identity used by the on-screen lockup
  wordmark: string;
  logoImage: string | null;
  useBuiltinMark: boolean;
  perPhotoSeconds: number;
  music: string | null;
  // adjustable look (tunable via the "refine" prompt)
  captionScale: number; // multiplies caption size (1 = default)
  grain: number; // 0..1 film-grain intensity
  particles: boolean; // floating bokeh on/off
  grade: number; // 0..1 cinematic colour grade
  lightLeak: number; // 0..1 drifting light leaks
};

export const defaultProps: ReelProps = {
  format: "reels",
  slides: [
    { images: [staticFile("photos/1.jpeg")], caption: "3,400 strong, and growing" },
    { images: [staticFile("photos/2.webp")], caption: "Where curiosity meets code" },
    { images: [staticFile("photos/3.webp"), staticFile("photos/6.webp")], caption: "Big ideas, out loud" },
    { images: [staticFile("photos/4.webp")], caption: "Built, not just imagined" },
    { images: [staticFile("photos/5.webp")], caption: "Beginners welcome, always" },
    { images: [staticFile("photos/7.webp")], caption: "Proudly Western Sydney" },
    { images: [staticFile("photos/8.jpg")], caption: "Your seat is waiting" },
  ],
  kicker: brand.defaultCopy.kicker,
  title: brand.defaultCopy.title,
  subtitle: brand.defaultCopy.subtitle,
  ctaHeadline: brand.defaultCopy.ctaHeadline,
  ctaSub: brand.defaultCopy.ctaSub,
  website: brand.defaultCopy.website,
  handle: brand.defaultCopy.handle,
  accent: brand.accent,
  bg: brand.bg,
  wordmark: brand.wordmark,
  logoImage: brand.logoImage,
  useBuiltinMark: brand.useBuiltinMark,
  perPhotoSeconds: DEFAULT_PER_PHOTO_SECONDS,
  music: null,
  captionScale: 1,
  grain: 1,
  particles: true,
  grade: 1,
  lightLeak: 1,
};

// Frame timeline shared by the renderer (calculateMetadata) and the component
// so the computed total duration always matches what TransitionSeries produces.
export function getTimeline(props: ReelProps) {
  const introF = Math.round(INTRO_SECONDS * FPS);
  const outroF = Math.round(OUTRO_SECONDS * FPS);
  const perSlideF = Math.round(props.perPhotoSeconds * FPS);
  const slideFs = props.slides.map(() => perSlideF);
  const segments = 1 + props.slides.length + 1; // intro + slides + outro
  const transitions = Math.max(0, segments - 1);
  const totalF = introF + slideFs.reduce((a: number, b: number) => a + b, 0) + outroF - transitions * TRANSITION_FRAMES;
  return { introF, outroF, slideFs, totalF };
}

export const calculateMetadata: CalculateMetadataFunction<ReelProps> = ({ props }) => {
  const dims = FORMATS[props.format] ?? FORMATS.reels;
  const { totalF } = getTimeline(props);
  return {
    fps: FPS,
    width: dims.width,
    height: dims.height,
    durationInFrames: Math.max(FPS, totalF),
  };
};
