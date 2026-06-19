/**
 * playbackSlice.ts — Timeline playback controls
 */

export interface PlaybackSliceState {
  currentStep: number
  isPlaying: boolean
  playSpeed: number
}

export interface PlaybackSliceActions {
  setCurrentStep: (s: number) => void
  setIsPlaying: (v: boolean) => void
  nextStep: () => void
  prevStep: () => void
}

export const playbackSliceInitialState: PlaybackSliceState = {
  currentStep: 0,
  isPlaying: false,
  playSpeed: 1,
}
