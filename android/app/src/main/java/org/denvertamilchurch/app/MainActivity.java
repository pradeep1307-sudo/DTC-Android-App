package org.denvertamilchurch.app;

import android.os.Bundle;
import android.os.Build;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        registerPlugin(YouTubeFeedPlugin.class);
        registerPlugin(BibleSpeechPlugin.class);
        registerPlugin(AppPreferencesPlugin.class);
        super.onCreate(state);
        if(Build.VERSION.SDK_INT>=26) {
            NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
            manager.deleteNotificationChannel("daily_verse_loud_v2");manager.deleteNotificationChannel("church_events");
            NotificationChannel daily=new NotificationChannel("daily_verse_v3","Daily Bible Verse",NotificationManager.IMPORTANCE_HIGH);
            daily.setDescription("Daily Scripture at 6:00 AM");daily.enableVibration(true);daily.setVibrationPattern(new long[]{0,500,250,500});manager.createNotificationChannel(daily);
            NotificationChannel events=new NotificationChannel("church_events_v2","Church Event Reminders",NotificationManager.IMPORTANCE_HIGH);
            events.setDescription("Service and church event reminders");events.enableVibration(true);events.setVibrationPattern(new long[]{0,500,250,500});manager.createNotificationChannel(events);
        }
        DailyVerseScheduler.schedule(this);
        EventReminderScheduler.schedule(this);
        handleDebugNotification(getIntent());
    }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent);setIntent(intent);handleDebugNotification(intent); }
    private void handleDebugNotification(Intent intent) { if((getApplicationInfo().flags&ApplicationInfo.FLAG_DEBUGGABLE)!=0&&intent!=null&&intent.getBooleanExtra("testDailyVerse",false)) new DailyVerseReceiver().onReceive(this,intent); }
}
