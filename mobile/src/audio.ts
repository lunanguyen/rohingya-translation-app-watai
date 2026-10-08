import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioRecorder,
  type RecordingOptions,
} from "expo-audio";
import { EncodingType, File, Paths } from "expo-file-system";

// The backend decodes uploads as WAV, so record 16 kHz mono PCM.
const WAV_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: ".wav",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  ios: {
    extension: ".wav",
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    sampleRate: 16000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
};

let recorder: AudioRecorder | null = null;

export async function startRecording(): Promise<void> {
  const { granted } = await requestRecordingPermissionsAsync();
  if (!granted) {
    throw new Error("Microphone permission denied");
  }
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
  });
  const rec = new AudioModule.AudioRecorder(WAV_OPTIONS);
  await rec.prepareToRecordAsync();
  rec.record();
  recorder = rec;
}

export async function stopRecording(): Promise<string> {
  if (!recorder) throw new Error("No active recording");
  const rec = recorder;
  recorder = null;
  await rec.stop();
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  const uri = rec.uri;
  if (!uri) throw new Error("Recording produced no file");
  return uri;
}

function playUri(uri: string): void {
  const player: AudioPlayer = createAudioPlayer({ uri });
  const sub = player.addListener("playbackStatusUpdate", (status) => {
    if (status.didJustFinish) {
      sub.remove();
      player.remove();
    }
  });
  player.play();
}

export async function playBase64Wav(base64: string): Promise<void> {
  const file = new File(Paths.cache, `translated_${Date.now()}.wav`);
  file.create({ overwrite: true });
  file.write(base64, { encoding: EncodingType.Base64 });
  await setAudioModeAsync({ playsInSilentMode: true });
  playUri(file.uri);
}

export async function playRemoteAudio(url: string): Promise<void> {
  await setAudioModeAsync({ playsInSilentMode: true });
  playUri(url);
}
