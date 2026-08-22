import React from "react";
import { Composition } from "remotion";
import { VideoMobile } from "./Video";
import { VideoDesktop } from "./VideoDesktop";

const FPS = 30;
const DUR = 885; // 29.5s

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="VideoMobile" component={VideoMobile} durationInFrames={DUR} fps={FPS} width={1080} height={1920} />
    <Composition id="VideoDesktop" component={VideoDesktop} durationInFrames={DUR} fps={FPS} width={1920} height={1080} />
  </>
);
