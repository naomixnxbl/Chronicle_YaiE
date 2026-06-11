import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { TransitionPresentation } from "@remotion/transitions";
import { slide as slideTrans } from "@remotion/transitions/slide";
import type { ReelProps } from "../schema";
import type { TemplateSpec, SlideProps } from "./_types";
import { DISPLAY, SANS, useAspect, Lockup, PhotoOnBlurredBackdrop, SoundStamp } from "./_shared";

// Bold Typography — words are the hero, but the WHOLE photo is always visible.
// The photo sits in its own panel (no cropping) next to the typography column.
// On portrait, the photo is the top half. On landscape, the right side.

const StackedWords: React.FC<{ text: string; accent: string; sizeMul?: number }> = ({ text, accent, sizeMul = 1 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const words = text.split(/\s+/).filter(Boolean);
  const fontSize = base * (words.length <= 2 ? 0.18 : words.length <= 4 ? 0.14 : 0.105) * sizeMul;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: fontSize * 0.04 }}>
      {words.map((w, i) => {
        const e = spring({ frame: frame - (4 + i * 3), fps, config: { damping: 200, mass: 0.5 } });
        const wy = interpolate(e, [0, 1], [80, 0]);
        const blur = interpolate(e, [0, 1], [12, 0]);
        const highlightOne = i === Math.min(words.length - 1, Math.floor(words.length / 2));
        return (
          <div
            key={i}
            style={{
              fontFamily: DISPLAY,
              fontSize,
              fontWeight: 400,
              lineHeight: 0.9,
              letterSpacing: "-2px",
              textTransform: "uppercase",
              color: highlightOne ? accent : "#fff",
              opacity: e,
              transform: `translateY(${wy}px)`,
              filter: `blur(${blur}px)`,
              textShadow: "0 4px 26px rgba(0,0,0,0.65)",
              whiteSpace: "nowrap",
            }}
          >
            {w}
          </div>
        );
      })}
    </div>
  );
};

const Intro: React.FC<{ props: ReelProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  // Solid bg with a moving accent block at edge — pure typography intro.
  const blockX = interpolate(frame, [0, 22], [-100, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#0a0e16" }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "18%", background: props.accent, transform: `translateX(${blockX}%)` }} />
      <AbsoluteFill style={{ alignItems: "flex-start", justifyContent: "center", padding: `0 ${base * 0.09}px 0 ${base * 0.27}px` }}>
        <StackedWords text={props.title} accent={props.accent} />
        <div style={{ marginTop: base * 0.05, fontFamily: SANS, fontWeight: 600, color: "rgba(255,255,255,0.78)", fontSize: Math.round(base * 0.032), maxWidth: "80%", opacity: spring({ frame: frame - 22, fps, config: { damping: 200, mass: 0.5 } }) }}>
          {props.subtitle}
        </div>
        <div style={{ marginTop: base * 0.06, opacity: spring({ frame: frame - 30, fps }) }}>
          <Lockup fontSize={Math.round(base * 0.06)} color={props.accent} wordmark={props.wordmark} logoImage={props.logoImage} useBuiltinMark={props.useBuiltinMark} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Slide: React.FC<SlideProps> = ({ slide, index, durationInFrames, props }) => {
  const { width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const aspect = useAspect();
  // Layout: portrait — photo panel on top 52%, type column below.
  //         landscape — photo right ~46%, type left.
  //         square — photo right 50%, type left.
  const sideBySide = aspect !== "portrait";
  return (
    <AbsoluteFill style={{ background: "#0a0e16" }}>
      <AbsoluteFill style={{ flexDirection: sideBySide ? "row" : "column" }}>
        {/* Type column. Sits before the photo in portrait so the photo is at the bottom (eye-catch); after in landscape so reading flows right.
            No per-slide counter or wordmark — the brand HUD up top covers that. */}
        <div style={{ flex: sideBySide ? 1 : "0 0 48%", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", padding: `${base * 0.05}px ${base * 0.06}px`, order: sideBySide ? 0 : 1 }}>
          {slide.caption ? <StackedWords text={slide.caption} accent={props.accent} sizeMul={props.captionScale} /> : null}
        </div>
        {/* Photo panel — full-bleed cover. Photo is pre-cropped server-side to the format aspect. */}
        <div style={{ flex: sideBySide ? "0 0 46%" : "0 0 52%", position: "relative", overflow: "hidden", borderLeft: sideBySide ? `3px solid ${props.accent}` : "none", borderTop: sideBySide ? "none" : `3px solid ${props.accent}` }}>
          {/* sharp slam on entry — matches the directional cut transition */}
          <SoundStamp at={2} volume={0.55} />
          <Img
            src={slide.images[0]}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${1.0 + ((index % 2) * 0.04)})`,
              filter: "saturate(1.05) contrast(1.06)",
            }}
          />
          {slide.images[1] ? (
            <div style={{ position: "absolute", bottom: base * 0.025, left: base * 0.025, width: "32%", height: "32%", overflow: "hidden", border: `3px solid ${props.accent}`, boxShadow: "0 14px 30px rgba(0,0,0,0.65)" }}>
              <Img src={slide.images[1]} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(1.1)" }} />
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Outro: React.FC<{ props: ReelProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  return (
    <AbsoluteFill style={{ background: props.accent }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: base * 0.08, textAlign: "center" }}>
        <div style={{ fontFamily: DISPLAY, fontSize: Math.round(base * 0.16), lineHeight: 0.92, letterSpacing: "-3px", textTransform: "uppercase", color: "#0a0e16", opacity: spring({ frame, fps, config: { damping: 200, mass: 0.5 } }), maxWidth: "92%" }}>
          {props.ctaHeadline}
        </div>
        <div style={{ marginTop: base * 0.03, fontFamily: SANS, fontWeight: 800, color: "#0a0e16", fontSize: Math.round(base * 0.032), letterSpacing: "0.2em", textTransform: "uppercase", opacity: spring({ frame: frame - 16, fps }) }}>
          {props.ctaSub}
        </div>
        <div style={{ marginTop: base * 0.05, padding: `${base * 0.022}px ${base * 0.055}px`, background: "#0a0e16", color: props.accent, fontFamily: SANS, fontWeight: 800, fontSize: Math.round(base * 0.034), borderRadius: 99, opacity: spring({ frame: frame - 26, fps }) }}>
          {props.website}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const transition = (i: number): TransitionPresentation<Record<string, unknown>> => {
  // Hard cuts alternating direction — feels like a billboard slamming the next frame in.
  const dirs = ["from-right", "from-bottom", "from-left", "from-top"] as const;
  return slideTrans({ direction: dirs[i % dirs.length] });
};

export const boldSpec: TemplateSpec = {
  Intro,
  Slide,
  Outro,
  transition,
  perPhotoSeconds: 2.6,
  overlays: {
    grain: false,
    grade: false,
    lightLeak: false,
    particles: false,
    vignette: false,
    topBar: false,
  },
};
