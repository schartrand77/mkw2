import 'dotenv/config'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { SUITE_DEMO_SAMPLE } from '@/lib/suite-demo/manifest'

type Env = Record<string, string | undefined>

type SuiteDemoPathOptions = {
  makerworksRoot?: string
  env?: Env
}

type DemoFixture = {
  filename: string
  payload: unknown
}

type StockWorksDemoPayloads = {
  materials: Array<Record<string, unknown>>
  inventory: Array<Record<string, unknown> & { materialIndex: number }>
  movements: Array<Record<string, unknown> & { inventoryIndex: number }>
  hardware: Array<Record<string, unknown>>
}

export type DatabaseTargetExplanation = {
  host: string
  reachableFromLocalShell: boolean
  message: string
}

export function resolveSiblingRepoPath(makerworksRoot: string, repoName: string) {
  return path.join(path.dirname(path.resolve(makerworksRoot)), repoName)
}

export function explainDatabaseTarget(databaseUrl: string | undefined): DatabaseTargetExplanation {
  if (!databaseUrl) {
    return {
      host: '',
      reachableFromLocalShell: false,
      message: 'DATABASE_URL is not configured for the MakerWorks demo seed.',
    }
  }
  try {
    const parsed = new URL(databaseUrl)
    const host = parsed.hostname
    if (host === 'db') {
      return {
        host,
        reachableFromLocalShell: false,
        message:
          'DATABASE_URL points at "db", which is a Docker Compose service hostname. Run this command inside the MakerWorks web container or override DATABASE_URL to use localhost from this shell.',
      }
    }
    return {
      host,
      reachableFromLocalShell: true,
      message: `DATABASE_URL target host is ${host || 'local socket'}.`,
    }
  } catch {
    return {
      host: '',
      reachableFromLocalShell: false,
      message: 'DATABASE_URL is not a valid URL.',
    }
  }
}

export function resolveSuiteDemoPaths(options: SuiteDemoPathOptions = {}) {
  const makerworksRoot = path.resolve(options.makerworksRoot || process.cwd())
  const env = options.env || process.env
  const stockworksRoot = path.resolve(env.SUITE_DEMO_STOCKWORKS_ROOT || resolveSiblingRepoPath(makerworksRoot, 'stockworks'))
  const printlabRoot = path.resolve(env.SUITE_DEMO_PRINTLAB_ROOT || resolveSiblingRepoPath(makerworksRoot, 'printlab'))
  const printlabDataDir = path.resolve(env.SUITE_DEMO_PRINTLAB_DATA_DIR || path.join(printlabRoot, 'data'))
  const screenshotDir = path.join(makerworksRoot, 'docs', 'wiki', 'assets', 'suite-screenshots')
  return { makerworksRoot, stockworksRoot, printlabRoot, printlabDataDir, screenshotDir }
}

function nowIso() {
  return new Date('2026-05-02T14:00:00.000Z').toISOString()
}

export function buildPrintLabFixtures(): DemoFixture[] {
  const createdAt = nowIso()
  const queueItem = {
    id: 'queue-demo-1001',
    file_path: '/cache/makerworks-mw-demo-parametric-enclosure.gcode.3mf',
    file_name: 'makerworks-mw-demo-parametric-enclosure.gcode.3mf',
    plate_gcode: 'Metadata/plate_1.gcode',
    use_ams: true,
    ams_mapping: [0],
    start_at: null,
    source: 'makerworks',
    source_job_id: SUITE_DEMO_SAMPLE.orderLabel,
    source_order_id: SUITE_DEMO_SAMPLE.orderId,
    display_name: SUITE_DEMO_SAMPLE.modelTitle,
    created_at: createdAt,
    updated_at: createdAt,
  }
  const submittedJob = {
    id: SUITE_DEMO_SAMPLE.printLabJobId,
    source: 'makerworks',
    status: 'queued',
    printer_id: SUITE_DEMO_SAMPLE.printerId,
    printer_name: SUITE_DEMO_SAMPLE.printerName,
    queue_item_id: queueItem.id,
    idempotency_key: 'makerworks-demo-mw-demo-1001',
    source_job_id: SUITE_DEMO_SAMPLE.orderLabel,
    source_order_id: SUITE_DEMO_SAMPLE.orderId,
    model_id: SUITE_DEMO_SAMPLE.modelId,
    model_name: SUITE_DEMO_SAMPLE.modelTitle,
    model_url: `/models/${SUITE_DEMO_SAMPLE.modelId}`,
    download_url: `/api/models/${SUITE_DEMO_SAMPLE.modelId}/download.zip`,
    file_type: '3mf',
    file_path: queueItem.file_path,
    file_name: queueItem.file_name,
    plate_gcode: queueItem.plate_gcode,
    use_ams: true,
    ams_mapping: [0],
    metadata: {
      demo: true,
      order_label: SUITE_DEMO_SAMPLE.orderLabel,
      material: SUITE_DEMO_SAMPLE.primaryMaterial,
    },
    history: [
      {
        id: 'history-demo-queued',
        status: 'queued',
        message: `Queued MakerWorks demo order ${SUITE_DEMO_SAMPLE.orderLabel}.`,
        at: createdAt,
        details: { queue_item_id: queueItem.id },
      },
    ],
    preflight: {
      selected_printer_id: SUITE_DEMO_SAMPLE.printerId,
      qualified_printer_count: 2,
      approval_required: true,
    },
    created_at: createdAt,
    updated_at: createdAt,
  }
  const successfulGcode = {
    id: 'gcode-demo-1001',
    printer_id: SUITE_DEMO_SAMPLE.printerId,
    printer_name: SUITE_DEMO_SAMPLE.printerName,
    model_id: SUITE_DEMO_SAMPLE.modelId,
    model_name: SUITE_DEMO_SAMPLE.modelTitle,
    file_path: queueItem.file_path,
    file_name: queueItem.file_name,
    plate_gcode: queueItem.plate_gcode,
    source_job_id: SUITE_DEMO_SAMPLE.orderLabel,
    makerworks_sync: {
      status: 'ready',
      last_attempt_at: null,
      last_error: null,
    },
    completed_at: '2026-05-02T17:15:00.000Z',
    created_at: createdAt,
  }
  return [
    { filename: `queue_${SUITE_DEMO_SAMPLE.printerId}.json`, payload: [queueItem] },
    { filename: `submitted_jobs_${SUITE_DEMO_SAMPLE.printerId}.json`, payload: [submittedJob] },
    { filename: `successful_gcodes_${SUITE_DEMO_SAMPLE.printerId}.json`, payload: [successfulGcode] },
  ]
}

export function buildPrintLabPrintersFixture() {
  const basePrinters = [
    {
      id: SUITE_DEMO_SAMPLE.printerId,
      name: SUITE_DEMO_SAMPLE.printerName,
      config: {
        name: SUITE_DEMO_SAMPLE.printerName,
        host: '192.0.2.10',
        serial: 'DEMOX1C0001',
        access_code: 'demo-only',
        device_type: 'x1c',
        local_mqtt: true,
        enable_camera: false,
        disable_ssl_verify: true,
      },
    },
    {
      id: SUITE_DEMO_SAMPLE.backupPrinterId,
      name: SUITE_DEMO_SAMPLE.backupPrinterName,
      config: {
        name: SUITE_DEMO_SAMPLE.backupPrinterName,
        host: '192.0.2.11',
        serial: 'DEMOP1S0001',
        access_code: 'demo-only',
        device_type: 'p1s',
        local_mqtt: true,
        enable_camera: false,
        disable_ssl_verify: true,
      },
    },
  ]
  const extraPrinters = [
    ['demo-a1-mini', 'Demo A1 Mini', 'a1mini', 'PLA Basic White', 0, 'Ready'],
    ['demo-x1-carbon-02', 'Demo X1 Carbon 02', 'x1c', 'PETG Translucent Blue', 2, 'Printing'],
    ['demo-p1s-02', 'Demo P1S 02', 'p1s', 'ASA Charcoal', 1, 'Maintenance due'],
    ['demo-h2d', 'Demo H2D', 'h2d', 'PLA Matte Black', 4, 'Queued'],
    ['demo-a1', 'Demo A1', 'a1', 'TPU 95A Red', 0, 'Ready'],
    ['demo-x1e', 'Demo X1E', 'x1e', 'PA-CF Engineering', 3, 'Reserved'],
  ].map(([id, name, deviceType, material, queueDepth, state], index) => ({
    id,
    name,
    config: {
      name,
      host: `192.0.2.${20 + index}`,
      serial: `DEMO${String(index + 2).padStart(4, '0')}`,
      access_code: 'demo-only',
      device_type: deviceType,
      local_mqtt: true,
      enable_camera: false,
      disable_ssl_verify: true,
      demo_material: material,
      demo_queue_depth: queueDepth,
      demo_state: state,
    },
  }))
  return [...basePrinters, ...extraPrinters]
}

export function buildDemoModelFiles() {
  const modelPath = 'demo/suite/parametric-enclosure-kit.stl'
  const compatibilityPaths = [
    'demo/parametric-enclosure-kit.glb',
    'demo/parametric-enclosure-kit.3mf',
  ]
  const stlContent = `solid makerworks_demo_enclosure
  facet normal 0 0 -1
    outer loop
      vertex -45 -30 0
      vertex 45 -30 0
      vertex 45 30 0
    endloop
  endfacet
  facet normal 0 0 -1
    outer loop
      vertex -45 -30 0
      vertex 45 30 0
      vertex -45 30 0
    endloop
  endfacet
  facet normal 0 -1 0
    outer loop
      vertex -45 -30 0
      vertex -45 -30 18
      vertex 45 -30 18
    endloop
  endfacet
  facet normal 0 -1 0
    outer loop
      vertex -45 -30 0
      vertex 45 -30 18
      vertex 45 -30 0
    endloop
  endfacet
  facet normal 1 0 0
    outer loop
      vertex 45 -30 0
      vertex 45 -30 18
      vertex 45 30 18
    endloop
  endfacet
  facet normal 1 0 0
    outer loop
      vertex 45 -30 0
      vertex 45 30 18
      vertex 45 30 0
    endloop
  endfacet
  facet normal 0 1 0
    outer loop
      vertex 45 30 0
      vertex 45 30 18
      vertex -45 30 18
    endloop
  endfacet
  facet normal 0 1 0
    outer loop
      vertex 45 30 0
      vertex -45 30 18
      vertex -45 30 0
    endloop
  endfacet
  facet normal -1 0 0
    outer loop
      vertex -45 30 0
      vertex -45 30 18
      vertex -45 -30 18
    endloop
  endfacet
  facet normal -1 0 0
    outer loop
      vertex -45 30 0
      vertex -45 -30 18
      vertex -45 -30 0
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex -36 -21 18
      vertex 36 -21 18
      vertex 36 21 18
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex -36 -21 18
      vertex 36 21 18
      vertex -36 21 18
    endloop
  endfacet
endsolid makerworks_demo_enclosure
`
  return { modelPath, viewerPath: modelPath, compatibilityPaths, stlContent }
}

export function buildStockWorksDemoPayloads(): StockWorksDemoPayloads {
  const materialRows = [
    ['Demo PLA Matte Black', 'DemoFil', 'PLA', 'matte', 'Matte Black', '#111827', 0.026, 1000],
    ['Demo PETG Translucent Blue', 'DemoFil', 'PETG', 'translucent', 'Translucent Blue', '#3B82F6', 0.034, 1000],
    ['Demo PLA Galaxy Purple', 'Orbit', 'PLA', 'silk', 'Galaxy Purple', '#7C3AED', 0.031, 1000],
    ['Demo ASA Charcoal', 'Forge', 'ASA', 'engineering', 'Charcoal', '#374151', 0.052, 1000],
    ['Demo TPU 95A Signal Red', 'FlexWorks', 'TPU', 'flexible', 'Signal Red', '#DC2626', 0.061, 750],
    ['Demo PLA Safety Orange', 'DemoFil', 'PLA', 'basic', 'Safety Orange', '#F97316', 0.024, 1000],
    ['Demo PETG Clear', 'DemoFil', 'PETG', 'clear', 'Clear', '#D8F3FF', 0.036, 1000],
    ['Demo PA-CF Engineering Black', 'Forge', 'PA-CF', 'carbon fiber', 'Engineering Black', '#020617', 0.118, 500],
    ['Demo PLA Marble White', 'StoneSpool', 'PLA', 'marble', 'Marble White', '#F8FAFC', 0.044, 1000],
    ['Demo Support Interface Natural', 'SupportCo', 'Support', 'interface', 'Natural', '#FDE68A', 0.082, 500],
    ['Demo PLA Forest Green', 'DemoFil', 'PLA', 'matte', 'Forest Green', '#166534', 0.027, 1000],
    ['Demo PETG Smoke Gray', 'DemoFil', 'PETG', 'translucent', 'Smoke Gray', '#64748B', 0.035, 1000],
  ]
  const materials = materialRows.map(([name, brand, filamentType, category, color, colorHex, pricePerGram, spoolWeight], index) => ({
    name,
    brand,
    filament_type: filamentType,
    category,
    color,
    color_hex: colorHex,
    color_hexes: [colorHex],
    supplier: index % 2 === 0 ? 'Synthetic Supply Co.' : 'Demo Materials Ltd.',
    price_per_gram: pricePerGram,
    spool_weight_grams: spoolWeight,
    barcode: `MW-DEMO-MAT-${String(index + 1).padStart(3, '0')}`,
    notes: `Synthetic suite demo material ${index + 1}.`,
  }))
  const inventory = materials.map((_, index) => ({
    materialIndex: index,
    location: `Demo Rack ${String.fromCharCode(65 + (index % 4))} - Bin ${(index % 6) + 1}`,
    quantity_grams: Math.max(120, 980 - index * 63),
    reorder_level: index % 3 === 0 ? 650 : 350,
    spool_serial: `MW-DEMO-SPOOL-${String(index + 1).padStart(3, '0')}`,
    unit_cost_override: index % 4 === 0 ? 0.03 + index / 1000 : undefined,
  }))
  const movements = Array.from({ length: 28 }, (_, index) => ({
    inventoryIndex: index % inventory.length,
    movement_type: index % 5 === 0 ? 'incoming' : (index % 7 === 0 ? 'adjustment' : 'outgoing'),
    change_grams: index === 0
      ? -SUITE_DEMO_SAMPLE.reservedGrams
      : (index % 5 === 0 ? 1000 : -1 * (35 + index * 4)),
    reference: index === 0 ? SUITE_DEMO_SAMPLE.orderLabel : `MW-DEMO-TXN-${String(index + 1).padStart(3, '0')}`,
    note: index === 0
      ? `Reserved ${SUITE_DEMO_SAMPLE.reservedGrams}g for ${SUITE_DEMO_SAMPLE.orderLabel}.`
      : 'Synthetic usage, receipt, or adjustment for documentation screenshots.',
  }))
  const hardware = [
    ['MakerWorks Demo Shop Shirt', 'merch', 'piece', 18, 6, 'Demo Front Shelf'],
    ['M3 Heat-Set Inserts', 'inserts', 'piece', 840, 250, 'Rack H - Drawer 1'],
    ['M4 Socket Screws 12mm', 'screws', 'piece', 1260, 300, 'Rack H - Drawer 2'],
    ['6x3 Magnets', 'magnets', 'piece', 390, 150, 'Rack H - Drawer 3'],
    ['Shipping Boxes Small', 'packaging', 'piece', 74, 40, 'Packing Wall'],
    ['Desiccant Packs', 'storage', 'pack', 220, 75, 'Dry Cabinet'],
    ['Nozzle 0.4 Hardened', 'printer spares', 'piece', 11, 4, 'Maintenance Bin'],
    ['Build Plate Stickers', 'printer spares', 'piece', 7, 3, 'Maintenance Bin'],
    ['Label Rolls', 'operations', 'roll', 5, 2, 'Office Shelf'],
    ['MakerWorks Sticker Pack', 'merch', 'pack', 96, 25, 'Demo Front Shelf'],
    ['USB-C Cable 1m', 'electronics', 'piece', 22, 8, 'Rack E - Bin 2'],
    ['Threaded Standoffs', 'hardware', 'piece', 310, 120, 'Rack H - Drawer 4'],
  ].map(([name, category, unit, quantity, reorder, location], index) => ({
    name,
    category,
    merch_color: category === 'merch' ? 'Black' : undefined,
    merch_size: name === 'MakerWorks Demo Shop Shirt' ? 'L' : undefined,
    merch_style: category === 'merch' ? 'Suite demo merch' : undefined,
    merch_sku: category === 'merch' ? `MW-DEMO-MERCH-${String(index + 1).padStart(3, '0')}` : undefined,
    unit_of_measure: unit,
    unit_cost: 0.12 + index * 0.71,
    quantity_on_hand: quantity,
    reorder_level: reorder,
    bin_location: location,
    notes: 'Synthetic suite demo hardware or merch item.',
  }))
  return { materials, inventory, movements, hardware }
}

async function seedMakerWorks() {
  const demoFiles = buildDemoModelFiles()
  await writeDemoModelFiles(demoFiles)
  const passwordHash = await hashPassword('SuiteDemoPassword123!')
  const admin = await prisma.user.upsert({
    where: { email: SUITE_DEMO_SAMPLE.adminEmail },
    update: {
      name: SUITE_DEMO_SAMPLE.adminName,
      passwordHash,
      isAdmin: true,
      role: 'admin',
      emailVerified: true,
      isSuspended: false,
    },
    create: {
      id: 'mw-demo-admin-user',
      email: SUITE_DEMO_SAMPLE.adminEmail,
      name: SUITE_DEMO_SAMPLE.adminName,
      passwordHash,
      isAdmin: true,
      role: 'admin',
      emailVerified: true,
      isSuspended: false,
    },
  })

  const customer = await prisma.user.upsert({
    where: { email: SUITE_DEMO_SAMPLE.customerEmail },
    update: {
      name: SUITE_DEMO_SAMPLE.customerName,
      passwordHash,
      emailVerified: true,
      isSuspended: false,
    },
    create: {
      id: 'mw-demo-customer-user',
      email: SUITE_DEMO_SAMPLE.customerEmail,
      name: SUITE_DEMO_SAMPLE.customerName,
      passwordHash,
      emailVerified: true,
      isSuspended: false,
    },
  })

  await prisma.profile.upsert({
    where: { userId: customer.id },
    update: { slug: 'avery-demo', bio: 'Synthetic suite demo customer profile.' },
    create: { userId: customer.id, slug: 'avery-demo', bio: 'Synthetic suite demo customer profile.' },
  })

  const organization = await prisma.organization.upsert({
    where: { slug: SUITE_DEMO_SAMPLE.organizationSlug },
    update: {
      name: SUITE_DEMO_SAMPLE.organizationName,
      billingEmail: 'billing@example.invalid',
      billingContact: 'Riley Demo',
      quoteApprovalRequired: true,
      requirePoAboveCents: 25000,
    },
    create: {
      id: 'mw-demo-organization',
      name: SUITE_DEMO_SAMPLE.organizationName,
      slug: SUITE_DEMO_SAMPLE.organizationSlug,
      billingEmail: 'billing@example.invalid',
      billingContact: 'Riley Demo',
      quoteApprovalRequired: true,
      requirePoAboveCents: 25000,
      createdById: admin.id,
    },
  })

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: organization.id, userId: customer.id } },
    update: { role: 'requester', status: 'active' },
    create: { organizationId: organization.id, userId: customer.id, role: 'requester', status: 'active' },
  })

  await prisma.printer.upsert({
    where: { id: SUITE_DEMO_SAMPLE.printerId },
    update: {
      name: SUITE_DEMO_SAMPLE.printerName,
      provider: 'printlab',
      externalId: SUITE_DEMO_SAMPLE.printerId,
      status: 'available',
      active: true,
      metadata: { demo: true, loadedMaterial: SUITE_DEMO_SAMPLE.primaryMaterial },
    },
    create: {
      id: SUITE_DEMO_SAMPLE.printerId,
      name: SUITE_DEMO_SAMPLE.printerName,
      provider: 'printlab',
      externalId: SUITE_DEMO_SAMPLE.printerId,
      status: 'available',
      active: true,
      metadata: { demo: true, loadedMaterial: SUITE_DEMO_SAMPLE.primaryMaterial },
    },
  })

  const model = await prisma.model.upsert({
    where: { id: SUITE_DEMO_SAMPLE.modelId },
    update: {
      title: SUITE_DEMO_SAMPLE.modelTitle,
      description: 'Synthetic enclosure kit used to document the MakerWorks to StockWorks to PrintLab flow.',
      material: 'PLA',
      filePath: demoFiles.modelPath,
      viewerFilePath: demoFiles.viewerPath,
      fileType: 'stl',
      visibility: 'public',
      volumeMm3: 82000,
      sizeXmm: 142,
      sizeYmm: 88,
      sizeZmm: 38,
      supportRatio: 0.12,
      priceUsd: 42,
      effectivePriceUsd: 42,
      printabilityScore: 0.91,
      supportLikelihood: 0.18,
      failureRiskScore: 0.16,
      orientationSuggestion: 'Flat on base with cable opening facing up.',
      supportStrategySuggestion: 'Organic supports for snap tabs only.',
      defaultColors: [SUITE_DEMO_SAMPLE.primaryMaterial],
      colorSlotCount: 2,
      allowedColors: ['Black', 'Blue', 'White'],
    },
    create: {
      id: SUITE_DEMO_SAMPLE.modelId,
      title: SUITE_DEMO_SAMPLE.modelTitle,
      description: 'Synthetic enclosure kit used to document the MakerWorks to StockWorks to PrintLab flow.',
      creditName: 'MakerWorks Demo Library',
      filePath: demoFiles.modelPath,
      viewerFilePath: demoFiles.viewerPath,
      fileType: 'stl',
      material: 'PLA',
      visibility: 'public',
      volumeMm3: 82000,
      sizeXmm: 142,
      sizeYmm: 88,
      sizeZmm: 38,
      supportRatio: 0.12,
      priceUsd: 42,
      effectivePriceUsd: 42,
      printabilityScore: 0.91,
      supportLikelihood: 0.18,
      failureRiskScore: 0.16,
      orientationSuggestion: 'Flat on base with cable opening facing up.',
      supportStrategySuggestion: 'Organic supports for snap tabs only.',
      defaultColors: [SUITE_DEMO_SAMPLE.primaryMaterial],
      colorSlotCount: 2,
      allowedColors: ['Black', 'Blue', 'White'],
      userId: admin.id,
    },
  })

  await prisma.collection.upsert({
    where: { slug: SUITE_DEMO_SAMPLE.collectionSlug },
    update: {
      title: 'Suite Demo Production Ready',
      description: 'Synthetic collection for the end-to-end suite documentation workflow.',
      kind: 'curated',
      isActive: true,
    },
    create: {
      id: 'mw-demo-collection',
      slug: SUITE_DEMO_SAMPLE.collectionSlug,
      title: 'Suite Demo Production Ready',
      description: 'Synthetic collection for the end-to-end suite documentation workflow.',
      kind: 'curated',
      isActive: true,
      position: 1,
    },
  })

  await prisma.collectionModel.upsert({
    where: { collectionId_modelId: { collectionId: 'mw-demo-collection', modelId: model.id } },
    update: { position: 1 },
    create: { collectionId: 'mw-demo-collection', modelId: model.id, position: 1 },
  })

  await prisma.productTemplate.upsert({
    where: { id: 'mw-demo-template-enclosure' },
    update: {
      title: 'Parametric Enclosure Kit - Ready Print',
      baseModelId: model.id,
      stockworksCategory: 'models',
      stockworksSku: 'MW-DEMO-ENCLOSURE',
      stockworksUnitPriceUsd: 42,
      stockworksStatus: 'Active',
      lockedMaterial: 'PLA',
      lockedColor: 'Black',
      lockedColorCount: 2,
      materialOptions: ['PLA', 'PETG'],
      colorOptions: ['Black', 'Translucent Blue', 'White'],
      isActive: true,
    },
    create: {
      id: 'mw-demo-template-enclosure',
      title: 'Parametric Enclosure Kit - Ready Print',
      description: 'Synthetic ready-print template linked to StockWorks availability.',
      baseModelId: model.id,
      stockworksCategory: 'models',
      stockworksSku: 'MW-DEMO-ENCLOSURE',
      stockworksUnitPriceUsd: 42,
      stockworksStatus: 'Active',
      lockedMaterial: 'PLA',
      lockedColor: 'Black',
      lockedColorCount: 2,
      materialOptions: ['PLA', 'PETG'],
      colorOptions: ['Black', 'Translucent Blue', 'White'],
      isActive: true,
    },
  })

  await prisma.merchItem.upsert({
    where: { id: 'mw-demo-merch-shirt' },
    update: {
      title: 'MakerWorks Demo Shop Shirt',
      category: 'apparel',
      availability: 'in_stock',
      priceUsd: 24,
      isActive: true,
    },
    create: {
      id: 'mw-demo-merch-shirt',
      title: 'MakerWorks Demo Shop Shirt',
      description: 'Synthetic merch item for StockWorks sync screenshots.',
      category: 'apparel',
      availability: 'in_stock',
      priceUsd: 24,
      sizeOptions: ['M', 'L'],
      colorOptions: ['Black'],
      isActive: true,
    },
  })

  await prisma.printOrder.deleteMany({ where: { id: SUITE_DEMO_SAMPLE.orderId } })
  await prisma.printOrder.create({
    data: {
      id: SUITE_DEMO_SAMPLE.orderId,
      orderNumber: SUITE_DEMO_SAMPLE.orderNumber,
      userId: customer.id,
      organizationId: organization.id,
      customerEmail: SUITE_DEMO_SAMPLE.customerEmail,
      customerName: SUITE_DEMO_SAMPLE.customerName,
      status: 'in_production',
      paymentMethod: 'invoice',
      paymentStatus: 'pending',
      shippingMethod: 'pickup',
      subtotalCents: 4200,
      totalCents: 4200,
      notes: 'Synthetic suite demo order. Do not fulfill.',
      printerId: SUITE_DEMO_SAMPLE.printerId,
      printerAssignedAt: new Date('2026-05-02T15:00:00.000Z'),
      printerAssignedBy: admin.id,
      metadata: {
        demo: true,
        orderLabel: SUITE_DEMO_SAMPLE.orderLabel,
        printLabJobId: SUITE_DEMO_SAMPLE.printLabJobId,
        stockworksReservedGrams: SUITE_DEMO_SAMPLE.reservedGrams,
      },
      items: {
        create: [
          {
            modelId: model.id,
            modelTitle: model.title,
            material: 'PLA',
            colors: ['Black', 'Translucent Blue'],
            infillPct: 25,
            finish: 'standard',
            quantity: 1,
            unitPriceCents: 4200,
            totalCents: 4200,
            configuration: {
              demo: true,
              materialName: SUITE_DEMO_SAMPLE.primaryMaterial,
              alternateMaterial: SUITE_DEMO_SAMPLE.alternateMaterial,
            },
            viewerPath: model.viewerFilePath,
          },
        ],
      },
      messages: {
        create: [
          {
            userId: admin.id,
            senderRole: 'shop',
            body: `Demo production note: ${SUITE_DEMO_SAMPLE.reservedGrams}g reserved in StockWorks and queued as ${SUITE_DEMO_SAMPLE.printLabJobId}.`,
          },
        ],
      },
      approvalRequests: {
        create: [
          {
            requestedById: admin.id,
            status: 'pending',
            message: 'Synthetic approval request for procurement routing screenshots.',
          },
        ],
      },
    },
  })
}

async function writeDemoModelFiles(files: ReturnType<typeof buildDemoModelFiles>) {
  for (const storagePath of [files.modelPath, ...files.compatibilityPaths]) {
    const fullPath = path.join(process.cwd(), 'storage', storagePath)
    await mkdir(path.dirname(fullPath), { recursive: true })
    await writeFile(fullPath, files.stlContent, 'utf-8')
  }
}

async function postStockWorks(baseUrl: string, pathName: string, body: unknown, authHeader: string) {
  const response = await fetch(new URL(pathName, baseUrl), {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok && response.status !== 409) {
    const detail = await response.text().catch(() => '')
    throw new Error(`StockWorks demo seed failed at ${pathName}: HTTP ${response.status}${detail ? ` ${detail.slice(0, 120)}` : ''}`)
  }
  return response.json().catch(() => null)
}

async function seedStockWorks(env: Env = process.env) {
  if ((env.SUITE_DEMO_STOCKWORKS_SEED || '').trim() !== '1') {
    return 'skipped'
  }
  const baseUrl = env.SUITE_DEMO_STOCKWORKS_URL || env.STOCKWORKS_BASE_URL || 'http://localhost:8000'
  const username = env.STOCKWORKS_ADMIN_USERNAME || env.STOCKWORKS_USERNAME || ''
  const password = env.STOCKWORKS_ADMIN_PASSWORD || env.STOCKWORKS_PASSWORD || ''
  if (!username || !password) {
    return 'skipped: missing demo StockWorks credentials'
  }
  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
  const payloads = buildStockWorksDemoPayloads()
  const createdMaterials = []
  for (const materialPayload of payloads.materials) {
    createdMaterials.push(await postStockWorks(baseUrl, '/materials', materialPayload, authHeader))
  }
  const createdInventory = []
  for (const inventoryPayload of payloads.inventory) {
    const material = createdMaterials[inventoryPayload.materialIndex]
    if (!material?.id) continue
    const { materialIndex, ...body } = inventoryPayload
    createdInventory.push(await postStockWorks(baseUrl, '/inventory', { ...body, material_id: material.id }, authHeader))
  }
  for (const movementPayload of payloads.movements) {
    const inventory = createdInventory[movementPayload.inventoryIndex]
    if (!inventory?.id) continue
    const { inventoryIndex, ...body } = movementPayload
    await postStockWorks(baseUrl, '/movements', { ...body, inventory_item_id: inventory.id }, authHeader)
  }
  for (const hardwarePayload of payloads.hardware) {
    await postStockWorks(baseUrl, '/hardware', hardwarePayload, authHeader)
  }
  return 'seeded'
}

async function seedPrintLabFixtures(printlabDataDir: string) {
  await mkdir(printlabDataDir, { recursive: true })
  await writeFile(
    path.join(printlabDataDir, 'printers_added.json'),
    JSON.stringify(buildPrintLabPrintersFixture(), null, 2),
    'utf-8',
  )
  for (const fixture of buildPrintLabFixtures()) {
    await writeFile(path.join(printlabDataDir, fixture.filename), JSON.stringify(fixture.payload, null, 2), 'utf-8')
  }
}

export async function runSuiteDemoSeed(env: Env = process.env) {
  const paths = resolveSuiteDemoPaths({ env })
  const dbTarget = explainDatabaseTarget(env.DATABASE_URL)
  if (!dbTarget.reachableFromLocalShell) {
    throw new Error(dbTarget.message)
  }
  await seedMakerWorks()
  const stockworksStatus = await seedStockWorks(env)
  await seedPrintLabFixtures(paths.printlabDataDir)
  return {
    makerworks: 'seeded',
    stockworks: stockworksStatus,
    printlab: `seeded fixtures in ${paths.printlabDataDir}`,
  }
}

async function main() {
  const result = await runSuiteDemoSeed()
  console.log(`MakerWorks demo data: ${result.makerworks}`)
  console.log(`StockWorks demo data: ${result.stockworks}`)
  console.log(`PrintLab demo data: ${result.printlab}`)
  console.log('Demo MakerWorks admin user created: suite-demo-admin@example.invalid')
}

const isCli = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isCli) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
