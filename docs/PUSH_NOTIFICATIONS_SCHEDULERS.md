# Prahari — Push Notifications & Reminders Scheduler

This document details the scheduling, browser Push API payloads, and background workers designed to handle medication reminder schedules and staggering intervals in Prahari (MedLens).

---

## 1. Push Notifications Architecture

Medication reminders are designed to run locally using the **HTML5 Service Worker Push API** to preserve user privacy and operate without database storage.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           BROWSER CLIENT                                │
│                                                                         │
│  [ MedicationsPage ] ──► Registers Reminders ──► [ Local Storage ]      │
│                                                          │              │
│  [ Push Notification ] ◄── Triggered by Worker ◄─── [ Service Worker ]  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

1.  **Registering Schedules:** Tapping a medication's "Remind Me" toggle registers a schedule inside the client-side `localStorage`.
2.  **Notification Authorization:** The browser requests permission via `Notification.requestPermission()`.
3.  **Service Worker Trigger:** Notifications are shown in response to events (e.g., Push messages from a backend or user interaction); long-running timers in a Service Worker are not reliable.

---

## 2. Medication Staggering Scheduler (Schedule Guardian)

When a user logs multiple medications, Prahari checks for interaction conflicts and alerts the user to space them out.

### 2.1 Staggering Calculations
If a drug-drug interaction warning is detected (e.g., *Fluoroquinolones* + *Calcium Antacids*), the scheduler enforces a minimum separation interval of **2 hours**:

```
Medication A Intake (e.g., Ciprofloxacin, 8:00 AM)
 ├─── Staggering Interval: 2 Hours (No Antacids allowed)
 ▼
Medication B Intake (e.g., Calcium Antacids, 10:00 AM)
```

### 2.2 Schedule Generation Algorithm
The front-end scheduler checks for overlaps and calculates intake times:
```javascript
// Example scheduling calculation
function calculateSafeTimes(activeMeds, interactionMatrix) {
  let schedule = {};
  let baseHour = 8; // Start at 8:00 AM
  
  activeMeds.forEach((med, index) => {
    let hasConflict = activeMeds.some((otherMed, otherIdx) => {
      if (index === otherIdx) return false;
      return interactionMatrix[med.rxcui]?.[otherMed.rxcui] === 'T1_Critical';
    });
    
    let intakeHour = baseHour + (hasConflict ? index * 2 : 0);
    schedule[med.name] = `${intakeHour}:00`;
  });
  
  return schedule;
}
```

---

## 3. Local OS Notification Payload

When the service worker fires, the OS notification utilizes the following payload format:
```json
{
  "title": "🛡️ Prahari Medication Sentinel",
  "options": {
    "body": "It's time to take Metformin 500mg. Tap to review warnings.",
    "icon": "/prahari-icon.svg",
    "badge": "/prahari-icon.svg",
    "tag": "med-reminder-metformin",
    "requireInteraction": true,
    "actions": [
      { "action": "confirm", "title": "Take Dose" },
      { "action": "snooze", "title": "Snooze 15m" }
    ]
  }
}
```
 Tapping `Take Dose` registers the event in the client's transient logs, updating the daily schedule status card.
