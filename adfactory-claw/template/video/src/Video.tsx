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

// ── BRAND CONSTANTS ──────────────────────────────────────────────────────────
const CHARTREUSE = AD.brand.accent;
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const INDIGO_DEEP = AD.brand.indigoDeep;
const ELECTRIC_INDIGO = AD.brand.electricIndigo;

// paintOrder is a valid CSS property but not in React.CSSProperties type
type ExtendedCSSProperties = React.CSSProperties & { paintOrder?: string };

// ── HOOK CARD ─────────────────────────────────────────────────────────────────
// Scene 1: big 3-line text, Anton font, chartreuse fill + thick black stroke
const HookCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const s = spring({ frame: frame - 2, fps, config: { damping: 10, mass: 0.5, stiffness: 280 } });
  const scale = interpolate(s, [0, 1], [0.5, 1.0]);

  const textStyle: ExtendedCSSProperties = {
    fontFamily: '"Anton", "Impact", "Arial Black", sans-serif',
    fontWeight: 900,
    textTransform: "uppercase" as const,
    lineHeight: 0.88,
    textAlign: "center" as const,
    color: CHARTREUSE,
    WebkitTextStroke: `9px ${BLACK}`,
    paintOrder: "stroke fill",
    display: "block",
  };

  return (
    <AbsoluteFill>
      {/* Background: rooftop wide Veo3 clip */}
      <Loop durationInFrames={240}>
        <OffthreadVideo
          src={staticFile(AD.footage.rooftop)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          muted
        />
      </Loop>

      {/* Dark overlay to improve text readability */}
      <AbsoluteFill style={{ background: "rgba(0,0,0,0.25)" }} />

      {/* Hook text */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 80,
          transform: `scale(${scale})`,
          transformOrigin: "top center",
        }}
      >
        <span style={textStyle as React.CSSProperties & { fontSize: number }}>
          <span style={{ fontSize: 190 }}>{AD.hookLines[0]}</span>
        </span>
        <span style={{ ...textStyle, fontSize: 145 } as React.CSSProperties}>{AD.hookLines[1]}</span>
        <span style={{ ...textStyle, fontSize: 160 } as React.CSSProperties}>{AD.hookLines[2]}</span>
      </div>
    </AbsoluteFill>
  );
};

// ── NOTIFICATION CARD ─────────────────────────────────────────────────────────
// iOS-style white push notification card
interface NotifCardProps {
  sceneFrame: number; // frame relative to scene start
}
const NotifCard: React.FC<NotifCardProps> = ({ sceneFrame }) => {
  const tx = interpolate(sceneFrame, [0, 15], [500, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 280,
        left: "50%",
        transform: `translateX(calc(-50% + ${tx}px))`,
        width: 900,
        backgroundColor: WHITE,
        borderRadius: 22,
        padding: "22px 28px",
        display: "flex",
        alignItems: "center",
        gap: 18,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
      }}
    >
      <Bell size={44} color="#888888" strokeWidth={1.8} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 32, color: "#111111", fontFamily: "-apple-system, 'Helvetica Neue', sans-serif" }}>
          {AD.notif.app}
        </div>
        <div style={{ fontSize: 30, color: "#444444", fontFamily: "-apple-system, 'Helvetica Neue', sans-serif" }}>
          {AD.notif.line}
        </div>
      </div>
      <div style={{ fontSize: 28, color: "#888888", fontFamily: "-apple-system, 'Helvetica Neue', sans-serif" }}>
        now
      </div>
    </div>
  );
};

// ── KARAOKE CAPTION ───────────────────────────────────────────────────────────
interface KaraokeWord {
  text: string;
  highlight: boolean;
}

interface KaraokePhrase {
  words: KaraokeWord[];
  startFrame: number; // relative to scene start
}

interface KaraokeCaptionProps {
  phrases: KaraokePhrase[];
  sceneFrame: number;
}

const KaraokeCaption: React.FC<KaraokeCaptionProps> = ({ phrases, sceneFrame }) => {
  // Find the active phrase
  let activePhrase: KaraokePhrase | null = null;
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
    <div
      style={{
        position: "absolute",
        top: "48%",
        left: 0,
        right: 0,
        display: "flex",
        flexWrap: "wrap" as const,
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        padding: "0 40px",
      }}
    >
      {activePhrase.words.map((word, i) => {
        // 3-frame stagger; faster 5-frame pop from a legible floor (0.7) so a
        // word is never tiny/illegible on the instant a new phrase begins.
        const wordFrame = phraseFrame - i * 3;
        const s = Math.min(Math.max(wordFrame / 5, 0), 1);
        // scale: 0 -> 0.7, 0.5 -> 1.15, 1.0 -> 1.0
        let wordScale: number;
        if (s < 0.5) {
          wordScale = interpolate(s, [0, 0.5], [0.7, 1.15]);
        } else {
          wordScale = interpolate(s, [0.5, 1.0], [1.15, 1.0]);
        }
        const opacity = wordFrame < 0 ? 0 : 1;

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              fontFamily: '"Chakra Petch", "Impact", "Arial Black", sans-serif',
              fontWeight: 700,
              fontSize: 78,
              textTransform: "uppercase" as const,
              color: word.highlight ? CHARTREUSE : WHITE,
              textShadow: `2px 2px 0 ${BLACK}, -2px 2px 0 ${BLACK}, 2px -2px 0 ${BLACK}, -2px -2px 0 ${BLACK}, 0 4px 12px rgba(0,0,0,0.9)`,
              transform: `scale(${wordScale})`,
              opacity,
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};

// ── SCENE HELPER: talking-head background ─────────────────────────────────────
const TalkingHeadBg: React.FC<{ src: string }> = ({ src }) => (
  <Loop durationInFrames={240}>
    <OffthreadVideo
      src={staticFile(src)}
      style={{ width: 1080, height: 1920, objectFit: "cover" }}
      muted
    />
  </Loop>
);

// ── SCENE 1: HOOK ─────────────────────────────────────────────────────────────
const Scene1: React.FC = () => <HookCard />;

// ── SCENE 2: NOTIFICATION ────────────────────────────────────────────────────
const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Loop durationInFrames={240}>
        <OffthreadVideo
          src={staticFile(AD.footage.dim)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          muted
        />
      </Loop>
      <AbsoluteFill style={{ background: "rgba(0,0,0,0.35)" }} />
      <NotifCard sceneFrame={frame} />
    </AbsoluteFill>
  );
};

// ── SCENE 3: TALKING LEDGE ────────────────────────────────────────────────────
const SCENE3_PHRASES: KaraokePhrase[] = AD.scene3;

const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <TalkingHeadBg src={AD.footage.ledge} />
      <AbsoluteFill style={{ background: "rgba(0,0,0,0.2)" }} />
      <KaraokeCaption phrases={SCENE3_PHRASES} sceneFrame={frame} />
    </AbsoluteFill>
  );
};

// ── SCENE 4: DESK ─────────────────────────────────────────────────────────────
const SCENE4_PHRASES: KaraokePhrase[] = AD.scene4;

const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <TalkingHeadBg src={AD.footage.desk} />
      <AbsoluteFill style={{ background: "rgba(0,0,0,0.2)" }} />
      <KaraokeCaption phrases={SCENE4_PHRASES} sceneFrame={frame} />
    </AbsoluteFill>
  );
};

// ── SCENE 5: WALKING ─────────────────────────────────────────────────────────
const SCENE5_PHRASES: KaraokePhrase[] = AD.scene5;

const Scene5: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <TalkingHeadBg src={AD.footage.walking} />
      <AbsoluteFill style={{ background: "rgba(0,0,0,0.2)" }} />
      <KaraokeCaption phrases={SCENE5_PHRASES} sceneFrame={frame} />
    </AbsoluteFill>
  );
};

// ── SCENE 6: TWO-SHOT ─────────────────────────────────────────────────────────
const SCENE6_PHRASES: KaraokePhrase[] = AD.scene6;

const Scene6: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <TalkingHeadBg src={AD.footage.twoshot} />
      <AbsoluteFill style={{ background: "rgba(0,0,0,0.2)" }} />
      <KaraokeCaption phrases={SCENE6_PHRASES} sceneFrame={frame} />
    </AbsoluteFill>
  );
};

// ── SCENE 7: END CARD ─────────────────────────────────────────────────────────
const Scene7: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const s1 = spring({ frame: frame - 5, fps, config: { damping: 14, mass: 0.6 } });
  const s2 = spring({ frame: frame - 14, fps, config: { damping: 14, mass: 0.6 } });
  const s3 = spring({ frame: frame - 22, fps, config: { damping: 14, mass: 0.6 } });

  const translateY1 = interpolate(s1, [0, 1], [60, 0]);
  const translateY2 = interpolate(s2, [0, 1], [60, 0]);
  const translateY3 = interpolate(s3, [0, 1], [60, 0]);

  const joinFreeStyle: ExtendedCSSProperties = {
    fontFamily: '"Anton", "Impact", "Arial Black", sans-serif',
    fontWeight: 900,
    fontSize: 180,
    color: CHARTREUSE,
    WebkitTextStroke: `8px ${BLACK}`,
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
        gap: 32,
        opacity: fadeIn,
      }}
    >
      {/* Varritech wordmark / logo */}
      <div
        style={{
          transform: `translateY(${translateY1}px)`,
          opacity: s1,
          fontFamily: '"Chakra Petch", "Arial Black", sans-serif',
          fontWeight: 700,
          fontSize: 68,
          color: WHITE,
          letterSpacing: 3,
          textTransform: "uppercase" as const,
        }}
      >
        {AD.endCard.brandName}
      </div>

      {/* JOIN FREE */}
      <div
        style={{
          transform: `translateY(${translateY2}px)`,
          opacity: s2,
          ...(joinFreeStyle as React.CSSProperties),
        }}
      >
        {AD.endCard.cta}
      </div>

      {/* URL */}
      <div
        style={{
          transform: `translateY(${translateY3}px)`,
          opacity: s3,
          fontFamily: '"Chakra Petch", "Arial Black", sans-serif',
          fontWeight: 500,
          fontSize: 52,
          color: WHITE,
          letterSpacing: 1,
        }}
      >
        {AD.endCard.url}
      </div>
    </AbsoluteFill>
  );
};

// ── ROOT VIDEO ────────────────────────────────────────────────────────────────
export const VideoMobile: React.FC = () => (
  <AbsoluteFill style={{ background: BLACK }}>
    <Sequence from={0} durationInFrames={90}>
      <Scene1 />
    </Sequence>
    <Sequence from={90} durationInFrames={90}>
      <Scene2 />
    </Sequence>
    <Sequence from={180} durationInFrames={90}>
      <Scene3 />
    </Sequence>
    <Sequence from={270} durationInFrames={180}>
      <Scene4 />
    </Sequence>
    <Sequence from={450} durationInFrames={180}>
      <Scene5 />
    </Sequence>
    <Sequence from={630} durationInFrames={180}>
      <Scene6 />
    </Sequence>
    <Sequence from={810} durationInFrames={75}>
      <Scene7 />
    </Sequence>
    <Audio src={staticFile("vo.mp3")} />
  </AbsoluteFill>
);
