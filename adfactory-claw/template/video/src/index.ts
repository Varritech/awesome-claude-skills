import { registerRoot } from "remotion";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadChakra } from "@remotion/google-fonts/ChakraPetch";
import { RemotionRoot } from "./Root";
loadAnton();
loadChakra();
registerRoot(RemotionRoot);
