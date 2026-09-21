package com.pthagaard.theoballoner;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * In-app updates for the private phase: the app asks GitHub Releases for the newest build
 * (when the parent menu opens, on "Søg", and once a day shortly after start), fetches the APK
 * into the app's cache in the background, and hands it to Android's installer when a parent
 * taps "Installér nu". This is the only network access in the app, only parents can trigger
 * it, and it only talks to the project's own GitHub Releases.
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    private static final String RELEASE_BASE = "https://github.com/PThagaard/Theo/releases/download/latest/";
    private static final String VERSION_URL = RELEASE_BASE + "version.json";
    private static final int TIMEOUT_MS = 20000;

    @PluginMethod
    public void version(PluginCall call) {
        JSObject result = new JSObject();
        result.put("version", currentVersion());
        call.resolve(result);
    }

    @PluginMethod
    public void check(PluginCall call) {
        new Thread(() -> {
            try {
                JSONObject latest = new JSONObject(fetchText(VERSION_URL));
                JSObject result = new JSObject();
                result.put("current", currentVersion());
                result.put("latest", latest.optString("version"));
                result.put("build", latest.optInt("build"));
                result.put("date", latest.optString("date"));
                result.put("notes", latest.optString("notes"));
                result.put("apk", latest.optString("apk", RELEASE_BASE + "TheosBalloner.apk"));
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Kunne ikke hente versionsoplysninger: " + e.getMessage());
            }
        }).start();
    }

    /** Fetches the APK for a version into the cache (or finds it there already), so installing is instant. */
    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url", RELEASE_BASE + "TheosBalloner.apk");
        String version = call.getString("version", "");
        if (url == null || !url.startsWith(RELEASE_BASE)) {
            call.reject("Kun opdateringer fra projektets egne udgivelser er tilladt");
            return;
        }
        new Thread(() -> {
            try {
                boolean cached = isDownloaded(version);
                File apk = ensureDownloaded(url, version);
                JSObject result = new JSObject();
                result.put("path", apk.getAbsolutePath());
                result.put("cached", cached);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Opdateringen kunne ikke hentes: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void install(PluginCall call) {
        String url = call.getString("url", RELEASE_BASE + "TheosBalloner.apk");
        String version = call.getString("version", "");
        if (url == null || !url.startsWith(RELEASE_BASE)) {
            call.reject("Kun opdateringer fra projektets egne udgivelser er tilladt");
            return;
        }
        new Thread(() -> {
            try {
                File apk = ensureDownloaded(url, version);
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(uri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                call.reject("Opdateringen kunne ikke hentes: " + e.getMessage());
            }
        }).start();
    }

    private File updateDir() {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Kunne ikke oprette mappe");
        return dir;
    }

    /** Only digits and dots in file names: the version comes from the network. */
    private String safeVersion(String version) {
        String safe = version == null ? "" : version.replaceAll("[^0-9.]", "");
        return safe.isEmpty() ? "ukendt" : safe;
    }

    private File apkFile(String version) {
        return new File(updateDir(), "TheosBalloner-" + safeVersion(version) + ".apk");
    }

    /** A completed download leaves a marker next to the file, so a half-fetched APK is never installed. */
    private File doneMarker(File apk) {
        return new File(apk.getPath() + ".done");
    }

    private boolean isDownloaded(String version) {
        File apk = apkFile(version);
        return apk.exists() && apk.length() > 0 && doneMarker(apk).exists();
    }

    private File ensureDownloaded(String url, String version) throws Exception {
        File apk = apkFile(version);
        if (isDownloaded(version)) return apk;
        // Older downloads are of no use any more; keep the cache small.
        File[] old = updateDir().listFiles();
        if (old != null) for (File file : old) file.delete();
        download(url, apk);
        if (!doneMarker(apk).createNewFile()) throw new IllegalStateException("Kunne ikke gemme opdateringen");
        return apk;
    }

    private String currentVersion() {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            return info.versionName == null ? "?" : info.versionName;
        } catch (Exception e) {
            return "?";
        }
    }

    private HttpURLConnection open(String url) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(TIMEOUT_MS);
        connection.setReadTimeout(TIMEOUT_MS);
        connection.setInstanceFollowRedirects(true);
        connection.setRequestProperty("User-Agent", "TheosBalloner/" + currentVersion());
        connection.connect();
        int code = connection.getResponseCode();
        if (code != HttpURLConnection.HTTP_OK) throw new IllegalStateException("HTTP " + code);
        return connection;
    }

    private String fetchText(String url) throws Exception {
        HttpURLConnection connection = open(url);
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
            StringBuilder text = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) text.append(line).append('\n');
            return text.toString();
        } finally {
            connection.disconnect();
        }
    }

    private void download(String url, File target) throws Exception {
        HttpURLConnection connection = open(url);
        long total = connection.getContentLengthLong();
        long done = 0;
        int lastPercent = -1;
        try (InputStream in = connection.getInputStream(); FileOutputStream out = new FileOutputStream(target)) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = in.read(buffer)) > 0) {
                out.write(buffer, 0, read);
                done += read;
                int percent = total > 0 ? (int) (done * 100 / total) : -1;
                if (percent != lastPercent) {
                    lastPercent = percent;
                    JSObject progress = new JSObject();
                    progress.put("percent", percent);
                    progress.put("bytes", done);
                    notifyListeners("progress", progress);
                }
            }
        } finally {
            connection.disconnect();
        }
    }
}
