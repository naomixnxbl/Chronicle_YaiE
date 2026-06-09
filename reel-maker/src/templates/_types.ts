import type React from "react";
import type { TransitionPresentation } from "@remotion/transitions";
import type { ReelProps, Slide } from "../schema";

// Each visual style is described by a TemplateSpec. The engine handles the
// shared shell (TransitionSeries, audio, the brand HUD) and delegates the
// actual look — intro frame, per-slide layout, outro frame, transition choice,
// and which overlays to enable — to the spec.
export type SlideProps = {
  slide: Slide;
  index: number;
  slideCount: number;
  durationInFrames: number;
  props: ReelProps;
};

export type TemplateSpec = {
  Intro: React.FC<{ props: ReelProps }>;
  Slide: React.FC<SlideProps>;
  Outro: React.FC<{ props: ReelProps }>;
  // SLIDE-to-SLIDE transition. Receives the slide index so templates can cycle.
  transition: (i: number) => TransitionPresentation<Record<string, unknown>>;
  // Intro-to-first-slide transition. If omitted the engine uses a slide-from-bottom.
  introTransition?: () => TransitionPresentation<Record<string, unknown>>;
  // Cadence override. If unset the engine uses props.perPhotoSeconds.
  perPhotoSeconds?: number;
  // Which shared overlays to draw on top. Defaults are tuned for the Signature look.
  overlays?: {
    grain?: boolean;
    grade?: boolean;
    lightLeak?: boolean;
    particles?: boolean;
    letterbox?: boolean;
    vignette?: boolean;
    topBar?: boolean;
  };
  // Escape hatch: bypass the slot model entirely. None of the bundled templates
  // use this today, but it's here for templates that need bespoke timeline math.
  renderWhole?: React.FC<{ props: ReelProps }>;
};
