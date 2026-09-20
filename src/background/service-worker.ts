// Background service worker: activates the content script on toolbar click.
// No default_popup is set on the action, so onClicked fires as expected.

chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;
  // sendMessage rejects if the content script isn't listening (e.g. non-Walmart tab).
  chrome.tabs.sendMessage(tab.id, { type: "lup:activate" }).catch(() => {});
});
