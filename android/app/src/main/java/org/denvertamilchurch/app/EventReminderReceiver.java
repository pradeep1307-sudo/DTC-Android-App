package org.denvertamilchurch.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;

public class EventReminderReceiver extends BroadcastReceiver {
    static final String CHANNEL="church_events_v2";
    @Override public void onReceive(Context context, Intent intent) {
        if (!context.getSharedPreferences("dtc_preferences",Context.MODE_PRIVATE).getBoolean("notifications",true)
                || !context.getSharedPreferences("dtc_preferences",Context.MODE_PRIVATE).getBoolean("event_reminders",true)) return;
        String title=intent.getStringExtra("title");
        String location=intent.getStringExtra("location");
        int minutes=intent.getIntExtra("minutes",0);
        boolean tamil="ta".equals(context.getSharedPreferences("dtc_preferences",Context.MODE_PRIVATE).getString("language","en"));
        String heading=minutes>0 ? (tamil?minutes+" நிமிடங்களில் நிகழ்ச்சி":"Event in "+minutes+" minutes") : (tamil?"நிகழ்ச்சி இப்போது தொடங்குகிறது":"Event starting now");
        NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
        if(Build.VERSION.SDK_INT>=26) {
            NotificationChannel channel=new NotificationChannel(CHANNEL,"Church Event Reminders",NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Service and church event reminders");channel.enableVibration(true);channel.setVibrationPattern(new long[]{0,500,250,500});manager.createNotificationChannel(channel);
        }
        Intent open=new Intent(context,MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending=PendingIntent.getActivity(context,intent.getIntExtra("notificationId",700),open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        String detail=(title==null?"Church event":title)+(location==null||location.isEmpty()?"":" - "+location);
        NotificationCompat.Builder notification=new NotificationCompat.Builder(context,CHANNEL).setSmallIcon(R.drawable.ic_notification).setContentTitle(heading).setContentText(detail).setStyle(new NotificationCompat.BigTextStyle().bigText(detail)).setContentIntent(pending).setAutoCancel(true).setCategory(NotificationCompat.CATEGORY_EVENT).setPriority(NotificationCompat.PRIORITY_HIGH).setDefaults(NotificationCompat.DEFAULT_ALL);
        manager.notify(intent.getIntExtra("notificationId",700),notification.build());
        EventReminderScheduler.schedule(context);
    }
}
