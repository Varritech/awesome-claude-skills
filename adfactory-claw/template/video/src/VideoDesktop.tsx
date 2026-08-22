import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Audio,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  OffthreadVideo,
  Loop,
  Easing,
} from "remotion";
import { Bell } from "lucide-react";
import { AD } from "./adcopy";

const CHARTREUSE = AD.brand.accent;
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const INDIGO_DEEP = AD.brand.indigoDeep;
const ELECTRIC_INDIGO = AD.brand.electricIndigo;

type ExtendedCSSProperties = React.CSSProperties & { paintOrder?: string };

const HookCardDesktop: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: frame - 2, fps, config: { damping: 10, mass: 0.5, stiffness: 280 } });
  const scale = interpolate(sp, [0, 1], [0.5, 1.0]);

  const textStyle: ExtendedCSSProperties = {
    fontFamily: '"Anton", "Impact", "Arial Black", sans-serif',
    fontWeight: 900,
    textTransform: "uppercase" as const,
    lineHeight: 0.88,
    textAlign: "center" as const,
    color: CHARTREUSE,
    WebkitTextStroke: `5px ${BLACK}`,
    paintOrder: "stroke fill",
    display: "block",
  };

  return (
    <AbsoluteFill>
      <Loop durationInFrames={240}>
        <OffthreadVideo
          src={staticFile(AD.footage.rooftop)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          muted
        />
      </Loop>
      <AbsoluteFill style={{ background: "rgba(0,0,0,0.25)" }} />
      <div
        style={{
          position: "absolute",
          top: 34,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 45,
          transform: `scale(${scale})`,
          transformOrigin: "top center",
        }}
      >
        <span style={{ ...textStyle, fontSize: 107 } as React.CSSProperties}>{AD.hookLines[0]}</span>
        <span style={{ ...textStyle, fontSize: 81 } as React.CSSProperties}>{AD.hookLines[1]}</span>
        <span style={{ ...textStyle, fontSize: 90 } as React.CSSProperties}>{AD.hookLines[2]}</span>
      </div>
    </AbsoluteFill>
  );
};

const NotifCardDesktop: React.FC<{ sceneFrame: number }> = ({ sceneFrame }) => {
  const tx = interpolate(sceneFrame, [0, 15], [400, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 160,
        left: "50%",
        transform: `translateX(calc(-50% + ${tx}px))`,
        width: 820,
        backgroundColor: WHITE,
        borderRadius: 16,
        padding: "16px 22px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
      }}
    >
      <Bell size={30} color="#888888" strokeWidth={1.8} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 22, color: "#111111", fontFamily: "-apple-system, 'Helvetica Neue', sans-serif" }}>{AD.notif.app}</div>
        <div style={{ fontSize: 20, color: "#444444", fontFamily: "-apple-system, 'Helvetica Neue', sans-serif" }}>{AD.notif.line}</div>
      </div>
      <div style={{ fontSize: 18, color: "#888888", fontFamily: "-apple-system, 'Helvetica Neue', sans-serif" }}>now</div>
    </div>
  );
};

interface KaraokeWordD { text: string; highlight: boolean; }
interface KaraokePhraseD { words: KaraokeWordD[]; startFrame: number; }

const KaraokeCaptionDesktop: React.FC<{ phrases: KaraokePhraseD[]; sceneFrame: number }> = ({ phrases, sceneFrame }) => {
  let activePhrase: KaraokePhraseD | null = null;
  let activePhraseStart = 0;
  for (let i = phrases.length - 1; i >= 0; i--) {
    if (sceneFrame >= phrases[i].startFrame) {
      activePhrase = phrases[i];
      activePhraseStart = phrases[i].startFrame;
      break;
    }
  }
  if (!activePhrase) return null;
  const phraseFrame = sceneFrame - activePhraseStart;

  return (
    <div style={{ position: "absolute", top: "48%", left: 0, right: 0, display: "flex", flexWrap: "wrap" as const, justifyContent: "center", alignItems: "center", gap: 6, padding: "0 40px" }}>
      {activePhrase.words.map((word, i) => {
        const wordFrame = phraseFrame - i * 3;
        const s = Math.min(Math.max(wordFrame / 5, 0), 1);
        let wordScale: number;
        if (s < 0.5) { wordScale = interpolate(s, [0, 0.5], [0.7, 1.15]); }
        else { wordScale = interpolate(s, [0.5, 1.0], [1.15, 1.0]); }
        const opacity = wordFrame < 0 ? 0 : 1;
        return (
          <span key={i} style={{ display: "inline-block", fontFamily: '"Chakra Petch", "Impact", "Arial Black", sans-serif', fontWeight: 700, fontSize: 44, textTransform: "uppercase" as const, color: word.highlight ? CHARTREUSE : WHITE, textShadow: `2px 2px 0 ${BLACK}, -2px 2px 0 ${BLACK}, 2px -2px 0 ${BLACK}, -2px -2px 0 ${BLACK}, 0 4px 8px rgba(0,0,0,0.9)`, transform: `scale(${wordScale})`, opacity }}>
            {word.text}
          </span>
        );
      })}
    </div>
  );
};

const TalkingHeadBgD: React.FC<{ src: string }> = ({ src }) => (
  <Loop durationInFrames={240}>
    <OffthreadVideo src={staticFile(src)} style={{ width: 1920, height: 1080, objectFit: "cover" }} muted />
  </Loop>
);

const D_SCENE3: KaraokePhraseD[] = AD.scene3;
const D_SCENE4: KaraokePhraseD[] = AD.scene4;
const D_SCENE5: KaraokePhraseD[] = AD.scene5;
const D_SCENE6: KaraokePhraseD[] = AD.scene6;

const EndCardDesktop: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const s1 = spring({ frame: frame - 5, fps, config: { damping: 14, mass: 0.6 } });
  const s2 = spring({ frame: frame - 14, fps, config: { damping: 14, mass: 0.6 } });
  const s3 = spring({ frame: frame - 22, fps, config: { damping: 14, mass: 0.6 } });
  const ty1 = interpolate(s1, [0, 1], [40, 0]);
  const ty2 = interpolate(s2, [0, 1], [40, 0]);
  const ty3 = interpolate(s3, [0, 1], [40, 0]);

  const joinFreeStyle: ExtendedCSSProperties = {
    fontFamily: '"Anton", "Impact", "Arial Black", sans-serif',
    fontWeight: 900,
    fontSize: 101,
    color: CHARTREUSE,
    WebkitTextStroke: `5px ${BLACK}`,
    paintOrder: "stroke fill",
    textTransform: "uppercase" as const,
    lineHeight: 0.9,
    textAlign: "center" as const,
  };

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${INDIGO_DEEP} 0%, ${ELECTRIC_INDIGO} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        opacity: fadeIn,
      }}
    >
      <div style={{ transform: `translateY(${ty1}px)`, opacity: s1, fontFamily: '"Chakra Petch", "Arial Black", sans-serif', fontWeight: 700, fontSize: 38, color: WHITE, letterSpacing: 3, textTransform: "uppercase" as const }}>{AD.endCard.brandName}</div>
      <div style={{ transform: `translateY(${ty2}px)`, opacity: s2, ...(joinFreeStyle as React.CSSProperties) }}>{AD.endCard.cta}</div>
      <div style={{ transform: `translateY(${ty3}px)`, opacity: s3, fontFamily: '"Chakra Petch", "Arial Black", sans-serif', fontWeight: 500, fontSize: 29, color: WHITE }}>{AD.endCard.url}</div>
    </AbsoluteFill>
  );
};

export const VideoDesktop: React.FC = () => {
  // frame at root level = global frame (not reset by Sequence children)
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <Sequence from={0} durationInFrames={90}>
        <HookCardDesktop />
      </Sequence>
      <Sequence from={90} durationInFrames={90}>
        <AbsoluteFill>
          <Loop durationInFrames={240}><OffthreadVideo src={staticFile(AD.footage.dim)} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted /></Loop>
          <AbsoluteFill style={{ background: "rgba(0,0,0,0.35)" }} />
          {/* frame - 90: global frame 90-180, minus 90 gives 0-90 for the scene */}
          <NotifCardDesktop sceneFrame={frame - 90} />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={180} durationInFrames={90}>
        <AbsoluteFill>
          <TalkingHeadBgD src={AD.footage.ledge} />
          <AbsoluteFill style={{ background: "rgba(0,0,0,0.2)" }} />
          <KaraokeCaptionDesktop phrases={D_SCENE3} sceneFrame={frame - 180} />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={270} durationInFrames={180}>
        <AbsoluteFill>
          <TalkingHeadBgD src={AD.footage.desk} />
          <AbsoluteFill style={{ background: "rgba(0,0,0,0.2)" }} />
          <KaraokeCaptionDesktop phrases={D_SCENE4} sceneFrame={frame - 270} />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={450} durationInFrames={180}>
        <AbsoluteFill>
          <TalkingHeadBgD src={AD.footage.walking} />
          <AbsoluteFill style={{ background: "rgba(0,0,0,0.2)" }} />
          <KaraokeCaptionDesktop phrases={D_SCENE5} sceneFrame={frame - 450} />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={630} durationInFrames={180}>
        <AbsoluteFill>
          <TalkingHeadBgD src={AD.footage.twoshot} />
          <AbsoluteFill style={{ background: "rgba(0,0,0,0.2)" }} />
          <KaraokeCaptionDesktop phrases={D_SCENE6} sceneFrame={frame - 630} />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={810} durationInFrames={75}>
        <EndCardDesktop />
      </Sequence>
      <Audio src={staticFile("vo.mp3")} />
    </AbsoluteFill>
  );
};
