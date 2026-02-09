package com.acousticguard.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {

    private WebView mWebView;
    private static final int PERMISSION_REQUEST_CODE = 1001;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 1. 初始化 WebView
        mWebView = new WebView(this);
        setContentView(mWebView);

        // 2. 配置 WebSettings
        WebSettings webSettings = mWebView.getSettings();
        webSettings.setJavaScriptEnabled(true); // 启用 JS
        webSettings.setDomStorageEnabled(true); // 启用本地存储
        webSettings.setAllowFileAccess(true);   // 允许访问文件
        webSettings.setMediaPlaybackRequiresUserGesture(false); // 允许自动播放音频

        // 3. 处理 Chrome Client (关键：处理录音权限)
        mWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                // 自动同意网页的麦克风请求
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        request.grant(request.getResources());
                    }
                });
            }
        });

        mWebView.setWebViewClient(new WebViewClient());

        // 4. 检查安卓原生权限
        checkAndroidPermissions();

        // 5. 加载网页
        // 注意：在手机 IDE 中，您需要把 index.html 等文件放入 assets 文件夹
        mWebView.loadUrl("file:///android_asset/index.html");
    }

    private void checkAndroidPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            String[] permissions = {Manifest.permission.RECORD_AUDIO};
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(permissions, PERMISSION_REQUEST_CODE);
            }
        }
    }
    
    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                // 权限已授予，刷新页面以生效
                mWebView.reload();
            } else {
                Toast.makeText(this, "需要录音权限才能运行", Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (mWebView.canGoBack()) {
            mWebView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}