import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Play, Square, ShieldCheck } from 'lucide-react';
import DecibelGauge from './components/DecibelGauge';
import Waveform from './components/Waveform';
import EventList from './components/EventList';
import { 
  AudioEvent, 
  SafetyLevel, 
  SoundType,
  AudioStats
} from './types';
import { 
  calculateDecibels, 
  determineSafetyLevel, 
  analyzeFrequency,
  encodeWAV 
} from './services/audioUtils';
import { 
  SAMPLE_RATE, 
  FFT_SIZE, 
  DB_THRESHOLD_WARNING 
} from './constants';

const App: React.FC = () => {
  // State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [stats, setStats] = useState<AudioStats>({ current: 30, max: 0, min: 100, avg: 0 });
  const [safetyLevel, setSafetyLevel] = useState<SafetyLevel>(SafetyLevel.SAFE);
  const [events, setEvents] = useState<AudioEvent[]>([]);
  const [waveData, setWaveData] = useState<Uint8Array>(new Uint8Array(FFT_SIZE));
  const [permissionError, setPermissionError] = useState<string | null>(null);
  // Size indicator (in seconds roughly)
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [playbackId, setPlaybackId] = useState<string | null>(null);

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastEventTimeRef = useRef<number>(0);
  
  // Raw PCM Data Storage (Array of Float32Arrays)
  const pcmDataRef = useRef<Float32Array[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  
  // Stats Accumulator
  const dbSumRef = useRef<number>(0);
  const dbCountRef = useRef<number>(0);

  // Audio Player
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const resetStats = useCallback(() => {
    setStats({ current: 30, max: 0, min: 100, avg: 0 });
    dbSumRef.current = 0;
    dbCountRef.current = 0;
    setEvents([]);
    pcmDataRef.current = [];
    setRecordingDuration(0);
    if (isRecording) {
      recordingStartTimeRef.current = Date.now();
    }
  }, [isRecording]);

  const stopAudio = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    // Disconnect ScriptProcessor
    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    
    if (sourceRef.current) sourceRef.current.disconnect();
    if (analyserRef.current) analyserRef.current.disconnect();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
       audioContextRef.current.close();
    }
    
    setIsRecording(false);
  }, []);

  const startAudio = useCallback(async () => {
    try {
      setPermissionError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: SAMPLE_RATE,
      });
      audioContextRef.current = audioCtx;

      // Analyser for Visualization
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      // ScriptProcessor for Recording Raw PCM
      const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptNode;
      
      pcmDataRef.current = []; // Clear old data
      recordingStartTimeRef.current = Date.now();

      scriptNode.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        pcmDataRef.current.push(new Float32Array(inputData));
        setRecordingDuration(prev => prev + inputData.length / SAMPLE_RATE);
      };

      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 0;
      
      source.connect(scriptNode);
      scriptNode.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      setIsRecording(true);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const timeDomainArray = new Uint8Array(bufferLength);

      const update = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteTimeDomainData(timeDomainArray);
        analyserRef.current.getByteFrequencyData(dataArray);

        setWaveData(new Uint8Array(timeDomainArray));

        // Logic
        const db = calculateDecibels(timeDomainArray);
        const now = Date.now();

        // Update Stats
        dbSumRef.current += db;
        dbCountRef.current += 1;
        
        setStats(prev => ({
          current: Math.round(prev.current * 0.7 + db * 0.3), // Smoothing
          max: Math.max(prev.max, db),
          min: db > 10 ? Math.min(prev.min, db) : prev.min, 
          avg: Math.round(dbSumRef.current / dbCountRef.current)
        }));

        setSafetyLevel(determineSafetyLevel(db));

        // Event Detection
        if (db > DB_THRESHOLD_WARNING && now - lastEventTimeRef.current > 2000) {
           const soundType = analyzeFrequency(dataArray, SAMPLE_RATE, bufferLength);
           
           const newEvent: AudioEvent = {
             id: Math.random().toString(36).substr(2, 9),
             timestamp: now,
             relativeTime: (now - recordingStartTimeRef.current) / 1000,
             db: db,
             type: soundType,
           };
           
           setEvents(prev => [...prev, newEvent]);
           lastEventTimeRef.current = now;
        }

        rafRef.current = requestAnimationFrame(update);
      };

      update();

    } catch (err: any) {
      console.error("Error accessing microphone:", err);
      setPermissionError("Microphone access denied. Please allow permissions in your browser settings.");
      setIsRecording(false);
    }
  }, []);

  const getMergedPCM = useCallback(() => {
    const totalLength = pcmDataRef.current.reduce((acc, curr) => acc + curr.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of pcmDataRef.current) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }, []);

  const saveRecording = useCallback(() => {
    if (pcmDataRef.current.length === 0) return;
    
    const mergedData = getMergedPCM();
    const wavBlob = encodeWAV(mergedData, SAMPLE_RATE);
    const url = URL.createObjectURL(wavBlob);
    
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `acoustic-guard-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.wav`;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  }, [getMergedPCM]);

  const playEventAudio = useCallback((event: AudioEvent) => {
    if (pcmDataRef.current.length === 0) return;

    const targetTime = event.relativeTime;
    const startTime = Math.max(0, targetTime - 3); 
    const endTime = targetTime + 4; 
    
    const startSample = Math.floor(startTime * SAMPLE_RATE);
    const endSample = Math.floor(endTime * SAMPLE_RATE);

    const mergedData = getMergedPCM();
    
    if (startSample >= mergedData.length) return;
    
    const slice = mergedData.slice(startSample, Math.min(endSample, mergedData.length));
    
    const wavBlob = encodeWAV(slice, SAMPLE_RATE);
    const url = URL.createObjectURL(wavBlob);

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }

    const audio = new Audio(url);
    audioPlayerRef.current = audio;
    
    setPlaybackId(event.id);
    
    audio.play().catch(e => console.log("Playback error", e));

    audio.onended = () => {
      setPlaybackId(null);
      window.URL.revokeObjectURL(url);
    };

    audio.onpause = () => {
       if (audioPlayerRef.current === audio) setPlaybackId(null);
    }

  }, [getMergedPCM]);

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  return (
    <div className="min-h-screen bg-ag-bg flex flex-col font-sans max-w-md mx-auto relative shadow-2xl overflow-hidden">
      
      {/* Header - safe area padding handled in global CSS */}
      <header className="px-4 py-3 flex items-center justify-between border-b border-gray-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 pt-safe-top">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="text-ag-primary w-6 h-6" />
          <h1 className="text-lg font-bold tracking-tight text-white">AcousticGuard</h1>
        </div>
        
        {isRecording && (
          <div className="font-mono text-ag-primary font-bold animate-pulse text-sm">
            REC {Math.floor(recordingDuration / 60)}:{(Math.floor(recordingDuration) % 60).toString().padStart(2, '0')}
          </div>
        )}
        
        <div className="w-10 h-10"></div> {/* Empty spacer to balance header center */}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-2 py-4 space-y-4 overflow-hidden relative">
        
        {permissionError && (
          <div className="bg-red-900/50 border border-red-700 text-red-100 p-4 rounded-lg text-sm mb-4">
            {permissionError}
          </div>
        )}

        <div className="flex-shrink-0">
          <DecibelGauge 
            stats={stats} 
            safetyLevel={safetyLevel} 
            onReset={resetStats}
            onSave={saveRecording}
            isRecording={isRecording}
            recordingSize={recordingDuration}
          />
        </div>

        <div className="flex-shrink-0 px-2">
           <div className="flex justify-between items-end mb-2">
             <h2 className="text-sm font-semibold text-gray-400 flex items-center">
               <Activity className="w-4 h-4 mr-1" /> Spectrum Analysis
             </h2>
           </div>
           <Waveform dataArray={waveData} safetyLevel={safetyLevel} />
        </div>

        <div className="flex-1 min-h-0 px-2 pb-2">
           <EventList 
             events={events} 
             onPlayEvent={playEventAudio}
             isPlayingId={playbackId}
           />
        </div>

      </main>

      {/* Control Bar - safe area padding handled in global CSS */}
      <footer className="p-6 bg-slate-900 border-t border-gray-800 z-30 pb-safe-bottom">
        <div className="flex items-center justify-center space-x-6 relative">
          
          {!isRecording ? (
            <button
              onClick={startAudio}
              className="group relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 transition-all shadow-[0_0_25px_rgba(59,130,246,0.6)] active:scale-95"
            >
              <Play className="w-8 h-8 text-white fill-current ml-1" />
              <div className="absolute inset-0 rounded-full border-2 border-white/20 animate-ping opacity-20"></div>
            </button>
          ) : (
            <button
              onClick={stopAudio}
              className="group relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-tr from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 transition-all shadow-[0_0_25px_rgba(239,68,68,0.6)] active:scale-95"
            >
              <Square className="w-8 h-8 text-white fill-current" />
            </button>
          )}

        </div>
        
        <div className="flex justify-center mt-6 px-4 text-xs font-medium">
             <div className="flex flex-col items-center gap-1 text-ag-primary">
                <ShieldCheck size={20}/>
                <span>Monitor</span>
             </div>
        </div>
      </footer>
    </div>
  );
};

export default App;