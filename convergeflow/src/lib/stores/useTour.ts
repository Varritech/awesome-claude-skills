'use client';

import { create } from 'zustand';

export interface TourStep {
  target: string; // CSS selector
  title: string;
  body: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="dashboard"]',
    title: 'Your Dashboard',
    body: "This is your command center. See how many emails were sent today and track your reply rate.",
    position: 'bottom',
  },
  {
    target: '[data-tour="leads"]',
    title: 'Find Leads',
    body: "Browse leads in your industry and area. Add them to campaigns with one click.",
    position: 'right',
  },
  {
    target: '[data-tour="campaigns"]',
    title: 'Email Campaigns',
    body: "Create multi-step sequences. ConvergeFlow handles scheduling, follow-ups, and replies automatically.",
    position: 'right',
  },
  {
    target: '[data-tour="emails"]',
    title: 'Sent Emails',
    body: "Track every email: delivered, opened, replied, bounced. All in one place.",
    position: 'bottom',
  },
  {
    target: '[data-tour="settings"]',
    title: 'Settings & Inboxes',
    body: "Manage your sending domains and inboxes here. Add more inboxes to increase volume.",
    position: 'top',
  },
];

interface TourState {
  tourActive: boolean;
  currentStep: number;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  endTour: () => void;
}

export const useTour = create<TourState>((set, get) => ({
  tourActive: false,
  currentStep: 0,

  startTour: () => set({ tourActive: true, currentStep: 0 }),

  nextStep: () => {
    const { currentStep } = get();
    const nextIndex = currentStep + 1;
    if (nextIndex >= TOUR_STEPS.length) {
      set({ tourActive: false, currentStep: 0 });
    } else {
      set({ currentStep: nextIndex });
    }
  },

  prevStep: () => {
    const { currentStep } = get();
    if (currentStep > 0) {
      set({ currentStep: currentStep - 1 });
    }
  },

  endTour: () => set({ tourActive: false, currentStep: 0 }),
}));
