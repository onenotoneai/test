package com.acousticguard.app;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.util.AttributeSet;
import android.view.MotionEvent;
import android.view.View;
import java.util.ArrayList;
import java.util.List;

public class WaveformView extends View {
    private Paint linePaint;
    private Paint markerPaint;
    private Paint cursorPaint;
    private List<Float> amplitudes = new ArrayList<>();
    private List<Marker> markers = new ArrayList<>();
    private float progress = 0f;
    private OnSeekListener seekListener;

    public static class Marker {
        public int index;
        public int db;
        public long timestamp;

        public Marker(int index, int db, long timestamp) {
            this.index = index;
            this.db = db;
            this.timestamp = timestamp;
        }
    }

    public interface OnSeekListener {
        void onSeek(float percentage);
    }

    public WaveformView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init();
    }

    private void init() {
        linePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        linePaint.setColor(Color.parseColor("#3B82F6"));
        linePaint.setStrokeWidth(4f);
        linePaint.setStrokeCap(Paint.Cap.ROUND);

        markerPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        markerPaint.setColor(Color.parseColor("#EF4444"));
        markerPaint.setStrokeWidth(6f);

        cursorPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        cursorPaint.setColor(Color.WHITE);
        cursorPaint.setStrokeWidth(4f);
    }

    public void clear() {
        amplitudes.clear();
        markers.clear();
        progress = 0f;
        invalidate();
    }

    public void setSessionData(List<Float> amps, List<Marker> marks) {
        this.amplitudes = new ArrayList<>(amps);
        this.markers = new ArrayList<>(marks);
        invalidate();
    }

    public void addAmplitude(float amp) {
        amplitudes.add(amp);
        // Keep window of last 1000 samples for live view
        if (amplitudes.size() > 1000) amplitudes.remove(0);
        invalidate();
    }

    public void addMarker(int db, long timestamp) {
        markers.add(new Marker(amplitudes.size() - 1, db, timestamp));
        invalidate();
    }

    public void setProgress(float p) {
        this.progress = p;
        invalidate();
    }

    public void setOnSeekListener(OnSeekListener listener) {
        this.seekListener = listener;
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        if (amplitudes.isEmpty()) return;

        float width = getWidth();
        float height = getHeight();
        float centerY = height / 2;
        float step = width / (float) amplitudes.size();

        // Draw Amplitudes
        for (int i = 0; i < amplitudes.size(); i++) {
            float x = i * step;
            float val = amplitudes.get(i) * centerY * 0.8f; // scale down slightly
            canvas.drawLine(x, centerY - val, x, centerY + val, linePaint);
        }

        // Draw Markers (Nodes)
        for (Marker m : markers) {
            float x = m.index * step;
            canvas.drawLine(x, 0, x, height, markerPaint);
            // Optional: draw dB text
            // canvas.drawText(m.db + "dB", x + 5, 30, markerPaint);
        }

        // Draw Playback Cursor
        float cursorX = progress * width;
        canvas.drawLine(cursorX, 0, cursorX, height, cursorPaint);
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        if (event.getAction() == MotionEvent.ACTION_DOWN || event.getAction() == MotionEvent.ACTION_MOVE) {
            float p = event.getX() / getWidth();
            if (seekListener != null) seekListener.onSeek(Math.max(0, Math.min(1, p)));
            return true;
        }
        return super.onTouchEvent(event);
    }
}