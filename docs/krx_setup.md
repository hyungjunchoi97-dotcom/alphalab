# KRX Open API Setup

## 1. Get an API Key

1. Sign up at [KRX Open API](https://openapi.krx.co.kr)
2. Go to **My Page → API 인증키 신청** (Request API Key)
3. Request access to **주식 일별매매정보** (Stock Daily Trading)
4. Wait for approval (may take up to 1 business day)
5. Copy your key from **My Page → API 인증키 발급내역**

## 2. Configure Environment

### Local Development

Copy the example env file and fill in your values:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` with your keys. **Restart the dev server** after editing — Next.js does not hot-reload server env vars.

The app accepts any of these env variable names for the KRX key (checked in order, first match wins):

| Priority | Env Variable | Notes |
|----------|-------------|-------|
| 1 | `KRX_API_KEY` | **Preferred** |
| 2 | `KRX_AUTH_KEY` | Alias |
| 3 | `AUTH_KEY` | Legacy / generic |
| 4 | `KRX_KEY` | Short alias |

### Vercel (Production)

1. Go to your Vercel project → **Settings → Environment Variables**
2. Add `KRX_API_KEY` with your key value
3. Redeploy

## 3. Verify

Open in your browser:

```
http://localhost:3000/api/krx/health
```

Check the response:

| Field | Expected |
|-------|----------|
| `ok` | `true` |
| `hasKey` | `true` |
| `keyHint` | First 4 chars of your key + `...` |

Then check live data:

```
http://localhost:3000/api/krx/movers
```

The `source` field should be `"live"` when KRX returns data successfully.

## 4. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `source: "mock"` | `KRX_API_KEY` not set or server not restarted |
| `source: "live"` but empty | Key may not have approval for stock data yet |
| `message: "KRX API returned 401"` | Key invalid or not yet approved |
| `message: "KRX API returned 403"` | Key not approved for this specific service |
| `source: "stale-cache"` | Temporary KRX outage; cached data is being served |

## 5. Health Endpoint Auth

`/api/krx/health` returns limited info by default. To see full diagnostics (key hint, cache state), send the `x-admin-token` header matching `PB_ADMIN_TOKEN` from your env: `curl -H "x-admin-token: YOUR_TOKEN" localhost:3000/api/krx/health`

## 6. API Limits

- **10,000 requests/day** per key
- The app caches responses for 10 minutes to stay well within limits
- Data available from 2010 onwards
