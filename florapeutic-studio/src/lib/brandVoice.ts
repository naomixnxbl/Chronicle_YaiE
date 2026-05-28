// Florapeutic brand voice — distilled from the plugin's brand-voice.md so the
// tool can guide writing offline AND prime the AI enhancer with the same rules.

import type { Audience, ContentTheme, Platform } from "./types";

export const THEMES: { id: ContentTheme; label: string; ico: string; blurb: string }[] = [
  { id: "preservation", label: "Preservation craft", ico: "🌸", blurb: "Freeze-drying, resin, pressing, shadow boxes — the skilled work." },
  { id: "meanings", label: "Flower meanings", ico: "🌷", blurb: "Symbolism & the story behind specific blooms." },
  { id: "sustainability", label: "Sustainability & donation", ico: "🌿", blurb: "Second life for blooms, keeping flowers out of landfill." },
  { id: "behind-the-scenes", label: "Behind the scenes", ico: "🤍", blurb: "Studio moments & real client stories." },
];

export const AUDIENCES: { id: Audience; label: string; blurb: string }[] = [
  { id: "awareness", label: "Awareness", blurb: "Broad public, top-of-funnel. CTA: follow / save / share." },
  { id: "consideration", label: "Consideration", blurb: "Brides & event hosts evaluating Florapeutic. CTA: get a quote." },
  { id: "mixed", label: "Mixed", blurb: "Lead with an awareness CTA, follow with a soft quote line." },
];

export const PLATFORMS: { id: Platform; label: string; ico: string; spec: string }[] = [
  { id: "instagram", label: "Instagram & Reels", ico: "📱", spec: "Reels, Stories & feed" },
  { id: "youtube", label: "YouTube", ico: "▶️", spec: "Shorts & long-form" },
  { id: "advertisement", label: "Advertisement", ico: "📣", spec: "Paid social & promo" },
];
