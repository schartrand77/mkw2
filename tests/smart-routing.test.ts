import assert from 'node:assert/strict'
import test from 'node:test'

import { recommendSmartRouting } from '../lib/smart-routing'

test('smart routing prefers materially compatible printers when compatibility is required', () => {
  const result = recommendSmartRouting({
    printers: [
      {
        id: 'printer_pla',
        name: 'PLA Farm',
        status: 'available',
        active: true,
        dailyCapacityHours: 8,
        metadata: {
          supportedMaterials: ['PLA'],
          throughputMultiplier: 1.1,
        },
      },
      {
        id: 'printer_abs',
        name: 'ABS Farm',
        status: 'available',
        active: true,
        dailyCapacityHours: 8,
        metadata: {
          supportedMaterials: ['ABS'],
          throughputMultiplier: 1.5,
        },
      },
    ],
    orders: [
      {
        id: 'order_1',
        createdAt: new Date('2026-04-06T12:00:00.000Z'),
        totalHours: 2,
        printerId: null,
        materials: ['PLA'],
        queuePosition: 1,
      },
    ],
    policy: {
      requireMaterialCompatibility: true,
      prioritizeSpeed: 0.6,
      prioritizeQueueBalance: 0.2,
      prioritizeCost: 0.1,
      prioritizeSla: 0.1,
    },
  })

  assert.equal(result.recommendations.length, 1)
  assert.equal(result.recommendations[0]?.printerId, 'printer_pla')
})

test('smart routing can bias toward lower-cost printers when cost weight is increased', () => {
  const result = recommendSmartRouting({
    printers: [
      {
        id: 'printer_fast',
        name: 'Fast Printer',
        status: 'available',
        active: true,
        dailyCapacityHours: 8,
        metadata: {
          supportedMaterials: ['PLA'],
          throughputMultiplier: 1.8,
          costPerHour: 6,
        },
      },
      {
        id: 'printer_economy',
        name: 'Economy Printer',
        status: 'available',
        active: true,
        dailyCapacityHours: 8,
        metadata: {
          supportedMaterials: ['PLA'],
          throughputMultiplier: 1.0,
          costPerHour: 1.5,
        },
      },
    ],
    orders: [
      {
        id: 'order_2',
        createdAt: new Date('2026-04-06T12:00:00.000Z'),
        totalHours: 1,
        printerId: null,
        materials: ['PLA'],
        queuePosition: 1,
      },
    ],
    policy: {
      prioritizeSpeed: 0.05,
      prioritizeQueueBalance: 0.1,
      prioritizeCost: 0.75,
      prioritizeSla: 0.1,
    },
  })

  assert.equal(result.recommendations[0]?.printerId, 'printer_economy')
})
