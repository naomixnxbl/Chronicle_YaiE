import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { TransitionPresentation } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide as slideTrans } from "@remotion/transitions/slide";
import type { ReelProps } from "../schema";
import type { TemplateSpec, SlideProps } from "./_types";
import { HAND, SERIF, Lockup, SoundStamp, TypewriterCaption, useAspect } from "./_shared";

const CREAM = "#f3ead7";
const PAPER = "#fbfbf7";
const INK = "#23241f";

// Decorative tape on a polaroid corner.
const Tape: React.FC<{ rotate?: number; style?: React.CSSProperties }> = ({ rotate = 0, style }) => (
  <div
    style={{
      position: "absolute",
      width: 110,
      height: 26,
      background: "rgba(255, 245, 200, 0.62)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
      transform: `rotate(${rotate}deg)`,
      mixBlendMode: "multiply",
      ...style,
    }}
  />
);

// Soft warm cream paper backdrop with a subtle vignette so the cards pop.
const PaperBackdrop: React.FC = () => (
  <>
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 40%, #f9efd6 0%, ${CREAM} 60%, #d9cda5 100%)` }} />
    <AbsoluteFill style={{ boxShadow: "inset 0 0 300px rgba(70,50,20,0.35)", pointerEvents: "none" }} />
  </>
);

const Intro: React.FC<{ props: ReelProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const aspect = useAspect();
  const cardTilt = -3;
  const slam = spring({ frame, fps, config: { damping: 11, stiffness: 130, mass: 0.7 } });
  const rot = interpolate(slam, [0, 1], [cardTilt * 3.5, cardTilt]);
  const sc = interpolate(slam, [0, 1], [1.2, 1]);
  return (
    <AbsoluteFill>
      <PaperBackdrop />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: base * 0.05 }}>
        <div
          style={{
            background: PAPER,
            padding: `${base * 0.05}px ${base * 0.06}px`,
            paddingBottom: base * 0.13,
            transform: `rotate(${rot}deg) scale(${sc})`,
            boxShadow: "0 44px 80px -22px rgba(40,30,15,0.55), 0 10px 22px rgba(40,30,15,0.2)",
            maxWidth: aspect === "landscape" ? "62%" : "84%",
            position: "relative",
            borderRadius: 4,
          }}
        >
          <Tape rotate={-12} style={{ top: -10, left: "12%" }} />
          <Tape rotate={9} style={{ top: -10, right: "12%" }} />
          {/* Title prints in like a typewriter — sets the tone for the rest of the reel. */}
          <TypewriterCaption
            text={props.title}
            startFrame={10}
            charsPerFrame={0.55}
            style={{ fontFamily: SERIF, fontWeight: 700, color: INK, fontSize: Math.round(base * 0.075), lineHeight: 1.04, textAlign: "center", letterSpacing: "-0.5px" }}
            cursorColor={INK}
            soundVolume={0.16}
          />
          <div style={{ marginTop: base * 0.025, fontFamily: HAND, color: "#5a4a32", fontSize: Math.round(base * 0.05), textAlign: "center", opacity: spring({ frame: frame - 50, fps, config: { damping: 200, mass: 0.5 } }) }}>
            {props.subtitle}
          </div>
        </div>
        <div style={{ marginTop: base * 0.04, opacity: spring({ frame: frame - 60, fps }) }}>
          <Lockup fontSize={Math.round(base * 0.058)} color={props.accent} wordmark={props.wordmark} logoImage={props.logoImage} useBuiltinMark={props.useBuiltinMark} />
        </div>
      </AbsoluteFill>
      {/* card drop SFX */}
      <SoundStamp at={0} volume={0.55} />
    </AbsoluteFill>
  );
};

// A single polaroid card — contained photo so nothing crops, with an optional
// typewriter caption laid ON the photo on a translucent dark band. Drop SFX is
// triggered by the parent so two-photo slides can stagger drops.
const PolaroidCard: React.FC<{
  src: string;
  caption?: string;
  tilt: number;
  widthPct: number;
  heightPct: number;
  delay?: number;
  durationInFrames: number;
}> = ({ src, caption, tilt, widthPct, heightPct, delay = 0, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const slam = spring({ frame: frame - delay, fps, config: { damping: 11, stiffness: 130, mass: 0.7 } });
  const rot = interpolate(slam, [0, 1], [tilt * 3.5, tilt]);
  const sc = interpolate(slam, [0, 1], [1.18, 1]);
  // Almost-imperceptible breathing after landing so the static card feels alive.
  const breathe = 1 + 0.005 * Math.sin(((frame - delay) / fps) * 1.6);
  return (
    <div
      style={{
        background: PAPER,
        padding: base * 0.018,
        // Bottom margin only if the caption needs to sit on the white border;
        // otherwise the photo fills the card edge-to-edge for a cleaner look.
        paddingBottom: base * 0.022,
        boxShadow: "0 48px 90px -22px rgba(40,30,15,0.55), 0 12px 26px rgba(40,30,15,0.22)",
        transform: `rotate(${rot}deg) scale(${sc * breathe})`,
        width: `${widthPct}%`,
        height: `${heightPct}%`,
        position: "relative",
        borderRadius: 4,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Tape rotate={tilt > 0 ? -16 : 12} style={{ top: -10, left: "50%", marginLeft: -55 }} />
      {/* Photo area — fills the card, contains the FULL image (no crop). */}
      <div style={{ flex: 1, minHeight: 0, background: "#1a1815", overflow: "hidden", borderRadius: 2, position: "relative" }}>
        {/* Blurred fill so the letterbox bars around a contained photo look intentional, not dead. */}
        <Img src={src} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(28px) brightness(0.55) saturate(1.1)" }} />
        <Img src={src} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", filter: "saturate(0.94) contrast(0.97) sepia(0.05)" }} />
        {/* Caption-band gradient + typewriter caption ON the photo. */}
        {caption ? (
          <>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "32%", background: "linear-gradient(to top, rgba(10,8,4,0.78) 0%, rgba(10,8,4,0.4) 55%, rgba(10,8,4,0) 100%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", left: "6%", right: "6%", bottom: "6%", textAlign: "center" }}>
              <TypewriterCaption
                text={caption}
                startFrame={delay + 14}
                charsPerFrame={0.55}
                style={{ fontFamily: HAND, color: "#fff", fontSize: base * 0.052, lineHeight: 1.05, letterSpacing: "0.2px", textShadow: "0 2px 8px rgba(0,0,0,0.7)" }}
                cursorColor="#fff"
                soundVolume={0.14}
                durationInFrames={durationInFrames}
                outFadeFrames={14}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

const Slide: React.FC<SlideProps> = ({ slide, index, durationInFrames }) => {
  const aspect = useAspect();
  const tiltA = index % 2 === 0 ? -3 : 3;
  const tiltB = -tiltA;
  if (slide.images.length >= 2) {
    // Two-photo slides: side by side in landscape (big cards), layered in portrait/square so they really fill the frame.
    if (aspect === "landscape") {
      return (
        <AbsoluteFill>
          <PaperBackdrop />
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "row", gap: "3%", padding: "3%" }}>
            <PolaroidCard src={slide.images[0]} caption={slide.caption} tilt={tiltA} widthPct={46} heightPct={92} durationInFrames={durationInFrames} />
            <PolaroidCard src={slide.images[1]} tilt={tiltB} widthPct={46} heightPct={92} delay={8} durationInFrames={durationInFrames} />
          </AbsoluteFill>
          <SoundStamp at={2} volume={0.55} />
          <SoundStamp at={10} volume={0.5} />
        </AbsoluteFill>
      );
    }
    // Portrait / square — front card very large, second card peeks behind, almost no empty cream visible.
    return (
      <AbsoluteFill>
        <PaperBackdrop />
        <AbsoluteFill style={{ padding: "3%" }}>
          <div style={{ position: "absolute", top: "4%", left: "4%", width: "76%", height: "62%", transform: `rotate(${tiltB * 1.6}deg)` }}>
            <PolaroidCard src={slide.images[1]} tilt={0} widthPct={100} heightPct={100} delay={10} durationInFrames={durationInFrames} />
          </div>
          <div style={{ position: "absolute", bottom: "3%", right: "3%", width: "84%", height: "70%" }}>
            <PolaroidCard src={slide.images[0]} caption={slide.caption} tilt={tiltA * 0.6} widthPct={100} heightPct={100} durationInFrames={durationInFrames} />
          </div>
        </AbsoluteFill>
        <SoundStamp at={2} volume={0.55} />
        <SoundStamp at={12} volume={0.5} />
      </AbsoluteFill>
    );
  }
  // Single-photo: one big polaroid filling almost the whole frame.
  const widthPct = aspect === "landscape" ? 64 : aspect === "square" ? 88 : 94;
  const heightPct = aspect === "landscape" ? 94 : aspect === "square" ? 90 : 88;
  return (
    <AbsoluteFill>
      <PaperBackdrop />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "3%" }}>
        <PolaroidCard src={slide.images[0]} caption={slide.caption} tilt={tiltA} widthPct={widthPct} heightPct={heightPct} durationInFrames={durationInFrames} />
      </AbsoluteFill>
      <SoundStamp at={2} volume={0.55} />
    </AbsoluteFill>
  );
};

const Outro: React.FC<{ props: ReelProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const slam = spring({ frame, fps, config: { damping: 11, stiffness: 130, mass: 0.7 } });
  const rot = interpolate(slam, [0, 1], [-7, -3]);
  const sc = interpolate(slam, [0, 1], [1.2, 1]);
  return (
    <AbsoluteFill>
      <PaperBackdrop />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: base * 0.05 }}>
        <div
          style={{
            background: PAPER,
            padding: `${base * 0.07}px ${base * 0.08}px`,
            transform: `rotate(${rot}deg) scale(${sc})`,
            boxShadow: "0 44px 80px -22px rgba(40,30,15,0.55), 0 10px 22px rgba(40,30,15,0.2)",
            textAlign: "center",
            position: "relative",
            borderRadius: 4,
            maxWidth: "82%",
          }}
        >
          <Tape rotate={-10} style={{ top: -10, left: "30%" }} />
          <Tape rotate={8} style={{ top: -10, right: "30%" }} />
          <TypewriterCaption
            text={props.ctaHeadline}
            startFrame={8}
            charsPerFrame={0.55}
            style={{ fontFamily: SERIF, fontWeight: 800, color: INK, fontSize: Math.round(base * 0.078), lineHeight: 1.02, textAlign: "center", letterSpacing: "-0.5px" }}
            cursorColor={INK}
            soundVolume={0.16}
          />
          <div style={{ fontFamily: HAND, color: "#5a4a32", fontSize: Math.round(base * 0.05), marginTop: base * 0.025, opacity: spring({ frame: frame - 50, fps }) }}>
            {props.ctaSub}
          </div>
          <div style={{ marginTop: base * 0.04, display: "inline-block", padding: `${base * 0.02}px ${base * 0.045}px`, background: props.accent, color: "#0B121F", fontFamily: SERIF, fontWeight: 700, borderRadius: 99, fontSize: Math.round(base * 0.034), opacity: spring({ frame: frame - 64, fps }) }}>
            {props.website}
          </div>
        </div>
      </AbsoluteFill>
      <SoundStamp at={0} volume={0.55} />
    </AbsoluteFill>
  );
};

const transition = (i: number): TransitionPresentation<Record<string, unknown>> => {
  // Soft alternating fade and gentle slide — feels like flipping through pages of an album.
  return i % 2 === 0 ? fade() : slideTrans({ direction: "from-right" });
};

export const polaroidSpec: TemplateSpec = {
  Intro,
  Slide,
  Outro,
  transition,
  // Slower cadence — typewriter captions need time to type out.
  perPhotoSeconds: 3.6,
  overlays: {
    grain: false,
    grade: false,
    lightLeak: false,
    particles: false,
    vignette: false,
    topBar: false,
  },
};
