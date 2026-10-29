package com.bigredreport.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.ProgressDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Big Red Report para Android: el juego (el mismo que en el navegador) va dentro de la app y se sirve desde
 * https://appassets.androidplatform.net/ (así funcionan el guardado, IndexedDB y el modo sin conexión).
 * Al abrirla mira en GitHub si hay versión nueva de la app y, si la hay, la descarga e instala (con permiso del usuario).
 */
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String START = "https://" + HOST + "/juego/BigRedRacing.html";
    static final String API = "https://api.github.com/repos/BigRedReport/bigredreport/releases/latest";
    static final String ASSET = "BigRedReport-Android.apk";
    static final int PICK = 41;
    WebView web; ValueCallback<Uri[]> pending; final Handler ui = new Handler(Looper.getMainLooper());

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        setContentView(web);
        immersive();
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false); s.setAllowFileAccess(false); s.setAllowContentAccess(true);
        s.setUserAgentString(s.getUserAgentString() + " BigRedReportAndroid/" + version());
        web.setBackgroundColor(0xff0e1119);
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl(); if (!HOST.equals(u.getHost())) return null;
                String path = u.getPath(); if (path == null || path.equals("/")) path = "/juego/BigRedRacing.html";
                try { InputStream in = getAssets().open(path.substring(1));
                    WebResourceResponse res = new WebResourceResponse(mime(path), mime(path).startsWith("text") || path.endsWith(".js") ? "utf-8" : null, in);
                    Map<String, String> h = new HashMap<>(); h.put("Access-Control-Allow-Origin", "*"); h.put("Cache-Control", "no-cache"); res.setResponseHeaders(h); return res;
                } catch (Exception e) { return new WebResourceResponse("text/plain", "utf-8", 404, "Not found", null, null); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl(); if (HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { } return true;   // enlaces de fuera: en el navegador
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (pending != null) pending.onReceiveValue(null); pending = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT); i.addCategory(Intent.CATEGORY_OPENABLE); i.setType("*/*");
                i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(Intent.createChooser(i, "Elige el archivo"), PICK); } catch (Exception e) { pending = null; return false; }
                return true;
            }
        });
        if (b != null) web.restoreState(b); else web.loadUrl(START);
        ui.postDelayed(this::checkUpdate, 2500);
    }

    void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }
    @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) immersive(); }
    @Override protected void onSaveInstanceState(Bundle b) { super.onSaveInstanceState(b); web.saveState(b); }
    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }

    // botón atrás: como Escape en el juego (pausa / volver)
    @Override public void onBackPressed() {
        web.evaluateJavascript("(function(){var o={key:'Escape',code:'Escape',keyCode:27,bubbles:true};window.dispatchEvent(new KeyboardEvent('keydown',o));setTimeout(function(){window.dispatchEvent(new KeyboardEvent('keyup',o));},60);})()", null);
    }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        if (req == PICK && pending != null) {
            Uri[] out = null;
            if (res == RESULT_OK && data != null) {
                if (data.getClipData() != null) { int n = data.getClipData().getItemCount(); out = new Uri[n]; for (int i = 0; i < n; i++) out[i] = data.getClipData().getItemAt(i).getUri(); }
                else if (data.getData() != null) out = new Uri[] { data.getData() };
            }
            pending.onReceiveValue(out); pending = null; return;
        }
        super.onActivityResult(req, res, data);
    }

    static String mime(String p) {
        String l = p.toLowerCase();
        if (l.endsWith(".html")) return "text/html"; if (l.endsWith(".js")) return "application/javascript"; if (l.endsWith(".css")) return "text/css";
        if (l.endsWith(".png")) return "image/png"; if (l.endsWith(".jpg") || l.endsWith(".jpeg")) return "image/jpeg"; if (l.endsWith(".webmanifest") || l.endsWith(".json")) return "application/json";
        if (l.endsWith(".svg")) return "image/svg+xml"; if (l.endsWith(".mp3")) return "audio/mpeg"; if (l.endsWith(".wav")) return "audio/wav"; return "application/octet-stream";
    }
    String version() { try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return "0"; } }
    static boolean newer(String a, String b) {
        String[] A = a.split("\\."), B = b.split("\\.");
        for (int i = 0; i < 3; i++) { int x = i < A.length ? toInt(A[i]) : 0, y = i < B.length ? toInt(B[i]) : 0; if (x != y) return x > y; } return false;
    }
    static int toInt(String s) { try { return Integer.parseInt(s.replaceAll("[^0-9]", "")); } catch (Exception e) { return 0; } }

    // ---------- actualizador: versión nueva en GitHub → descargar e instalar ----------
    void checkUpdate() {
        new Thread(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(API).openConnection(); c.setRequestProperty("Accept", "application/vnd.github+json"); c.setConnectTimeout(8000); c.setReadTimeout(8000);
                if (c.getResponseCode() != 200) return;
                ByteArrayOutputStream bo = new ByteArrayOutputStream(); InputStream in = c.getInputStream(); byte[] buf = new byte[8192]; int n; while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
                JSONObject j = new JSONObject(bo.toString("UTF-8")); String tag = j.optString("tag_name", "").replaceFirst("^v", ""); JSONArray as = j.optJSONArray("assets"); String url = null;
                if (as != null) for (int i = 0; i < as.length(); i++) { JSONObject a = as.getJSONObject(i); if (ASSET.equals(a.optString("name"))) url = a.optString("browser_download_url"); }
                if (url == null || !newer(tag, version())) return;
                final String u = url, t = tag;
                if (getSharedPreferences("upd", 0).getString("skip", "").equals(t)) return;
                ui.post(() -> new AlertDialog.Builder(this).setTitle("Versión nueva: " + t).setMessage("Hay una versión nueva de Big Red Report. ¿La descargo e instalo ahora? (Tus partidas y ajustes se conservan.)")
                    .setPositiveButton("Actualizar", (d, w) -> download(u)).setNegativeButton("Ahora no", null)
                    .setNeutralButton("Saltar esta", (d, w) -> getSharedPreferences("upd", 0).edit().putString("skip", t).apply()).show());
            } catch (Exception e) { }
        }).start();
    }
    @SuppressWarnings("deprecation")
    void download(String url) {
        final ProgressDialog pd = new ProgressDialog(this); pd.setTitle("Descargando la actualización"); pd.setProgressStyle(ProgressDialog.STYLE_HORIZONTAL); pd.setMax(100); pd.setCancelable(false); pd.show();
        new Thread(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection(); c.setInstanceFollowRedirects(true);
                int code = c.getResponseCode(); int hops = 0;
                while ((code == 301 || code == 302 || code == 303 || code == 307 || code == 308) && hops++ < 5) { String loc = c.getHeaderField("Location"); c = (HttpURLConnection) new URL(loc).openConnection(); code = c.getResponseCode(); }
                long total = c.getContentLengthLong(), got = 0; File f = ApkProvider.apk(this);
                try (InputStream in = c.getInputStream(); OutputStream o = new FileOutputStream(f)) { byte[] buf = new byte[65536]; int n; while ((n = in.read(buf)) > 0) { o.write(buf, 0, n); got += n; final int pc = total > 0 ? (int) (got * 100 / total) : 0; ui.post(() -> pd.setProgress(pc)); } }
                ui.post(() -> { pd.dismiss(); install(); });
            } catch (Exception e) { ui.post(() -> { pd.dismiss(); new AlertDialog.Builder(this).setMessage("No se ha podido descargar la actualización: " + e.getMessage()).setPositiveButton("Vale", null).show(); }); }
        }).start();
    }
    void install() {
        if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
            new AlertDialog.Builder(this).setMessage("Para instalar la actualización, Android necesita que permitas a Big Red Report instalar aplicaciones. Actívalo y vuelve.")
                .setPositiveButton("Abrir ajustes", (d, w) -> { try { startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()))); } catch (Exception e) { } ui.postDelayed(this::install, 4000); })
                .setNegativeButton("Cancelar", null).show();
            return;
        }
        Intent i = new Intent(Intent.ACTION_VIEW); i.setDataAndType(Uri.parse("content://com.bigredreport.app.apk/update.apk"), "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try { startActivity(i); } catch (Exception e) { }
    }
}
