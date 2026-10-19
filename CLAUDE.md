# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A rebuild of **Desks Near Me**, a two-sided marketplace for renting workspace (desks, meeting rooms, offices). Guests search/inquire; hosts list spaces; admins moderate. It is built entirely on **platformOS (POS)** — a hosted, server-rendered platform where the "backend" is Liquid pages that run GraphQL against POS's own data store. There is no separate app server, no Node runtime, no database you manage directly.

This is a **rebuild, not a migration**, from the legacy `marketplace_builder` (MarketplaceKit) structure. Most old functionality is intentionally dropped. Keep the modern `app/` layout — never reintroduce `marketplace_builder/` conventions.

## Project guardrails

- **Do not port** these from the legacy repo: booking/reservation flows, the blog, and long-tail SEO page generation. When unsure whether to bring over any legacy file, **ask first**.
- **Price is always visible.** Every listing shows per-period pricing (hour/day/week/month) set by the host. There is never a "contact host for price" state — do not add one.
- **Role is chosen at signup** (guest or host); admin is assigned separately. See the auth flow below.
- Product scope is a simple listing marketplace with three roles (admin/guest/host): login/logout, visual refresh, responsive design.

## Deploy & tooling

There is no local dev server, build step, or test suite — pages render on the POS platform. Development is deploy-and-view against the staging instance defined in [.pos](.pos).

Deploy with the `pos-cli`. Node is pinned to **node@22** (Homebrew, keg-only, linked with `--force`) for pos-cli compatibility — use that, not a newer Node. The environment name is `staging`:

```bash
pos-cli deploy staging
```

```bash
pos-cli sync staging
```

`pos-cli sync` watches `app/` and pushes changes live as you edit — the normal inner loop. `.pos` holds the staging URL, deploy token, and partner-portal URL; treat its token as a secret.

Secrets/config (API keys) are **constants** set in the POS Partner Portal, read in Liquid as `context.constants.<name>` (e.g. `geoapify_api_key`, `geoapify_map_key`, `recaptcha_site_key`, `recaptcha_secret_key`). They are not in the repo.

## Architecture

Everything lives under `app/`. POS assigns meaning by directory:

- **`app/schema/*.yml`** — data models ("tables"). Each defines a `name` and typed `properties`. Core models: `listing`, `listing_photo`, `profile`, `user`, `conversation`, `message`, `favorite`, `geo_cache`. There are no migrations — editing a schema and deploying updates the model.
- **`app/graphql/**/*.graphql`** — every data read/write. Queries filter POS's generic `records` table by `table: { value: "listing" }` and pull typed columns via `property(name: ...)` / `property_int` / `property_float` / `property_array`. Mutations use `record_create` / `record_update` / `record_delete`. Organized by domain folder (`listings/`, `messages/`, `conversations/`, `profiles/`, `favorites/`, `photos/`, `users/`, `session/`, `admin/`, `geo/`).
- **`app/views/pages/*.liquid`** — routes. Front-matter (YAML between `---`) declares `slug`, `method` (default GET; `post` for form handlers), `metadata` (title/description/`full_bleed`), and `authorization_policies`. GET pages render HTML; POST pages run logic and `redirect_to`. Files ending `.json.liquid` under `pages/api/` are JSON endpoints (they `echo` JSON).
- **`app/views/partials/*.liquid`** — reusable fragments, rendered with `{% render 'listings/card' %}` or `{% include 'hosts/avatar' %}`.
- **`app/authorization_policies/*.liquid`** — access guards referenced by name in page front-matter. A policy echoes `true` to allow; otherwise POS `redirect_to`s with `flash_alert`. Roles come from the `profile.role` field (`guest` / `host` / `admin`), **not** from the POS `user` — see `require_host`, `require_admin`, `require_login`.
- **`app/api_calls/*.liquid`** — outbound HTTP templates (Geoapify geocoding, reCAPTCHA verify). Front-matter sets `to`/`format`/`request_type`/`request_headers`; invoked from GraphQL via `api_call_send(template: { name: ... }, data: $data)`.
- **`app/emails/*.liquid`** & **`app/smses/`** — notification templates, sent from GraphQL via `email_send(template: { name: ... })`.
- **`app/assets/`** — `styles/app.css` (single stylesheet, design tokens as CSS custom properties like `--accent`, `--ink`, `--r`), `scripts/*.js` (vanilla JS, no framework/bundler; progressive enhancement), fonts, images. Reference with the `| asset_url` filter.
- **`app/translations/*.yml`** — i18n (`en`, `pl`), read with the `t` filter.

`app/views/layouts/application.liquid` is the global shell (header/nav/footer, auth-aware menu, unread-message badge, login/signup modals). It reads per-page SEO via `context.exports.seo` — pages set title/description/canonical by `export title, description, canonical, namespace: 'seo'`.

`modules/example/` is the stock POS module scaffold (public/private split); it is boilerplate, not part of this app.

## Conventions & gotchas specific to this codebase

- **Roles live on `profile`, not `user`.** To check a role, GraphQL `profiles/get_by_user` and read `.role`. The POS `user` only holds auth/identity.
- **Relations are by string ID, joined manually.** e.g. `listing.host_id` → `users/*` or `profiles/get_by_user`; photos join `listing.uuid` ↔ `listing_photo.object_uuid` via `related_records`. There are no foreign keys — a page typically fires several sequential `graphql` calls and stitches results in Liquid.
- **Listing detail slugs are `id-slug`;** the page splits on `-` and takes the first segment as the real id (`context.params.id | split: '-' | first`). Build canonical URLs with the `listings/url` partial.
- **Signup/auth flow is custom.** `user/create` creates the user + a `profile` carrying a `confirmation_token`, emails a `/confirm?token=` link, and gates login on `profile.confirmed_at` (see `session/create`). Do not assume POS's built-in confirmation.
- **Geo search is done in Liquid, not the DB.** `listings/index` computes a bounding box using a hardcoded cosine lookup table (longitude bands corrected by `cos(latitude)`), then refines client-side. `geo_cache` memoizes geocoding results.
- **Money** is stored as separate `price_hour/day/week/month` floats; the "from" rate is the first non-blank in that order. Format with `| advanced_format: '%.2f'`.
- **POST forms** must include `<input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">`. JSON API endpoints under `pages/api/` guard with `authorization_policies: [require_login]` and return `{"error": ...}` shapes.
- Match the existing Liquid style: logic in a leading `{%- liquid ... -%}` block, `assign` for locals, `graphql x = 'folder/name', arg: val` to call queries by path.
