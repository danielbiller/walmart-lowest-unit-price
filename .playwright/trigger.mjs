// Trigger-only shim: sends lup:activate from the extension SW's main world
// (the one op unreachable through CLI/MCP page-world tools). Everything else
// (assert/click/screenshot) happens through playwright-cli.
const PORT = 9223;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SW_ID = "imcnbgfhjlogjpdgnhbfnghbkacjlkbb";
const list = async () => await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();

// Attach to our SW (debugger-attached workers are exempt from idle shutdown).
let swWs = null;
for (let i = 0; i < 20 && !swWs; i++) {
  const all = await list();
  const ours = all.find((t) => t.type === "service_worker" && t.url.includes(SW_ID));
  if (ours) {
    swWs = new WebSocket(ours.webSocketDebuggerUrl);
    await new Promise((res, rej) => { swWs.addEventListener("open", res, { once: true }); swWs.addEventListener("error", rej, { once: true }); });
    break;
  }
  await sleep(500);
}
if (!swWs) { console.log("TRIGGER: no SW"); process.exit(2); }
console.log("TRIGGER: attached, worker held");

let id = 0;
const evaluate = (expression) => new Promise((resolve, reject) => {
  const cur = ++id;
  const to = setTimeout(() => reject(new Error("CDP timeout")), 30000);
  const onMsg = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id === cur) { swWs.removeEventListener("message", onMsg); clearTimeout(to); resolve(m); }
  };
  swWs.addEventListener("message", onMsg);
  swWs.send(JSON.stringify({ id: cur, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
});

// Retry until the content script answers (it injects at document_idle).
for (let i = 0; i < 30; i++) {
  const r = await evaluate(`chrome.tabs.query({active:true,currentWindow:true}).then(([t]) => t ? chrome.tabs.sendMessage(t.id, {type:'lup:activate'}).then(()=>'SENT:'+t.id, e=>'RETRY:'+e.message) : 'NO_TABS')`);
  const v = r.result?.result?.value ?? JSON.stringify(r).slice(0, 120);
  if (String(v).startsWith("SENT")) { console.log("TRIGGER: " + v); process.exit(0); }
  await sleep(2000);
}
console.log("TRIGGER: content script never answered");
process.exit(1);
