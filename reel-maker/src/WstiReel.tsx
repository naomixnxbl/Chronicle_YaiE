import React from "react";
import {
  AbsoluteFill,
  Html5Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import type { TransitionPresentation } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { type ReelProps, getTimeline, TRANSITION_FRAMES } from "./schema";

const { fontFamily: DISPLAY } = loadAnton();
const { fontFamily: SANS } = loadInter("normal", {
  weights: ["400", "600", "800"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});
const { fontFamily: BRAND } = loadMontserrat("normal", {
  weights: ["800"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

// ---------- brand ----------

const WstiMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" fill="none" style={{ display: "block" }}>
    <path d="M54 30 H92 V68" stroke={color} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M28 52 H66 V90" stroke={color} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Brand lockup. WSTI keeps its exact wordmark + vector swoosh (useBuiltinMark);
// other brands show their logo image, falling back to a plain wordmark.
const Lockup: React.FC<{
  fontSize: number;
  color: string;
  wordmark?: string;
  logoImage?: string | null;
  useBuiltinMark?: boolean;
}> = ({ fontSize, color, wordmark = "WSTI", logoImage = null, useBuiltinMark = true }) => {
  if (!useBuiltinMark && logoImage) {
    return (
      <Img
        src={staticFile(logoImage)}
        style={{ height: fontSize * 1.05, width: "auto", display: "block", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.5))" }}
      />
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: fontSize * 0.18 }}>
      <span
        style={{
          fontFamily: BRAND,
          fontWeight: 800,
          color: "#fff",
          fontSize,
          letterSpacing: `-${fontSize * 0.015}px`,
          lineHeight: 1,
        }}
      >
        {wordmark}
      </span>
      {useBuiltinMark ? <WstiMark size={fontSize * 0.86} color={color} /> : null}
    </div>
  );
};

// ---------- cinematic overlays ----------

// Animated film grain — rendered at half resolution (cheaper, still filmic),
// reseeded every 2 frames.
const Grain: React.FC<{ intensity: number }> = ({ intensity }) => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2) % 12;
  if (intensity <= 0) return null;
  return (
    <AbsoluteFill style={{ mixBlendMode: "overlay", opacity: 0.06 * intensity, pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "50%", height: "50%", transform: "scale(2)", transformOrigin: "top left" }}>
        <svg width="100%" height="100%">
          <filter id={`grain${seed}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={1} seed={seed} stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter={`url(#grain${seed})`} />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// Drifting coloured light leaks (teal + warm) for depth.
const LightLeak: React.FC<{ accent: string; intensity: number }> = ({ accent, intensity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const x = 50 + Math.sin(t * 0.5) * 28;
  const y = 24 + Math.cos(t * 0.42) * 16;
  if (intensity <= 0) return null;
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", pointerEvents: "none", opacity: 0.5 * intensity }}>
      <AbsoluteFill style={{ background: `radial-gradient(38% 30% at ${x}% ${y}%, ${accent}30, transparent 70%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(34% 26% at ${100 - x}% 82%, rgba(255,170,110,0.16), transparent 70%)` }} />
    </AbsoluteFill>
  );
};

// Cinematic colour grade. Professional mode = subtle teal-shadow / warm-highlight.
// Energy (Instagram) mode = punchier, more saturated, with a slow drifting accent
// wash + a moving light sheen so the frame always feels alive.
const Grade: React.FC<{ intensity: number; accent: string; energy: number }> = ({ intensity, accent, energy }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (intensity <= 0) return null;
  if (energy > 0) {
    const t = frame / fps;
    const sheen = 50 + Math.sin(t * 0.6) * 60; // sweeping highlight position
    return (
      <>
        <AbsoluteFill
          style={{
            mixBlendMode: "soft-light",
            opacity: 0.34 * intensity,
            pointerEvents: "none",
            background: `linear-gradient(125deg, ${accent}cc 0%, #161028 48%, #2e1030 100%)`,
          }}
        />
        <AbsoluteFill
          style={{
            mixBlendMode: "overlay",
            opacity: 0.16 * intensity,
            pointerEvents: "none",
            background: `linear-gradient(${sheen}deg, transparent 40%, rgba(255,255,255,0.5) 50%, transparent 60%)`,
          }}
        />
      </>
    );
  }
  return (
    <AbsoluteFill
      style={{
        mixBlendMode: "soft-light",
        opacity: 0.22 * intensity,
        pointerEvents: "none",
        background: "linear-gradient(125deg, #0a3242 0%, #14202e 45%, #2e1d0c 100%)",
      }}
    />
  );
};

const Vignette: React.FC = () => (
  <AbsoluteFill style={{ boxShadow: "inset 0 0 360px rgba(0,0,0,0.6)", pointerEvents: "none" }} />
);

// Floating bokeh particles for depth/motion. Energy (Instagram) mode = more
// of them, faster rise, brighter twinkle.
const Particles: React.FC<{ accent: string; energy: number }> = ({ accent, energy }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const count = energy > 0 ? 28 : 16;
  const speedBase = energy > 0 ? 0.3 : 0.18;
  const opMul = energy > 0 ? 0.7 : 0.45;
  const dots = Array.from({ length: count }, (_, i) => {
    const seed = i * 97.13;
    const x = (seed % 100) / 100;
    const speed = speedBase + (i % 5) * 0.05;
    const y = 1.15 - (((t * speed + (seed % 53) / 53) % 1.3));
    const size = (5 + (i % 4) * 6) * (energy > 0 ? 1.2 : 1);
    const tw = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.3 + i));
    return { x, y, size, tw, i };
  });
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", pointerEvents: "none" }}>
      {dots.map((d) => (
        <div
          key={d.i}
          style={{
            position: "absolute",
            left: `${d.x * 100}%`,
            top: `${d.y * 100}%`,
            width: d.size,
            height: d.size,
            borderRadius: "50%",
            background: d.i % 3 === 0 ? accent : "#ffffff",
            opacity: d.tw * opMul,
            filter: "blur(2px)",
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

// ---------- photo + caption ----------

// Whole photo always visible (objectFit:contain). Empty space is filled with a
// blurred, zoomed copy of the same photo — premium "blurred backdrop", works in
// any aspect ratio. Foreground zoom stays <= 1 so the photo is never cropped.
const PhotoLayer: React.FC<{ src: string; index: number; durationInFrames: number; energy: number }> = ({
  src,
  index,
  durationInFrames,
  energy,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoomIn = index % 2 === 0;
  // Instagram pushes the backdrop motion harder for a livelier frame.
  const bgRange = energy > 0 ? [1.22, 1.42] : [1.18, 1.32];
  const bgScale = interpolate(frame, [0, durationInFrames], zoomIn ? bgRange : [bgRange[1], bgRange[0]], {
    extrapolateRight: "clamp",
  });
  const bgPan = interpolate(frame, [0, durationInFrames], zoomIn ? [-2.5, 2.5] : [2.5, -2.5], {
    extrapolateRight: "clamp",
  });
  // gentle drift on the photo itself — capped at 1.0 so the full frame is never cropped
  const fgScale = interpolate(frame, [0, durationInFrames], zoomIn ? [0.94, 1.0] : [1.0, 0.94], {
    extrapolateRight: "clamp",
  });
  // snappy entrance pop (scale + settle) — only on Instagram
  const pop = energy > 0 ? spring({ frame, fps, config: { damping: 14, stiffness: 140, mass: 0.6 } }) : 1;
  const popScale = energy > 0 ? interpolate(pop, [0, 1], [1.06, 1]) : 1;
  const fgFilter =
    energy > 0
      ? "drop-shadow(0 24px 60px rgba(0,0,0,0.6)) saturate(1.28) contrast(1.07)"
      : "drop-shadow(0 24px 60px rgba(0,0,0,0.6))";
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#070b14" }}>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${bgScale}) translateX(${bgPan}%)`,
          filter: `blur(22px) brightness(0.5) saturate(${energy > 0 ? 1.4 : 1.15})`,
        }}
      />
      <AbsoluteFill style={{ background: "rgba(7,11,20,0.28)" }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            transform: `scale(${fgScale * popScale})`,
            filter: fgFilter,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Scrim: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "linear-gradient(to top, rgba(7,11,20,0.96) 0%, rgba(7,11,20,0.6) 24%, rgba(7,11,20,0) 54%)," +
        "linear-gradient(to bottom, rgba(7,11,20,0.5) 0%, rgba(7,11,20,0) 18%)",
    }}
  />
);

// Caption: words form in (rise + un-blur), whole line dissolves out before the cut.
const AnimatedCaption: React.FC<{
  text: string;
  index: number;
  durationInFrames: number;
  accent: string;
  captionScale: number;
  energy: number;
}> = ({ text, index, durationInFrames, accent, captionScale, energy }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const words = text.split(/\s+/).filter(Boolean);
  const variant = index % 3;

  const outStart = durationInFrames - 16;
  const outOpacity = interpolate(frame, [outStart, durationInFrames - 2], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const outY = interpolate(frame, [outStart, durationInFrames - 2], [0, -34], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const outBlur = interpolate(frame, [outStart, durationInFrames - 2], [0, 8], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // size by the SHORTER side so captions stay a sensible, consistent size in
  // every format (reels / square / 16:9) — kept small so the photo shows.
  // Instagram bumps captions ~22% bigger so they punch on a phone screen.
  const base = Math.min(width, height);
  const isWide = width > height;
  const energyScale = energy > 0 ? 1.22 : 1;
  const font = variant === 2 ? SANS : DISPLAY;
  const size = (variant === 0 ? base * 0.06 : variant === 1 ? base * 0.054 : base * 0.046) * captionScale * energyScale;
  const centered = variant === 2;
  const maxW = centered ? "82%" : isWide ? "60%" : "90%";
  const barReveal = spring({ frame: frame - 4, fps, config: { damping: 200, mass: 0.5 } });
  // gentle continuous bob on Instagram so static lines never feel dead
  const bob = energy > 0 ? Math.sin((frame / fps) * 2.4) * (base * 0.004) : 0;

  return (
    <div
      style={{
        opacity: outOpacity,
        transform: `translateY(${outY + bob}px)`,
        filter: `blur(${outBlur}px)`,
        maxWidth: maxW,
        textAlign: centered ? "center" : "left",
      }}
    >
      {variant !== 1 ? (
        <div
          style={{
            width: base * (energy > 0 ? 0.16 : 0.12) * barReveal,
            height: Math.max(5, base * (energy > 0 ? 0.011 : 0.008)),
            background: accent,
            borderRadius: 99,
            margin: centered ? "0 auto" : "0",
            marginBottom: size * 0.32,
            boxShadow: `0 0 ${base * (energy > 0 ? 0.04 : 0.025)}px ${accent}`,
          }}
        />
      ) : null}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: `${size * 0.04}px ${size * 0.22}px`,
          justifyContent: centered ? "center" : "flex-start",
          fontFamily: font,
          fontWeight: variant === 2 ? 800 : 400,
          fontSize: size,
          lineHeight: 1.0,
          letterSpacing: variant === 2 ? "1px" : "-0.5px",
          textTransform: "uppercase",
        }}
      >
        {words.map((w, i) => {
          // snappier, tighter-staggered word entrance on Instagram
          const delay = energy > 0 ? 4 + i * 2 : 6 + i * 3;
          const e = spring({ frame: frame - delay, fps, config: { damping: 200, mass: 0.5 } });
          const wy = interpolate(e, [0, 1], [42, 0]);
          const wb = interpolate(e, [0, 1], [9, 0]);
          const highlight = variant === 1 && i === words.length - 1;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: e,
                transform: `translateY(${wy}px)`,
                filter: `blur(${wb}px)`,
                color: highlight ? accent : "#fff",
                // subtle chromatic-aberration + soft shadow; Instagram adds an accent glow
                textShadow:
                  energy > 0
                    ? `1.5px 0 rgba(255,40,90,0.34), -1.5px 0 rgba(40,200,255,0.34), 0 0 ${size * 0.5}px ${accent}66, 0 5px 34px rgba(0,0,0,0.6)`
                    : "1.5px 0 rgba(255,40,90,0.30), -1.5px 0 rgba(40,200,255,0.30), 0 4px 30px rgba(0,0,0,0.55)",
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const PhotoSlide: React.FC<{
  src: string;
  caption?: string;
  index: number;
  durationInFrames: number;
  accent: string;
  captionScale: number;
  energy: number;
}> = ({ src, caption, index, durationInFrames, accent, captionScale, energy }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const centered = index % 3 === 2;
  // quick light flash on entrance (reads as a snappy, trendy cut) — brighter on Instagram
  const flash = interpolate(frame, [0, 2, 9], [energy > 0 ? 0.75 : 0.55, energy > 0 ? 0.4 : 0.32, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <PhotoLayer src={src} index={index} durationInFrames={durationInFrames} energy={energy} />
      <AbsoluteFill style={{ background: "#eafff6", opacity: flash, mixBlendMode: "screen", pointerEvents: "none" }} />
      <Scrim />
      {caption ? (
        <AbsoluteFill
          style={{
            justifyContent: "flex-end",
            alignItems: centered ? "center" : "flex-start",
            padding: `0 ${base * 0.06}px ${base * 0.06}px`,
          }}
        >
          <AnimatedCaption text={caption} index={index} durationInFrames={durationInFrames} accent={accent} captionScale={captionScale} energy={energy} />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

// Two related photos in one frame, caption set elegantly between them.
// Reels (tall) -> stacked top/bottom; landscape/square -> side by side.
const DuoSlide: React.FC<{
  images: string[];
  caption?: string;
  durationInFrames: number;
  accent: string;
  bg: string;
  captionScale: number;
  energy: number;
}> = ({ images, caption, durationInFrames, accent, bg, captionScale, energy }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const stacked = height >= width; // reels & square stack; landscape side-by-side
  const flash = interpolate(frame, [0, 2, 9], [energy > 0 ? 0.7 : 0.5, energy > 0 ? 0.38 : 0.3, 0], { extrapolateRight: "clamp" });

  const inA = spring({ frame: frame - 3, fps, config: { damping: 200, mass: 0.7 } });
  const inB = spring({ frame: frame - 7, fps, config: { damping: 200, mass: 0.7 } });
  const capIn = spring({ frame: frame - 12, fps, config: { damping: 200, mass: 0.6 } });
  // gentle scale drift (<=1, never crops the contained photo)
  const drift = interpolate(frame, [0, durationInFrames], [0.97, 1.0], { extrapolateRight: "clamp" });

  const offA = interpolate(inA, [0, 1], [stacked ? -50 : -60, 0]);
  const offB = interpolate(inB, [0, 1], [stacked ? 50 : 60, 0]);

  const half: React.CSSProperties = {
    flex: 1,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  const imgStyle = (off: number, op: number): React.CSSProperties => ({
    width: "100%",
    height: "100%",
    objectFit: "contain",
    opacity: op,
    transform: `translate${stacked ? "Y" : "X"}(${off}px) scale(${drift})`,
    filter: energy > 0 ? "drop-shadow(0 18px 44px rgba(0,0,0,0.55)) saturate(1.28) contrast(1.07)" : "drop-shadow(0 18px 44px rgba(0,0,0,0.55))",
  });

  // caption band sizing
  const capSize = base * 0.05 * captionScale * (energy > 0 ? 1.2 : 1);
  const ruleLen = base * 0.07;

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      {/* faint blurred wash from the first image for cohesion */}
      <Img src={images[0]} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(60px) brightness(0.35) saturate(1.1)", opacity: 0.5 }} />
      <AbsoluteFill style={{ flexDirection: stacked ? "column" : "row", padding: base * 0.045, gap: base * 0.02 }}>
        <div style={half}>
          <Img src={images[0]} style={imgStyle(offA, inA)} />
        </div>
        {/* elegant caption band BETWEEN the two photos */}
        <div
          style={{
            opacity: capIn,
            display: "flex",
            flexDirection: stacked ? "row" : "column",
            alignItems: "center",
            justifyContent: "center",
            gap: base * 0.025,
            padding: `${base * 0.01}px 0`,
          }}
        >
          <div style={{ width: stacked ? ruleLen : Math.max(4, base * 0.006), height: stacked ? Math.max(4, base * 0.006) : ruleLen, background: accent, borderRadius: 99, boxShadow: `0 0 ${base * 0.02}px ${accent}` }} />
          <div
            style={{
              fontFamily: DISPLAY,
              color: "#fff",
              fontSize: capSize,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              textAlign: "center",
              lineHeight: 1.05,
              maxWidth: stacked ? "70%" : "90%",
              transform: `translateY(${interpolate(capIn, [0, 1], [16, 0])}px)`,
              textShadow: "1.5px 0 rgba(255,40,90,0.28), -1.5px 0 rgba(40,200,255,0.28), 0 4px 24px rgba(0,0,0,0.5)",
            }}
          >
            {caption}
          </div>
          <div style={{ width: stacked ? ruleLen : Math.max(4, base * 0.006), height: stacked ? Math.max(4, base * 0.006) : ruleLen, background: accent, borderRadius: 99, boxShadow: `0 0 ${base * 0.02}px ${accent}` }} />
        </div>
        <div style={half}>
          <Img src={images[1]} style={imgStyle(offB, inB)} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#eafff6", opacity: flash, mixBlendMode: "screen", pointerEvents: "none" }} />
      <Vignette />
    </AbsoluteFill>
  );
};

// Word-by-word reveal used by the intro headline.
const WordReveal: React.FC<{ text: string; startFrame: number; style: React.CSSProperties }> = ({
  text,
  startFrame,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.06em 0.26em", ...style }}>
      {text.split(/\s+/).filter(Boolean).map((w, i) => {
        const e = spring({ frame: frame - (startFrame + i * 3), fps, config: { damping: 200, mass: 0.5 } });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: e,
              transform: `translateY(${interpolate(e, [0, 1], [44, 0])}px)`,
              filter: `blur(${interpolate(e, [0, 1], [9, 0])}px)`,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

const IntroSlide: React.FC<{ props: ReelProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = (d: number) => spring({ frame: frame - d, fps, config: { damping: 200 } });
  const isWide = width > height;
  return (
    <AbsoluteFill style={{ backgroundColor: props.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 8%, ${props.accent}26 0%, ${props.bg} 58%)` }} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          padding: `0 ${width * 0.08}px`,
          alignItems: isWide ? "center" : "flex-start",
          textAlign: isWide ? "center" : "left",
        }}
      >
        <div style={{ opacity: s(0), transform: `translateY(${interpolate(s(0), [0, 1], [24, 0])}px)`, marginBottom: width * 0.055 }}>
          <Lockup fontSize={Math.round(width * 0.088)} color={props.accent} wordmark={props.wordmark} logoImage={props.logoImage} useBuiltinMark={props.useBuiltinMark} />
        </div>
        <WordReveal
          text={props.title}
          startFrame={8}
          style={{
            fontFamily: DISPLAY,
            color: "#fff",
            fontSize: Math.round(width * 0.094),
            lineHeight: 0.98,
            letterSpacing: "-1px",
            textTransform: "uppercase",
            maxWidth: isWide ? "82%" : "100%",
            justifyContent: isWide ? "center" : "flex-start",
          }}
        />
        <div
          style={{
            opacity: s(20),
            transform: `translateY(${interpolate(s(20), [0, 1], [24, 0])}px)`,
            fontFamily: SANS,
            fontWeight: 600,
            color: "rgba(255,255,255,0.82)",
            fontSize: Math.round(width * 0.034),
            marginTop: width * 0.035,
          }}
        >
          {props.subtitle}
        </div>
      </AbsoluteFill>
      <Vignette />
    </AbsoluteFill>
  );
};

// Pointer cursor (classic arrow).
const Cursor: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", ...style }}>
    <path
      d="M5 2 L5 21 L9.6 16.7 L12.5 23.5 L15.4 22.3 L12.5 15.8 L18.5 15.8 Z"
      fill="#fff"
      stroke="#0B121F"
      strokeWidth={1.3}
      strokeLinejoin="round"
    />
  </svg>
);

const OutroSlide: React.FC<{ props: ReelProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = (d: number) => spring({ frame: frame - d, fps, config: { damping: 200 } });
  const isWide = width > height;

  // cursor approaches the pill, then clicks
  const CLICK = 58;
  const approach = spring({ frame: frame - 40, fps, config: { damping: 16, stiffness: 120, mass: 0.8 } });
  const ax = (1 - approach) * width * 0.12;
  const ay = (1 - approach) * width * 0.1;
  const dip = interpolate(frame, [CLICK - 1, CLICK + 1, CLICK + 4], [0, width * 0.012, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cursorOpacity = interpolate(frame, [34, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const press = interpolate(frame, [CLICK - 2, CLICK, CLICK + 9], [1, 0.93, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glow = interpolate(frame, [CLICK, CLICK + 18], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rippleScale = interpolate(frame, [CLICK, CLICK + 20], [0.2, 5.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rippleOpacity = interpolate(frame, [CLICK, CLICK + 20], [0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cursorSize = width * 0.07;

  return (
    <AbsoluteFill style={{ backgroundColor: props.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 100%, ${props.accent}33 0%, ${props.bg} 55%)` }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", padding: `0 ${width * 0.08}px` }}>
        <div style={{ opacity: s(0), transform: `scale(${interpolate(s(0), [0, 1], [0.82, 1])})` }}>
          <Lockup fontSize={Math.round(width * 0.16)} color={props.accent} wordmark={props.wordmark} logoImage={props.logoImage} useBuiltinMark={props.useBuiltinMark} />
        </div>
        <div
          style={{
            opacity: s(10),
            transform: `translateY(${interpolate(s(10), [0, 1], [28, 0])}px)`,
            fontFamily: DISPLAY,
            color: "#fff",
            fontSize: Math.round(width * 0.072),
            textTransform: "uppercase",
            lineHeight: 1.02,
            marginTop: width * 0.045,
            maxWidth: isWide ? "72%" : "100%",
          }}
        >
          {props.ctaHeadline}
        </div>
        <div
          style={{
            opacity: s(18),
            fontFamily: SANS,
            fontWeight: 600,
            color: "rgba(255,255,255,0.8)",
            fontSize: Math.round(width * 0.032),
            marginTop: width * 0.022,
            maxWidth: "85%",
          }}
        >
          {props.ctaSub}
        </div>

        {/* website pill + clicking cursor */}
        <div style={{ position: "relative", display: "inline-block", marginTop: width * 0.06, opacity: s(24) }}>
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 800,
              color: "#0B121F",
              background: props.accent,
              fontSize: Math.round(width * 0.034),
              padding: `${width * 0.021}px ${width * 0.05}px`,
              borderRadius: 999,
              transform: `scale(${press})`,
              boxShadow: `0 0 ${width * 0.06 * glow}px ${props.accent}, 0 ${width * 0.01}px ${width * 0.03}px rgba(0,0,0,0.4)`,
            }}
          >
            {props.website}
          </div>
          {/* click ripple */}
          <div
            style={{
              position: "absolute",
              left: "62%",
              top: "52%",
              width: width * 0.05,
              height: width * 0.05,
              marginLeft: -(width * 0.025),
              marginTop: -(width * 0.025),
              borderRadius: "50%",
              border: `${Math.max(2, width * 0.004)}px solid ${props.accent}`,
              transform: `scale(${rippleScale})`,
              opacity: rippleOpacity,
              pointerEvents: "none",
            }}
          />
          {/* cursor */}
          <div
            style={{
              position: "absolute",
              left: "60%",
              top: "38%",
              opacity: cursorOpacity,
              transform: `translate(${ax}px, ${ay + dip}px)`,
              filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
            }}
          >
            <Cursor size={cursorSize} />
          </div>
        </div>
      </AbsoluteFill>
      <Vignette />

      {/* synthesized click at the moment of contact */}
      <Sequence from={CLICK}>
        <Html5Audio src={staticFile("sfx/click.wav")} volume={0.85} />
      </Sequence>
    </AbsoluteFill>
  );
};

const TopBar: React.FC<{ props: ReelProps; totalF: number }> = ({ props }) => {
  const { width } = useVideoConfig();
  const pad = width * 0.05;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: pad, left: pad, opacity: 0.95, filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.5))" }}>
        <Lockup fontSize={Math.round(width * 0.044)} color={props.accent} wordmark={props.wordmark} logoImage={props.logoImage} useBuiltinMark={props.useBuiltinMark} />
      </div>
    </AbsoluteFill>
  );
};

// ---------- main ----------

const photoTransition = (i: number, energy: number): TransitionPresentation<Record<string, unknown>> => {
  if (energy > 0) {
    // punchy directional slides cycling all four ways for an energetic feel
    const dirs = ["from-right", "from-bottom", "from-left", "from-top"] as const;
    return slide({ direction: dirs[i % dirs.length] }) as TransitionPresentation<Record<string, unknown>>;
  }
  return (i % 2 === 0
    ? slide({ direction: "from-right" })
    : wipe({ direction: "from-left" })) as TransitionPresentation<Record<string, unknown>>;
};

export const WstiReel: React.FC<ReelProps> = (props) => {
  const { introF, outroF, slideFs, totalF } = getTimeline(props);
  const t = linearTiming({ durationInFrames: TRANSITION_FRAMES });
  // Instagram (reels / 9:16) gets the bold, creative treatment; square &
  // landscape stay clean and professional.
  const energy = props.format === "reels" ? 1 : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: props.bg }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={introF}>
          <IntroSlide props={props} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={t} />

        {props.slides.map((s, i) => (
          <React.Fragment key={i}>
            <TransitionSeries.Sequence durationInFrames={slideFs[i]}>
              {s.images.length >= 2 ? (
                <DuoSlide
                  images={s.images}
                  caption={s.caption}
                  durationInFrames={slideFs[i]}
                  accent={props.accent}
                  bg={props.bg}
                  captionScale={props.captionScale}
                  energy={energy}
                />
              ) : (
                <PhotoSlide
                  src={s.images[0]}
                  caption={s.caption}
                  index={i}
                  durationInFrames={slideFs[i]}
                  accent={props.accent}
                  captionScale={props.captionScale}
                  energy={energy}
                />
              )}
            </TransitionSeries.Sequence>
            <TransitionSeries.Transition presentation={photoTransition(i, energy)} timing={t} />
          </React.Fragment>
        ))}

        <TransitionSeries.Sequence durationInFrames={outroF}>
          <OutroSlide props={props} />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* cinematic grade + leaks + particles + grain, above content but below the HUD */}
      <Grade intensity={props.grade} accent={props.accent} energy={energy} />
      <LightLeak accent={props.accent} intensity={props.lightLeak * (energy > 0 ? 1.6 : 1)} />
      {props.particles ? <Particles accent={props.accent} energy={energy} /> : null}
      <Vignette />
      <Grain intensity={props.grain} />

      <TopBar props={props} totalF={totalF} />

      {props.music ? (
        <Html5Audio
          src={props.music}
          loop
          loopVolumeCurveBehavior="extend"
          volume={(f: number) =>
            interpolate(f, [0, 20, totalF - 30, totalF], [0, 0.7, 0.7, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          }
        />
      ) : null}
    </AbsoluteFill>
  );
};
