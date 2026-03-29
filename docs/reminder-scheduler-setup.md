# Reminder scheduler setup

This app sends reminder emails via:

- API route: `POST /api/cron/exam-reminders`
- Required auth: one of:
  - `Authorization: Bearer <CRON_SECRET>`
  - `x-cron-secret: <CRON_SECRET>`
  - query param `?secret=<CRON_SECRET>`

## 1) Environment variables

Set these on your deployed app:

- `CRON_SECRET` = long random secret
- `RESEND_API_KEY` = your Resend API key
- `REMINDER_FROM_EMAIL` = verified sender email in Resend

## 2) Create Cloud Scheduler job (recommended)

Use Cloud Scheduler to call your deployed endpoint every hour.

Replace values below:

- `PROJECT_ID`
- `REGION` (example: `us-central1`)
- `APP_BASE_URL` (example: `https://your-app.vercel.app`)
- `CRON_SECRET_VALUE`

```bash
gcloud scheduler jobs create http exam-reminders-hourly \
  --project=PROJECT_ID \
  --location=REGION \
  --schedule="*/30 * * * *" \
  --uri="APP_BASE_URL/api/cron/exam-reminders" \
  --http-method=POST \
  --headers="Authorization=Bearer CRON_SECRET_VALUE"
```

To update an existing job:

```bash
gcloud scheduler jobs update http exam-reminders-hourly \
  --project=PROJECT_ID \
  --location=REGION \
  --schedule="*/30 * * * *" \
  --uri="APP_BASE_URL/api/cron/exam-reminders" \
  --http-method=POST \
  --headers="Authorization=Bearer CRON_SECRET_VALUE"
```

## 3) Test manually

```bash
curl -X POST "APP_BASE_URL/api/cron/exam-reminders" \
  -H "Authorization: Bearer CRON_SECRET_VALUE"
```

Expected JSON:

```json
{ "ok": true, "sent": 0, "failed": 0 }
```

## 4) Quick troubleshooting

- `401 Unauthorized`: `CRON_SECRET` mismatch
- `500 ... RESEND_API_KEY ...`: missing email env vars
- reminders not sent: check `exam_reminders` documents are `enabled=true`, `status=scheduled`, and `remindAt <= now`
