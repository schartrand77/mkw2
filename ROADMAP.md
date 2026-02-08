# MakerWorks Feature Roadmap (By Phase)

Last updated: 2026-02-08

## Phase 1 - Operational Core (Stability + Daily Use)

Goal: Make it rock-solid for real daily production use.

Orders & Jobs
- [x] Estimate -> Cart -> Order -> Job pipeline
- [x] Job status workflow (queued / printing / post-process / shipped)
- [x] Job ticket printable sheets
- [x] QR code per job
- [x] Attach model + slicer profile to job

Inventory Reliability
- [x] Filament level adjustments with audit log
- [x] Spool consumption per job
- [x] Low-stock alerts
- [x] SKU + barcode normalization

Pricing Engine v1 Lockdown
- [x] Material + time + electricity + labor formula finalized
- [x] Admin pricing preview sandbox
- [x] Saved pricing profiles

Admin Safety
- [x] Role-based access
- [x] Config change audit log
- [x] Environment validation checks
- [x] Backup / restore button

Ship when: You could run your farm for a week without touching spreadsheets.

## Phase 2 - Automation Layer

Goal: Reduce human babysitting.

Printer Integration
- [x] Bambu View API client + sync endpoints
- [x] Printer records + assignment fields in schema
- [x] Printer status dashboard
- [x] Job -> printer assignment
- [x] Auto job queue
- [x] Failure flag + requeue button
- [x] AMS tray mapping from estimate colors

Smart Material Tracking
- [x] Auto spool deduction from slicer stats
- [x] Remaining spool prediction
- [x] Reorder thresholds
- [x] Vendor + cost history tracking

Workflow Automation
- [x] Auto job creation from paid orders
- [x] Packing checklist auto-generate
- [x] Shipping label fields + tracking

Ship when: You're clicking half as much per job.

## Phase 3 - Intelligence & Insight

Goal: Stop guessing. Start knowing.
Status: Complete (2026-02-08)

Analytics
- [x] Profit per job
- [x] Profit per printer hour
- [x] Failure rate per model/material
- [x] Revenue per filament type
- [x] Utilization charts

Model Intelligence
- [x] Mesh analysis on upload
- [x] Printability score
- [x] Support likelihood detection
- [x] Orientation suggestions
- [x] Estimated failure risk score

Estimate Engine v2
- [x] G-code parser import
- [x] Multi-material breakdown
- [x] Batch discounts
- [x] Rush pricing toggle
- [x] Demand surge multiplier

Ship when: You can answer "is this job worth it?" instantly.

## Phase 4 - Storefront Power

Goal: Turn MakerWorks into a real customer-facing platform.
Status: Complete (2026-02-08)

Product Builder
- [x] Configurable products
- [x] Material/color/size options
- [x] Live price preview
- [x] Saved product templates

Customer Portal
- [x] Upload model -> instant estimate
- [x] Order tracking page
- [x] Approval checkpoints
- [x] Saved presets

Commerce Features
- [x] Bulk pricing tiers
- [x] Minimum order rules
- [x] Quote approval flow
- [x] Invoice + PO mode

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
