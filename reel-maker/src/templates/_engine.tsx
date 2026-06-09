import React from "react";
import {
  AbsoluteFill,
  Html5Audio,
  interpolate,
  useVideoConfig,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { type ReelProps, getTimeline, TRANSITION_FRAMES } from "../schema";
import type { TemplateSpec } from "./_types";
import {
  Grade,
  Grain,
  LightLeak,
  Letterbox,
  Particles,
  Vignette,
  Lockup,
} from "./_shared";

// Top-corner brand HUD shown across the whole video.
const TopBar: React.FC<{ props: ReelProps }> = ({ props }) => {
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

// The shared timeline shell. Each template plugs in its own Intro/Slide/Outro;
// the engine handles TransitionSeries math, audio loop, and overlays.
export const Engine: React.FC<{ props: ReelProps; spec: TemplateSpec }> = ({ props, spec }) => {
  // Allow per-template cadence to override the user-set value when present.
  const effectiveProps: ReelProps = spec.perPhotoSeconds
    ? { ...props, perPhotoSeconds: spec.perPhotoSeconds }
    : props;
  const { introF, outroF, slideFs, totalF } = getTimeline(effectiveProps);
  const t = linearTiming({ durationInFrames: TRANSITION_FRAMES });
  // "Energy" controls the punchier grade/particle treatment used by reels-style
  // templates regardless of aspect ratio.
  const energy = props.template === "signature" || props.template === "polaroid" ? 1 : 0;

  const overlays = spec.overlays || {};
  const showGrain = overlays.grain !== false;
  const showGrade = overlays.grade !== false;
  const showLightLeak = overlays.lightLeak !== false;
  const showParticles = overlays.particles !== false;
  const showVignette = overlays.vignette !== false;
  const showTopBar = overlays.topBar !== false;
  const showLetterbox = overlays.letterbox === true;

  const introTransition = spec.introTransition
    ? spec.introTransition()
    : slide({ direction: "from-bottom" });

  const Intro = spec.Intro;
  const Slide = spec.Slide;
  const Outro = spec.Outro;

  return (
    <AbsoluteFill style={{ backgroundColor: props.bg }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={introF}>
          <Intro props={effectiveProps} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={introTransition} timing={t} />

        {effectiveProps.slides.map((s, i) => (
          <React.Fragment key={i}>
            <TransitionSeries.Sequence durationInFrames={slideFs[i]}>
              <Slide
                slide={s}
                index={i}
                slideCount={effectiveProps.slides.length}
                durationInFrames={slideFs[i]}
                props={effectiveProps}
              />
            </TransitionSeries.Sequence>
            <TransitionSeries.Transition presentation={spec.transition(i)} timing={t} />
          </React.Fragment>
        ))}

        <TransitionSeries.Sequence durationInFrames={outroF}>
          <Outro props={effectiveProps} />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {showGrade ? <Grade intensity={props.grade} accent={props.accent} energy={energy} /> : null}
      {showLightLeak ? <LightLeak accent={props.accent} intensity={props.lightLeak * (energy > 0 ? 1.6 : 1)} /> : null}
      {showParticles && props.particles ? <Particles accent={props.accent} energy={energy} /> : null}
      {showVignette ? <Vignette /> : null}
      {showGrain ? <Grain intensity={props.grain} /> : null}
      {showLetterbox ? <Letterbox ratio={0.085} /> : null}

      {showTopBar ? <TopBar props={effectiveProps} /> : null}

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
