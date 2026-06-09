import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { TransitionPresentation } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type { ReelProps } from "../schema";
import type { TemplateSpec, SlideProps } from "./_types";
import { SANS, SERIF, useAspect, PhotoOnBlurredBackdrop } from "./_shared";

// Editorial: a quiet magazine layout — Playfair serif for headlines, Inter for
// captions, generous margins, thin accent rules. Photo uses the contained-on-
// blurred-backdrop pattern so the WHOLE image is always visible. Minimal motion
// (a soft drift); no stickers / particles / film grain. Feels right on LinkedIn.

// Whole photo always visible — contained on a quiet dark blurred backdrop so
// horizontal pics in 9:16 don't crop. Minimal motion (the editorial vibe).
const EditorialPhoto: React.FC<{ src: string; index: number; durationInFrames: number }> = ({ src, index, durationInFrames }) => (
  <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#06080c" }}>
    <PhotoOnBlurredBackdrop
      src={src}
      index={index}
      durationInFrames={durationInFrames}
      bgFilter="blur(34px) brightness(0.32) saturate(0.85)"
      bgTint="rgba(6,8,12,0.55)"
      fgFilter="saturate(0.95) contrast(1.04) drop-shadow(0 28px 60px rgba(0,0,0,0.5))"
    />
  </div>
);

const ColumnRule: React.FC<{ accent: string; vertical?: boolean; length: number; thickness?: number }> = ({ accent, vertical = false, length, thickness = 3 }) => (
  <div style={{ background: accent, width: vertical ? thickness : length, height: vertical ? length : thickness, borderRadius: 99 }} />
);

const Intro: React.FC<{ props: ReelProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const aspect = useAspect();
  const kicker = spring({ frame, fps, config: { damping: 200, mass: 0.5 } });
  const title = spring({ frame: frame - 10, fps, config: { damping: 200, mass: 0.5 } });
  const sub = spring({ frame: frame - 22, fps, config: { damping: 200, mass: 0.5 } });
  return (
    <AbsoluteFill style={{ background: "#0c1117" }}>
      <AbsoluteFill style={{ flexDirection: aspect === "landscape" ? "row" : "column", padding: base * 0.08 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: SANS, fontWeight: 800, letterSpacing: "0.32em", textTransform: "uppercase", color: props.accent, fontSize: Math.round(base * 0.022), opacity: kicker }}>
            {props.kicker || props.wordmark}
          </div>
          <div style={{ marginTop: base * 0.025 }}>
            <ColumnRule accent={props.accent} length={base * 0.08} />
          </div>
          <div
            style={{
              fontFamily: SERIF,
              fontWeight: 800,
              color: "#fbfbf7",
              fontSize: Math.round(base * (aspect === "landscape" ? 0.08 : 0.092)),
              lineHeight: 1.02,
              marginTop: base * 0.04,
              maxWidth: "94%",
              letterSpacing: "-0.5px",
              opacity: title,
              transform: `translateY(${(1 - title) * 18}px)`,
            }}
          >
            {props.title}
          </div>
          <div style={{ fontFamily: SANS, fontWeight: 400, color: "rgba(251,251,247,0.66)", fontSize: Math.round(base * 0.028), marginTop: base * 0.035, maxWidth: "82%", lineHeight: 1.45, opacity: sub, transform: `translateY(${(1 - sub) * 12}px)` }}>
            {props.subtitle}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Slide: React.FC<SlideProps> = ({ slide, index, durationInFrames, props }) => {
  const { width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const aspect = useAspect();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const capReveal = spring({ frame: frame - 8, fps, config: { damping: 200, mass: 0.5 } });
  const lockupReveal = spring({ frame: frame - 22, fps, config: { damping: 200, mass: 0.5 } });
  // Layout:
  // - Landscape: photo on left ~62%, copy column right ~38%.
  //   Two-photo slides STACK vertically on the left (each photo is wider, more
  //   impactful) — old side-by-side made each photo too narrow.
  // - Portrait + square: photo takes the top 78%, copy strip at the bottom.
  const sideBySide = aspect === "landscape";
  const photoColStyle: React.CSSProperties = sideBySide
    ? { width: "62%", height: "100%", position: "relative", overflow: "hidden" }
    : { width: "100%", height: aspect === "square" ? "76%" : "78%", position: "relative", overflow: "hidden" };
  // For two photos: stacked in landscape, side-by-side in portrait/square.
  const duoFlexDir: "row" | "column" = sideBySide ? "column" : "row";
  return (
    <AbsoluteFill style={{ background: "#0c1117" }}>
      <AbsoluteFill style={{ flexDirection: sideBySide ? "row" : "column" }}>
        <div style={photoColStyle}>
          {slide.images.length >= 2 ? (
            <div style={{ display: "flex", flexDirection: duoFlexDir, width: "100%", height: "100%", gap: 2 }}>
              <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                <EditorialPhoto src={slide.images[0]} index={index} durationInFrames={durationInFrames} />
              </div>
              <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                <EditorialPhoto src={slide.images[1]} index={index + 1} durationInFrames={durationInFrames} />
              </div>
            </div>
          ) : (
            <EditorialPhoto src={slide.images[0]} index={index} durationInFrames={durationInFrames} />
          )}
        </div>
        {/* Copy column. In landscape this gets a subtle radial wash so it
            doesn't look like dead-black space behind the typography. */}
        <div style={{
          flex: 1, padding: `${base * 0.06}px ${base * 0.07}px`,
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          background: sideBySide ? `radial-gradient(120% 80% at 100% 0%, ${props.accent}12 0%, transparent 60%)` : "transparent",
        }}>
          <div>
            <div style={{ fontFamily: SANS, fontWeight: 800, letterSpacing: "0.32em", textTransform: "uppercase", color: props.accent, fontSize: Math.round(base * 0.022), opacity: capReveal }}>
              {String(index + 1).padStart(2, "0")}  ·  Field Notes
            </div>
            <div style={{ marginTop: base * 0.022 }}>
              <ColumnRule accent={props.accent} length={base * 0.08} thickness={2} />
            </div>
            {slide.caption ? (
              <div
                style={{
                  fontFamily: SERIF,
                  fontWeight: 800,
                  color: "#fbfbf7",
                  // Bigger pull-quote in landscape — fills the column properly instead of looking lost.
                  fontSize: Math.round(base * (sideBySide ? 0.078 : 0.046) * props.captionScale),
                  lineHeight: 1.05,
                  marginTop: base * 0.03,
                  maxWidth: "100%",
                  letterSpacing: "-0.5px",
                  opacity: capReveal,
                  transform: `translateY(${(1 - capReveal) * 12}px)`,
                }}
            >
              &ldquo;{slide.caption}&rdquo;
            </div>
            ) : null}
          </div>
          {/* Bottom of the column: full wordmark + tagline + counter. Fills
              the vertical space so the column doesn't look empty in landscape. */}
          <div style={{ opacity: lockupReveal, transform: `translateY(${(1 - lockupReveal) * 10}px)` }}>
            <div style={{ width: "100%", height: 1, background: "rgba(251,251,247,0.14)", marginBottom: base * 0.022 }} />
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: base * 0.02 }}>
              <div>
                <div style={{ fontFamily: SERIF, fontWeight: 800, color: "#fbfbf7", fontSize: Math.round(base * (sideBySide ? 0.04 : 0.026)), lineHeight: 1, letterSpacing: "-0.3px" }}>
                  {props.wordmark}
                </div>
                <div style={{ marginTop: base * 0.01, fontFamily: SANS, fontWeight: 600, color: "rgba(251,251,247,0.55)", fontSize: Math.round(base * 0.018), letterSpacing: "0.04em" }}>
                  {props.handle || props.website}
                </div>
              </div>
              <div style={{ fontFamily: SANS, fontWeight: 800, color: props.accent, fontSize: Math.round(base * (sideBySide ? 0.05 : 0.028)), letterSpacing: "0.04em", lineHeight: 1 }}>
                {String(index + 1).padStart(2, "0")}<span style={{ color: "rgba(251,251,247,0.32)" }}>/{String(props.slides.length).padStart(2, "0")}</span>
              </div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Outro: React.FC<{ props: ReelProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const head = spring({ frame, fps, config: { damping: 200, mass: 0.5 } });
  const sub = spring({ frame: frame - 16, fps, config: { damping: 200, mass: 0.5 } });
  const cta = spring({ frame: frame - 28, fps, config: { damping: 200, mass: 0.5 } });
  return (
    <AbsoluteFill style={{ background: "#0c1117" }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", padding: base * 0.08 }}>
        <ColumnRule accent={props.accent} length={base * 0.08} />
        <div style={{ fontFamily: SERIF, fontWeight: 800, color: "#fbfbf7", fontSize: Math.round(base * 0.078), lineHeight: 1.04, marginTop: base * 0.035, maxWidth: "84%", opacity: head, transform: `translateY(${(1 - head) * 14}px)` }}>
          {props.ctaHeadline}
        </div>
        <div style={{ fontFamily: SANS, color: "rgba(251,251,247,0.62)", fontSize: Math.round(base * 0.026), marginTop: base * 0.022, maxWidth: "70%", lineHeight: 1.45, opacity: sub }}>
          {props.ctaSub}
        </div>
        <div style={{ marginTop: base * 0.05, padding: `${base * 0.02}px ${base * 0.052}px`, background: "transparent", color: props.accent, border: `1.5px solid ${props.accent}`, fontFamily: SANS, fontWeight: 700, fontSize: Math.round(base * 0.026), letterSpacing: "0.18em", textTransform: "uppercase", borderRadius: 99, opacity: cta }}>
          {props.website}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const transition = (_i: number): TransitionPresentation<Record<string, unknown>> => fade();

export const editorialSpec: TemplateSpec = {
  Intro,
  Slide,
  Outro,
  transition,
  perPhotoSeconds: 3.5, // slower magazine cadence
  overlays: {
    grain: false,
    grade: false,
    lightLeak: false,
    particles: false,
    vignette: false,
    topBar: false, // brand line is in the slide footer
  },
};
