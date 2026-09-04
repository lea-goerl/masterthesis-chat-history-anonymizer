# Deploying to the LMU server (privacy-guardrail.medien.ifi.lmu.de)

The app has two parts served by **one** process:

- the **React frontend** (built into `dist/`), and
- a small **FastAPI backend** (`server/main.py`) that serves that frontend *and*
  accepts `POST /submit`, writing **one JSON file per participant**.

It runs with `uvicorn` on `localhost:50000`; the existing **Nginx** reverse
proxy already forwards outside traffic there. **No Node.js is needed on the
server** — you build locally and upload the finished `dist/` folder.

Participant data (the donated chats) is stored **only on the LMU server**, which
is what you want for data protection.

---

## 1. Build the frontend locally

On your own machine, in the project root:

```bash
npm install          # first time only
npm run build        # produces dist/
```

Before going live, remove or dev-gate the "Download JSON (test)" button in
`src/components/ExportControls.tsx` if you don't want participants to see it.

## 2. Get onto the university network

SSH only works inside the MWN. From home, connect via **eduVPN**
(https://doku.lrz.de/vpn-ins-mwn-10333177.html) first.

## 3. Upload the app + build

Pick a clean folder on the server, e.g. `~/web/privacy-guardrail-pre-study`.
From the project root, upload the backend files and the build (SSH port is 22022):

```bash
ssh -p 22022 privacy-guardrail@immimed-prjsv22.medien.ifi.lmu.de "mkdir -p ~/web/privacy-guardrail-pre-study"

scp -P 22022 server/main.py server/requirements.txt \
    privacy-guardrail@immimed-prjsv22.medien.ifi.lmu.de:~/web/privacy-guardrail-pre-study/

scp -P 22022 -r dist \
    privacy-guardrail@immimed-prjsv22.medien.ifi.lmu.de:~/web/privacy-guardrail-pre-study/
```

After this the server should contain:

```
~/web/privacy-guardrail-pre-study/
├── main.py
├── requirements.txt
└── dist/            (index.html, assets/, ...)
```

## 4. Create a Python environment on the server

```bash
ssh -p 22022 privacy-guardrail@immimed-prjsv22.medien.ifi.lmu.de
cd ~/web/privacy-guardrail-pre-study
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
mkdir -p data/submissions
```

## 5. Quick manual test (before touching systemd)

Stop the dummy app so port 50000 is free, then run ours by hand:

```bash
sudo systemctl stop privacy-guardrail
.venv/bin/uvicorn main:app --host 127.0.0.1 --port 50000
```

In another terminal (or a browser via the public URL):

```bash
curl localhost:50000/healthz
# -> {"status":"ok", ...}
```

Then open **https://privacy-guardrail.medien.ifi.lmu.de/?id_one=testrun** in a
browser, upload a ChatGPT export, mask + tag, and submit. A file
`testrun__<timestamp>.json` should appear in `data/submissions/`.
Stop the manual run with Ctrl+C when done.

## 6. Make it permanent (systemd)

You have `sudo` for `systemctl`/`journalctl` on this service, but you can't edit
the unit file yourself. Send `server/privacy-guardrail.service.example` to Rainer
and ask him to point the existing `privacy-guardrail.service` at this app —
specifically `WorkingDirectory`, the `SUBMISSION_DIR` env var, and `ExecStart`
(the `main:app` uvicorn line in the example).

Once he's updated it:

```bash
sudo systemctl restart privacy-guardrail
sudo systemctl status  privacy-guardrail
sudo journalctl -u privacy-guardrail -f      # live logs while you test
```

## 7. Give participants the link

Participants never download anything. They open a URL with their id, e.g.:

```
https://privacy-guardrail.medien.ifi.lmu.de/?id_one=<PARTICIPANT_ID>
```

Your study tool (Prolific / SoSci) normally fills in `id_one` automatically, and
after submitting, the app redirects back there (see `src/vars.tsx` /
`ExportControls.tsx`).

---

## Updating later

Rebuild locally (`npm run build`), re-upload `dist/` (step 3), and
`sudo systemctl restart privacy-guardrail`. The backend rarely changes; usually
only `dist/` needs re-uploading.

## Where the data lives

Each submission → `data/submissions/<id_one>__<UTC-timestamp>.json`, containing:

```json
{
  "received_at": "2026-07-05T15:38:21+00:00",
  "remote_addr": "…",
  "payload": {
    "id_one": "…",
    "conversations": [ /* user prompts only, masked */ ],
    "masking_summary": { "tag_counts": { … }, "masked_terms": [ { "tag": "…", "length": 12 } ] },
    "total_conversations": 4,
    "total_messages": 6,
    "all_chat_length": 12
  }
}
```

Note: the same `/submit` endpoint also receives the help/error reports the
frontend sends (they'll have a `helpMessage` field instead of `conversations`).
