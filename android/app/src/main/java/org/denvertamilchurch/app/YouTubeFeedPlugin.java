package org.denvertamilchurch.app;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "YouTubeFeed")
public class YouTubeFeedPlugin extends Plugin {
    private static final String LIVE_TAB = "https://www.youtube.com/@TamilChurchDenver/streams";
    private static final Pattern VIDEO_ID = Pattern.compile("\\\"videoId\\\":\\\"([A-Za-z0-9_-]{11})\\\"");

    @PluginMethod
    public void getVideos(PluginCall call) {
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(LIVE_TAB).openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(20000);
                connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36");
                connection.setRequestProperty("Accept-Language", "en-US,en;q=0.9");
                connection.setRequestProperty("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
                if (connection.getResponseCode() != 200) throw new Exception("YouTube Live tab returned " + connection.getResponseCode());

                StringBuilder html = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                    char[] buffer = new char[8192];
                    for (int count; (count = reader.read(buffer)) != -1;) html.append(buffer, 0, count);
                }

                LinkedHashSet<String> liveIds = new LinkedHashSet<>();
                Matcher matcher = VIDEO_ID.matcher(html);
                while (matcher.find() && liveIds.size() < 9) liveIds.add(matcher.group(1));
                if (liveIds.isEmpty()) throw new Exception("No videos were found on the YouTube Live tab");

                JSArray videos = new JSArray();
                int index = 0;
                for (String id : liveIds) {
                    JSObject video = new JSObject();
                    video.put("id", id);
                    video.put("title", index == 0 ? "Latest Live Service" : "Previous Live Service");
                    video.put("published", "");
                    video.put("thumbnail", "https://img.youtube.com/vi/" + id + "/hqdefault.jpg");
                    videos.put(video);
                    index++;
                }
                JSObject result = new JSObject();
                result.put("source", LIVE_TAB);
                result.put("videos", videos);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Unable to load the YouTube Live tab", error);
            } finally {
                if (connection != null) connection.disconnect();
            }
        }).start();
    }
}
