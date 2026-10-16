# Live validation with playwright-cli (paper towels + `+5 more`)

Config (`cli.config.json`, auto-loaded) launches Chromium headed with
`dist/` as an unpacked extension, plus `--remote-debugging-port=9223` for
the trigger shim. The CLI covers everything in page-land; the one op it
cannot do — sending `lup:activate` from the extension's service-worker
context (`run-code`/`worker.evaluate` never expose `chrome.*`) — is
`trigger.mjs` (raw CDP `Runtime.evaluate`, ~60 lines, no deps).

## One-time seed per machine (~5 min)

Chrome 155 silently neuters unpacked extensions without dev mode (worker
sees zero windows, no errors logged). The profile below persists locally
(gitignored) so this is once per machine, not per run:

```bash
npm run build
PROFILE=$PWD/.playwright/profile
DISPLAY=:99 playwright-cli -s=seed open "https://www.walmart.com/search?q=paper+towels" --headed --profile=$PROFILE  # creates profile
DISPLAY=:99 playwright-cli -s=seed close
node -e "const fs=require('fs');const f='$PROFILE/Default/Preferences';const p=JSON.parse(fs.readFileSync(f,'utf8'));p.extensions.ui.developer_mode=true;for(const e of Object.values(p.extensions.settings||{})){if(e?.path?.includes('walmart-lowest-unit-price'))e.disable_reasons=[];}fs.writeFileSync(f,JSON.stringify(p));"
rm -f $PROFILE/Default/Secure*
```

## Each run

```bash
npm run build   # the browser serves extension code from launch time; never validate edited code in a stale browser
DISPLAY=:99 playwright-cli -s=wally open "https://www.walmart.com/search?q=paper+towels" --headed --profile=$PWD/.playwright/profile
node .playwright/trigger.mjs                        # SENT:<tabid>
DISPLAY=:99 playwright-cli -s=wally eval "<marker assertions on data-lup-*>"
DISPLAY=:99 playwright-cli -s=wally snapshot --filename=panel.yaml   # find the +5 ref
DISPLAY=:99 playwright-cli -s=wally click <ref>     # Details first (panel is collapsed), then +5 more
DISPLAY=:99 playwright-cli -s=wally eval "<re-probe counts + overlay>"
DISPLAY=:99 playwright-cli -s=wally screenshot --filename=proof.png  # on fail (or record)
DISPLAY=:99 playwright-cli -s=wally close
```

## Reading results

- Pass/fail on our markers (`data-lup-ranked`, `data-lup-unit-price`, one badge per group, overlay text); inspect host markup freely for diagnosis.
- `+5 more` fetching zero pages with the honest stalled note is a **pass** of that path — live `fetch()` hits intermittent PerimeterX `/blocked` (200 with 0 tiles). Identical runs differing = environment, not code; allow ~2 min for slow page fetches before judging.
- Port (9223) and extension ID in `trigger.mjs` derive from `cli.config.json` and the `dist` path — only change them if those move.
