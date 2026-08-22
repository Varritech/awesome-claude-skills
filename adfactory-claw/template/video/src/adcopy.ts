// Daily-injected ad copy + footage map. The AdFactory claw OVERWRITES this file
// each run (research + Hormozi-hook stages) before rendering, then drops the Veo
// clips named here into public/. Defaults below = the proven C-replica values so
// the template renders standalone if run by hand.
export type KWord = { text: string; highlight: boolean };
export type Phrase = { words: KWord[]; startFrame: number };

export const AD = {
  brand: {
    accent: "#99FF32",
    indigoDeep: "#190336",
    electricIndigo: "#8638EE",
  },
  hookLines: ["YOUR", "FOUNDER FRIENDS", "ARE IMAGINARY"] as string[],
  notif: { app: "Varritech", line: "3 founders want to connect" },
  // footage filenames (in public/); claw writes Veo3 clips to these names
  footage: {
    rooftop: "veo_rooftop_wide.mp4",
    dim: "veo_dim_laptop.mp4",
    ledge: "veo_talking_ledge.mp4",
    desk: "veo_talking_desk.mp4",
    walking: "veo_talking_desk.mp4",
    twoshot: "veo_selfie_twoshot.mp4",
  },
  // karaoke per talking-head scene (scenes 3..6)
  scene3: [
    { startFrame: 0, words: [{ text: "so", highlight: false }, { text: "i", highlight: false }, { text: "JOINED", highlight: true }, { text: "a", highlight: false }] },
    { startFrame: 30, words: [{ text: "COMMUNITY", highlight: true }, { text: "of", highlight: false }] },
    { startFrame: 60, words: [{ text: "actual", highlight: false }, { text: "FOUNDERS", highlight: true }] },
  ] as Phrase[],
  scene4: [
    { startFrame: 0, words: [{ text: "FOUNDERS", highlight: true }, { text: "who", highlight: false }, { text: "GET", highlight: true }, { text: "it", highlight: false }] },
    { startFrame: 45, words: [{ text: "warm", highlight: false }, { text: "INTROS", highlight: true }] },
    { startFrame: 90, words: [{ text: "DEMO", highlight: true }, { text: "days", highlight: false }] },
    { startFrame: 135, words: [{ text: "RESOURCES", highlight: true }, { text: "that", highlight: false }, { text: "actually", highlight: false }, { text: "matter", highlight: false }] },
  ] as Phrase[],
  scene5: [
    { startFrame: 0, words: [{ text: "they", highlight: false }, { text: "put", highlight: false }, { text: "your", highlight: false }, { text: "STORY", highlight: true }] },
    { startFrame: 45, words: [{ text: "in", highlight: false }, { text: "FRONT", highlight: true }, { text: "of", highlight: false }] },
    { startFrame: 90, words: [{ text: "THOUSANDS", highlight: true }, { text: "of", highlight: false }, { text: "builders", highlight: false }] },
    { startFrame: 135, words: [{ text: "your", highlight: false }, { text: "NEXT", highlight: true }, { text: "co-founder", highlight: false }] },
  ] as Phrase[],
  scene6: [
    { startFrame: 0, words: [{ text: "cause", highlight: false }, { text: "the", highlight: false }, { text: "ONLY", highlight: true }, { text: "people", highlight: false }] },
    { startFrame: 45, words: [{ text: "who", highlight: false }, { text: "ACTUALLY", highlight: true }, { text: "get", highlight: false }, { text: "it", highlight: false }] },
    { startFrame: 90, words: [{ text: "are", highlight: false }, { text: "other", highlight: false }, { text: "FOUNDERS", highlight: true }] },
    { startFrame: 135, words: [{ text: "JOIN", highlight: true }, { text: "free", highlight: false }, { text: "today", highlight: false }] },
  ] as Phrase[],
  endCard: { brandName: "VARRITECH", cta: "JOIN FREE", url: "varritech.com/community" },
};
