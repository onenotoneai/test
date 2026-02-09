package com.acousticguard.app;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaPlayer;
import android.media.MediaRecorder;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.ImageButton;
import android.widget.ListView;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.drawerlayout.widget.DrawerLayout;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {

    private static final int SAMPLE_RATE = 44100;
    private static final int DB_THRESHOLD = 65;
    
    private AudioRecord audioRecord;
    private boolean isRecording = false;
    private Thread recordingThread;
    
    private WaveformView waveformView;
    private TextView txtDb;
    private TextView txtStatus;
    private ImageButton btnRecord;
    private ImageButton btnHistory;
    private SeekBar playbackSeekBar;
    private ListView nodeList;
    private ListView historyList;
    private DrawerLayout drawerLayout;

    private List<String> nodeItems = new ArrayList<>();
    private List<WaveformView.Marker> currentMarkers = new ArrayList<>();
    private List<Float> currentAmplitudes = new ArrayList<>();
    private ArrayAdapter<String> nodeAdapter;

    private List<String> historyFiles = new ArrayList<>();
    private ArrayAdapter<String> historyAdapter;

    private MediaPlayer mediaPlayer;
    private String tempPcmPath;
    private Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        waveformView = findViewById(R.id.waveform_view);
        txtDb = findViewById(R.id.txt_db);
        txtStatus = findViewById(R.id.txt_status);
        btnRecord = findViewById(R.id.btn_record);
        btnHistory = findViewById(R.id.btn_history);
        playbackSeekBar = findViewById(R.id.playback_seekbar);
        nodeList = findViewById(R.id.node_list);
        historyList = findViewById(R.id.history_list);
        drawerLayout = findViewById(R.id.drawer_layout);

        nodeAdapter = new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, nodeItems);
        nodeList.setAdapter(nodeAdapter);

        historyAdapter = new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, historyFiles);
        historyList.setAdapter(historyAdapter);

        btnRecord.setOnClickListener(v -> toggleRecording());
        btnHistory.setOnClickListener(v -> drawerLayout.openDrawer(View.FOCUS_RIGHT));

        // 自由拖动波形图来跳转进度
        waveformView.setOnSeekListener(percentage -> {
            if (mediaPlayer != null) {
                int msec = (int) (percentage * mediaPlayer.getDuration());
                mediaPlayer.seekTo(msec);
            }
        });

        // 点击具体的节点列表跳转播放
        nodeList.setOnItemClickListener((parent, view, position, id) -> {
            if (mediaPlayer != null) {
                // 列表显示是倒序的（最新在前），获取对应标记的时间戳
                int markerIdx = currentMarkers.size() - 1 - position;
                if (markerIdx >= 0 && markerIdx < currentMarkers.size()) {
                    long timeMs = currentMarkers.get(markerIdx).timestamp;
                    mediaPlayer.seekTo((int)timeMs);
                    if (!mediaPlayer.isPlaying()) mediaPlayer.start();
                }
            }
        });

        // 历史记录加载
        historyList.setOnItemClickListener((parent, view, position, id) -> {
            String wavName = historyFiles.get(position);
            loadFullSession(wavName);
            drawerLayout.closeDrawers();
        });

        refreshHistoryList();
    }

    private void toggleRecording() {
        if (isRecording) {
            stopRecording();
            btnRecord.setImageResource(android.R.drawable.ic_btn_speak_now);
        } else {
            startRecording();
            btnRecord.setImageResource(android.R.drawable.ic_media_pause);
        }
    }

    private void startRecording() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 100);
            return;
        }

        if (mediaPlayer != null) { mediaPlayer.release(); mediaPlayer = null; }
        
        txtStatus.setText("RECORDING...");
        playbackSeekBar.setVisibility(View.GONE);
        waveformView.clear();
        nodeItems.clear();
        currentMarkers.clear();
        currentAmplitudes.clear();
        nodeAdapter.notifyDataSetChanged();

        int bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        audioRecord = new AudioRecord(MediaRecorder.AudioSource.MIC, SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufferSize);
        
        isRecording = true;
        audioRecord.startRecording();
        
        recordingThread = new Thread(() -> {
            short[] buffer = new short[bufferSize];
            tempPcmPath = getExternalFilesDir(null) + "/temp.pcm";
            long startTime = System.currentTimeMillis();

            try (FileOutputStream os = new FileOutputStream(tempPcmPath)) {
                while (isRecording) {
                    int read = audioRecord.read(buffer, 0, bufferSize);
                    double sum = 0;
                    for (int i = 0; i < read; i++) {
                        sum += buffer[i] * buffer[i];
                        os.write((byte) (buffer[i] & 0xff));
                        os.write((byte) ((buffer[i] >> 8) & 0xff));
                    }
                    
                    double amplitude = Math.sqrt(sum / read);
                    final int db = (int) (20 * Math.log10(amplitude / 0.1));
                    final long currentRelTime = System.currentTimeMillis() - startTime;
                    
                    mainHandler.post(() -> {
                        txtDb.setText(String.valueOf(Math.max(30, db)));
                        float ampNorm = (float)amplitude / 32768f;
                        currentAmplitudes.add(ampNorm);
                        waveformView.addAmplitude(ampNorm);
                        
                        if (db > DB_THRESHOLD) {
                            waveformView.addMarker(db, currentRelTime);
                            currentMarkers.add(new WaveformView.Marker(currentAmplitudes.size()-1, db, currentRelTime));
                            nodeItems.add(0, "Anomaly: " + db + "dB at " + (currentRelTime/1000) + "s");
                            nodeAdapter.notifyDataSetChanged();
                        }
                    });
                }
            } catch (IOException e) { e.printStackTrace(); }
        });
        recordingThread.start();
    }

    private void stopRecording() {
        isRecording = false;
        if (audioRecord != null) {
            audioRecord.stop();
            audioRecord.release();
            audioRecord = null;
        }
        
        long ts = System.currentTimeMillis();
        String wavPath = getExternalFilesDir(null) + "/REC_" + ts + ".wav";
        String metaPath = getExternalFilesDir(null) + "/REC_" + ts + ".json";
        
        // 1. 自动保存音频
        copyPcmToWav(tempPcmPath, wavPath);
        
        // 2. 自动保存元数据 (波形、分贝、标记点)
        saveMetadata(metaPath);
        
        refreshHistoryList();
        txtStatus.setText("SAVED & READY");
        preparePlayback(wavPath);
    }

    private void saveMetadata(String path) {
        try {
            JSONObject root = new JSONObject();
            JSONArray amps = new JSONArray();
            for (Float f : currentAmplitudes) amps.put(f.doubleValue());
            root.put("amplitudes", amps);

            JSONArray marks = new JSONArray();
            for (WaveformView.Marker m : currentMarkers) {
                JSONObject obj = new JSONObject();
                obj.put("index", m.index);
                obj.put("db", m.db);
                obj.put("ts", m.timestamp);
                marks.put(obj);
            }
            root.put("markers", marks);

            FileWriter writer = new FileWriter(path);
            writer.write(root.toString());
            writer.close();
        } catch (Exception e) { e.printStackTrace(); }
    }

    private void loadFullSession(String wavName) {
        String baseName = wavName.substring(0, wavName.lastIndexOf("."));
        String wavPath = getExternalFilesDir(null) + "/" + wavName;
        String jsonPath = getExternalFilesDir(null) + "/" + baseName + ".json";

        // 清空 UI
        waveformView.clear();
        nodeItems.clear();
        currentMarkers.clear();
        currentAmplitudes.clear();

        // 加载元数据 JSON
        File jsonFile = new File(jsonPath);
        if (jsonFile.exists()) {
            try {
                StringBuilder sb = new StringBuilder();
                BufferedReader br = new BufferedReader(new FileReader(jsonFile));
                String line;
                while ((line = br.readLine()) != null) sb.append(line);
                br.close();

                JSONObject root = new JSONObject(sb.toString());
                JSONArray amps = root.getJSONArray("amplitudes");
                for (int i = 0; i < amps.length(); i++) {
                    currentAmplitudes.add((float) amps.getDouble(i));
                }

                JSONArray marks = root.getJSONArray("markers");
                for (int i = 0; i < marks.length(); i++) {
                    JSONObject obj = marks.getJSONObject(i);
                    WaveformView.Marker m = new WaveformView.Marker(obj.getInt("index"), obj.getInt("db"), obj.getLong("ts"));
                    currentMarkers.add(m);
                    nodeItems.add(0, "Anomaly: " + m.db + "dB at " + (m.timestamp/1000) + "s");
                }
                
                waveformView.setSessionData(currentAmplitudes, currentMarkers);
                nodeAdapter.notifyDataSetChanged();
            } catch (Exception e) { e.printStackTrace(); }
        }

        preparePlayback(wavPath);
    }

    private void preparePlayback(String path) {
        if (mediaPlayer != null) mediaPlayer.release();
        playbackSeekBar.setVisibility(View.VISIBLE);
        try {
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(path);
            mediaPlayer.prepare();
            playbackSeekBar.setMax(mediaPlayer.getDuration());
            
            mainHandler.post(new Runnable() {
                @Override
                public void run() {
                    if (mediaPlayer != null) {
                        if (mediaPlayer.isPlaying()) {
                            float p = (float)mediaPlayer.getCurrentPosition() / mediaPlayer.getDuration();
                            waveformView.setProgress(p);
                            playbackSeekBar.setProgress(mediaPlayer.getCurrentPosition());
                        }
                        mainHandler.postDelayed(this, 100);
                    }
                }
            });
            mediaPlayer.start();
        } catch (IOException e) { e.printStackTrace(); }
    }

    private void refreshHistoryList() {
        File dir = getExternalFilesDir(null);
        File[] files = dir.listFiles((d, name) -> name.endsWith(".wav"));
        historyFiles.clear();
        if (files != null) {
            for (File f : files) historyFiles.add(0, f.getName());
        }
        historyAdapter.notifyDataSetChanged();
    }

    private void copyPcmToWav(String pcmPath, String wavPath) {
        // ... (同之前的 WAV 转换逻辑，确保导出标准音频文件)
        long sampleRate = SAMPLE_RATE;
        int channels = 1;
        long byteRate = 16 * SAMPLE_RATE * channels / 8;
        byte[] buffer = new byte[2048];
        try (FileInputStream in = new FileInputStream(pcmPath);
             FileOutputStream out = new FileOutputStream(wavPath)) {
            long totalAudioLen = in.getChannel().size();
            long totalDataLen = totalAudioLen + 36;
            byte[] header = new byte[44];
            header[0] = 'R'; header[1] = 'I'; header[2] = 'F'; header[3] = 'F';
            header[4] = (byte) (totalDataLen & 0xff); header[5] = (byte) ((totalDataLen >> 8) & 0xff);
            header[6] = (byte) ((totalDataLen >> 16) & 0xff); header[7] = (byte) ((totalDataLen >> 24) & 0xff);
            header[8] = 'W'; header[9] = 'A'; header[10] = 'V'; header[11] = 'E';
            header[12] = 'f'; header[13] = 'm'; header[14] = 't'; header[15] = ' ';
            header[16] = 16; header[17] = 0; header[18] = 0; header[19] = 0;
            header[20] = 1; header[21] = 0; header[22] = (byte) channels; header[23] = 0;
            header[24] = (byte) (sampleRate & 0xff); header[25] = (byte) ((sampleRate >> 8) & 0xff);
            header[26] = (byte) ((sampleRate >> 16) & 0xff); header[27] = (byte) ((sampleRate >> 24) & 0xff);
            header[28] = (byte) (byteRate & 0xff); header[29] = (byte) ((byteRate >> 8) & 0xff);
            header[30] = (byte) ((byteRate >> 16) & 0xff); header[31] = (byte) ((byteRate >> 24) & 0xff);
            header[32] = (byte) (2); header[33] = 0; header[34] = 16; header[35] = 0;
            header[36] = 'd'; header[37] = 'a'; header[38] = 't'; header[39] = 'a';
            header[40] = (byte) (totalAudioLen & 0xff); header[41] = (byte) ((totalAudioLen >> 8) & 0xff);
            header[42] = (byte) ((totalAudioLen >> 16) & 0xff); header[43] = (byte) ((totalAudioLen >> 24) & 0xff);
            out.write(header, 0, 44);
            int length;
            while ((length = in.read(buffer)) != -1) out.write(buffer, 0, length);
        } catch (IOException e) { e.printStackTrace(); }
    }
}