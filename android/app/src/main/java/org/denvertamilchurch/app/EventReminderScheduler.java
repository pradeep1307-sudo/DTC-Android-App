package org.denvertamilchurch.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Calendar;
import java.util.HashSet;
import java.util.Set;
import java.util.Locale;
import java.util.TimeZone;

public final class EventReminderScheduler {
    private EventReminderScheduler() {}
    private static final TimeZone DENVER=TimeZone.getTimeZone("America/Denver");
    private static PendingIntent pending(Context context,JSONObject event,int minutes,int flags) throws Exception {
        String key=event.optString("id",event.optString("title"))+"-"+minutes;
        int requestCode=8000+(key.hashCode()&0x3fffffff)%1000000;
        Intent intent=new Intent(context,EventReminderReceiver.class).putExtra("title",event.optString("title","Church event")).putExtra("location",event.optString("location","")).putExtra("minutes",minutes).putExtra("notificationId",requestCode);
        return PendingIntent.getBroadcast(context,requestCode,intent,flags|PendingIntent.FLAG_IMMUTABLE);
    }
    private static Date nextOccurrence(JSONObject event,SimpleDateFormat parser,long now) throws Exception {
        String date=event.optString("date"),time=event.optString("time");
        if(!date.isEmpty()&&!time.isEmpty())return parser.parse(date+" "+time);
        String recurrence=event.optString("recurrence");
        if(recurrence.isEmpty()||time.isEmpty())return null;
        Date clock=new SimpleDateFormat("h:mm a",Locale.US).parse(time);if(clock==null)return null;
        Calendar source=Calendar.getInstance();source.setTime(clock);
        Calendar candidate=Calendar.getInstance(DENVER);candidate.set(Calendar.SECOND,0);candidate.set(Calendar.MILLISECOND,0);
        candidate.set(Calendar.HOUR_OF_DAY,source.get(Calendar.HOUR_OF_DAY));candidate.set(Calendar.MINUTE,source.get(Calendar.MINUTE));
        if("weekly-sunday".equals(recurrence)) {
            while(candidate.get(Calendar.DAY_OF_WEEK)!=Calendar.SUNDAY||candidate.getTimeInMillis()<=now)candidate.add(Calendar.DAY_OF_YEAR,1);
        } else if("weekly-friday".equals(recurrence)) {
            while(candidate.get(Calendar.DAY_OF_WEEK)!=Calendar.FRIDAY||candidate.getTimeInMillis()<=now)candidate.add(Calendar.DAY_OF_YEAR,1);
        } else if("first-sunday".equals(recurrence)) {
            candidate.set(Calendar.DAY_OF_MONTH,1);while(candidate.get(Calendar.DAY_OF_WEEK)!=Calendar.SUNDAY)candidate.add(Calendar.DAY_OF_MONTH,1);
            if(candidate.getTimeInMillis()<=now){candidate.add(Calendar.MONTH,1);candidate.set(Calendar.DAY_OF_MONTH,1);while(candidate.get(Calendar.DAY_OF_WEEK)!=Calendar.SUNDAY)candidate.add(Calendar.DAY_OF_MONTH,1);}
        } else if("third-sunday".equals(recurrence)) {
            candidate.set(Calendar.DAY_OF_MONTH,1);while(candidate.get(Calendar.DAY_OF_WEEK)!=Calendar.SUNDAY)candidate.add(Calendar.DAY_OF_MONTH,1);candidate.add(Calendar.DAY_OF_MONTH,14);
            if(candidate.getTimeInMillis()<=now){candidate.add(Calendar.MONTH,1);candidate.set(Calendar.DAY_OF_MONTH,1);while(candidate.get(Calendar.DAY_OF_WEEK)!=Calendar.SUNDAY)candidate.add(Calendar.DAY_OF_MONTH,1);candidate.add(Calendar.DAY_OF_MONTH,14);}
        } else if("first-of-month".equals(recurrence)) {
            candidate.set(Calendar.DAY_OF_MONTH,1);if(candidate.getTimeInMillis()<=now){candidate.add(Calendar.MONTH,1);candidate.set(Calendar.DAY_OF_MONTH,1);}
        } else return null;
        return candidate.getTime();
    }
    public static void schedule(Context context) {
        if (!context.getSharedPreferences("dtc_preferences",Context.MODE_PRIVATE).getBoolean("notifications",true)
                || !context.getSharedPreferences("dtc_preferences",Context.MODE_PRIVATE).getBoolean("event_reminders",true)) return;
        cancel(context);
        try(InputStream input=context.getAssets().open("public/assets/upcoming/events.json");ByteArrayOutputStream output=new ByteArrayOutputStream()) {
            byte[] buffer=new byte[4096];int count;while((count=input.read(buffer))!=-1)output.write(buffer,0,count);
            JSONArray events=new JSONArray(output.toString("UTF-8"));
            SimpleDateFormat parser=new SimpleDateFormat("yyyy-MM-dd h:mm a",Locale.US);parser.setTimeZone(DENVER);
            AlarmManager alarms=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
            long now=System.currentTimeMillis();
            Set<Long> scheduledTimes=new HashSet<>();
            for(int i=0;i<events.length();i++) {
                JSONObject event=events.getJSONObject(i);Date parsed=nextOccurrence(event,parser,now);if(parsed==null||parsed.getTime()<now||!scheduledTimes.add(parsed.getTime()))continue;
                for(int minutes:new int[]{10,5,0}) {
                    long trigger=parsed.getTime()-minutes*60000L;if(trigger<=now)continue;
                    PendingIntent pending=pending(context,event,minutes,PendingIntent.FLAG_UPDATE_CURRENT);
                    if(Build.VERSION.SDK_INT<Build.VERSION_CODES.S||alarms.canScheduleExactAlarms()) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,trigger,pending);
                    else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,trigger,pending);
                }
            }
        } catch(Exception ignored) {}
    }
    public static void cancel(Context context) {
        try(InputStream input=context.getAssets().open("public/assets/upcoming/events.json");ByteArrayOutputStream output=new ByteArrayOutputStream()) {
            byte[] buffer=new byte[4096];int count;while((count=input.read(buffer))!=-1)output.write(buffer,0,count);
            JSONArray events=new JSONArray(output.toString("UTF-8"));AlarmManager alarms=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
            for(int i=0;i<events.length();i++)for(int minutes:new int[]{10,5,0}) { PendingIntent item=pending(context,events.getJSONObject(i),minutes,PendingIntent.FLAG_NO_CREATE);if(item!=null)alarms.cancel(item); }
        } catch(Exception ignored) {}
    }
}
