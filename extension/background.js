/* Ascend side panel: opens the panel from the toolbar icon and shows how many quests are left on the badge. */
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  refresh();
});

async function refresh() {
  const { snap } = await chrome.storage.local.get('snap');
  const today = new Date();
  const key = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  const left = snap && snap.date === key ? snap.quests.filter((q) => !q.done).length : 0;
  chrome.action.setBadgeText({ text: left ? String(left) : '' });
  chrome.action.setBadgeBackgroundColor({ color: snap && snap.theme === 'rose' ? '#c4688a' : '#b9743f' });
  chrome.action.setBadgeTextColor && chrome.action.setBadgeTextColor({ color: '#ffffff' });
}

chrome.storage.onChanged.addListener((c, area) => {
  if (area === 'local' && c.snap) refresh();
});
chrome.alarms && chrome.alarms.onAlarm.addListener(refresh);
refresh();
