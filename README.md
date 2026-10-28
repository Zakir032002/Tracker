# Ascend: a habit tracker built like a game

Turn your habits into quests. Earn XP and coins, build streaks, fight a weekly boss, and take real damage when you
slack. Your progress is saved on your device automatically, so you can close the tab or shut the computer down and
pick up exactly where you left off.

The interface is a WebGL scene with an editorial design system, in three themes you can switch between with a
circular reveal (the moon/sun/sparkle button, or Settings → Appearance):

- **Obsidian**: warm black, one muted accent.
- **Bone**: warm paper light.
- **Rosé Aurum**: light blush pink with champagne gold. A faceted rose-quartz jewel ringed with a gold ribbon and
  pearls, drifting 3D petals and sparkles, gold-leaf headlines, a rose-gold skyline, a sunset sanctuary and a cursor
  that leaves star dust.

Instrument Serif / Geist / Geist Mono type, inertial scrolling, and choreographed transitions throughout.

## Run it

```bash
npm install        # only needed to rebuild the 3D bundle
python3 -m http.server 8000     # any static server works
# open http://localhost:8000
```

`index.html` also opens directly from disk, but browsers block loading audio files from `file://`, so the Sanctuary
sounds need a server. The easiest permanent home is **GitHub Pages**: *Settings → Pages → Deploy from a branch →
`main` / root*. Use that one URL every day: data lives in your browser's storage for the address you use, so
`file://`, `localhost` and your Pages URL are three separate places. **Settings → Export backup** moves it between them.

The built 3D bundle (`js/scene.bundle.js`) is committed. After editing anything in `src/scene/`, run `npm run build`.

## What's inside

| | |
|---|---|
| **Today** | A sticky hero with the live 3D *Ascension Core*: a glass gem whose ember brightens with your progress, with orbiting beads for each quest and a ring for the week. Quest stream, weekly boss, daily chest |
| **Quests** | Habits with emoji, colour, difficulty, weekday schedule, "times per day" counters and reminder times |
| **Insights** | A 3D **contribution skyline** (one tower per day, hover for details), a GitHub-style yearly grid, a LeetCode-style month calendar, a 12-month overview and charts |
| **Penalties** | Missing quests costs HP, XP and coins at day end, breaks your streak, and at 0 HP you die. Ignoring a quest alarm costs HP. Hardcore mode doubles everything |
| **Sanctuary** | A moonlit 3D ocean that reacts to the audio. Layer light/heavy rain, rain on window, thunder, ocean waves, temple and singing bowl, with sleep timer and one-tap mixes |
| **Brainwave generator** | Binaural beats (or isochronic tones for speakers) from 0.5 to 40 Hz with delta / theta / alpha / beta / gamma presets, adjustable carrier, optional pink-noise bed and three guided journeys that glide the beat (Focus ramp, Wind down, Sleep descent) |
| **Alarms** | Alarms and per-quest reminders with six synthesized tones, a full-screen takeover, escalating snooze cost, damage if you ignore a quest alarm. Ambient audio ducks while an alarm rings |
| **Notes** | Draggable, resizable, pinnable sticky notes that auto-save |
| **Focus** | Pomodoro-style sessions that survive refreshes, optionally with a rain mix |
| **Vault** | A turning 3D **rank medal** (level numeral and rank, metal changes per theme), your **ascent path** through the ranks, coins for power-ups and *your own* real-life rewards, 38 trophies, profile with streak grid |
| **Intention** | A thought for the day on Today, which you can replace with your own one-line intention |
| **Stays on screen** | Quests marked *Keep it on my screen* and your pinned sticky notes follow you: in a Chrome side panel (extension) or a small always-on-top window |

Keyboard: `1`–`8` jump between screens, `n` creates a quest.

## Keep quests beside your tabs

A web page can't dock itself to the edge of Chrome, so there are two ways to keep your quests in view. Both show every
quest that is *Keep it on my screen* (on by default, switch it off per quest in the editor) and your pinned sticky
notes. You can tick quests, add +1 to counters, and add, edit or delete notes from either one, and the app updates.
They stay until you complete the quest, delete it, or delete the note.

1. **Chrome side panel (recommended).** Open `chrome://extensions`, turn on *Developer mode*, choose *Load unpacked*
   and pick the `extension/` folder. Click the Ascend icon in the toolbar to open the panel beside your tabs; the
   badge counts quests left today. Keep Ascend open in a tab (a background tab is fine) so changes sync. If you close it,
   changes you make in the panel wait in a queue and apply the next time you open Ascend.
   The extension only runs on `*.github.io`, `localhost` and `127.0.0.1`. If you host Ascend on your own domain, add it
   to `content_scripts.matches` in `extension/manifest.json`. Run `scripts/sync-ext.sh` after changing shared styles.
2. **Pin to screen.** The *Pin to screen* button on Today opens a small always-on-top window (Document
   Picture-in-Picture in Chrome and Edge, a compact pop-up elsewhere) that stays above your other windows.

Nothing leaves your device: the extension only reads the snapshot the app publishes and relays a short whitelist of
commands (toggle, +1, add/edit/delete note, add quest).

## About the brainwave generator

Binaural beats play a slightly different tone in each ear; the perceived "beat" is the difference. A 2019
meta-analysis of 22 studies ([Garcia-Argibay, Santed & Reales, *Psychological Research*](https://pubmed.ncbi.nlm.nih.gov/30073406/))
found a medium overall effect (g ≈ 0.45) on attention, memory, anxiety and pain, with the size depending on the
frequency, how long you listen and whether you listen before or during the task. Later work on memory and attention is
more mixed. Treat it as a relaxation and focus aid, not medicine. Use stereo headphones, keep the volume low, and skip
it if you have epilepsy or a seizure disorder. The visual beating in the 3D scene is deliberately slow (never a strobe).

## Alarms: what to know

Browsers can't ring a page that isn't running. Alarms fire while Ascend is open in a tab or installed as an app (a
background tab is fine), and browsers require one tap on the page before they allow sound. If a reminder passes while
the app is closed, you are still penalized the normal way when the day closes.

## Credits

- Ambient recordings are from [Moodist](https://github.com/remvze/moodist) by remvze (MIT). Individual sounds there are
  under the Pixabay Content License or CC0.
- [Three.js](https://threejs.org), [GSAP](https://gsap.com), [Lenis](https://lenis.darkroom.engineering).
- Fonts: Instrument Serif, Geist and Geist Mono (SIL Open Font License), self-hosted.

## Layout

```
index.html            app shell
src/scene/*.js        the 3D scene (core, skyline, sanctuary ocean, medal, rosefx petals/sparkles); bundled by esbuild
js/scene.bundle.js    built scene bundle (committed)
js/store.js           state, persistence, backup/export
js/game.js            XP, streaks, penalties, day rollover, boss, achievements, shop
js/sound.js           ambient loops + binaural / isochronic generator (Web Audio)
js/audio.js           synthesized UI sounds and alarm tones
js/motion.js          smooth scroll, cursor, magnetic buttons, tilt, text reveals, route curtain
js/bridge.js          snapshot + command bridge for the side panel and pin window
js/pin.js             "Pin to screen" window
extension/            Chrome side-panel extension (manifest, content script, panel)
js/ui.js              router, HUD, nav, modals, 3D placement, reactions to game events
js/views/*.js         Today, Quests, Insights, Notes, Alarms, Focus, Sanctuary, Vault, Settings
css/*.css             tokens + atmosphere, components, views, rose theme, pin/panel
assets/sounds/*.mp3   Moodist recordings
```
