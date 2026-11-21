# Shadowfax forward and reverse APIs

Status (November 21, 2026): the token-only admin card and B2C pricing/catalog changes are deployed. The supplied production token is saved, and forward/reverse read-only production rate calls passed. Booking remains intentionally inactive; shipment/callback/POD end-to-end verification is still pending. No real shipment was created. Existing couriers retain their configuration and billing behavior.

## Credential card and rate-card setup

Admin → Courier Credentials includes a Shadowfax card with one password input: Production Token.
`PUT /api/admin/couriers/credentials/shadowfax` accepts only `{ "productionToken": "..." }`,
uses the fixed official production host, and preserves existing OAuth/callback configuration.
The saved token is never returned by the card's read or write APIs. Saving does not activate booking.

Shadowfax (internal ID 101) appears in the B2C courier/provider catalog, admin rate-card
add/edit/export/import selections and filters, and seller B2C order/rate-card filters.
Admins can save and review inactive-courier pricing; sellers still receive only available
courier pricing. Existing plan isolation, slabs, COD rules and booking gates are unchanged.
Shadowfax is not offered for B2B or the settlement CSV uploader, whose carrier-specific
column mapping has not been verified. Actual shipping choices remain serviceability/activation gated.

Verification: `check:shadowfax` covers token-only validation. The admin credential-card test
checks a single masked, empty input and saved metadata. `scripts/ops/verify-shadowfax-release.cjs`
checks authenticated catalogs and credential/rate access. `verify-shadowfax-rates.cjs` exercises
the real rate service using a private QA plan inside one confirmed rolled-back transaction;
it never assigns a plan to a seller, commits rates, or contacts a courier.

Release verification passed for the three credential-card/submission tests, 27 Shadowfax
contract/safety groups, transactional rate-card create/read/update, seller-isolated exports,
warehouse completeness, label preferences, authorization and credential redaction.
The reviewed deployment retains old hashed frontend assets and uses a checked candidate API
during the main process restart. Both deployment paths share the VPS deployment lock.
Browser visual verification was unavailable in this session; the card was checked by rendering
and automated assertions, not a claimed live browser walkthrough.

Source documentation: [Forward quickstart](https://developer.shadowfax.in/docs/forward-logistics/quickstart), [forward API reference](https://developer.shadowfax.in/docs/api/forward-logistics), [reverse quickstart](https://developer.shadowfax.in/docs/reverse-logistics/quickstart), [reverse API reference](https://developer.shadowfax.in/docs/api/reverse-logistics). Reviewed November 20, 2026. The reference navigation lists 14 forward and 9 reverse operations; shared endpoints are intentionally listed under both directions below. Authentication is additional.

## Forward API inventory

All paths below are relative to the selected official `/api` base.

| API | Method and carrier path | Operator operation |
| --- | --- | --- |
| Place forward order | POST `/v3/clients/orders/` | `book` (raw payload on staging only; normal billed workflow in production) |
| Cancel forward order | POST `/v3/clients/orders/cancel/` | `cancel` |
| Update forward order | POST `/v3/clients/order_update/` | `update` |
| Track forward order | GET `/v4/clients/orders/{awb}/track/` | `track` |
| Bulk track forward orders | POST `/v4/clients/bulk_track/` | `bulk-track` |
| Forward serviceability | GET `/v1/clients/serviceability/` | `serviceability` |
| Forward rate calculator | POST `/v1/clients/rate_calculator/` | `rate` |
| Generate shipping label | POST `/client/generate_label/` | `label` (PDF/PRN) |
| Fetch proof of delivery | POST `/v1/clients/pod_details/` | `pod` |
| Discover escalation categories | GET `/v1/clients/support/issue/` | `escalation-categories` |
| Raise escalation | POST `/v1/clients/support/issue/` | `escalate` |
| Generate AWBs / replenish pool | POST `/v3/clients/generate_marketplace_awb/` | `awbs` |
| Request fresh AWBs asynchronously | POST `/v1/clients/awb/` | `fresh-awbs` |
| Poll fresh-AWB result | GET `/v1/clients/awb/{request_id}/` | `awb-result` |

## Reverse API inventory

| API | Method and carrier path | Operator operation |
| --- | --- | --- |
| Place reverse pickup order (optional SKU QC rules) | POST `/v1/clients/pickup/orders/` | `book` |
| Update reverse pickup order | POST `/v3/clients/order_update/` | `update` |
| Cancel reverse pickup order | POST `/v2/clients/requests/mark_cancel` | `cancel` |
| Track single pickup | GET `/v4/clients/requests/{awb}` | `track` |
| Track multiple pickups | POST `/v4/clients/requests/bulk_query` | `bulk-track` |
| Reverse serviceability | GET `/v1/clients/serviceability/` | `serviceability` |
| Reverse / reverse-QC rate calculator | POST `/v1/clients/rate_calculator/` | `rate` (`qc: true` for reverse-QC) |
| Fetch proof of delivery | POST `/v1/clients/pod_details/` | `pod` |
| Generate reverse AWBs | POST `/v3/clients/orders/generate_awb/` | `awbs` |

Both static Token authentication and OAuth2 client-credentials (`POST /v1/clients/token/`) are implemented. OAuth tokens are cached until shortly before expiry, with single-flight exchange. Forward fresh-AWB requests also support `request_type: rev` per the shared endpoint specification.

## ChoiceMee entry points

- Admin-only configuration: GET/PUT `/api/admin/couriers/shadowfax/configuration`. Responses expose only environment and presence flags, never secrets. PUT accepts `apiBase`, `apiKey` (static token), `clientId`, `password` (OAuth client secret), and `webhookSecret`. Omitted fields are retained; explicit empty strings clear stored fields. Configuration does not activate booking.
- Admin-only API tools: POST `/api/admin/couriers/shadowfax/{forward|reverse}/{operation}`. These are API endpoints, not a new administration UI. See operations above. Normal seller credentials cannot access these tools.
- Production booking: existing create/book-draft flow, using `integration_type: shadowfax`, internal `courier_id: 101`, or external `provider_code: SF6T9`. Seller rate cards, warehouse ownership, readiness checks, and wallet transaction remain in the existing pipeline. A disabled catalog entry is provisioned; no prices are invented.
- Reverse: existing returns flow. Original order ownership and stored weight/products/addresses are used. The normal booking transaction performs the debit once, after acceptance; the legacy pre-debit is bypassed only for Shadowfax.
- Cancellation: existing seller and external-API cancellation routes call the correct directional API and use the existing once-only refund logic.
- Tracking: existing order tracking, order-list synchronization, seller notifications and merchant webhooks share the normalized carrier tracking result. A bounded three-minute sweep recovers missed callbacks. Unknown statuses stay in history without inventing a local transition.
- Carrier labels are requested after forward booking; a label failure does not create another shipment. The carrier label API is forward-only. POD and operational escalation/AWB tools are available to authorized operators.
- Booked-order editing remains subject to the existing UI's draft-only rule. All raw update sections are integrated for staging API tests; production operator tools permit forward RTO/RTS/NDR status actions only. Raw production address/weight/financial updates are blocked to prevent divergence from local billing. There are no new seller UI controls for these operations.

Operator JSON fields: `payload` for raw staging booking/update; `awbNumber` for single-order calls; `awbNumbers` for bulk/POD; `remarks` for cancellation; `service`, `pincodes`, `page`, `count` for serviceability; `originPincode`, `destinationPincode`, `weightKg`, optional `qc` for rates; `fileType` for labels; `category` and `comments` for escalation; `count` for AWBs; `requestId` for async AWB results. Raw update payloads use Shadowfax's documented units (not necessarily the same as creation): creation weights are kilograms; the reverse update schema documents grams.

## Callbacks

Register HTTPS `https://api.choicemee.in/api/webhooks/shadowfax` and custom header `x-shadowfax-webhook-secret` with Shadowfax. Forward, reverse-to-seller, reverse-to-warehouse, staging and production registrations are separate carrier-side tasks. Configure `awb_number`, `status_id`, `status`, `last_updated_iso` (or `event_timestamp`), and `current_location`. This contract must be agreed with the account manager because callback schemas are client-specific.

Authentication is constant-time; an unconfigured secret fails closed. Events are matched only to unique local Shadowfax AWBs, durably deduplicated before HTTP 200, then reconciled against authenticated tracking. Unknown test AWBs do not mutate orders. Inactive integrations do not poll Shadowfax. Carrier callbacks are not assumed to have reliable retries.

## Safety / activation checklist

1. Keep `SHADOWFAX_ENABLED` unset/false for this release. Existing database URL, relay, credentials and other couriers must not change.
2. Apply `apps/backend/migration_add_shadowfax.sql` with the existing database connection. It adds two private operational journals, a partial index, and a disabled B2C catalog entry only. The reviewed deployment script applies it idempotently. Do not run destructive schema synchronization.
3. Add staging credentials through the admin configuration API, or environment keys `SHADOWFAX_API_BASE`, `SHADOWFAX_API_TOKEN` (or `SHADOWFAX_CLIENT_ID` + `SHADOWFAX_CLIENT_SECRET`), and `SHADOWFAX_WEBHOOK_SECRET`. Database-stored values take precedence. Default base is `https://dale.staging.shadowfax.in/api`.
4. Run staging create/cancel/update/track/bulk/rates/serviceability/label/POD/escalation/AWB tests and confirm actual account callback mappings. Contract fixtures are not a substitute for this gate.
5. Configure agreed seller forward/reverse rate cards for internal ID 101 using existing pricing administration. Current workflow mapping is Marketplace + Regular, return-to-seller; Warehouse/D2D/MPS/Surface fulfillment variants are not exposed by the current seller form. The low-level operator tools accept documented raw payloads where supported. QC is explicit per SKU and defaults off in the workflow mapper.
6. With confirmed production credentials, production callback registrations and verified rates, switch the base to `https://dale.shadowfax.in/api`, enable the Shadowfax catalog entry, and set `SHADOWFAX_ENABLED=true` on the server. A staging URL or missing webhook secret cannot activate live booking. Credentials alone never activate it.
7. Conduct a separately authorized real shipment test and verify AWB, carrier acceptance, pickup, label, wallet, tracking, cancellation/refund and COD settlement. Implementation did not exercise real courier funds or customer pickups.

Reservations use seller-scoped hashed order IDs and survive restarts and credential rotation. Carrier HTTP-200 business failures are rejected. Ambiguous timeouts/malformed booking results block blind retries permanently: operators must reconcile the original carrier order and the journal before proceeding. Never delete an uncertain reservation merely because 30 minutes passed. No automatic cross-carrier fallback follows a possibly accepted booking.

## Verification commands

`npm run check:shadowfax` in `apps/backend` uses a fake transport and storage; it does not contact the carrier or a live database. It covers every listed endpoint contract plus authentication, payload mapping, account service tiers, limits, failure semantics, reverse flat duplicate responses, null quotes, tracking, and durable retry behavior. Use a dummy DATABASE_URL for local tests. Build with `npm run build`. Existing `check:seller-shipping`, `check:courier-charge` and `check:b2c-slabs` cover adjacent regressions.

On the VPS, `scripts/ops/verify-shadowfax-release.cjs` is a read-only inactive-release check: administrator access, seller rejection, no secret disclosure, missing-credential failure, disabled catalog and zero test bookings/callbacks. `scripts/ops/verify-shipping-release.cjs` verifies existing authenticated exports, warehouse completeness and label preferences. Tokens stay in process memory.
