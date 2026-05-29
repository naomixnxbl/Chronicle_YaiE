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
import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";
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
const { fontFamily: HAND } = loadCaveat("normal", {
  weights: ["600", "700"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

// ---------- instagram "energy" helpers ----------

// Custom transition: zoom + blur + flash — the classic punchy Reels cut.
const ZoomBlur: React.FC<{
  presentationDirection: "entering" | "exiting";
  presentationProgress: number;
  passedProps: Record<string, unknown>;
  children: React.ReactNode;
}> = ({ presentationDirection, presentationProgress, children }) => {
  const p = presentationProgress;
  const entering = presentationDirection === "entering";
  const scale = entering ? interpolate(p, [0, 1], [1.35, 1]) : interpolate(p, [0, 1], [1, 0.8]);
  const blur = entering ? interpolate(p, [0, 1], [16, 0]) : interpolate(p, [0, 1], [0, 16]);
  const opacity = entering ? interpolate(p, [0, 0.35, 1], [0, 1, 1]) : interpolate(p, [0, 1], [1, 0]);
  return (
    <AbsoluteFill style={{ transform: `scale(${scale})`, filter: `blur(${blur}px)`, opacity }}>
      {children}
    </AbsoluteFill>
  );
};
const zoomBlur = (): TransitionPresentation<Record<string, unknown>> =>
  ({ component: ZoomBlur, props: {} } as unknown as TransitionPresentation<Record<string, unknown>>);

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
      {useBuiltinMark ? (
        logoImage ? (
          <Img
            src={staticFile(logoImage)}
            style={{ height: fontSize * 1.0, width: "auto", display: "block", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.45))" }}
          />
        ) : (
          <WstiMark size={fontSize * 0.86} color={color} />
        )
      ) : null}
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
type IgStyle = "polaroid" | "contain";
const PhotoLayer: React.FC<{ src: string; caption?: string; index: number; durationInFrames: number; energy: number; igStyle?: IgStyle }> = ({
  src,
  caption,
  index,
  durationInFrames,
  energy,
  igStyle = "contain",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const zoomIn = index % 2 === 0;
  // Instagram pushes the backdrop motion harder for a livelier frame.
  const bgRange = energy > 0 ? [1.22, 1.42] : [1.18, 1.32];
  const bgScale = interpolate(frame, [0, durationInFrames], zoomIn ? bgRange : [bgRange[1], bgRange[0]], {
    extrapolateRight: "clamp",
  });
  const bgPan = interpolate(frame, [0, durationInFrames], zoomIn ? [-2.5, 2.5] : [2.5, -2.5], {
    extrapolateRight: "clamp",
  });
  // Professional formats: gentle Ken Burns drift (never crops). Instagram holds
  // the photo still — no in/out pulsing.
  const base = Math.min(width, height);
  const fgScale = interpolate(frame, [0, durationInFrames], zoomIn ? [0.94, 1.0] : [1.0, 0.94], { extrapolateRight: "clamp" });
  // Instagram: a polaroid CARD that slams in once with a slight tilt + overshoot, then holds still
  const tilt = zoomIn ? -2.5 : 2.5;
  const slam = energy > 0 ? spring({ frame, fps, config: { damping: 11, stiffness: 130, mass: 0.7 } }) : 1;
  const cardRot = interpolate(slam, [0, 1], [tilt * 3.5, tilt]);
  const cardScale = interpolate(slam, [0, 1], [1.18, 1]);
  // handwritten caption appears on the polaroid a beat after it lands
  const capReveal = spring({ frame: frame - 12, fps, config: { damping: 200, mass: 0.6 } });
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
        {energy > 0 && igStyle === "polaroid" ? (
          // tilted white photo-card with a handwritten caption
          <div
            style={{
              width: "84%",
              height: "70%",
              background: "#fbfbf7",
              padding: base * 0.014,
              borderRadius: base * 0.022,
              boxShadow: "0 34px 90px -22px rgba(0,0,0,0.85)",
              transform: `rotate(${cardRot}deg) scale(${cardScale})`,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden", borderRadius: base * 0.008, display: "flex", background: "#eef0f2" }}>
              <Img src={src} style={{ width: "100%", height: "100%", objectFit: "contain", filter: "saturate(1.2) contrast(1.05)" }} />
            </div>
            {caption ? (
              <div
                style={{
                  flex: "none",
                  minHeight: base * 0.12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: `${base * 0.012}px ${base * 0.02}px 0`,
                  opacity: capReveal,
                  transform: `translateY(${(1 - capReveal) * 8}px)`,
                }}
              >
                <div style={{ fontFamily: HAND, fontWeight: 700, color: "#14233d", fontSize: base * 0.062, lineHeight: 1.0, textAlign: "center", transform: `rotate(${tilt * 0.5}deg)` }}>
                  {caption}
                </div>
              </div>
            ) : null}
          </div>
        ) : energy > 0 ? (
          // framed: the WHOLE photo on the blurred backdrop — never cropped
          <Img
            src={src}
            style={{ width: "100%", height: "100%", objectFit: "contain", transform: "scale(0.97)", filter: "drop-shadow(0 24px 60px rgba(0,0,0,0.65)) saturate(1.2) contrast(1.05)" }}
          />
        ) : (
          <Img
            src={src}
            style={{ width: "100%", height: "100%", objectFit: "contain", transform: `scale(${fgScale})`, filter: "drop-shadow(0 24px 60px rgba(0,0,0,0.6))" }}
          />
        )}
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
      {variant !== 1 && !(energy > 0) ? (
        <div
          style={{
            width: base * 0.12 * barReveal,
            height: Math.max(5, base * 0.008),
            background: accent,
            borderRadius: 99,
            margin: centered ? "0 auto" : "0",
            marginBottom: size * 0.32,
            boxShadow: `0 0 ${base * 0.025}px ${accent}`,
          }}
        />
      ) : null}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: energy > 0 ? `${size * 0.18}px ${size * 0.16}px` : `${size * 0.04}px ${size * 0.22}px`,
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
          // kinetic: each word punches in big, then settles (Instagram only)
          const scalePop = energy > 0
            ? interpolate(frame, [delay, delay + 3, delay + 10], [1.5, 1.1, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
            : 1;
          // karaoke: the word is "active" (accent box) right as it lands, then settles to a dark box
          const justLanded = energy > 0 && frame >= delay + 1 && frame < delay + 11;
          const highlight = variant === 1 && i === words.length - 1;
          // CapCut-style caption boxes on Instagram
          const boxStyle: React.CSSProperties = energy > 0
            ? {
                background: justLanded ? accent : "rgba(8,12,22,0.66)",
                color: justLanded ? "#08121e" : "#fff",
                padding: `${size * 0.1}px ${size * 0.2}px`,
                borderRadius: size * 0.16,
                boxShadow: justLanded ? `0 0 ${size * 0.5}px ${accent}88` : "0 6px 18px rgba(0,0,0,0.45)",
                textShadow: "none",
              }
            : {
                color: highlight ? accent : "#fff",
                textShadow: "1.5px 0 rgba(255,40,90,0.30), -1.5px 0 rgba(40,200,255,0.30), 0 4px 30px rgba(0,0,0,0.55)",
              };
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: e,
                transform: `translateY(${wy}px) scale(${scalePop})`,
                filter: `blur(${wb}px)`,
                ...boxStyle,
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


// Small twinkling accent sticker.
const Sparkle: React.FC<{ accent: string; size: number; style?: React.CSSProperties }> = ({ accent, size, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tw = 0.5 + 0.5 * Math.sin((frame / fps) * 6);
  const rot = (frame / fps) * 35;
  return (
    <div style={{ position: "absolute", color: accent, fontSize: size, lineHeight: 1, opacity: 0.25 + 0.6 * tw, transform: `rotate(${rot}deg)`, textShadow: `0 0 ${size * 0.5}px ${accent}`, pointerEvents: "none", zIndex: 5, ...style }}>✦</div>
  );
};

// Spring pop-in wrapper for stickers (scale-up + overshoot + slight rotate).
const StickerPop: React.FC<{ delay: number; rotate?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ delay, rotate = 0, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 9, stiffness: 150, mass: 0.6 } });
  const sc = interpolate(s, [0, 1], [0, 1]);
  const wobble = Math.sin((frame / fps) * 3 + delay) * 2; // gentle life after popping
  return (
    <div style={{ position: "absolute", transform: `scale(${sc}) rotate(${rotate + wobble}deg)`, opacity: s > 0.03 ? 1 : 0, pointerEvents: "none", zIndex: 6, ...style }}>
      {children}
    </div>
  );
};

const LocationPin: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.5))" }}>
    <path d="M12 2C7.6 2 4 5.6 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4.4-3.6-8-8-8z" fill={color} stroke="#fff" strokeWidth={1.3} />
    <circle cx="12" cy="10" r="3.1" fill="#fff" />
  </svg>
);

const Arrow: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{ display: "block", filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.5))" }}>
    <path d="M50 12 C 30 14, 16 26, 15 48" stroke={color} strokeWidth={5} strokeLinecap="round" />
    <path d="M15 48 L 8 38 M15 48 L 27 44" stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// A curated, per-slide combo of stickers — varied so it never feels repetitive.
// Kept in the upper area so it never collides with the bottom captions.
const StickerSet: React.FC<{ index: number; accent: string; base: number }> = ({ index, accent, base }) => {
  const v = index % 4;
  const star = <div style={{ color: accent, fontSize: base * 0.06, textShadow: `0 0 ${base * 0.03}px ${accent}` }}>✦</div>;
  return (
    <>
      {v === 0 && (
        <>
          <StickerPop delay={6} style={{ top: base * 0.12, right: base * 0.09 }}><LocationPin size={base * 0.08} color={accent} /></StickerPop>
          <StickerPop delay={12} style={{ top: base * 0.26, right: base * 0.2 }}>{star}</StickerPop>
        </>
      )}
      {v === 1 && (
        <>
          <StickerPop delay={6} style={{ top: base * 0.12, right: base * 0.1 }}><LocationPin size={base * 0.085} color={accent} /></StickerPop>
          <StickerPop delay={11} rotate={8} style={{ top: base * 0.3, left: base * 0.08 }}><Arrow size={base * 0.12} color={accent} /></StickerPop>
        </>
      )}
      {v === 2 && (
        <>
          <StickerPop delay={6} style={{ top: base * 0.14, left: base * 0.09 }}>{star}</StickerPop>
          <StickerPop delay={10} style={{ top: base * 0.2, right: base * 0.1 }}><div style={{ color: accent, fontSize: base * 0.045, textShadow: `0 0 ${base * 0.025}px ${accent}` }}>✦</div></StickerPop>
          <StickerPop delay={14} style={{ top: base * 0.28, right: base * 0.22 }}><LocationPin size={base * 0.06} color={accent} /></StickerPop>
        </>
      )}
      {v === 3 && (
        <>
          <StickerPop delay={6} rotate={-8} style={{ top: base * 0.13, left: base * 0.08 }}><Arrow size={base * 0.13} color={accent} /></StickerPop>
          <StickerPop delay={12} style={{ top: base * 0.16, right: base * 0.1 }}>{star}</StickerPop>
        </>
      )}
    </>
  );
};

const PhotoSlide: React.FC<{
  src: string;
  caption?: string;
  index: number;
  slideCount: number;
  durationInFrames: number;
  accent: string;
  captionScale: number;
  energy: number;
}> = ({ src, caption, index, slideCount, durationInFrames, accent, captionScale, energy }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const centered = index % 3 === 2;
  // Instagram: alternate framed (whole photo on blurred backdrop) and polaroid —
  // both show the ENTIRE photo, never cropped. Just varied treatments.
  const IG_STYLES: IgStyle[] = ["contain", "polaroid", "contain", "polaroid", "contain", "polaroid"];
  const igStyle: IgStyle = energy > 0 ? IG_STYLES[index % IG_STYLES.length] : "contain";
  // polaroid carries its own handwritten caption; the others use the bottom caption.
  const bottomCaption = !!caption && igStyle !== "polaroid";
  // quick light flash on entrance (reads as a snappy, trendy cut) — brighter on Instagram
  const flash = interpolate(frame, [0, 2, 9], [energy > 0 ? 0.75 : 0.55, energy > 0 ? 0.4 : 0.32, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <PhotoLayer src={src} caption={caption} index={index} durationInFrames={durationInFrames} energy={energy} igStyle={igStyle} />
      <AbsoluteFill style={{ background: energy > 0 ? accent : "#eafff6", opacity: flash, mixBlendMode: "screen", pointerEvents: "none" }} />
      {/* scrim behind the bottom caption (polaroid carries its caption on the card, so no scrim) */}
      {bottomCaption || energy === 0 ? <Scrim /> : null}
      {energy > 0 ? (
        <>
          <StickerSet index={index} accent={accent} base={base} />
        </>
      ) : null}
      {bottomCaption || (caption && energy === 0) ? (
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
  index: number;
  slideCount: number;
  durationInFrames: number;
  accent: string;
  bg: string;
  captionScale: number;
  energy: number;
}> = ({ images, caption, index, slideCount, durationInFrames, accent, bg, captionScale, energy }) => {
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
      <AbsoluteFill style={{ background: energy > 0 ? accent : "#eafff6", opacity: flash, mixBlendMode: "screen", pointerEvents: "none" }} />
      {energy > 0 ? (
        <>
          <Sparkle accent={accent} size={base * 0.045} style={{ top: base * 0.16, right: base * 0.08 }} />
        </>
      ) : null}
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
  // Size fonts/vertical spacing by the SHORTER side so landscape (16:9) doesn't blow up.
  const base = Math.min(width, height);
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
        <div style={{ opacity: s(0), transform: `translateY(${interpolate(s(0), [0, 1], [24, 0])}px)`, marginBottom: base * 0.055 }}>
          <Lockup fontSize={Math.round(base * 0.088)} color={props.accent} wordmark={props.wordmark} logoImage={props.logoImage} useBuiltinMark={props.useBuiltinMark} />
        </div>
        <WordReveal
          text={props.title}
          startFrame={8}
          style={{
            fontFamily: DISPLAY,
            color: "#fff",
            fontSize: Math.round(base * 0.094),
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
            fontSize: Math.round(base * 0.034),
            marginTop: base * 0.035,
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
  // Size fonts/vertical spacing by the SHORTER side so landscape (16:9) text isn't oversized.
  const base = Math.min(width, height);

  // cursor approaches the pill, then clicks
  const CLICK = 58;
  const approach = spring({ frame: frame - 40, fps, config: { damping: 16, stiffness: 120, mass: 0.8 } });
  const ax = (1 - approach) * base * 0.12;
  const ay = (1 - approach) * base * 0.1;
  const dip = interpolate(frame, [CLICK - 1, CLICK + 1, CLICK + 4], [0, base * 0.012, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cursorOpacity = interpolate(frame, [34, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const press = interpolate(frame, [CLICK - 2, CLICK, CLICK + 9], [1, 0.93, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glow = interpolate(frame, [CLICK, CLICK + 18], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rippleScale = interpolate(frame, [CLICK, CLICK + 20], [0.2, 5.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rippleOpacity = interpolate(frame, [CLICK, CLICK + 20], [0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cursorSize = base * 0.07;

  return (
    <AbsoluteFill style={{ backgroundColor: props.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 100%, ${props.accent}33 0%, ${props.bg} 55%)` }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", padding: `0 ${width * 0.08}px` }}>
        <div style={{ opacity: s(0), transform: `scale(${interpolate(s(0), [0, 1], [0.82, 1])})` }}>
          <Lockup fontSize={Math.round(base * 0.16)} color={props.accent} wordmark={props.wordmark} logoImage={props.logoImage} useBuiltinMark={props.useBuiltinMark} />
        </div>
        <div
          style={{
            opacity: s(10),
            transform: `translateY(${interpolate(s(10), [0, 1], [28, 0])}px)`,
            fontFamily: DISPLAY,
            color: "#fff",
            fontSize: Math.round(base * 0.072),
            textTransform: "uppercase",
            lineHeight: 1.02,
            marginTop: base * 0.045,
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
            fontSize: Math.round(base * 0.032),
            marginTop: base * 0.022,
            maxWidth: "85%",
          }}
        >
          {props.ctaSub}
        </div>

        {/* website pill + clicking cursor */}
        <div style={{ position: "relative", display: "inline-block", marginTop: base * 0.06, opacity: s(24) }}>
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 800,
              color: "#0B121F",
              background: props.accent,
              fontSize: Math.round(base * 0.034),
              padding: `${base * 0.021}px ${base * 0.05}px`,
              borderRadius: 999,
              transform: `scale(${press})`,
              boxShadow: `0 0 ${base * 0.06 * glow}px ${props.accent}, 0 ${base * 0.01}px ${base * 0.03}px rgba(0,0,0,0.4)`,
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
              width: base * 0.05,
              height: base * 0.05,
              marginLeft: -(base * 0.025),
              marginTop: -(base * 0.025),
              borderRadius: "50%",
              border: `${Math.max(2, base * 0.004)}px solid ${props.accent}`,
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
    // cycle punchy cuts: zoom-blur, then fast directional whip-slides
    const cuts = [
      zoomBlur,
      () => slide({ direction: "from-right" }) as TransitionPresentation<Record<string, unknown>>,
      () => slide({ direction: "from-bottom" }) as TransitionPresentation<Record<string, unknown>>,
      () => slide({ direction: "from-left" }) as TransitionPresentation<Record<string, unknown>>,
    ];
    return cuts[i % cuts.length]();
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
                  index={i}
                  slideCount={props.slides.length}
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
                  slideCount={props.slides.length}
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
