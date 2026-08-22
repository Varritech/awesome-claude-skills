import React from "react";
import {
  Zap,
  Palette,
  Clapperboard,
  FlaskConical,
  BrainCircuit,
  Check,
  X,
  type LucideIcon,
} from "lucide-react";

// Icon kit — Lucide ONLY (https://lucide.dev, ISC license). NEVER use system emoji.
// Need an icon not wrapped below? Import it from "lucide-react" and wrap it here
// in the same brand style. Browse names at https://lucide.dev/icons.
// Usage stays identical across the ad: <IconBolt size={64} color={COLORS.accent} />.

type IconProps = { size?: number; color?: string; glow?: boolean };

// EDIT default color to a brand token import (e.g. COLORS.accent) if you have one.
const DEFAULT_COLOR = "#96F01E";

const wrap =
  (Ico: LucideIcon): React.FC<IconProps> =>
  ({ size = 64, color = DEFAULT_COLOR, glow = true }) =>
    (
      <Ico
        size={size}
        color={color}
        strokeWidth={2.4}
        absoluteStrokeWidth
        style={{
          display: "block",
          filter: glow ? "drop-shadow(0 0 10px rgba(140,90,240,0.6))" : undefined,
        }}
      />
    );

export const IconBolt = wrap(Zap); // automations / energy
export const IconPalette = wrap(Palette); // design & UI
export const IconFilm = wrap(Clapperboard); // video
export const IconResearch = wrap(FlaskConical); // research
export const IconBurst = wrap(BrainCircuit); // shock / price reveal
export const IconCheck = wrap(Check); // benefit lists
export const IconCross = wrap(X); // pain-point lists
