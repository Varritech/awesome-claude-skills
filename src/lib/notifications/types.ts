export interface Notification {
  id: string;
  type: 'reply' | 'bounce' | 'booking';
  message: string;
  leadName: string;
  campaignName: string;
  createdAt: string;
  read: boolean;
}
