package org.denvertamilchurch.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) { DailyVerseScheduler.schedule(context); EventReminderScheduler.schedule(context); }
}
