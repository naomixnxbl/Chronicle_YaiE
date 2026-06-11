import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { TransitionPresentation } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type { ReelProps } from "../schema";
import type { TemplateSpec, SlideProps } from "./_types";
import { SANS, SERIF, useAspect, Lockup, PhotoOnBlurredBackdrop, SoundStamp } from "./_shared";

// Documentary — letterboxed cinematic, heavy grain (default via overlays),
// gentle scale drift on a contained photo (NEVER cropped) with the blurred
// backdrop doing the work the old "cover + pan" hack used to do.
// Subtitle bar at the bottom for every caption.

// Cinematic display — whole photo visible, contained on a blurred backdrop
// fill so the letterbox bars don't look like dead space. The drift stays <=1
// so the contained photo is never clipped.
const DocPhoto: React.FC<{ src: string; index: number; durationInFrames: number }> = ({ src, index, durationInFrames }) => (
  <PhotoOnBlurredBackdrop
    src={src}
    index={index}
    durationInFrames={durationInFrames}
    bgFilter="blur(32px) brightness(0.35) saturate(0.7)"
    bgTint="rgba(6,7,10,0.55)"
    fgFilter="saturate(0.82) contrast(1.08) brightness(0.96) drop-shadow(0 24px 50px rgba(0,0,0,0.55))"
    fgScaleRange={index % 2 === 0 ? [0.96, 1.0] : [1.0, 0.96]}
  />
);

const Subtitle: React.FC<{ text: string; accent: string; sizeMul: number; sub?: string }> = ({ text, accent, sizeMul, sub }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const reveal = spring({ frame: frame - 6, fps, config: { damping: 200, mass: 0.5 } });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: reveal, transform: `translateY(${(1 - reveal) * 8}px)` }}>
      <div style={{ width: base * 0.045, height: 3, background: accent, marginBottom: base * 0.014 }} />
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 700,
          color: "#fff",
          background: "rgba(8,10,14,0.55)",
          padding: `${base * 0.014}px ${base * 0.026}px`,
          fontSize: base * 0.036 * sizeMul,
          letterSpacing: "0.6px",
          maxWidth: "84%",
          textAlign: "center",
          textShadow: "0 2px 8px rgba(0,0,0,0.6)",
          borderRadius: 4,
        }}
      >
        {text}
      </div>
      {sub ? (
        <div style={{ fontFamily: SANS, fontWeight: 600, color: "rgba(255,255,255,0.65)", fontSize: base * 0.02, marginTop: base * 0.014, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
};

const Intro: React.FC<{ props: ReelProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const aspect = useAspect();
  const title = spring({ frame, fps, config: { damping: 200, mass: 0.5 } });
  const sub = spring({ frame: frame - 18, fps, config: { damping: 200, mass: 0.5 } });
  return (
    <AbsoluteFill style={{ background: "#06070a" }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: base * 0.08, textAlign: "center" }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, letterSpacing: "0.42em", textTransform: "uppercase", color: props.accent, fontSize: Math.round(base * 0.022), opacity: title }}>
          A {props.wordmark} story
        </div>
        <div style={{ marginTop: base * 0.05, fontFamily: SERIF, fontWeight: 800, color: "#fbfbf7", fontSize: Math.round(base * (aspect === "landscape" ? 0.085 : 0.1)), lineHeight: 1.0, letterSpacing: "-1px", opacity: title, transform: `translateY(${(1 - title) * 18}px)`, maxWidth: "86%" }}>
          {props.title}
        </div>
        <div style={{ marginTop: base * 0.035, fontFamily: SANS, color: "rgba(251,251,247,0.7)", fontSize: Math.round(base * 0.028), maxWidth: "70%", lineHeight: 1.5, opacity: sub }}>
          {props.subtitle}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Slide: React.FC<SlideProps> = ({ slide, index, durationInFrames, props }) => {
  const { width, height } = useVideoConfig();
  const base = Math.min(width, height);
  return (
    <AbsoluteFill style={{ background: "#06070a" }}>
      {slide.images.length >= 2 ? (
        <AbsoluteFill style={{ flexDirection: width > height ? "row" : "column" }}>
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            <DocPhoto src={slide.images[0]} index={index} durationInFrames={durationInFrames} />
          </div>
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            <DocPhoto src={slide.images[1]} index={index + 1} durationInFrames={durationInFrames} />
          </div>
        </AbsoluteFill>
      ) : (
        <DocPhoto src={slide.images[0]} index={index} durationInFrames={durationInFrames} />
      )}
      {/* darken bottom for subtitle legibility */}
      <AbsoluteFill style={{ boxShadow: "inset 0 -120px 180px rgba(6,7,10,0.7)" }} />
      {slide.caption ? (
        <>
          <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", padding: `0 0 ${base * 0.14}px` }}>
            <Subtitle text={slide.caption} accent={props.accent} sizeMul={props.captionScale} />
          </AbsoluteFill>
          {/* soft tap as the subtitle bar slides up */}
          <SoundStamp at={6} volume={0.3} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

const Outro: React.FC<{ props: ReelProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  return (
    <AbsoluteFill style={{ background: "#06070a" }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: base * 0.08, textAlign: "center" }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, letterSpacing: "0.42em", textTransform: "uppercase", color: props.accent, fontSize: Math.round(base * 0.022), opacity: spring({ frame, fps, config: { damping: 200, mass: 0.5 } }) }}>
          End scene
        </div>
        <div style={{ fontFamily: SERIF, fontWeight: 800, color: "#fbfbf7", fontSize: Math.round(base * 0.082), lineHeight: 1.04, marginTop: base * 0.04, maxWidth: "82%", opacity: spring({ frame: frame - 12, fps, config: { damping: 200, mass: 0.5 } }) }}>
          {props.ctaHeadline}
        </div>
        <div style={{ marginTop: base * 0.035, fontFamily: SANS, color: "rgba(251,251,247,0.66)", fontSize: Math.round(base * 0.028), maxWidth: "70%", lineHeight: 1.45, opacity: spring({ frame: frame - 22, fps, config: { damping: 200, mass: 0.5 } }) }}>
          {props.ctaSub}
        </div>
        <div style={{ marginTop: base * 0.05, opacity: spring({ frame: frame - 32, fps }) }}>
          <Lockup fontSize={Math.round(base * 0.06)} color={props.accent} wordmark={props.wordmark} logoImage={props.logoImage} useBuiltinMark={props.useBuiltinMark} />
        </div>
        <div style={{ marginTop: base * 0.03, fontFamily: SANS, fontWeight: 700, color: props.accent, fontSize: Math.round(base * 0.032), letterSpacing: "0.18em", textTransform: "uppercase", opacity: spring({ frame: frame - 40, fps }) }}>
          {props.website}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const transition = (_i: number): TransitionPresentation<Record<string, unknown>> => fade();

export const documentarySpec: TemplateSpec = {
  Intro,
  Slide,
  Outro,
  transition,
  perPhotoSeconds: 3.4,
  overlays: {
    grain: true,      // heavy grain is the look
    grade: false,
    lightLeak: false,
    particles: false,
    vignette: true,
    letterbox: true,  // cinematic 2.39:1 bars
    topBar: false,
  },
};
