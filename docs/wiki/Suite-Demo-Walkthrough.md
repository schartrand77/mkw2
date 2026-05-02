# MakerWorks Suite Demo Walkthrough

This page documents a fully synthetic end-to-end MakerWorks suite scenario. It is designed for local screenshots and onboarding, not production operations.

## Demo Story

A synthetic customer, Avery Demo, orders the Parametric Enclosure Kit for Northstar Robotics Club. MakerWorks handles discovery, quoting, checkout, and admin production views. PrintLab shows the safe fake printer handoff for PL-DEMO-1001. StockWorks shows material availability, stock movements, incoming job demand, and loaded tray context.

Demo identifiers:

- Order: MW-DEMO-1001
- PrintLab job: PL-DEMO-1001
- Printer: Demo X1 Carbon
- Material: PLA Matte Black

## Safety

The demo workflow uses synthetic data only. It must not capture real customer records, real inventory counts, `.env` values, payment secrets, or production URLs.

The PrintLab portion is fixture-based and does not send real printer actions. Do not use this workflow to pause, resume, stop, heat, move fans, upload, or submit real print jobs.

By default, PrintLab screenshots are rendered from synthetic demo content so live printer serials, names, camera views, and job state are not captured. Set `SUITE_DEMO_PRINTLAB_CAPTURE_LIVE=1` only when you explicitly want to document a safe non-production PrintLab instance.

## Regenerating

Run these commands from the MakerWorks repo root after local demo services are available:

```powershell
npm run suite:demo:seed
npm run suite:demo:screenshots
npm run suite:demo:wiki
```

Screenshots are written under `docs/wiki/assets/suite-screenshots/`.

## MakerWorks

### Storefront Home

The customer-facing entry point with featured sample models and suite navigation context.

![Storefront Home](assets/suite-screenshots/makerworks-01-home.png)

### Discover Models

Search and discovery with synthetic models, tags, and inventory-aware context.

![Discover Models](assets/suite-screenshots/makerworks-02-discover.png)

### Model Detail

The sample enclosure model with printability, materials, creator, and add-to-cart controls.

![Model Detail](assets/suite-screenshots/makerworks-03-model-detail.png)

### Cart Configurator

Configured quote details including material, color, infill, scale, and estimated pricing.

![Cart Configurator](assets/suite-screenshots/makerworks-04-cart-quote.png)

### Checkout

Sample checkout and organization procurement fields before the order enters production.

![Checkout](assets/suite-screenshots/makerworks-05-checkout.png)

### Customer Order

Customer-facing order history and production status for the synthetic order.

![Customer Order](assets/suite-screenshots/makerworks-06-customer-order.png)

### Admin Dashboard

Shop operator dashboard with sample demand, order, and production signals.

![Admin Dashboard](assets/suite-screenshots/makerworks-07-admin-dashboard.png)

### Production Queue

Production queue and printer assignment view for the demo order.

![Production Queue](assets/suite-screenshots/makerworks-08-admin-production.png)

### Print Job Detail

Admin print job detail page showing the demo order, production controls, and PrintLab submission status.

![Print Job Detail](assets/suite-screenshots/makerworks-09-print-job-detail.png)

### Inventory Intelligence

StockWorks-backed material availability and low-stock signal surfaced in MakerWorks.

![Inventory Intelligence](assets/suite-screenshots/makerworks-10-admin-inventory.png)

## StockWorks

### Materials

Synthetic filament catalog, colors, pricing, supplier, and barcode references.

![Materials](assets/suite-screenshots/stockworks-01-materials.png)

### Inventory

Sample spool inventory showing current grams, reorder levels, locations, and serials.

![Inventory](assets/suite-screenshots/stockworks-02-inventory.png)

### Hardware

Hardware and merch stock that can sync back to MakerWorks catalog availability.

![Hardware](assets/suite-screenshots/stockworks-03-hardware.png)

### Stock Movements

Material movement history including the reservation for MW-DEMO-1001.

![Stock Movements](assets/suite-screenshots/stockworks-04-movements.png)

### Orders

Incoming MakerWorks job visibility from the inventory team perspective.

![Orders](assets/suite-screenshots/stockworks-05-orders.png)

### Reports

Inventory, usage, low-stock, and job-demand reporting for the demo flow.

![Reports](assets/suite-screenshots/stockworks-06-reports.png)

### PrintLab Loaded Trays

PrintLab loaded tray context inside StockWorks settings.

![PrintLab Loaded Trays](assets/suite-screenshots/stockworks-07-printlab.png)

## PrintLab

### Printer Fleet

Representative safe fake printer fleet screenshot mirrored into the PrintLab repo.

![Printer Fleet](assets/suite-screenshots/printlab-01-printers.png)

## Suite Flow

### Commerce to Production

Composite documentation slot for MakerWorks order handoff into PrintLab production.

![Commerce to Production](assets/suite-screenshots/suite-01-commerce-to-production.png)

### Inventory Demand

Composite documentation slot for MakerWorks demand flowing into StockWorks inventory planning.

![Inventory Demand](assets/suite-screenshots/suite-02-inventory-demand.png)

## Integration Flow

1. MakerWorks owns the storefront, quoting, checkout, order lifecycle, and admin production view.
2. StockWorks owns materials, inventory, merch, stock movements, material warnings, and incoming job demand.
3. PrintLab owns printer state, preflight/routing, submitted jobs, successful G-code records, and callback context.
4. The synthetic order ties the same sample material, printer, and job identifiers across all three apps.
