import React, { useRef, useEffect } from 'react';
import { SafetyLevel } from '../types';

interface WaveformProps {
  dataArray: Uint8Array;
  safetyLevel: SafetyLevel;
}

const Waveform: React.FC<WaveformProps> = ({ dataArray, safetyLevel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#1e293b'; // ag-card
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 2;
    
    let strokeColor = '#22c55e';
    if (safetyLevel === SafetyLevel.WARNING) strokeColor = '#eab308';
    if (safetyLevel === SafetyLevel.DANGER) strokeColor = '#ef4444';
    
    ctx.strokeStyle = strokeColor;
    ctx.beginPath();

    const sliceWidth = width / dataArray.length;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();

  }, [dataArray, safetyLevel]);

  return (
    <div className="w-full h-32 bg-ag-card rounded-xl overflow-hidden shadow-inner border border-gray-700">
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        className="w-full h-full"
      />
    </div>
  );
};

export default Waveform;