# MakerWorks Feature Roadmap (By Phase)

Last updated: 2026-02-07

## Phase 1 - Operational Core (Stability + Daily Use)

Goal: Make it rock-solid for real daily production use.

Orders & Jobs
- [ ] Estimate -> Cart -> Order -> Job pipeline
- [x] Job status workflow (queued / printing / post-process / shipped)
- [x] Job ticket printable sheets
- [x] QR code per job
- [ ] Attach model + slicer profile to job

Inventory Reliability
- [ ] Filament level adjustments with audit log
- [ ] Spool consumption per job
- [ ] Low-stock alerts
- [ ] SKU + barcode normalization

Pricing Engine v1 Lockdown
- [ ] Material + time + electricity + labor formula finalized
- [ ] Admin pricing preview sandbox
- [ ] Saved pricing profiles

Admin Safety
- [ ] Role-based access
- [ ] Config change audit log
- [ ] Environment validation checks
- [ ] Backup / restore button

Ship when: You could run your farm for a week without touching spreadsheets.

## Phase 2 - Automation Layer

Goal: Reduce human babysitting.

Printer Integration
- [ ] Printer status dashboard
- [ ] Job -> printer assignment
- [ ] Auto job queue
- [ ] Failure flag + requeue button
- [ ] AMS tray mapping from estimate colors

Smart Material Tracking
- [ ] Auto spool deduction from slicer stats
- [ ] Remaining spool prediction
- [ ] Reorder thresholds
- [ ] Vendor + cost history tracking

Workflow Automation
- [ ] Auto job creation from paid orders
- [ ] Packing checklist auto-generate
- [ ] Shipping label fields + tracking

Ship when: You're clicking half as much per job.

## Phase 3 - Intelligence & Insight

Goal: Stop guessing. Start knowing.

Analytics
- [ ] Profit per job
- [ ] Profit per printer hour
- [ ] Failure rate per model/material
- [ ] Revenue per filament type
- [ ] Utilization charts

Model Intelligence
- [ ] Mesh analysis on upload
- [ ] Printability score
- [ ] Support likelihood detection
- [ ] Orientation suggestions
- [ ] Estimated failure risk score

Estimate Engine v2
- [ ] G-code parser import
- [ ] Multi-material breakdown
- [ ] Batch discounts
- [ ] Rush pricing toggle
- [ ] Demand surge multiplier

Ship when: You can answer "is this job worth it?" instantly.

## Phase 4 - Storefront Power

Goal: Turn MakerWorks into a real customer-facing platform.

Product Builder
- [ ] Configurable products
- [ ] Material/color/size options
- [ ] Live price preview
- [ ] Saved product templates

Customer Portal
- [ ] Upload model -> instant estimate
- [ ] Order tracking page
- [ ] Approval checkpoints
- [ ] Saved presets

Commerce Features
- [ ] Bulk pricing tiers
- [ ] Minimum order rules
- [ ] Quote approval flow
- [ ] Invoice + PO mode

Ship when: Customers can self-serve without emailing you 19 times.

## Phase 5 - Farm Optimization

Goal: Make multi-printer scaling not hurt.

Fleet Intelligence
- [ ] Printer utilization heatmaps
- [ ] Maintenance schedules
- [ ] MTBF tracking
- [ ] Per-printer success rate

Batch Optimization
- [ ] Auto nesting suggestions
- [ ] Batch grouping by material/color
- [ ] Queue optimizer
- [ ] Print cluster planning

Material Optimization
- [ ] Waste reports
- [ ] Color similarity suggestions
- [ ] Alternate filament recommendations

Ship when: Adding printers feels easy instead of chaotic.

## Phase 6 - Integrations & Ecosystem

Goal: MakerWorks becomes the hub, not the island.

Integrations
- [ ] Slicer plugins
- [ ] Webhook API
- [ ] Shopify/WooCommerce connector
- [ ] OctoPrint/Klipper adapters
- [ ] Vendor catalog importers

External Automation
- [ ] Accounting export
- [ ] Shipping provider APIs
- [ ] Supplier reorder automation

Ship when: Other systems plug into you - not vice versa.

## Phase 7 - Advanced / Differentiator Tier

Goal: Features competitors do not bother building.

- [ ] AI orientation optimizer
- [ ] Failure photo classifier
- [ ] Auto support strategy suggestions
- [ ] Color blend preview for AMS
- [ ] Print time correction from history
- [ ] Assembly grouping for multipart models
- [ ] Demand forecasting

Ship when: People accuse you of being unfair.
