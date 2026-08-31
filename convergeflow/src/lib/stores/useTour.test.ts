import { describe, it, expect, beforeEach } from 'vitest';
import { useTour, TOUR_STEPS } from './useTour';

// Reset store state between tests
beforeEach(() => {
  useTour.setState({ tourActive: false, currentStep: 0 });
});

describe('useTour store', () => {
  it('starts with tour inactive and step 0', () => {
    const state = useTour.getState();
    expect(state.tourActive).toBe(false);
    expect(state.currentStep).toBe(0);
  });

  it('startTour activates the tour at step 0', () => {
    useTour.getState().startTour();
    const state = useTour.getState();
    expect(state.tourActive).toBe(true);
    expect(state.currentStep).toBe(0);
  });

  it('nextStep advances to step 1', () => {
    useTour.getState().startTour();
    useTour.getState().nextStep();
    expect(useTour.getState().currentStep).toBe(1);
    expect(useTour.getState().tourActive).toBe(true);
  });

  it('nextStep on the last step ends the tour', () => {
    useTour.setState({ tourActive: true, currentStep: TOUR_STEPS.length - 1 });
    useTour.getState().nextStep();
    expect(useTour.getState().tourActive).toBe(false);
    expect(useTour.getState().currentStep).toBe(0);
  });

  it('prevStep goes back from step 2 to step 1', () => {
    useTour.setState({ tourActive: true, currentStep: 2 });
    useTour.getState().prevStep();
    expect(useTour.getState().currentStep).toBe(1);
  });

  it('prevStep at step 0 does not go below 0', () => {
    useTour.setState({ tourActive: true, currentStep: 0 });
    useTour.getState().prevStep();
    expect(useTour.getState().currentStep).toBe(0);
  });

  it('endTour deactivates tour and resets to step 0', () => {
    useTour.setState({ tourActive: true, currentStep: 3 });
    useTour.getState().endTour();
    expect(useTour.getState().tourActive).toBe(false);
    expect(useTour.getState().currentStep).toBe(0);
  });

  it('has exactly 5 tour steps', () => {
    expect(TOUR_STEPS).toHaveLength(5);
  });

  it('each tour step has required fields', () => {
    TOUR_STEPS.forEach((step) => {
      expect(step.target).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.body).toBeTruthy();
      expect(['top', 'bottom', 'left', 'right']).toContain(step.position);
    });
  });
});
