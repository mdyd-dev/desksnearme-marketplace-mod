# Modularization plan

Phase 1 inventory. No code changed.

Reference: `github.com/Platform-OS/pos-modules` cloned and read at the versions below. Module
behaviour described here comes from reading the module source, not the READMEs alone, and the
places where source and docs disagree are called out.

| Module | Version read | Dependencies |
| :--- | :--- | :--- |
| core | 2.1.11 | none |
| common-styling | 1.38.13 | none |
| user | 5.3.2 | core ^2.1.9, common-styling ^1.38.5 |
| captchas | 1.1.2 | none |
| captchas_recaptcha | 1.1.2 | captchas ^1.1.0 |
| chat | 2.2.4 | core, user ^5.3.0, common-styling, push_notifications ^2.0.1 |
| tests | 1.3.6 | none |
| user_invites | 1.0.3 | core, user, common-styling |
| reports | 2.0.2 | core, user |
| data_export_api | 0.2.2 | core |
| push_notifications | 2.0.2 | core, common-styling, user |
| payments / payments_stripe | 0.3.5 / 1.3.5 | core / payments, core, user |

`pos-cli modules install` may resolve newer versions than these. Re-read the installed source
before writing any integration code.

## Starting state

- 9,847 lines under `app/`: 6,818 Liquid, 1,175 GraphQL, plus CSS/JS/YAML.
- Zero modules in use. `modules/example/` is empty scaffold.
- **No `app/config.yml`** and **no `app/pos-modules.json`**. Both get created by the first install.
- **The project is not a git repository.** Phase 2 asks for a feature branch with one commit per
  step, so step zero is `git init` plus an initial commit of the current state. `.gitignore`
  already excludes `.pos` and `tmp/`, so the deploy token will not be committed.
- 31 pages carry `authorization_policies` front-matter. 18 call sites read `profiles/get_by_user`.

## Decisive architectural findings

These three shape everything below.

### 1. Module tables are namespaced, so there is no table collision and no free rename

The user module's profile table is `modules/user/profile`. The chat module's are
`modules/chat/conversation` and `modules/chat/message`. Our tables are `profile`,
`conversation`, `message`. They can coexist, which de-risks a staged cutover, but it also means
**every migration is a real record-by-record copy**, never a schema rename.

### 2. `PROFILE_MODULE` is a dead extension point in user 5.3.2

The module ships `profiles/create_proxy`, `update_proxy`, `find_proxy`, `search_proxy`,
`filters_proxy` and `create_validate_proxy`, each resolving a `PROFILE_MODULE` variable so a
custom module can own the profile. Looks ideal for our case.

It does not work. Nothing in the monorepo calls any `_proxy` file. `helpers/current_profile`,
`commands/user/create`, `commands/session/create`, `commands/email_verifications/*`,
`views/pages/users/email/update` and the oauth paths all call
`modules/user/queries/profiles/find` and `modules/user/commands/profiles/create` directly. Only
`helpers/table_name.liquid` reads the variable besides the proxies themselves.

So our custom profile fields (`phone`, `bio`, `company_name`) cannot be added by configuration.
The two real options:

- **(a) Override the module profile.** Five overrides: `schema/profile.yml`,
  `graphql/profiles/create.graphql`, `graphql/profiles/update.graphql`,
  `graphql/profiles/search.graphql`, and both `profiles/create/build.liquid` and
  `profiles/update/build.liquid`. The build files drop any key not in their literal hash, and the
  mutations only list named properties, so all of them have to change together. Every user module
  upgrade then needs a six-file re-diff.
- **(b) Side table.** The module profile owns identity and roles. A `near_me_profile` record
  keyed by `user_id` owns `phone`, `bio`, `company_name`. Zero overrides of the user module.
  Costs one extra GraphQL read on the pages that show those three fields (account edit, public
  user page, host card), which is the same cost we pay today.

**Recommendation: (b).** It satisfies the "prefer settings over overrides" rule, and the three
fields are ours, not identity. Note the trade-off honestly: profile search by phone or company
would need its own query, and we do not have that feature today.

### 3. Rewrite the authorization policies, do not replace them

The user module's RBAC entry points are `can_do` / `can_do_or_redirect` /
`can_do_or_unauthorized`, invoked as `include` inside a page body. POS
`authorization_policies` are a different mechanism, declared in page front-matter.

Converting 31 pages from front-matter policies to in-body includes is a wide mechanical diff
across every protected page, and an omission fails open. Instead, **keep the front-matter and
rewrite the six policy files** to call `modules/user/helpers/current_profile` plus
`modules/user/helpers/can_do`. The page diff is zero, the RBAC model is the module's, and the
blast radius is six files. New pages can use either mechanism.

---

## Bucket 1: replace with an official module

### 1.1 core (install first, nothing to replace)

Pure foundation, zero dependencies. We gain the command pattern, 23 validators (including
`presence`, `uniqueness`, `email`, `password_complexity`, `length`, `number`), events plus
consumers, `variable/set` and `variable/get` for runtime settings, and the module registry.

Nothing of ours is replaced in this step. It is the prerequisite for everything else.

Our hand-rolled validation lives inline in POST handlers (`user/create.liquid` builds a `valid`
boolean by hand). That gets replaced as each domain moves to a command, not in one sweep.

### 1.2 common-styling

Replaces: nothing we want to keep. Provides the form error partials
(`forms/error_list`, `forms/error_input_handler`) that every user module and captchas view
renders, so it is a hard dependency of the user module rather than a styling choice.

Setup cost: `{% render 'modules/common-styling/init' %}` in our layout head, `pos-app` class, and
`escape_output_instead_of_sanitize: true` in a new `app/config.yml`.

Gap: our design system (`app/assets/styles/app.css`, 407 lines of `--accent` / `--ink` / `--r`
tokens, brick-red brand, Archivo) is unrelated to the `pos-` prefixed system. They coexist by CSS
layers and prefix, with our stylesheet loaded after. Do not adopt the CSS reset
(`reset: true`): the README itself warns against it in an existing app, and our visual refresh
is the product.

Override needed: none expected. If module form markup clashes with our 8px-button / `wcard`
patterns, override the specific partial under
`app/modules/common-styling/public/views/partials/forms/`, one file at a time.

### 1.3 user (the main event)

Replaces, once verified on staging:

| Ours | Module equivalent |
| :--- | :--- |
| `app/schema/profile.yml` (identity + roles half) | `modules/user/profile` schema |
| `app/schema/user.yml` custom properties | not needed, these never worked anyway |
| `app/graphql/users/*.graphql` (10 files) | `modules/user/queries|commands/user/*` |
| `app/graphql/profiles/*.graphql` (11 files) | `modules/user/queries|commands/profiles/*` |
| `app/graphql/session/delete.graphql` | `modules/user/commands/session/destroy` |
| `app/views/pages/user/create.liquid` | `commands/user/create` (wrapper, see gap A) |
| `app/views/pages/session/create.liquid` | `commands/session/create` |
| `app/views/pages/logout.liquid` | `commands/session/destroy` |
| `confirm.liquid`, `confirm/verify.liquid`, `confirmation/resend.liquid`, `check-email.liquid` | email verification feature (see gap C) |
| `forgot-password`, `reset-password`, `password/reset`, `password/update` | `/passwords/reset`, `/authentication_links`, `/passwords/new`, `/passwords/create` |
| `app/emails/confirm_email.liquid`, `password_reset.liquid` | `partials/emails/users/verify`, `partials/emails/passwords/reset` |
| 6 `authorization_policies/*.liquid` role checks | `can_do` behind the same policy files (finding 3) |
| `profile.confirmed_at` gate in session create | `USER_EMAIL_VERIFICATION_ENABLED` |

**Gap A: role chosen at signup.** Our product requires the visitor to pick guest or host. The
module's `POST /users` page calls `commands/user/create` with `roles: null`, which falls back to
the `USER_DEFAULT_ROLE` constant. A submitted role is ignored.

Two ways in. Overriding `views/pages/users/create.liquid` means owning a page that also contains
the email verification branch, the hcaptcha comment and the redirect helper, all of which change
between releases. Instead **keep a thin app-owned POST endpoint** that validates the role against
an allow-list and calls `modules/user/commands/user/create` with `roles: [role]`. The command,
the profile creation, the transaction and the `user_created` event are all the module's. No
override. Set `USER_DEFAULT_ROLE` to `guest` so any other path (oauth, invites) lands somewhere
sane.

**Gap B: anti-spam on signup.** Not in the module. The README lists "Built-in CAPTCHA Protection"
as a TODO, and the registration partial renders `modules/common-styling/forms/hcaptcha`, which is
hCaptcha-specific and not the captchas module. Our honeypot, fill timer and disposable-domain
blocklist have no module equivalent. See bucket 2, `near_me_antispam`.

**Gap C: email verification semantics differ.** The module's feature is off by default and gated
by `USER_EMAIL_VERIFICATION_ENABLED`. It is a better design than ours: `email_verified_at` is the
single source of truth, resends are throttled by interval and daily cap, a completed password
reset also confirms the address, and a second click on the link is not an error. It also
publishes a `user_email_verified` event and fires `hook_user_email_verified`.

But it differs from ours in two ways that matter. Ours stores a POS temporary token in
`profile.confirmation_token` and verifies at `GET /confirm?token=`, made a two-step POST so the
link is never a GET write (see the signup anti-spam memory). The module verifies at
`GET /users/verify`. And the module requires its own backfill before the flag is flipped, or
every existing user is locked out at next login. `MIGRATIONS.md` in the module has the ordered
steps. Read it before writing our migration.

**Gap D: no admin user management UI.** The module ships only
`views/partials/admin_pages/list.liquid`, which dumps every user property into an unstyled
table. It is a debug aid, not our `/admin/users` page. Our admin stays ours (bucket 3), rebuilt
on the module's `commands/profiles/roles/set` and `queries/profiles/search` instead of our
`profiles/update_role` and `users/admin_search`.

**Gap E: single role string becomes a roles array.** Our `profile.role` is one of
`guest|host|admin`. The module's `profile.roles` is an array, and `superadmin` short-circuits
every `can_do` check. Proposed permissions file (the one override we do create, as the module's
own setup instructs):

```
guest:  listings.view, favorites.manage, messages.manage.own, profile.manage
host:   everything guest has, plus listings.manage.own, photos.manage.own
admin:  admin_pages.view, admin.users.manage, listings.manage.all, messages.manage.all
```

Keep `admin` as an explicit-permission role rather than aliasing it to `superadmin`, and create
exactly one real superadmin account as break-glass. Listing ownership checks
(`listing.host_id == profile.user_id`) go in `app/lib/can/listings.liquid` behind
`access_callback`, which is the pattern the README documents.

**Overrides this step creates** (running list, with reasons):

1. `app/modules/user/public/lib/queries/role_permissions/permissions.liquid` — our roles and
   permissions. Unavoidable and expected: the module's own setup instructions require it.

That is the only one planned. Gaps A, B and D are handled by app-owned code calling module
commands, not by overriding module files.

### 1.4 captchas + captchas_recaptcha

Replaces `app/api_calls/recaptcha_verify.liquid`,
`app/graphql/api_calls/recaptcha_verify.graphql`, and the inline verify block in
`user/create.liquid` and `support/contact.liquid`.

Provider choice: **`captchas_recaptcha` (v2 checkbox)**, not `captchas_recaptcha3`. Our
`recaptcha_site_key` is a v2 checkbox key and cannot be rendered invisible, and the failure mode
looks healthy in the DOM, so a provider mismatch here would be expensive to debug.

Constants to add in the Partner Portal, replacing `recaptcha_site_key` /
`recaptcha_secret_key`:

```
CAPTCHA_DEFAULT_PROVIDER  = recaptcha
CAPTCHA_DEFAULT_SITE_KEY  = <existing recaptcha_site_key value>
CAPTCHA_DEFAULT_SECRET    = <existing recaptcha_secret_key value>
```

Then every form is `{% render 'modules/captchas/widget' %}` and every handler is
`function result = 'modules/captchas/commands/captcha/verify'` checking `result.valid`. No keys
at any call site. Worth also passing `expected_hostname` on the signup and contact handlers,
which we do not do today, to reject tokens solved on another domain.

Note the module README's billing warning: each verify is one billable outbound API call. Same as
today, so no change, but the cheap heuristics should stay in front of it.

### 1.5 tests (dev only)

We have no test suite and no way to run one locally, which is exactly why the data migrations in
this project are the riskiest part. The tests module gives assertions and a `/\_tests` runner on
staging. Recommend installing it as a dev dependency and writing tests for the migration
commands and the permission matrix before running either against real data.

### 1.6 Evaluated and declined

**chat (2.2.4) — declined for this pass.** Our messaging is 7 pages, 8 conversation queries, 6
message queries and a layout unread badge. The module is a real-time WebSocket inbox at
`/inbox`, and it pulls in `push_notifications` ^2.0.1, which pulls common-styling and user, and
expects an import map in our head. Against that it is missing three things we ship: archiving a
conversation, reporting a message to admins (`app/emails/message_report.liquid`), and starting a
conversation from a listing with that listing as context. Its `conversation` schema is just
`participant_ids` and `participant_read_ids`, with no room for a `listing_id`, so listing context
would need a schema override on day one.

It is also the least broken part of our app and the one with the clearest custom shape. Adopting
it would be a product change dressed as a refactor. Revisit if we want real-time delivery or
push. For now messaging goes to bucket 2.

**user_invites (1.0.3)** — no invite flow in scope. Genuinely useful later for host onboarding
(invite a building manager to claim listings). Note it as a future fit, do not install.

**payments + payments_stripe** — out of scope by project guardrail. There are no bookings and no
reservations, so there is nothing to charge for. Do not install.

**push_notifications** — only arrives as a chat dependency. Declined with chat.

**reports (2.0.2)** — background CSV export generation for admin pages. It distributes no pages
of its own. No current requirement. A plausible fit if admin ever needs "export all listings",
not now.

**data_export_api (0.2.2)** — instance data export over an API. No requirement.

**websocket, mcp, openai, oauth_google/facebook/github** — no current requirement. Note that
oauth is the one with a real near-term case: social signup would let us drop a password form, and
the user module already has the integration points. Out of scope for this modularization.

---

## Bucket 2: extract into our own modules

Design rules applied to every proposal below:

- The module owns **data, commands, queries and settings**. Views stay in `app/` unless a second
  consumer actually exists. A module whose views are our pages verbatim is not reusable, it is
  our app with extra indirection and an upgrade story.
- Configuration goes through `modules/core/commands/variable/set` and
  `context.constants`, never through file overrides.
- `pos-module.json` declares dependencies explicitly.

### 2.1 `near_me_geo`

Geocoding and proximity search, the most reusable thing we have and the one with no official
equivalent.

- **machine_name:** `near_me_geo`
- **Dependencies:** `core`
- **Public:** `schema/geo_cache.yml`; `api_calls/geoapify_autocomplete.liquid`;
  `graphql/geo/cache_get`, `cache_set`, `api_calls/geoapify_autocomplete`;
  `lib/queries/geocode/autocomplete` (cache-aware); `lib/helpers/bounding_box` (the cosine
  lookup table currently inline in `listings/index.liquid` lines 70 to 108);
  `assets/js/address-autocomplete.js`, `map-picker.js`, `geo-map.js`; the
  `api/geo/autocomplete.json` endpoint.
- **Private:** nothing. All of it is useful to a consumer.
- **Settings:** `GEOAPIFY_API_KEY`, `GEOAPIFY_MAP_KEY` as constants (renamed from
  `geoapify_api_key` / `geoapify_map_key`); `GEO_DEFAULT_RADIUS_KM` (currently hardcoded 50) and
  `GEO_CACHE_TTL_DAYS` as core variables.
- **Why it earns a module:** the bounding-box helper is pure logic with no desksnear content, and
  "geo search in Liquid because the DB cannot do it" is a platformOS-wide problem.
- **Risk:** the JS is tuned to our markup (`place-search.js` and `distance.js` stay in `app/` for
  that reason). Keep the module's JS to the generic autocomplete and map-init layer.

### 2.2 `near_me_photos`

- **machine_name:** `near_me_photos`
- **Dependencies:** `core`, `user`
- **Public:** `schema/listing_photo.yml` (99 lines, the largest schema we have);
  `graphql/photos/*` (6 files); presign, create, delete and reorder commands; the three JSON
  endpoints.
- **Private:** nothing.
- **Settings:** `PHOTOS_MAX_PER_OBJECT`, `PHOTOS_ALLOWED_TYPES`.
- **Why standalone rather than folded into listings:** profile pictures already reuse this table
  with `photo_type='profile'` and `object_uuid=user_id`. It is genuinely a polymorphic
  attachment store keyed by `(object_uuid, photo_type)`, and it has two consumers today.
- **Rename:** the table name `listing_photo` is now wrong. Within the module it becomes
  `modules/near_me_photos/photo`, which is a copy migration, not a rename (finding 1).
- **Views:** `gallery.liquid`, `sortable.liquid`, `s3_form.liquid`, `lightbox.js`, `photo-sort.js`
  are design-coupled. Start them in `app/`; promote only what a second consumer needs.

### 2.3 `near_me_listings`

- **machine_name:** `near_me_listings`
- **Dependencies:** `core`, `user`, `near_me_geo`, `near_me_photos`
- **Public:** `schema/listing.yml`; `graphql/listings/*` (16 files) and the listing half of
  `graphql/admin/*`; create, update, delete, `set_status`, `set_featured`, `set_hero` commands in
  build/check/execute form; `queries/listings/search` wrapping the bounding box; the per-period
  pricing helper (`price_hour|day|week|month`, first non-blank wins, `advanced_format: '%.2f'`);
  `helpers/listing_url` (the `id-slug` convention); `lib/can/listings.liquid` for the
  `access_callback`.
- **Private:** nothing.
- **Settings:** `LISTING_TYPES` (currently the hardcoded `"Desk,Meeting Room,Office Space"`),
  `LISTING_PRICE_PERIODS`, `LISTING_CURRENCY`, `LISTING_DEFAULT_STATUS`.
- **Enforced invariant:** price is always visible. The pricing helper has no
  "contact for price" branch and must never gain one. Worth a comment in the helper saying so,
  since a module is where a future contributor would most plausibly add it.
- **Views stay in `app/`:** `listings/form.liquid` (444 lines), `card`, `wcard`,
  `amenity_fields`, `hours_fields` and the two big pages (`index` 574 lines, `show` 495) are the
  product's design, not reusable logic. Extracting them would produce a module nobody but us can
  install.
- **Biggest single win:** `listings/index.liquid` at 574 lines is the hardest file in the repo,
  and roughly 120 of those lines are bounding-box math and filter assembly that belong in
  `near_me_geo` and this module's search query.

### 2.4 `near_me_messaging`

Only because chat was declined. If chat is adopted later this module is the thing it replaces.

- **machine_name:** `near_me_messaging`
- **Dependencies:** `core`, `user`
- **Public:** `schema/conversation.yml`, `schema/message.yml`; `graphql/conversations/*` (8) and
  `graphql/messages/*` (6); create, reply, archive, report, `mark_read` commands;
  `queries/messages/unread_count` for the layout badge; `emails/new_message`,
  `emails/message_report`.
- **Private:** nothing.
- **Settings:** `MESSAGING_SUPPORT_EMAIL` (currently `support@desksnear.me` hardcoded, see the
  support chat memory), `MESSAGING_REPORT_RECIPIENT`.
- **Generalization needed:** our conversation is listing-scoped. Make the module's field a
  generic `subject_type` plus `subject_id` rather than `listing_id`, so the module does not
  depend on `near_me_listings`. Our pages pass `subject_type: 'listing'`.
- **Note:** the support conversation is just a conversation whose participant is the support
  account. That stays true and needs no special case.

### 2.5 `near_me_antispam`

Small, but it is precisely the gap the user module admits to having, and it is the piece most
likely to be wanted by another platformOS app.

- **machine_name:** `near_me_antispam`
- **Dependencies:** `core` (and `captchas` only if we fold captcha orchestration in, which we
  should not: captchas already does that job)
- **Public:** `lib/validations/honeypot.liquid`, `lib/validations/fill_time.liquid`,
  `lib/validations/disposable_email.liquid`, each shaped like a core validator so it composes in
  a command's check stage; `views/partials/form_traps.liquid` rendering the hidden field plus the
  timestamp input.
- **Private:** `assets/disposable_domains.txt`, so the blocklist is not served to the public.
  This is the one place the public/private split actually buys something.
- **Settings:** `ANTISPAM_MIN_FILL_SECONDS` (currently hardcoded 2),
  `ANTISPAM_HONEYPOT_FIELD` (currently `website`).
- **Keeps a property of the current code worth preserving:** on honeypot hit we redirect to
  `/check-email` as if it worked, creating nothing. The validator must let the caller choose
  between a silent success and a visible error.

### 2.6 Deliberately not a module: admin

`/admin`, `/admin/users` and `/admin/listings` look like a module candidate and are not one.
Manage-listings is `near_me_listings` queries behind our markup; manage-users is the user
module's `profiles/search` and `roles/set` behind our markup. A `near_me_admin` module would
contain only page markup, which is the thing we just decided not to extract anywhere else.

Instead: admin pages stay in `app/` (bucket 3), each domain module ships the admin-grade queries
and commands those pages call, and authorization is `admin_pages.view` plus
`<resource>.manage.all`.

### 2.7 Marginal: contact form

`support/contact.liquid` plus `emails/support_contact.liquid` plus one GraphQL file. Once
captchas is installed this is about 40 lines of app code. Not worth a module and its manifest.
Leave it in `app/`, depending on `captchas` directly.

---

## Bucket 3: stays in `app/`

- **Branding and design:** `assets/styles/app.css` (design tokens, brick-red brand), fonts
  (Archivo, Inter, Newsreader), `logo-*.svg`, favicon, `images/hero-*`.
- **Layout shell:** `views/layouts/application.liquid` (261 lines: header, auth-aware nav, unread
  badge, login and signup modals, `context.exports.seo` plumbing), `layouts/mailer.liquid`.
- **Homepage:** `pages/index.liquid`, `partials/home/main.liquid` (and its anonymous-visitor
  `{% cache %}` block), `partials/home/type_tiles.liquid`, the admin-picked hero listing, the
  self-hosted `hero-map.avif` snapshot.
- **Page copy:** about, terms, faq, privacy, support, unauthorized.
- **Design-coupled views:** the listing form, cards, `wcard`, amenity and hours fields, photo
  gallery and sortable, host avatar, the two login/signup modals.
- **Admin pages:** all of `pages/admin/**` (see 2.6).
- **Thin endpoint wrappers:** the role-aware signup POST (gap A), `/logout` if we keep that slug,
  the contact form POST.
- **Our translations:** the desksnear-specific half of `translations/en.yml` and `pl.yml`. Module
  strings move to module translation namespaces.
- **App-level authorization:** the six policy files, rewritten to call `can_do`; `app/lib/can/*`.
- **Site plumbing:** `assets/scripts/sw.js`, `place-search.js`, `distance.js`,
  `listing-readiness.js`, `favorites.js`.
- **Favorites:** `schema/favorite.yml` and its 4 GraphQL files. Small, entirely ours, and
  meaningless outside a listing marketplace. Candidate to fold into `near_me_listings` later if
  that module ever wants a "saved by N people" count; standalone module not justified.
- `modules/example/` should be deleted. It is empty POS scaffold, and once real modules exist
  under `modules/` it is actively confusing.

---

## Risks

Ordered by what would actually hurt.

### R1. Existing users and the profile cutover (high)

Module profiles live in a different table (finding 1), so this is a copy with a cutover, and
three states break if handled naively:

- **Unconfirmed users.** Our gate is `profile.confirmed_at`; the module's is
  `email_verified_at`. The module requires a backfill *before* `USER_EMAIL_VERIFICATION_ENABLED`
  is flipped or every user is locked out at next login. Confirmed users map to
  `email_verified_at`. Users who never confirmed have to re-request, because our
  `confirmation_token` is a POS temporary token that the module's verify path does not read.
- **Users mid password reset.** `profile.reset_token` becomes meaningless. Anyone holding an
  unused reset link gets a dead link and must re-request. Unavoidable; the mitigation is timing
  the cutover for low traffic and accepting it, not engineering around it.
- **Roles.** `role: "admin"` becomes `roles: ["admin"]`, and the admin role must be defined in
  our permissions override before the migration runs, or `can_do` logs a warning and denies.

Order of operations: install user, write the permissions override, migrate profiles with roles
and `email_verified_at`, verify login works for a confirmed test user **and** an admin, only then
flip email verification on, only then delete our profile GraphQL.

### R2. Slug collisions (high, and partly unknown)

| Ours | Module | Note |
| :--- | :--- | :--- |
| `GET users/:id` | `GET /users/new`, `POST /users`, `GET /users/check-email`, `GET /users/verify`, `/users/verification/resend`, `/users/email/edit`, `/users/email/update` | **The one to resolve first.** Whether a static module slug wins over our dynamic `users/:id` is POS routing behaviour I have not verified. If dynamic wins, the entire module registration and verification surface 404s. |
| `POST session/create` | `POST /sessions` | Ours is replaced; the login modal's action changes. |
| `GET logout` | `DELETE /sessions` | Keep `/logout` as a thin GET calling `commands/session/destroy`, or switch the header to a DELETE form. A GET logout is CSRF-able, so the form is the better end state. |
| `GET confirm`, `POST confirm/verify`, `GET check-email`, `POST confirmation/resend` | `GET /users/verify`, `GET /users/check-email`, `POST /users/verification/resend` | Our two-step POST confirm was deliberate. The module's `GET /users/verify` is a GET that writes. Check whether that is acceptable to us before adopting, and keep redirects from our old URLs for links already in inboxes. |
| `GET forgot-password`, `GET reset-password`, `POST password/reset`, `POST password/update` | `/passwords/reset`, `POST /authentication_links`, `/passwords/new`, `POST /passwords/create` | Add redirects from our four slugs. |
| `GET hosts/:id` | none | Already redirects to `/users/:id`; collateral damage if `users/:id` has to move. |
| `api/photos`, `api/favorites/*`, `api/geo/autocomplete.json` | chat uses `api/chat/*` | No collision, and none if chat stays declined. |

Mitigation for the first row: test it on staging with a throwaway page before committing to
anything else in the user step. If dynamic slugs win, our profile page moves and we eat the
redirect, because the module's registration URLs are not worth overriding six pages to relocate.

### R3. `escape_output_instead_of_sanitize: true` (medium)

common-styling requires it, and it is a site-wide output change in a repo that currently has no
`app/config.yml` and so runs on the sanitize default. We already mark our intentional raw output
with `| html_safe` (the two map-data JSON script tags and the geo autocomplete endpoint), which is
exactly where behaviour differs. Listing descriptions render plainly and should be unaffected.

Verify specifically: the listings index map data, the listing detail map data,
`/api/geo/autocomplete.json`, and any listing title or address containing an apostrophe,
ampersand or angle bracket.

### R4. Authorization regression (medium, mitigated by finding 3)

Keeping front-matter policies holds the page diff at zero, but it moves all six role checks at
once. A policy that echoes nothing denies, so the failure mode is closed rather than open, which
is the right direction. Still: test all three roles against all 31 protected pages, not just the
happy path. The `superadmin` short-circuit means a mistakenly granted superadmin role silently
passes every check, so grant it to exactly one account.

### R5. Performance (medium, and we are already close to the line)

Mobile performance is TTFB-capped on staging and the SEO score is an open item. This work pushes
in the wrong direction: common-styling adds CSS and JS to every page, the user module adds
`pos-user-form.css`, and each `can_do` call resolves the permissions file.

Mitigations: load module stylesheets only on pages that render module forms rather than globally;
rely on `context.exports.current_profile` so `current_profile` runs once per request, not once
per check; re-measure on production rather than staging, where cold-start TTFB dominates. Also
**bump the homepage anonymous cache key** after any layout change, or logged-out visitors get
stale markup.

### R6. Upgrade surface (low, by design)

One override planned (the permissions file, which the module's own setup requires). Every
additional override is a file to re-diff on each user module release. Keep the running list in
this document current, with a reason per entry, and prefer an app-owned endpoint calling a module
command over an overridden module page.

`modules_that_allow_delete_on_deploy` in `app/config.yml` must list `core`, `user`,
`common-styling`, `captchas` and `captchas_recaptcha`, or removed module files linger on the
instance after an upgrade.

### R7. No safety net (low, cheap to fix)

No git history, no tests, no local dev server, and the only environment is the staging instance
that also serves as the review environment. `git init` plus the tests module plus
`platformos-check` before each deploy is most of the fix, and all of it is step zero.

---

## Proposed Phase 2 order

One migration step per commit, on a feature branch, each ending in a staging deploy plus the
click-through list below.

0. `git init`, commit current state, branch `modularize`. Create `app/config.yml`
   (`escape_output_instead_of_sanitize`, `modules_that_allow_delete_on_deploy`). Delete
   `modules/example/`.
1. Install `core` and `common-styling`. Wire the layout (`pos-app`, init partial, notifications).
   Deploy. Confirm nothing visual regressed and the R3 output sites are intact.
2. **Resolve R2 row one on staging before going further.** A throwaway static page under
   `users/` tells us whether the module's registration URLs will route.
3. Install `tests`. Port nothing; just confirm `/_tests` runs.
4. Install `user`. Write the permissions override. Rewrite the six authorization policies to
   `can_do`. Do not migrate data yet, do not delete anything yet.
5. Migrate profiles: roles, `email_verified_at` from `confirmed_at`, and the `near_me_profile`
   side records for phone, bio and company. Verify all three roles log in.
6. Cut over signup (app-owned role-aware POST calling the module command), login, logout, and
   password reset. Add redirects from our old slugs. Only now delete our `users/*`, `profiles/*`
   and `session/*` GraphQL and the replaced pages.
7. Flip `USER_EMAIL_VERIFICATION_ENABLED` after reading the module's `MIGRATIONS.md`. Verify an
   unverified signup is blocked at login and the resend throttle works.
8. Install `captchas` and `captchas_recaptcha`. Set the three constants. Swap signup and contact
   to the widget and verify command. Delete our `recaptcha_verify` api_call and GraphQL.
9. Extract `near_me_antispam`. Re-point signup at it.
10. Extract `near_me_geo`, then `near_me_photos`, then `near_me_listings`, then
    `near_me_messaging`. One module per commit, data copied before old tables are dropped.

Click-through after every step: signup as guest, signup as host, confirm the email, log in, log
out, edit profile, create a listing, edit a listing, upload and reorder photos, send an inquiry,
reply, archive, `/admin/users` role change, `/admin/listings` status change. Plus
`platformos-check` clean, allowing for the known intentional `NestedGraphQLQuery` warnings.

---

## Open questions

1. **`/users/:id`.** If module slugs win the routing contest we keep our profile URL; if they do
   not, our profile page has to move. Which do you prefer: move our page to `/u/:id` with
   redirects, or override the module's registration pages to relocate them? I recommend moving
   ours, since overriding six module pages to protect one URL is the worse trade.
2. **Custom profile fields.** Confirm the side table (`near_me_profile` for phone, bio, company)
   over the six-file override of the module profile.
3. **Email verification.** The module's verify endpoint is a GET that writes, which is what our
   two-step POST deliberately avoided. Adopt the module's flow as shipped, or keep our
   confirmation and leave `USER_EMAIL_VERIFICATION_ENABLED` off?
4. **Messaging.** Confirm chat stays declined and messaging becomes our module. The decision
   matters because 2.4 is wasted work if chat is adopted in six months.
5. **Scope of bucket 2.** All five modules, or stop after the official ones plus `near_me_geo`?
   Every custom module is a manifest, a version and a public API we maintain. The geo module
   earns that outright. The others are more about repo hygiene than reuse, and that is a
   reasonable thing to want, but it should be a conscious choice.
