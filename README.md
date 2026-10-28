# Ascend: a gamified habit tracker in liquid glass

Turn your habits into a game. Complete **quests** to earn XP and coins, build streaks, fight a **weekly boss**, and
take real damage when you slack. Everything is saved on your device automatically, so you can close the tab or shut
the computer down and pick up exactly where you left off.

No build step, no dependencies: plain HTML, CSS and JavaScript.

## Run it

```bash
# any static server works, e.g.
python3 -m http.server 8000
# then open http://localhost:8000
```

Or just open `index.html`. To use it every day (and keep one permanent copy of your data) host it on
**GitHub Pages**: *Settings → Pages → Deploy from a branch → `main` / root*. Then open the page on your phone or
laptop and choose **Install / Add to Home Screen** to use it like an app.

> Data lives in your browser's storage for the address you use. The `file://` copy, `localhost`, and your GitHub Pages
> URL are three separate places. Pick one and stick with it, and use **Settings → Export backup** to move or back up.

## Features

| | |
|---|---|
| **Quests** | Daily habits with emoji, colour, difficulty (Easy → Epic), weekday schedule, "times per day" counters (e.g. 8 glasses) and a reminder time |
| **XP, levels, ranks** | Level curve with ranks from Seedling to Mythic, streak multiplier, 12% critical hits, XP Elixir |
| **Streaks** | Current and longest streak, per-quest streaks, Streak Freezes that save a missed day |
| **GitHub / LeetCode style grids** | Yearly contribution grid (past year or any calendar year), a month-wise calendar with day detail, a 12-month overview, plus compact grids on Today and your profile |
| **Negative impact** | Missing quests costs **HP, XP and coins** at day end, breaks your streak, and at 0 HP you **die** (lose coins and XP). Ignoring a quest alarm costs HP. Hardcore mode doubles everything |
| **Weekly boss** | Every completed quest damages the boss. Defeat it for a big reward, or it escapes |
| **Daily chest, perfect-day bonus, 36 trophies** | Common → Legendary achievements |
| **Alarms** | Standalone alarms and per-quest reminders with six synthesized tones, full-screen takeover, escalating snooze cost, auto-escalation if ignored, optional browser notifications |
| **Sticky notes** | Draggable, resizable, pinnable, colourable glass notes that auto-save. Pinned notes show on Today |
| **Focus timer** | Pomodoro-style sessions that survive refreshes and reward XP and coins |
| **Vault** | Spend coins on power-ups and on **your own real-life rewards** (sushi night, gaming hour…) |
| **Your data** | Auto-save, daily rolling backup, JSON export/import, persistent-storage request |

Keyboard: `1`–`7` jump between screens, `n` creates a quest.

## Alarms: what to know

Browsers can't ring a web page that isn't running. Alarms fire while Ascend is open in a tab or installed as an
app (a background tab is fine). Browsers also require one tap on the page before they allow sound, so Ascend shows a
small "Tap anywhere to arm alarm sound" prompt. If a quest reminder passes while the app is closed, you'll still be
penalized the normal way when the day closes.

## Project layout

```
index.html            app shell
css/theme.css         tokens, animated backdrop, the liquid-glass material
css/components.css    HUD, dock, buttons, forms, modals, toasts
css/views.css         page layouts
js/store.js           state + persistence + backup/export
js/game.js            XP, streaks, penalties, day rollover, boss, achievements, shop
js/audio.js           synthesized sound effects and alarm tones (Web Audio)
js/alarm-engine.js    alarm scheduling and ringing
js/fx.js              confetti, floating rewards, shake, glass sheen
js/ui.js              router, HUD, dock, modals, reactions to game events
js/views/*.js         Today, Quests, Insights, Notes, Alarms, Focus, Vault, Settings
sw.js, manifest.*     offline support and installability
```
