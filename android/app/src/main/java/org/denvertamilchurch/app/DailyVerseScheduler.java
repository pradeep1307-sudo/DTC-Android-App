package org.denvertamilchurch.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import java.util.Calendar;

public final class DailyVerseScheduler {
    private DailyVerseScheduler() {}
    public static void schedule(Context context) {
        if (!context.getSharedPreferences("dtc_preferences",Context.MODE_PRIVATE).getBoolean("notifications",true)
                || !context.getSharedPreferences("dtc_preferences",Context.MODE_PRIVATE).getBoolean("daily_verse",true)) return;
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, DailyVerseReceiver.class);
        PendingIntent pending = PendingIntent.getBroadcast(context, 600, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Calendar next = Calendar.getInstance(); next.set(Calendar.HOUR_OF_DAY, 6); next.set(Calendar.MINUTE, 0); next.set(Calendar.SECOND, 0); next.set(Calendar.MILLISECOND, 0);
        if (next.getTimeInMillis() <= System.currentTimeMillis()) next.add(Calendar.DAY_OF_YEAR, 1);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()) {
            alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pending);
        } else {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pending);
        }
    }
}
