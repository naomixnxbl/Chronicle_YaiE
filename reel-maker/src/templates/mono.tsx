import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { TransitionPresentation } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type { ReelProps } from "../schema";
import type { TemplateSpec, SlideProps } from "./_types";
import { SANS, useAspect, Lockup } from "./_shared";

// Minimal Mono — black & white photos on white paper with a single accent
// splash (the rule line + the accent-coloured first letter of each caption).
// Ultra-restrained motion, nothing decorative.

const PAPER = "#fbfbf7";
const INK = "#0c1117";

// Mono photo: contained B&W (never cropped) on a soft B&W blurred backdrop so
// horizontal pics in 9:16 don't lose their edges.
const MonoImg: React.FC<{ src: string; index: number; durationInFrames: number; rounded?: boolean }> = ({ src, index, durationInFrames, rounded }) => {
  const frame = useCurrentFrame();
  const zoomIn = index % 2 === 0;
  const fgScale = interpolate(frame, [0, durationInFrames], zoomIn ? [0.97, 1.0] : [1.0, 0.97], { extrapolateRight: "clamp" });
  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: rounded ? 8 : 0, background: "#e8e6df", position: "relative" }}>
      <Img src={src} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1) blur(28px) brightness(1.1) contrast(0.9)", opacity: 0.8 }} />
      <Img src={src} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", transform: `scale(${fgScale})`, filter: "grayscale(1) contrast(1.08) brightness(1.02) drop-shadow(0 18px 38px rgba(0,0,0,0.18))" }} />
    </div>
  );
};

const Intro: React.FC<{ props: ReelProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const aspect = useAspect();
  const title = spring({ frame, fps, config: { damping: 200, mass: 0.5 } });
  const sub = spring({ frame: frame - 14, fps, config: { damping: 200, mass: 0.5 } });
  const rule = spring({ frame: frame - 24, fps, config: { damping: 200, mass: 0.5 } });
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <AbsoluteFill style={{ alignItems: "flex-start", justifyContent: "center", padding: `0 ${base * 0.1}px` }}>
        <div style={{ fontFamily: SANS, fontWeight: 800, letterSpacing: "0.42em", textTransform: "uppercase", color: INK, fontSize: Math.round(base * 0.02), opacity: title }}>
          {props.wordmark}
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 800, color: INK, fontSize: Math.round(base * (aspect === "landscape" ? 0.082 : 0.094)), lineHeight: 1.0, marginTop: base * 0.03, letterSpacing: "-1.5px", opacity: title, transform: `translateY(${(1 - title) * 14}px)`, maxWidth: "90%" }}>
          {props.title}
        </div>
        <div style={{ marginTop: base * 0.04, width: base * 0.18 * rule, height: 4, background: props.accent }} />
        <div style={{ marginTop: base * 0.03, fontFamily: SANS, color: "#5a5d63", fontSize: Math.round(base * 0.028), maxWidth: "70%", lineHeight: 1.45, opacity: sub }}>
          {props.subtitle}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const AccentCaption: React.FC<{ text: string; accent: string; sizeMul: number }> = ({ text, accent, sizeMul }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const reveal = spring({ frame: frame - 6, fps, config: { damping: 200, mass: 0.5 } });
  const first = (text || "").charAt(0).toUpperCase();
  const rest = (text || "").slice(1);
  return (
    <div style={{ opacity: reveal, transform: `translateY(${(1 - reveal) * 10}px)` }}>
      <div style={{ width: base * 0.05, height: 3, background: accent, marginBottom: base * 0.018 }} />
      <div style={{ fontFamily: SANS, fontWeight: 800, color: INK, fontSize: base * 0.05 * sizeMul, letterSpacing: "-0.5px", lineHeight: 1.05 }}>
        <span style={{ color: accent }}>{first}</span>
        {rest}
      </div>
    </div>
  );
};

const Slide: React.FC<SlideProps> = ({ slide, index, durationInFrames, props }) => {
  const { width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const aspect = useAspect();
  const sideBySide = aspect === "landscape";
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <AbsoluteFill style={{ flexDirection: sideBySide ? "row" : "column", padding: base * 0.06, gap: base * 0.03 }}>
        <div style={{ flex: sideBySide ? 1.4 : 2, overflow: "hidden" }}>
          {slide.images.length >= 2 ? (
            <div style={{ display: "flex", width: "100%", height: "100%", gap: base * 0.015 }}>
              <div style={{ flex: 1, overflow: "hidden" }}><MonoImg src={slide.images[0]} index={index} durationInFrames={durationInFrames} rounded /></div>
              <div style={{ flex: 1, overflow: "hidden" }}><MonoImg src={slide.images[1]} index={index + 1} durationInFrames={durationInFrames} rounded /></div>
            </div>
          ) : (
            <MonoImg src={slide.images[0]} index={index} durationInFrames={durationInFrames} rounded />
          )}
        </div>
        <div style={{ flex: sideBySide ? 1 : 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: `0 ${base * 0.01}px` }}>
          <div style={{ fontFamily: SANS, fontWeight: 800, letterSpacing: "0.42em", textTransform: "uppercase", color: "#9a9da3", fontSize: Math.round(base * 0.018) }}>
            {String(index + 1).padStart(2, "0")} / {String(props.slides.length).padStart(2, "0")}
          </div>
          {slide.caption ? (
            <div style={{ marginTop: base * 0.02 }}>
              <AccentCaption text={slide.caption} accent={props.accent} sizeMul={props.captionScale} />
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
    <AbsoluteFill style={{ background: PAPER }}>
      <AbsoluteFill style={{ alignItems: "flex-start", justifyContent: "center", padding: `0 ${base * 0.1}px` }}>
        <div style={{ width: base * 0.08, height: 4, background: props.accent, opacity: spring({ frame, fps, config: { damping: 200, mass: 0.5 } }) }} />
        <div style={{ marginTop: base * 0.04, fontFamily: SANS, fontWeight: 800, color: INK, fontSize: Math.round(base * 0.08), lineHeight: 1.02, letterSpacing: "-1.2px", maxWidth: "85%", opacity: spring({ frame: frame - 10, fps, config: { damping: 200, mass: 0.5 } }) }}>
          {props.ctaHeadline}
        </div>
        <div style={{ marginTop: base * 0.03, fontFamily: SANS, color: "#5a5d63", fontSize: Math.round(base * 0.028), maxWidth: "70%", lineHeight: 1.45, opacity: spring({ frame: frame - 20, fps, config: { damping: 200, mass: 0.5 } }) }}>
          {props.ctaSub}
        </div>
        <div style={{ marginTop: base * 0.06, opacity: spring({ frame: frame - 30, fps }) }}>
          <Lockup fontSize={Math.round(base * 0.055)} color={props.accent} wordmark={props.wordmark} logoImage={props.logoImage} useBuiltinMark={props.useBuiltinMark} />
        </div>
        <div style={{ marginTop: base * 0.025, fontFamily: SANS, fontWeight: 800, color: INK, fontSize: Math.round(base * 0.028), letterSpacing: "0.16em", textTransform: "uppercase", opacity: spring({ frame: frame - 38, fps }) }}>
          {props.website}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const transition = (_i: number): TransitionPresentation<Record<string, unknown>> => fade();

export const monoSpec: TemplateSpec = {
  Intro,
  Slide,
  Outro,
  transition,
  perPhotoSeconds: 3.0,
  overlays: {
    grain: false,
    grade: false,
    lightLeak: false,
    particles: false,
    vignette: false,
    topBar: false,
  },
};
