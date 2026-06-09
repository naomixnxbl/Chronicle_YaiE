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
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import type { ReelProps } from "../schema";
import type { TemplateSpec, SlideProps } from "./_types";
import {
  Arrow,
  Cursor,
  DISPLAY,
  HAND,
  Lockup,
  LocationPin,
  SANS,
  Scrim,
  Sparkle,
  StickerPop,
  WordReveal,
  Vignette,
  zoomBlur,
} from "./_shared";

// ---------- photo + caption ----------

type IgStyle = "polaroid" | "contain";
// The WHOLE photo is always visible — contained inside the frame with a
// blurred zoomed copy of itself filling the empty bars. No part of the photo
// is ever cut (especially important for horizontal photos in 9:16 reels).
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
  const base = Math.min(width, height);
  // Backdrop: a blurred, pumped-up cover copy that drifts behind the contained foreground.
  const bgRange = energy > 0 ? [1.22, 1.42] : [1.18, 1.32];
  const bgScale = interpolate(frame, [0, durationInFrames], zoomIn ? bgRange : [bgRange[1], bgRange[0]], { extrapolateRight: "clamp" });
  const bgPan = interpolate(frame, [0, durationInFrames], zoomIn ? [-2.5, 2.5] : [2.5, -2.5], { extrapolateRight: "clamp" });
  // Foreground stays <= 1 so the contained photo is never clipped.
  const fgScale = interpolate(frame, [0, durationInFrames], zoomIn ? [0.94, 1.0] : [1.0, 0.94], { extrapolateRight: "clamp" });
  const tilt = zoomIn ? -2.5 : 2.5;
  const slam = energy > 0 ? spring({ frame, fps, config: { damping: 11, stiffness: 130, mass: 0.7 } }) : 1;
  const cardRot = interpolate(slam, [0, 1], [tilt * 3.5, tilt]);
  const cardScale = interpolate(slam, [0, 1], [1.18, 1]);
  const capReveal = spring({ frame: frame - 12, fps, config: { damping: 200, mass: 0.6 } });
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#070b14" }}>
      {/* Blurred backdrop fill — keeps the bars looking intentional instead of dead black. */}
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
        ) : (
          // Contained foreground — whole photo visible, never cropped.
          <Img
            src={src}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              transform: `scale(${fgScale})`,
              filter: energy > 0
                ? "drop-shadow(0 24px 60px rgba(0,0,0,0.65)) saturate(1.2) contrast(1.05)"
                : "drop-shadow(0 24px 60px rgba(0,0,0,0.6))",
            }}
          />
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

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

  const base = Math.min(width, height);
  const isWide = width > height;
  const energyScale = energy > 0 ? 1.22 : 1;
  const font = variant === 2 ? SANS : DISPLAY;
  const size = (variant === 0 ? base * 0.06 : variant === 1 ? base * 0.054 : base * 0.046) * captionScale * energyScale;
  const centered = variant === 2;
  const maxW = centered ? "82%" : isWide ? "60%" : "90%";
  const barReveal = spring({ frame: frame - 4, fps, config: { damping: 200, mass: 0.5 } });
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
          const delay = energy > 0 ? 4 + i * 2 : 6 + i * 3;
          const e = spring({ frame: frame - delay, fps, config: { damping: 200, mass: 0.5 } });
          const wy = interpolate(e, [0, 1], [42, 0]);
          const wb = interpolate(e, [0, 1], [9, 0]);
          const scalePop = energy > 0
            ? interpolate(frame, [delay, delay + 3, delay + 10], [1.5, 1.1, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
            : 1;
          const justLanded = energy > 0 && frame >= delay + 1 && frame < delay + 11;
          const highlight = variant === 1 && i === words.length - 1;
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
  durationInFrames: number;
  accent: string;
  captionScale: number;
  energy: number;
}> = ({ src, caption, index, durationInFrames, accent, captionScale, energy }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const centered = index % 3 === 2;
  // Every slide shows the WHOLE photo (contained) on a blurred backdrop fill —
  // horizontal pics in 9:16 reels stay uncropped (this matches the look the
  // user explicitly asked for; the "edge-to-edge cover" experiment was reverted).
  const flash = interpolate(frame, [0, 2, 9], [energy > 0 ? 0.75 : 0.55, energy > 0 ? 0.4 : 0.32, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <PhotoLayer src={src} caption={caption} index={index} durationInFrames={durationInFrames} energy={energy} igStyle="contain" />
      <AbsoluteFill style={{ background: energy > 0 ? accent : "#eafff6", opacity: flash, mixBlendMode: "screen", pointerEvents: "none" }} />
      <Scrim />
      {energy > 0 ? <StickerSet index={index} accent={accent} base={base} /> : null}
      {caption ? (
        <AbsoluteFill
          style={{
            justifyContent: "flex-end",
            alignItems: centered ? "center" : "flex-start",
            padding: `0 ${base * 0.06}px ${base * 0.08}px`,
          }}
        >
          <AnimatedCaption text={caption} index={index} durationInFrames={durationInFrames} accent={accent} captionScale={captionScale} energy={energy} />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

const DuoSlide: React.FC<{
  images: string[];
  caption?: string;
  index: number;
  durationInFrames: number;
  accent: string;
  bg: string;
  captionScale: number;
  energy: number;
}> = ({ images, caption, index, durationInFrames, accent, bg, captionScale, energy }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const base = Math.min(width, height);
  const stacked = height >= width;
  const flash = interpolate(frame, [0, 2, 9], [energy > 0 ? 0.7 : 0.5, energy > 0 ? 0.38 : 0.3, 0], { extrapolateRight: "clamp" });

  const inA = spring({ frame: frame - 3, fps, config: { damping: 200, mass: 0.7 } });
  const inB = spring({ frame: frame - 7, fps, config: { damping: 200, mass: 0.7 } });
  const capIn = spring({ frame: frame - 12, fps, config: { damping: 200, mass: 0.6 } });
  // gentle scale drift (<=1, never crops the contained photo)
  const drift = interpolate(frame, [0, durationInFrames], [0.97, 1.0], { extrapolateRight: "clamp" });
  const offA = interpolate(inA, [0, 1], [stacked ? -50 : -60, 0]);
  const offB = interpolate(inB, [0, 1], [stacked ? 50 : 60, 0]);

  const half: React.CSSProperties = { flex: 1, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" };
  const imgStyle = (off: number, op: number): React.CSSProperties => ({
    width: "100%",
    height: "100%",
    objectFit: "contain",
    opacity: op,
    transform: `translate${stacked ? "Y" : "X"}(${off}px) scale(${drift})`,
    filter: energy > 0 ? "drop-shadow(0 18px 44px rgba(0,0,0,0.55)) saturate(1.28) contrast(1.07)" : "drop-shadow(0 18px 44px rgba(0,0,0,0.55))",
  });

  const capSize = base * 0.05 * captionScale * (energy > 0 ? 1.2 : 1);
  const ruleLen = base * 0.07;

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      {/* faint blurred wash from the first image for cohesion */}
      <Img src={images[0]} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(60px) brightness(0.35) saturate(1.1)", opacity: 0.5 }} />
      <AbsoluteFill style={{ flexDirection: stacked ? "column" : "row", padding: base * 0.045, gap: base * 0.02 }}>
        <div style={half}><Img src={images[0]} style={imgStyle(offA, inA)} /></div>
        {/* elegant caption band BETWEEN the two contained photos */}
        <div style={{ opacity: capIn, display: "flex", flexDirection: stacked ? "row" : "column", alignItems: "center", justifyContent: "center", gap: base * 0.025, padding: `${base * 0.01}px 0` }}>
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
        <div style={half}><Img src={images[1]} style={imgStyle(offB, inB)} /></div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: energy > 0 ? accent : "#eafff6", opacity: flash, mixBlendMode: "screen", pointerEvents: "none" }} />
      {energy > 0 ? <Sparkle accent={accent} size={base * 0.045} style={{ top: base * 0.16, right: base * 0.08 }} /> : null}
      <Vignette />
    </AbsoluteFill>
  );
};

// ---------- slot components ----------

const Intro: React.FC<{ props: ReelProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = (d: number) => spring({ frame: frame - d, fps, config: { damping: 200 } });
  const isWide = width > height;
  const base = Math.min(width, height);
  return (
    <AbsoluteFill style={{ backgroundColor: props.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 8%, ${props.accent}26 0%, ${props.bg} 58%)` }} />
      <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${width * 0.08}px`, alignItems: isWide ? "center" : "flex-start", textAlign: isWide ? "center" : "left" }}>
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
        <div style={{ opacity: s(20), transform: `translateY(${interpolate(s(20), [0, 1], [24, 0])}px)`, fontFamily: SANS, fontWeight: 600, color: "rgba(255,255,255,0.82)", fontSize: Math.round(base * 0.034), marginTop: base * 0.035 }}>
          {props.subtitle}
        </div>
      </AbsoluteFill>
      <Vignette />
    </AbsoluteFill>
  );
};

const Outro: React.FC<{ props: ReelProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = (d: number) => spring({ frame: frame - d, fps, config: { damping: 200 } });
  const isWide = width > height;
  const base = Math.min(width, height);

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
        <div style={{ opacity: s(10), transform: `translateY(${interpolate(s(10), [0, 1], [28, 0])}px)`, fontFamily: DISPLAY, color: "#fff", fontSize: Math.round(base * 0.072), textTransform: "uppercase", lineHeight: 1.02, marginTop: base * 0.045, maxWidth: isWide ? "72%" : "100%" }}>
          {props.ctaHeadline}
        </div>
        <div style={{ opacity: s(18), fontFamily: SANS, fontWeight: 600, color: "rgba(255,255,255,0.8)", fontSize: Math.round(base * 0.032), marginTop: base * 0.022, maxWidth: "85%" }}>
          {props.ctaSub}
        </div>

        <div style={{ position: "relative", display: "inline-block", marginTop: base * 0.06, opacity: s(24) }}>
          <div style={{ fontFamily: SANS, fontWeight: 800, color: "#0B121F", background: props.accent, fontSize: Math.round(base * 0.034), padding: `${base * 0.021}px ${base * 0.05}px`, borderRadius: 999, transform: `scale(${press})`, boxShadow: `0 0 ${base * 0.06 * glow}px ${props.accent}, 0 ${base * 0.01}px ${base * 0.03}px rgba(0,0,0,0.4)` }}>
            {props.website}
          </div>
          <div style={{ position: "absolute", left: "62%", top: "52%", width: base * 0.05, height: base * 0.05, marginLeft: -(base * 0.025), marginTop: -(base * 0.025), borderRadius: "50%", border: `${Math.max(2, base * 0.004)}px solid ${props.accent}`, transform: `scale(${rippleScale})`, opacity: rippleOpacity, pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: "60%", top: "38%", opacity: cursorOpacity, transform: `translate(${ax}px, ${ay + dip}px)`, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))" }}>
            <Cursor size={cursorSize} />
          </div>
        </div>
      </AbsoluteFill>
      <Vignette />

      <Sequence from={CLICK}>
        <Html5Audio src={staticFile("sfx/click.wav")} volume={0.85} />
      </Sequence>
    </AbsoluteFill>
  );
};

const Slide: React.FC<SlideProps> = ({ slide, index, durationInFrames, props }) => {
  const energy = 1;
  if (slide.images.length >= 2) {
    return (
      <DuoSlide
        images={slide.images}
        caption={slide.caption}
        index={index}
        durationInFrames={durationInFrames}
        accent={props.accent}
        bg={props.bg}
        captionScale={props.captionScale}
        energy={energy}
      />
    );
  }
  return (
    <PhotoSlide
      src={slide.images[0]}
      caption={slide.caption}
      index={index}
      durationInFrames={durationInFrames}
      accent={props.accent}
      captionScale={props.captionScale}
      energy={energy}
    />
  );
};

const transition = (i: number): TransitionPresentation<Record<string, unknown>> => {
  const cuts = [
    zoomBlur,
    () => slide({ direction: "from-right" }) as TransitionPresentation<Record<string, unknown>>,
    () => slide({ direction: "from-bottom" }) as TransitionPresentation<Record<string, unknown>>,
    () => slide({ direction: "from-left" }) as TransitionPresentation<Record<string, unknown>>,
  ];
  // Unused 'wipe' alternative kept here for parity with the legacy code path.
  void wipe;
  return cuts[i % cuts.length]();
};

export const signatureSpec: TemplateSpec = {
  Intro,
  Slide,
  Outro,
  transition,
};
