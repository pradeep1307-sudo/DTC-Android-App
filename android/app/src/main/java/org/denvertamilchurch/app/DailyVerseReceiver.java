package org.denvertamilchurch.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.Calendar;
import java.util.TimeZone;

public class DailyVerseReceiver extends BroadcastReceiver {
    private static final String CHANNEL = "daily_verse_v3";
    private static String[] verseForToday(Context context) {
        String[] fallback={"Psalm 118:24","This is the day that Yahweh has made. We will rejoice and be glad in it!"};
        try (InputStream input=context.getAssets().open("public/assets/data/daily-verses.json"); ByteArrayOutputStream output=new ByteArrayOutputStream()) {
            byte[] buffer=new byte[4096]; int read;
            while((read=input.read(buffer))!=-1) output.write(buffer,0,read);
            JSONArray verses=new JSONObject(output.toString("UTF-8")).getJSONArray("verses");
            Calendar denver=Calendar.getInstance(TimeZone.getTimeZone("America/Denver"));
            int index=(denver.get(Calendar.DAY_OF_YEAR)-1)%verses.length();
            JSONObject verse=verses.getJSONObject(index);
            boolean tamil="ta".equals(context.getSharedPreferences("dtc_preferences",Context.MODE_PRIVATE).getString("language","en"));
            return new String[]{tamil?verse.optString("referenceTa",verse.getString("reference")):verse.getString("reference"),tamil?verse.optString("textTa",verse.getString("text")):verse.getString("text")};
        } catch(Exception ignored) { return fallback; }
    }
    @Override public void onReceive(Context context, Intent ignored) {
        if (!context.getSharedPreferences("dtc_preferences",Context.MODE_PRIVATE).getBoolean("notifications",true)
                || !context.getSharedPreferences("dtc_preferences",Context.MODE_PRIVATE).getBoolean("daily_verse",true)) return;
        NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
        if(Build.VERSION.SDK_INT>=26) {
            NotificationChannel channel=new NotificationChannel(CHANNEL,"Daily Bible Verse",NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Daily Scripture at 6:00 AM");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0,500,250,500});
            channel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).build());
            manager.createNotificationChannel(channel);
        }
        String[] verse=verseForToday(context);
        Intent open=new Intent(context,MainActivity.class); open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending=PendingIntent.getActivity(context,601,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        boolean tamil="ta".equals(context.getSharedPreferences("dtc_preferences",Context.MODE_PRIVATE).getString("language","en"));
        NotificationCompat.Builder notification=new NotificationCompat.Builder(context,CHANNEL).setSmallIcon(R.drawable.ic_notification).setContentTitle((tamil?"தினசரி வேதவசனம் - ":"Daily Verse - ")+verse[0]).setContentText(verse[1]).setStyle(new NotificationCompat.BigTextStyle().bigText(verse[1])).setContentIntent(pending).setAutoCancel(true).setCategory(NotificationCompat.CATEGORY_REMINDER).setPriority(NotificationCompat.PRIORITY_HIGH).setDefaults(NotificationCompat.DEFAULT_ALL);
        manager.notify(600,notification.build());
        DailyVerseScheduler.schedule(context);
    }
}
