# paved-road-demo

Multi-service reference demo (DEL-720): a small full-stack guestbook app,
deployed end-to-end through every baseline service the paved-road
platform (DEL-453/454) built in Phases 1-5.4, so there's one working
example to walk a prospective client through instead of describing the
platform in the abstract.

Unlike `dfplatform-status` (which deliberately offloads its frontend to
Cloudflare Pages), this app stays entirely on the platform - web tier,
backend tier, and persistence all run on the Proxmox cluster, so the demo
actually exercises the reverse proxy, service discovery, and Cloudflare
Tunnel ingress rather than bypassing them.

## Architecture

```
Internet          Cloudflare Tunnel        Web VLAN (200)         Backend VLAN (300)
┌──────────┐      ┌─────────────────┐      ┌──────────────────┐   ┌────────────────────┐
│ Browser   │─────▶│ reverse-proxy   │─────▶│ web/ (demo-web)   │──▶│ api/ (demo-api)     │
│           │ GET  │ (Caddy, Phase 4)│ GET  │ static UI + BFF   │ POST/GET  │ SQLite on disk      │
└──────────┘      └─────────────────┘      └──────────────────┘   └────────────────────┘
                                                      │                        ▲
                                                      │ resolves               │ Guide pushes this
                                                      ▼ demo-api.df.protected  │ route into the
                                            Infra-VLAN DNS resolver ──────────┘ backend Caddy fleet
                                            (DEL-719 zones)                     once self-placed
```

- **`web/`** (tier: `web`) - static guestbook UI (`public/`) plus a thin
  Node BFF (`server.js`) that proxies `/api/entries` to the backend tier
  server-side. The browser never talks to `demo-api` directly - Backend
  VLAN isn't internet-reachable by design
  (`proxmox-iac/docs/service-discovery-design.md`), so this hop has to
  happen inside the lab, the same pattern `dfplatform-status/api` uses to
  reach `backend-canary`.
- **`api/`** (tier: `backend`) - the actual business logic: validates and
  persists guestbook entries to a SQLite file (`node:sqlite`, Node core,
  no native deps) on the container's own disk. No separate database
  service - `curator/docs/design.md`'s "Floor plan" section makes the same
  call for Curator's own state, for the same reason (every workload here
  is small and single-instance; a managed DB engine would be the
  speculative scale this platform's own design docs warn against).

Both services expose `/healthz` (unauthenticated, for Caddy's upstream
health check) separately from the data path, same convention
`dfplatform-status` uses.

## Service discovery and routing

`demo-web` reaches `demo-api` at `http://demo-api.df.protected/api/entries`
- the backend-zone wildcard DNS DEL-719 added to the Infra resolver,
which `demo-web`'s own container also resolves through (same resolver
web-tier compute nodes already use). That resolves to the backend zone's
Caddy fleet; Caddy then routes on the `Host: demo-api` header to wherever
Curator/Guide actually placed the `demo-api` container - no hardcoded IP
anywhere in this repo, consistent with every other Catalogue-deployed
service.

Public ingress for `demo-web` needs no proxmox-iac change at all: DEL-768
already made the Cloudflare Tunnel ingress a single wildcard
(`*.<cloudflare_zone>`, forwarded to every node's Caddy regardless of
hostname), and `curator/docs/design.md`'s "Guide - pushing to Caddy"
section is explicit that once a service is Catalogue-deployed, Guide
pushes its Caddy route live the moment it self-places - including a
brand-new hostname, not just an update to an existing one.
`services/*.yaml`-rendered Terraform routes are only for the pre-Curator
services (`hello-world`, `status-page`, `backend-canary`) that predate
Guide; `demo-web` is Catalogue-deployed from day one, so it never needs
one.

## Running locally

```sh
nvm use
npm install
npm test     # unit tests for both services
npm run lint

DB_PATH=./demo.db node api/server.js        # PORT=8080 by default
API_URL=http://127.0.0.1:8080/api/entries PORT=8081 node web/server.js
```

Then open `http://127.0.0.1:8081`.

## Deployment runbook

1. **Images** - this repo's `.github/workflows/ci.yml` builds and pushes
   `registry.infra:5000/demo-api` and `registry.infra:5000/demo-web`,
   tagged with the commit SHA, on every merge to `main` (self-hosted
   `infra-vlan` runner, same as `dfplatform-status`).
2. **Catalogue** - `df-config/catalogue/demo-api.yaml` (tier `backend`)
   and `demo-web.yaml` (tier `web`) declare the deploy-time config
   (image, tag, port, resources). Bump each entry's `tag` to the real
   commit SHA once CI has published it - `curator deploy` never resolves
   floating tags.
3. **Deploy** - trigger `deltafamiglia/curator`'s `workflow_dispatch` job
   (`curator deploy demo-api`, then `curator deploy demo-web`) the same
   way DEL-716's deployment pipeline already does for every other
   Catalogue entry.
4. **Public hostname** - nothing to do here: `demo.<cloudflare_zone>`
   already resolves through DEL-768's existing wildcard Cloudflare
   ingress, and Guide pushes `demo-web`'s live route into the web-zone
   Caddy fleet the moment it self-places - see "Service discovery and
   routing" above.
5. **Verify** - `https://demo.<cloudflare_zone>` loads the guestbook,
   submitting an entry round-trips through `demo-web` -> `demo-api` ->
   SQLite and back; `curl https://demo.<cloudflare_zone>/healthz` and the
   same against `demo-api.df.protected` from an Infra-VLAN host confirm
   both tiers independently.

Steps 2-5 touch live Terraform state, Vault, and GitHub Actions
credentials this repo doesn't hold - they're Neil's to run/apply, same
division DEL-719's own thread used (code lands via PR review, `tofu
plan`/`apply` and the actual `workflow_dispatch` trigger stay a human
action against the live cluster).
