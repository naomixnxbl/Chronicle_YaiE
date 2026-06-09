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
import type { TransitionPresentation } from "@remotion/transitions";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";

// Fonts loaded once and shared across templates so we don't double-fetch.
export const { fontFamily: DISPLAY } = loadAnton();
export const { fontFamily: SANS } = loadInter("normal", {
  weights: ["400", "600", "800"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});
export const { fontFamily: BRAND } = loadMontserrat("normal", {
  weights: ["800"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});
export const { fontFamily: HAND } = loadCaveat("normal", {
  weights: ["600", "700"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});
export const { fontFamily: SERIF } = loadPlayfair("normal", {
  weights: ["400", "700", "800"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

export type Aspect = "portrait" | "square" | "landscape";

// Templates use this to branch layout — e.g. polaroid stacks vertically at 9:16
// and arranges horizontally at 16:9.
export const useAspect = (): Aspect => {
  const { width, height } = useVideoConfig();
  if (Math.abs(width - height) < 4) return "square";
  return width > height ? "landscape" : "portrait";
};

// ---------- brand mark + lockup ----------

export const WstiMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" fill="none" style={{ display: "block" }}>
    <path d="M54 30 H92 V68" stroke={color} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M28 52 H66 V90" stroke={color} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Lockup: React.FC<{
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

// ---------- overlays (used by the engine on top of every slide) ----------

export const Grain: React.FC<{ intensity: number }> = ({ intensity }) => {
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

export const LightLeak: React.FC<{ accent: string; intensity: number }> = ({ accent, intensity }) => {
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

// energy>0 = Signature/Polaroid (Reels-style punchy grade with sheen).
// energy=0 = restrained cinematic teal/warm.
export const Grade: React.FC<{ intensity: number; accent: string; energy: number }> = ({ intensity, accent, energy }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (intensity <= 0) return null;
  if (energy > 0) {
    const t = frame / fps;
    const sheen = 50 + Math.sin(t * 0.6) * 60;
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

export const Vignette: React.FC = () => (
  <AbsoluteFill style={{ boxShadow: "inset 0 0 360px rgba(0,0,0,0.6)", pointerEvents: "none" }} />
);

// Letterbox bars — documentary template uses these for the cinematic 2.39:1 feel.
export const Letterbox: React.FC<{ ratio?: number }> = ({ ratio = 0.1 }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: `${ratio * 100}%`, background: "#000" }} />
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${ratio * 100}%`, background: "#000" }} />
  </AbsoluteFill>
);

export const Particles: React.FC<{ accent: string; energy: number }> = ({ accent, energy }) => {
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

// ---------- stickers + word reveal (signature/polaroid use these) ----------

export const Sparkle: React.FC<{ accent: string; size: number; style?: React.CSSProperties }> = ({ accent, size, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tw = 0.5 + 0.5 * Math.sin((frame / fps) * 6);
  const rot = (frame / fps) * 35;
  return (
    <div style={{ position: "absolute", color: accent, fontSize: size, lineHeight: 1, opacity: 0.25 + 0.6 * tw, transform: `rotate(${rot}deg)`, textShadow: `0 0 ${size * 0.5}px ${accent}`, pointerEvents: "none", zIndex: 5, ...style }}>✦</div>
  );
};

export const StickerPop: React.FC<{ delay: number; rotate?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ delay, rotate = 0, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 9, stiffness: 150, mass: 0.6 } });
  const sc = interpolate(s, [0, 1], [0, 1]);
  const wobble = Math.sin((frame / fps) * 3 + delay) * 2;
  return (
    <div style={{ position: "absolute", transform: `scale(${sc}) rotate(${rotate + wobble}deg)`, opacity: s > 0.03 ? 1 : 0, pointerEvents: "none", zIndex: 6, ...style }}>
      {children}
    </div>
  );
};

export const LocationPin: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.5))" }}>
    <path d="M12 2C7.6 2 4 5.6 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4.4-3.6-8-8-8z" fill={color} stroke="#fff" strokeWidth={1.3} />
    <circle cx="12" cy="10" r="3.1" fill="#fff" />
  </svg>
);

export const Arrow: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{ display: "block", filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.5))" }}>
    <path d="M50 12 C 30 14, 16 26, 15 48" stroke={color} strokeWidth={5} strokeLinecap="round" />
    <path d="M15 48 L 8 38 M15 48 L 27 44" stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const WordReveal: React.FC<{ text: string; startFrame: number; style: React.CSSProperties }> = ({ text, startFrame, style }) => {
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

// ---------- custom transition: zoom-blur (Signature reels-style cut) ----------

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

export const zoomBlur = (): TransitionPresentation<Record<string, unknown>> =>
  ({ component: ZoomBlur, props: {} } as unknown as TransitionPresentation<Record<string, unknown>>);

// ---------- cursor + click ripple (used by signature outro) ----------

export const Cursor: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
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

// ---------- common photo helpers ----------

// Renders a photo full-frame using `contain` (never crops) on top of a blurred
// pumped-up copy of itself as the backdrop. This is the cinematic standard —
// the WHOLE photo is always visible, and the empty space around it gets filled
// with a soft, slowly-moving blurred version of the same image instead of black
// bars. Used by every template that wants edge-to-edge fill without cropping.
export const PhotoOnBlurredBackdrop: React.FC<{
  src: string;
  index: number;
  durationInFrames: number;
  energy?: number;
  // Optional: override the backdrop filter (e.g. set saturation=0 for the Mono template).
  bgFilter?: string;
  // Optional: override the foreground filter (e.g. grayscale, contrast tweak).
  fgFilter?: string;
  // Optional: tint colour to wash over the backdrop (e.g. accent colour at low opacity).
  bgTint?: string;
  // Optional: how much the foreground photo can scale (1 = no scale). Defaults to a tiny 0.97→1.0 drift.
  fgScaleRange?: [number, number];
}> = ({ src, index, durationInFrames, energy = 0, bgFilter, fgFilter, bgTint, fgScaleRange }) => {
  const frame = useCurrentFrame();
  const zoomIn = index % 2 === 0;
  const bgRange = energy > 0 ? [1.22, 1.42] : [1.18, 1.32];
  const bgScale = interpolate(frame, [0, durationInFrames], zoomIn ? bgRange : [bgRange[1], bgRange[0]], {
    extrapolateRight: "clamp",
  });
  const bgPan = interpolate(frame, [0, durationInFrames], zoomIn ? [-2.5, 2.5] : [2.5, -2.5], {
    extrapolateRight: "clamp",
  });
  // Foreground stays <= 1 so the contained photo is never clipped.
  const [s0, s1] = fgScaleRange ?? (zoomIn ? [0.97, 1.0] : [1.0, 0.97]);
  const fgScale = interpolate(frame, [0, durationInFrames], [s0, s1], { extrapolateRight: "clamp" });
  return (
    <>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${bgScale}) translateX(${bgPan}%)`,
          filter: bgFilter || `blur(28px) brightness(0.5) saturate(${energy > 0 ? 1.4 : 1.15})`,
        }}
      />
      <AbsoluteFill style={{ background: bgTint || "rgba(7,11,20,0.32)" }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            transform: `scale(${fgScale})`,
            filter: fgFilter || "drop-shadow(0 24px 60px rgba(0,0,0,0.6))",
          }}
        />
      </AbsoluteFill>
    </>
  );
};

// Soft scrim behind bottom captions on dark photo backgrounds.
export const Scrim: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "linear-gradient(to top, rgba(7,11,20,0.96) 0%, rgba(7,11,20,0.6) 24%, rgba(7,11,20,0) 54%)," +
        "linear-gradient(to bottom, rgba(7,11,20,0.5) 0%, rgba(7,11,20,0) 18%)",
    }}
  />
);

// ---------- sound design helpers ----------

// Plays a single short sound stamp (one click.wav burst) at the given frame.
// Used for snaps, slams, polaroid drops, slide cuts.
export const SoundStamp: React.FC<{
  at: number;
  src?: string;
  volume?: number;
  durationFrames?: number;
}> = ({ at, src = "sfx/click.wav", volume = 0.7, durationFrames = 6 }) => (
  <Sequence from={at} durationInFrames={durationFrames}>
    <Html5Audio src={staticFile(src)} volume={volume} />
  </Sequence>
);

// A typewriter caption — reveals one character at a time and plays a tiny
// "key clack" sound for each non-space character. The whole line lands with
// a blinking cursor while typing, then holds (or fades out for the slide cut).
export const TypewriterCaption: React.FC<{
  text: string;
  startFrame: number;
  charsPerFrame?: number; // higher = faster typing. Default ~0.5 (2 frames/char @ 30fps = ~15 chars/sec)
  style?: React.CSSProperties;
  cursorColor?: string;
  withSound?: boolean;
  soundVolume?: number;
  durationInFrames?: number; // for the out-fade
  outFadeFrames?: number; // how many frames to fade at the end (0 = hold to end)
}> = ({
  text,
  startFrame,
  charsPerFrame = 0.5,
  style,
  cursorColor,
  withSound = true,
  soundVolume = 0.18,
  durationInFrames,
  outFadeFrames = 16,
}) => {
  const frame = useCurrentFrame();
  const chars = [...(text || "")];
  const elapsed = Math.max(0, frame - startFrame);
  const charsShown = Math.min(chars.length, Math.floor(elapsed * charsPerFrame));
  const visible = chars.slice(0, charsShown).join("");
  const typing = charsShown < chars.length;
  // Blinking cursor while typing, also brief blinks after typing completes.
  const blink = Math.floor(elapsed / 8) % 2 === 0;
  const showCursor = typing || (chars.length > 0 && blink && elapsed < chars.length / charsPerFrame + 30);

  // Out-fade so the line gracefully exits before the slide cut.
  const outOpacity = (durationInFrames && outFadeFrames > 0)
    ? interpolate(frame, [durationInFrames - outFadeFrames, durationInFrames - 2], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;

  return (
    <>
      <div style={{ ...style, opacity: (style?.opacity ?? 1) as number * outOpacity }}>
        {visible}
        {showCursor ? (
          <span style={{ display: "inline-block", marginLeft: 2, color: cursorColor || (style?.color as string) || "#000", opacity: blink ? 1 : 0.2 }}>
            ▍
          </span>
        ) : null}
      </div>
      {withSound
        ? chars.map((c, i) => {
            if (c === " " || c === "\n") return null; // no clack on whitespace
            const at = startFrame + Math.floor(i / charsPerFrame);
            return <SoundStamp key={i} at={at} volume={soundVolume} durationFrames={3} />;
          })
        : null}
    </>
  );
};
