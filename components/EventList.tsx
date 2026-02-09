import React, { useState } from 'react';
import { AudioEvent, SoundType } from '../types';
import { AlertTriangle, Home, Mic, Clock, Play, Pause, Volume2 } from 'lucide-react';

interface EventListProps {
  events: AudioEvent[];
  onPlayEvent: (event: AudioEvent) => void;
  isPlayingId: string | null;
}

const EventList: React.FC<EventListProps> = ({ events, onPlayEvent, isPlayingId }) => {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-500 bg-ag-card rounded-xl border border-gray-700 h-full">
        <Mic className="w-8 h-8 mb-2 opacity-50" />
        <p>No abnormal sound events detected yet.</p>
      </div>
    );
  }

  // Reverse to show newest first
  const displayEvents = [...events].reverse();

  return (
    <div className="bg-ag-card rounded-xl border border-gray-700 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-gray-700 bg-slate-800 flex justify-between items-center">
        <h3 className="font-bold text-gray-200 flex items-center">
          <AlertTriangle className="w-4 h-4 mr-2 text-ag-warn" />
          Detected Anomalies ({events.length})
        </h3>
        <span className="text-xs text-gray-500">Tap to listen</span>
      </div>
      <div className="overflow-y-auto flex-1 p-2 space-y-2">
        {displayEvents.map((event) => {
           const isPlaying = isPlayingId === event.id;
           return (
            <button 
              key={event.id} 
              onClick={() => onPlayEvent(event)}
              className={`w-full text-left bg-slate-900 p-3 rounded-lg border flex items-center justify-between transition-all active:scale-[0.98] ${isPlaying ? 'border-ag-primary ring-1 ring-ag-primary bg-slate-800' : 'border-gray-800 hover:bg-slate-800'}`}
            >
              <div className="flex items-center space-x-3">
                {/* Visual Indicator */}
                <div className={`w-2 h-10 rounded-full transition-colors ${isPlaying ? 'bg-ag-primary animate-pulse' : (event.db > 70 ? 'bg-ag-danger' : 'bg-ag-warn')}`}></div>
                
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-lg">{event.db} dB</span>
                    <span className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-300">
                      {event.type}
                    </span>
                  </div>
                  <div className="flex items-center text-xs text-gray-400 mt-1">
                     <Clock className="w-3 h-3 mr-1" />
                     {new Date(event.timestamp).toLocaleTimeString()} 
                     <span className="mx-1">•</span>
                     T+{Math.floor(event.relativeTime)}s
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                  {isPlaying ? (
                    <div className="w-8 h-8 rounded-full bg-ag-primary flex items-center justify-center text-white">
                      <Volume2 className="w-4 h-4 animate-bounce" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400">
                      <Play className="w-4 h-4 ml-0.5" />
                    </div>
                  )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default EventList;