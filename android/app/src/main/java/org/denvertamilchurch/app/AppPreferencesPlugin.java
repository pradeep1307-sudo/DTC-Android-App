package org.denvertamilchurch.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.ActivityCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name="AppPreferences")
public class AppPreferencesPlugin extends Plugin {
    @PluginMethod public void setLanguage(PluginCall call) {
        String language=call.getString("language","en");
        getContext().getSharedPreferences("dtc_preferences",Context.MODE_PRIVATE).edit().putString("language","ta".equals(language)?"ta":"en").apply();
        call.resolve();
    }
    @PluginMethod public void configure(PluginCall call) {
        boolean notifications=call.getBoolean("notifications",true);boolean daily=notifications;boolean events=notifications;
        getContext().getSharedPreferences("dtc_preferences",Context.MODE_PRIVATE).edit().putBoolean("notifications",notifications).putBoolean("daily_verse",daily).putBoolean("event_reminders",events).apply();
        if(Build.VERSION.SDK_INT>=26) {
            NotificationManager manager=(NotificationManager)getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            manager.deleteNotificationChannel("daily_verse_loud_v2");manager.deleteNotificationChannel("church_events");
            NotificationChannel channel=new NotificationChannel("church_notifications_v1","Church Notifications",NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Daily Scripture, services, events, and calendar reminders");manager.createNotificationChannel(channel);
        }
        if(notifications&&Build.VERSION.SDK_INT>=33) ActivityCompat.requestPermissions(getActivity(),new String[]{Manifest.permission.POST_NOTIFICATIONS},600);
        if(daily) DailyVerseScheduler.schedule(getContext()); else {
            AlarmManager alarms=(AlarmManager)getContext().getSystemService(Context.ALARM_SERVICE);
            PendingIntent pending=PendingIntent.getBroadcast(getContext(),600,new Intent(getContext(),DailyVerseReceiver.class),PendingIntent.FLAG_NO_CREATE|PendingIntent.FLAG_IMMUTABLE);if(pending!=null)alarms.cancel(pending);
        }
        if(events) EventReminderScheduler.schedule(getContext()); else EventReminderScheduler.cancel(getContext());
        if((daily||events)&&Build.VERSION.SDK_INT>=Build.VERSION_CODES.S) {
            AlarmManager alarms=(AlarmManager)getContext().getSystemService(Context.ALARM_SERVICE);
            if(!alarms.canScheduleExactAlarms()) getActivity().startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getContext().getPackageName())));
        }
        call.resolve();
    }
    @PluginMethod public void notificationStatus(PluginCall call) {
        JSObject result=new JSObject();
        boolean enabled=NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        result.put("enabled",enabled);call.resolve(result);
    }
    @PluginMethod public void openNotificationSettings(PluginCall call) {
        Intent intent=new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
        intent.putExtra(Settings.EXTRA_APP_PACKAGE,getContext().getPackageName());
        getActivity().startActivity(intent);call.resolve();
    }
    @PluginMethod public void checkForUpdate(PluginCall call) {
        new Thread(() -> {
            JSObject result=new JSObject();
            try {
                HttpURLConnection connection=(HttpURLConnection)new URL("https://www.denvertamilchurch.com/app-update.json").openConnection();connection.setConnectTimeout(5000);connection.setReadTimeout(5000);
                BufferedReader reader=new BufferedReader(new InputStreamReader(connection.getInputStream()));StringBuilder json=new StringBuilder();String line;while((line=reader.readLine())!=null)json.append(line);reader.close();
                org.json.JSONObject remote=new org.json.JSONObject(json.toString());int latest=remote.optInt("versionCode",1);
                int current=getContext().getPackageManager().getPackageInfo(getContext().getPackageName(),0).versionCode;
                int minimum=remote.optInt("minimumVersionCode",1);boolean available=latest>current;
                result.put("reachable",true);result.put("available",available);result.put("required",available);result.put("currentVersionCode",current);result.put("latestVersionCode",latest);result.put("versionName",remote.optString("versionName",""));result.put("url","market://details?id="+getContext().getPackageName());result.put("notes",remote.optString("notes","A new app update is available."));
            } catch(Exception ignored) { try { result.put("currentVersionCode",getContext().getPackageManager().getPackageInfo(getContext().getPackageName(),0).versionCode); } catch(Exception ignoredAgain) {} result.put("reachable",false);result.put("available",false); }
            call.resolve(result);
        }).start();
    }
    @PluginMethod public void openUpdate(PluginCall call) {
        String packageName=getContext().getPackageName();
        Intent storeIntent=new Intent(Intent.ACTION_VIEW,Uri.parse("market://details?id="+packageName));
        storeIntent.setPackage("com.android.vending");
        try { getActivity().startActivity(storeIntent); }
        catch(Exception ignored) { getActivity().startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://play.google.com/store/apps/details?id="+packageName))); }
        call.resolve();
    }
}
