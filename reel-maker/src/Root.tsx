import React from "react";
import { Composition } from "remotion";
import { WstiReel } from "./WstiReel";
import { calculateMetadata, defaultProps, FPS } from "./schema";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="WstiReel"
      component={WstiReel}
      durationInFrames={900}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={defaultProps}
      calculateMetadata={calculateMetadata}
    />
  );
};
