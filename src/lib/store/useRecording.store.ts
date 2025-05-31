import { create } from "zustand";

interface IUseRecording {
  recording: boolean;
  recordingLoading: boolean;
  setRecording: (recording: boolean) => void;
  setRecordingLoading: (recordingLoading: boolean) => void;
}

const useRecording = create<IUseRecording>((set) => ({
  recording: true,
  recordingLoading: true,
  setRecording: (recording: boolean) => set({ recording }),
  setRecordingLoading: (recordingLoading: boolean) => set({ recordingLoading }),
}));

export default useRecording;
