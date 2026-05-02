export type SuiteDemoApp = 'MakerWorks' | 'StockWorks' | 'PrintLab' | 'Suite Flow'

export type SuiteDemoScreenshot = {
  app: SuiteDemoApp
  title: string
  filename: string
  path: string
  description: string
  optional?: boolean
  tabTarget?: string
  waitForText?: string
}

export const SUITE_DEMO_ASSET_DIR = 'docs/wiki/assets/suite-screenshots'

export const SUITE_DEMO_SCREENSHOTS: SuiteDemoScreenshot[] = [
  {
    app: 'MakerWorks',
    title: 'Storefront Home',
    filename: 'makerworks-01-home.png',
    path: '/',
    description: 'The customer-facing entry point with featured sample models and suite navigation context.',
    waitForText: 'Browse Library',
  },
  {
    app: 'MakerWorks',
    title: 'Discover Models',
    filename: 'makerworks-02-discover.png',
    path: '/discover?q=parametric',
    description: 'Search and discovery with synthetic models, tags, and inventory-aware context.',
    waitForText: 'Discover Models',
  },
  {
    app: 'MakerWorks',
    title: 'Model Detail',
    filename: 'makerworks-03-model-detail.png',
    path: '/models/mw-demo-parametric-enclosure',
    description: 'The sample enclosure model with printability, materials, creator, and add-to-cart controls.',
    optional: true,
    waitForText: 'Parametric Enclosure Kit',
  },
  {
    app: 'MakerWorks',
    title: 'Cart Configurator',
    filename: 'makerworks-04-cart-quote.png',
    path: '/cart',
    description: 'Configured quote details including material, color, infill, scale, and estimated pricing.',
    waitForText: 'Cart',
  },
  {
    app: 'MakerWorks',
    title: 'Checkout',
    filename: 'makerworks-05-checkout.png',
    path: '/checkout',
    description: 'Sample checkout and organization procurement fields before the order enters production.',
    waitForText: 'Checkout',
  },
  {
    app: 'MakerWorks',
    title: 'Customer Order',
    filename: 'makerworks-06-customer-order.png',
    path: '/customer/orders',
    description: 'Customer-facing order history and production status for the synthetic order.',
    optional: true,
    waitForText: 'Orders',
  },
  {
    app: 'MakerWorks',
    title: 'Admin Dashboard',
    filename: 'makerworks-07-admin-dashboard.png',
    path: '/admin',
    description: 'Shop operator dashboard with sample demand, order, and production signals.',
    optional: true,
    waitForText: 'Admin',
  },
  {
    app: 'MakerWorks',
    title: 'Production Queue',
    filename: 'makerworks-08-admin-production.png',
    path: '/admin/production',
    description: 'Production queue and printer assignment view for the demo order.',
    optional: true,
    waitForText: 'Production',
  },
  {
    app: 'MakerWorks',
    title: 'Inventory Intelligence',
    filename: 'makerworks-09-admin-inventory.png',
    path: '/admin/inventory',
    description: 'StockWorks-backed material availability and low-stock signal surfaced in MakerWorks.',
    optional: true,
    waitForText: 'Inventory',
  },
  {
    app: 'StockWorks',
    title: 'Materials',
    filename: 'stockworks-01-materials.png',
    path: '/',
    description: 'Synthetic filament catalog, colors, pricing, supplier, and barcode references.',
    tabTarget: 'materials-panel',
    waitForText: 'Materials',
  },
  {
    app: 'StockWorks',
    title: 'Inventory',
    filename: 'stockworks-02-inventory.png',
    path: '/',
    description: 'Sample spool inventory showing current grams, reorder levels, locations, and serials.',
    tabTarget: 'inventory-panel',
    waitForText: 'Inventory',
  },
  {
    app: 'StockWorks',
    title: 'Hardware',
    filename: 'stockworks-03-hardware.png',
    path: '/',
    description: 'Hardware and merch stock that can sync back to MakerWorks catalog availability.',
    tabTarget: 'hardware-panel',
    waitForText: 'Hardware',
  },
  {
    app: 'StockWorks',
    title: 'Stock Movements',
    filename: 'stockworks-04-movements.png',
    path: '/',
    description: 'Material movement history including the reservation for MW-DEMO-1001.',
    tabTarget: 'movement-panel',
    waitForText: 'Stock Movements',
  },
  {
    app: 'StockWorks',
    title: 'Orders',
    filename: 'stockworks-05-orders.png',
    path: '/',
    description: 'Incoming MakerWorks job visibility from the inventory team perspective.',
    tabTarget: 'orderworks-panel',
    waitForText: 'OrderWorks Jobs',
  },
  {
    app: 'StockWorks',
    title: 'Reports',
    filename: 'stockworks-06-reports.png',
    path: '/',
    description: 'Inventory, usage, low-stock, and job-demand reporting for the demo flow.',
    tabTarget: 'reports-panel',
    waitForText: 'Reports',
  },
  {
    app: 'StockWorks',
    title: 'PrintLab Loaded Trays',
    filename: 'stockworks-07-printlab.png',
    path: '/',
    description: 'PrintLab loaded tray context inside StockWorks settings.',
    tabTarget: 'settings-panel',
    optional: true,
    waitForText: 'PrintLab',
  },
  {
    app: 'PrintLab',
    title: 'Printer Fleet',
    filename: 'printlab-01-printers.png',
    path: '/',
    description: 'Safe fake printer fleet with queue, status, and health context.',
    waitForText: 'PrintLab',
  },
  {
    app: 'PrintLab',
    title: 'Printer Detail',
    filename: 'printlab-02-printer-detail.png',
    path: '/printer/demo-x1c',
    description: 'Demo X1 Carbon detail page with synthetic state and queued MakerWorks job context.',
    optional: true,
    waitForText: 'Demo X1 Carbon',
  },
  {
    app: 'PrintLab',
    title: 'MakerWorks Library Handoff',
    filename: 'printlab-03-makerworks-library.png',
    path: '/makerworks',
    description: 'MakerWorks library browsing and one-click handoff context from PrintLab.',
    optional: true,
    waitForText: 'MakerWorks',
  },
  {
    app: 'PrintLab',
    title: 'Preflight Routing',
    filename: 'printlab-04-preflight.png',
    path: '/makerworks-routing',
    description: 'Safe routing board showing printer qualification and approval requirements.',
    optional: true,
    waitForText: 'routing',
  },
  {
    app: 'PrintLab',
    title: 'Submitted Jobs',
    filename: 'printlab-05-jobs.png',
    path: '/makerworks-routing',
    description: 'Submitted job ledger for PL-DEMO-1001 without sending real printer actions.',
    optional: true,
    waitForText: 'PL-DEMO-1001',
  },
  {
    app: 'Suite Flow',
    title: 'Commerce to Production',
    filename: 'suite-01-commerce-to-production.png',
    path: '/admin/production',
    description: 'Composite documentation slot for MakerWorks order handoff into PrintLab production.',
    optional: true,
  },
  {
    app: 'Suite Flow',
    title: 'Inventory Demand',
    filename: 'suite-02-inventory-demand.png',
    path: '/admin/inventory',
    description: 'Composite documentation slot for MakerWorks demand flowing into StockWorks inventory planning.',
    optional: true,
  },
]

export const SUITE_DEMO_SAMPLE = {
  customerName: 'Avery Demo',
  customerEmail: 'avery.demo@example.invalid',
  adminName: 'MakerWorks Demo Admin',
  adminEmail: 'suite-demo-admin@example.invalid',
  organizationName: 'Northstar Robotics Club',
  organizationSlug: 'northstar-robotics-club-demo',
  modelId: 'mw-demo-parametric-enclosure',
  modelTitle: 'Parametric Enclosure Kit',
  collectionSlug: 'suite-demo-production-ready',
  orderId: 'mw-demo-order-1001',
  orderNumber: 1001,
  orderLabel: 'MW-DEMO-1001',
  printLabJobId: 'PL-DEMO-1001',
  printerId: 'demo-x1c',
  printerName: 'Demo X1 Carbon',
  backupPrinterId: 'demo-p1s',
  backupPrinterName: 'Demo P1S',
  primaryMaterial: 'PLA Matte Black',
  alternateMaterial: 'PETG Translucent Blue',
  reservedGrams: 220,
} as const

export function screenshotsByApp() {
  return SUITE_DEMO_SCREENSHOTS.reduce<Record<SuiteDemoApp, SuiteDemoScreenshot[]>>(
    (groups, entry) => {
      groups[entry.app].push(entry)
      return groups
    },
    {
      MakerWorks: [],
      StockWorks: [],
      PrintLab: [],
      'Suite Flow': [],
    },
  )
}
