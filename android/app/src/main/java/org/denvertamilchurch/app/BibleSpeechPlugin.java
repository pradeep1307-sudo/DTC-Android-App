package org.denvertamilchurch.app;

import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;
import java.util.Set;
import android.speech.tts.Voice;

@CapacitorPlugin(name = "BibleSpeech")
public class BibleSpeechPlugin extends Plugin {
    private static final String GOOGLE_TTS = "com.google.android.tts";
    private TextToSpeech speech;
    private boolean ready;

    private boolean hasGoogleSpeechServices() {
        try {
            getContext().getPackageManager().getPackageInfo(GOOGLE_TTS, 0);
            return true;
        } catch (android.content.pm.PackageManager.NameNotFoundException error) {
            return false;
        }
    }

    private Voice selectTamilVoice() {
        Set<Voice> voices = speech.getVoices();
        if (voices == null) return null;
        Voice best = null;
        int bestScore = Integer.MIN_VALUE;
        for (Voice voice : voices) {
            if (voice.getLocale() == null || !"ta".equals(voice.getLocale().getLanguage())) continue;
            String name = voice.getName().toLowerCase(Locale.US);
            int score = voice.getQuality();
            if (!voice.isNetworkConnectionRequired()) score += 40;
            if (name.contains("female") || name.contains("-taf") || name.contains("_female")) score += 100;
            if (name.contains("male") || name.contains("-tam")) score -= 100;
            if (best == null || score > bestScore) { best = voice; bestScore = score; }
        }
        return best;
    }

    private void initialize(PluginCall call, Runnable action) {
        if (speech != null && ready) {
            action.run();
            return;
        }
        getActivity().runOnUiThread(() -> {
            if (speech != null && ready) {
                action.run();
                return;
            }
            TextToSpeech.OnInitListener listener = status -> {
                if (status != TextToSpeech.SUCCESS) {
                    ready = false;
                    call.reject("Android text to speech could not start");
                    return;
                }
                speech.setSpeechRate(0.88f);
                speech.setPitch(1.0f);
                ready = true;
                action.run();
            };
            speech = hasGoogleSpeechServices()
                ? new TextToSpeech(getContext(), listener, GOOGLE_TTS)
                : new TextToSpeech(getContext(), listener);
        });
    }

    @PluginMethod
    public void shareVerse(PluginCall call) {
        String text=call.getString("text","").trim();
        if(text.isEmpty()){call.reject("No verse was selected");return;}
        Intent share=new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_SUBJECT,"Bible verse from Denver Tamil Church").putExtra(Intent.EXTRA_TEXT,text);
        getActivity().startActivity(Intent.createChooser(share,"Share Bible verse"));
        call.resolve();
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "").trim();
        if (text.isEmpty()) {
            call.reject("No verse was provided");
            return;
        }
        initialize(call, () -> getActivity().runOnUiThread(() -> {
            String requestedLanguage=call.getString("language","en-US");
            Locale locale=requestedLanguage.startsWith("ta") ? Locale.forLanguageTag("ta-IN") : Locale.US;
            int language=speech.setLanguage(locale);
            if(language==TextToSpeech.LANG_MISSING_DATA||language==TextToSpeech.LANG_NOT_SUPPORTED){call.reject((requestedLanguage.startsWith("ta")?"Tamil":"English")+" speech data is unavailable on this device");return;}
            if (requestedLanguage.startsWith("ta")) {
                Voice tamilVoice = selectTamilVoice();
                if (tamilVoice != null) speech.setVoice(tamilVoice);
                speech.setSpeechRate(0.80f);
                speech.setPitch(1.08f);
            } else {
                speech.setSpeechRate(0.88f);
                speech.setPitch(1.0f);
            }
            Bundle options = new Bundle();
            int result = speech.speak(text, TextToSpeech.QUEUE_FLUSH, options, "bible-verse");
            if (result == TextToSpeech.ERROR) call.reject("The verse could not be read");
            else {
                JSObject response = new JSObject();
                response.put("speaking", true);
                call.resolve(response);
            }
        }));
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (speech != null) speech.stop();
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (speech != null) {
            speech.stop();
            speech.shutdown();
            speech = null;
        }
        ready = false;
        super.handleOnDestroy();
    }
}
