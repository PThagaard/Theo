package com.pthagaard.theoballoner;

import android.app.ActivityManager;
import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Pins the app to the screen with Android's screen pinning ("Fastgør vinduer"), so a small
 * child cannot leave it. The system asks the parent to confirm the first time; unpinning
 * needs the usual "swipe up and hold" gesture (or this plugin's unlock from the parent menu).
 */
@CapacitorPlugin(name = "KidLock")
public class KidLockPlugin extends Plugin {

    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("supported", true);
        result.put("locked", isLocked());
        call.resolve(result);
    }

    @PluginMethod
    public void lock(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (!isLocked()) getActivity().startLockTask();
                JSObject result = new JSObject();
                result.put("locked", isLocked());
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Kunne ikke låse appen: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void unlock(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (isLocked()) getActivity().stopLockTask();
                JSObject result = new JSObject();
                result.put("locked", isLocked());
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Kunne ikke låse op: " + e.getMessage());
            }
        });
    }

    private boolean isLocked() {
        ActivityManager manager = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        return manager != null && manager.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
    }
}
