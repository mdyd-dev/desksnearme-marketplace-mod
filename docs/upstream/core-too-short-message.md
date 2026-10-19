# pos-module-core: password length error states the typed length, not the minimum

> Issue title to use:
> `pos-module-core: password length error states the typed length, not the minimum`
>
> File at <https://github.com/Platform-OS/pos-modules/issues>. Everything below the
> line is the issue body.

---

## Summary

The translation `en.validation.too_short` interpolates `%{value}`, which the length
validator sets to the length of the string the visitor typed. It should interpolate
`%{count}`, which is the minimum being enforced.

The result is that the error repeats the visitor's own input length back as if it were
the requirement. Typing a 3 character password says "has to be longer than 3
characters". Typing 5 says "has to be longer than 5 characters". The actual minimum is
6 in both cases.

## Steps to reproduce

1. Install `pos-module-user` (which depends on `pos-module-core`) on a clean instance.
2. Submit the registration form at `POST /users` with a 3 character password and
   otherwise valid values.
3. The re-rendered form shows: `has to be longer than 3 characters`.
4. Submit again with a 5 character password. It now shows:
   `has to be longer than 5 characters`.

Expected: both should state the minimum, which is 6.

## Cause

`modules/core/public/translations/en/validation.yml`, line 39:

```yaml
too_short: has to be longer than %{value} characters
```

`modules/core/public/lib/validations/length.liquid` interpolates two variables, where
`minimum` is the requirement and `size` is the length of the supplied value:

```liquid
assign message = message_minimum | default: 'modules/core/validation.length.minimum' | t: count: minimum, value: size
```

So `%{count}` is the minimum and `%{value}` is the typed length. `too_short` picks the
wrong one.

`modules/core/public/lib/validations/password_complexity.liquid`, line 32, is what
selects this message:

```liquid
assign message_minimum = 'modules/core/validation.too_short'
```

The sibling key in the same file already gets this right, which is good evidence of the
intent:

```yaml
length:
  minimum: is too short (minimum is %{count} characters)
```

## Suggested fix

One line in `modules/core/public/translations/en/validation.yml`:

```yaml
too_short: is too short (minimum is %{count} characters)
```

Any wording is fine as long as it uses `%{count}`. Matching `validation.length.minimum`
keeps the two consistent.

Alternatively, drop `too_short` and let `password_complexity` fall through to the
default `validation.length.minimum`, since the two messages would then be identical.
`too_short` has no other consumer: the only references are
`lib/validations/password_complexity.liquid` and its duplicate at
`views/partials/lib/validations/password_complexity.liquid`.

## Who is affected

Every application that uses `pos-module-user` registration or password reset, or calls
`modules/core/validations/password_complexity` directly. It is the only message shown
for a short password, so there is no correct message alongside it.

## Workaround in the meantime

A per-key translation override in the application. We are running this at
`app/modules/core/public/translations/en/validation.yml`:

```yaml
---
en:
  validation:
    too_short: is too short (minimum is %{count} characters)
```

Worth noting for the maintainers, since it is not obvious from the docs: this works as
a partial override. Deploying a file containing only that one key upserted 1 translation
and skipped 19, and the other keys from the upstream file still resolve. Translation
overrides are per key, not whole file.

## Environment

- `core` 2.1.11
- `user` 5.3.2 (the path a visitor actually hits this through)
- `pos-cli` 6.5.1

Happy to open a PR for the one-line change if that is easier than queueing it.

## Secondary observation, probably a separate issue

`pos-module-core` ships only `modules/core/public/translations/en/`. There is no `pl`
or any other locale. Applications running a non-English locale therefore fall back to
English for every core validation message, including this one. By contrast
`pos-module-captchas` ships both `en` and `pl`, and its README tells integrators to
expect both. Flagging it in case the omission is unintentional rather than filing it
separately.
