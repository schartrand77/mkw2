# Connector Betas

MakerWorks v3 includes two outbound connector betas built from existing order data.

## Shopify Draft Order Beta

- Purpose: transform a MakerWorks order into a draft-order style commerce payload.
- Source data:
  - customer email
  - shipping address
  - item titles, quantities, prices
  - organization, project, and department metadata
- Admin preview:
  - `/admin/connectors`
  - `/api/admin/connectors/preview?connectorId=shopify_draft_order&orderId=<id>`

## Shipping Manifest Beta

- Purpose: transform a MakerWorks shipped order into a carrier/shipping-manifest payload.
- Source data:
  - shipping address
  - shipping metadata (`carrier`, `service`, `trackingNumber`, `trackingUrl`, `labelUrl`, `shippedAt`)
  - declared item values
- Admin preview:
  - `/admin/connectors`
  - `/api/admin/connectors/preview?connectorId=shipping_manifest&orderId=<id>`

## Beta Constraints

- These betas currently generate normalized outbound payloads for operator review and downstream wiring.
- They do not yet include OAuth installation, credential vaulting, or fully managed upstream delivery.
- They are intended as the stable payload layer for future live connector transport.
