import { SoundType, SafetyLevel } from '../types';
import { DB_THRESHOLD_WARNING, DB_THRESHOLD_DANGER, LOW_FREQ_BOUND } from '../constants';

// Helper to write string to DataView
const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

// Convert Float32 audio data to 16-bit PCM and write to DataView
const floatTo16BitPCM = (output: DataView, offset: number, input: Float32Array) => {
  for (let i = 0; i < input.length; i++, offset += 2) {
    // Clamp values to -1 to 1
    const s = Math.max(-1, Math.min(1, input[i]));
    // Convert to 16-bit integer
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
};

export const encodeWAV = (samples: Float32Array, sampleRate: number): Blob => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // file length
  view.setUint32(4, 36 + samples.length * 2, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * blockAlign)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, samples.length * 2, true);

  floatTo16BitPCM(view, 44, samples);

  return new Blob([view], { type: 'audio/wav' });
};

export const calculateDecibels = (timeDomainData: Uint8Array): number => {
  let sumSquares = 0;
  // Calculate RMS (Root Mean Square)
  for (let i = 0; i < timeDomainData.length; i++) {
    // Determine the amplitude (0-255 center at 128)
    // Normalized to -1..1
    const normalized = (timeDomainData[i] - 128) / 128;
    sumSquares += normalized * normalized;
  }
  const rms = Math.sqrt(sumSquares / timeDomainData.length);
  
  // Standard conversion: 20 * log10(rms)
  // Since we normalized to 0..1, log10(rms) is negative (dBFS).
  // E.g., rms 0.1 => -20dBFS. rms 1.0 => 0dBFS.
  // We add an offset to approximate SPL (Sound Pressure Level).
  // 90-100dB is a typical max for phone mics before clipping.
  // Silence (rms near 0) should map to ~30dB (quiet room).
  
  if (rms < 0.0001) return 0; // Prevent -Infinity

  const db = 20 * Math.log10(rms) + 100;
  
  return Math.max(0, Math.round(db));
};

export const determineSafetyLevel = (db: number): SafetyLevel => {
  if (db >= DB_THRESHOLD_DANGER) return SafetyLevel.DANGER;
  if (db >= DB_THRESHOLD_WARNING) return SafetyLevel.WARNING;
  return SafetyLevel.SAFE;
};

export const analyzeFrequency = (frequencyData: Uint8Array, sampleRate: number, bufferLength: number): SoundType => {
  const nyquist = sampleRate / 2;
  const binSize = nyquist / bufferLength;
  
  let lowFreqEnergy = 0;
  let totalEnergy = 0;
  
  const lowFreqIndexLimit = Math.floor(LOW_FREQ_BOUND / binSize);

  for (let i = 0; i < frequencyData.length; i++) {
    const val = frequencyData[i];
    totalEnergy += val;
    if (i < lowFreqIndexLimit) {
      lowFreqEnergy += val;
    }
  }

  if (totalEnergy === 0) return SoundType.ENVIRONMENT;

  const lowFreqRatio = lowFreqEnergy / totalEnergy;

  if (lowFreqRatio > 0.4) {
    return SoundType.STRUCTURE;
  }
  
  return SoundType.ENVIRONMENT;
};