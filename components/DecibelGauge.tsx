import React from 'react';
import { SafetyLevel, AudioStats } from '../types';
import { RotateCcw, Save } from 'lucide-react';

interface DecibelGaugeProps {
  stats: AudioStats;
  safetyLevel: SafetyLevel;
  onReset: () => void;
  onSave: () => void;
  isRecording: boolean;
  recordingSize: number; // Number of chunks/size indicator
}

const DecibelGauge: React.FC<DecibelGaugeProps> = ({ 
  stats, 
  safetyLevel, 
  onReset, 
  onSave, 
  isRecording,
  recordingSize 
}) => {
  let colorClass = 'text-ag-safe';
  let ringColor = 'stroke-green-500';
  let statusText = 'Comfortable';

  if (safetyLevel === SafetyLevel.WARNING) {
    colorClass = 'text-ag-warn';
    ringColor = 'stroke-yellow-500';
    statusText = 'Moderate';
  } else if (safetyLevel === SafetyLevel.DANGER) {
    colorClass = 'text-ag-danger';
    ringColor = 'stroke-red-500';
    statusText = 'Noisy';
  }

  // Calculate gauge rotation (0 to 120dB mapping to 0 to 100%)
  const radius = 90; // Increased radius
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(Math.max(stats.current, 0), 120) / 120;
  const strokeDashoffset = circumference - percentage * circumference;

  return (
    <div className="flex flex-col items-center justify-center relative py-4">
      {/* Top Stats Label */}
      <div className="bg-slate-800/50 px-3 py-1 rounded-full text-xs text-ag-primary font-medium mb-4 backdrop-blur-sm border border-slate-700">
        Hearing Threshold
      </div>

      <div className="relative w-72 h-72 flex items-center justify-center">
        {/* Ticks/Scale Background (Simulated with dashes) */}
        <div className="absolute inset-0 rounded-full border border-slate-800"></div>
        
        {/* Background Ring */}
        <svg className="absolute w-full h-full transform -rotate-90">
          <circle
            cx="50%"
            cy="50%"
            r={radius}
            stroke="#1e293b" 
            strokeWidth="20"
            fill="transparent"
          />
        </svg>
        
        {/* Progress Ring */}
        <svg className="absolute w-full h-full transform -rotate-90 drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]">
          <circle
            cx="50%"
            cy="50%"
            r={radius}
            stroke="currentColor"
            strokeWidth="20"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={`transition-all duration-300 ease-out ${ringColor}`}
          />
          {/* Knob at the end of the arc */}
           <circle
             cx="50%"
             cy="50%"
             r="8"
             fill="white"
             className="transition-all duration-300 ease-out"
             style={{
                transformOrigin: 'center',
                transform: `rotate(${percentage * 360}deg) translate(${radius}px)` 
             }}
           />
        </svg>

        {/* Center Display */}
        <div className="absolute flex flex-col items-center z-10">
          <span className={`text-7xl font-sans font-bold tracking-tighter ${colorClass} drop-shadow-2xl`}>
            {stats.current}
          </span>
          <div className="flex w-full justify-between px-2 mt-2 text-xs text-gray-500 font-bold uppercase tracking-widest">
            <span>Min</span>
            <span>Max</span>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="w-full flex justify-between items-center px-8 mt-[-20px] z-20">
        <div className="flex flex-col items-center">
          <span className="text-3xl font-light text-white">{stats.max > -100 ? stats.max : '--'}</span>
          <span className="text-xs text-gray-400 font-bold tracking-wider">MAX</span>
        </div>
        <div className="flex flex-col items-center">
           <span className="text-3xl font-light text-white">{stats.avg > -100 ? stats.avg : '--'}</span>
           <span className="text-xs text-gray-400 font-bold tracking-wider">AVG</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex w-full justify-between px-4 mt-8">
        <button 
          onClick={onReset}
          className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-gray-300 px-5 py-2 rounded-xl transition-all active:scale-95 border border-slate-700"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset</span>
        </button>

        <button 
          onClick={onSave}
          disabled={recordingSize === 0}
          className={`flex items-center space-x-2 px-5 py-2 rounded-xl transition-all active:scale-95 border ${recordingSize > 0 ? 'bg-slate-800 hover:bg-slate-700 text-ag-primary border-slate-700' : 'bg-slate-900 text-gray-600 border-transparent cursor-not-allowed'}`}
        >
          <Save className="w-4 h-4" />
          <span>Save</span>
        </button>
      </div>
    </div>
  );
};

export default DecibelGauge;