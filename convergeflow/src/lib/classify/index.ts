export { isAutoReply, autoReplyReason } from './detectors';
export { classifyReply } from './classifier';
export type { ClassifyContext } from './classifier';
export {
  classifyReplyPipeline,
  categoryLabel,
  categoryBadgeColor,
  categoryChartColor,
} from './pipeline';
export type { ClassificationResult } from './pipeline';
