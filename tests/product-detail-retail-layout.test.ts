import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const pageSource = () => readFileSync(path.join(process.cwd(), 'app/products/[id]/page.tsx'), 'utf8')
const gallerySource = () => readFileSync(path.join(process.cwd(), 'components/products/ProductMediaGallery.tsx'), 'utf8')
const productConfiguratorSource = () => readFileSync(path.join(process.cwd(), 'components/products/ProductConfigurator.tsx'), 'utf8')
const merchConfiguratorSource = () => readFileSync(path.join(process.cwd(), 'components/products/MerchConfigurator.tsx'), 'utf8')

test('product detail page uses a retail product layout for product templates and merch', () => {
  const source = pageSource()

  assert.match(source, /ProductMediaGallery/)
  assert.match(source, /sticky top-24/)
  assert.match(source, /Product details/)
  assert.match(source, /Print specs/)
  assert.match(source, /Merch details/)
  assert.doesNotMatch(source, /grid lg:grid-cols-2 gap-6/)
})

test('product media gallery thumbnails switch the main image', () => {
  const source = gallerySource()

  assert.match(source, /"use client"/)
  assert.match(source, /useState/)
  assert.match(source, /setActiveIndex/)
  assert.match(source, /aria-pressed/)
  assert.match(source, /View .* image/)
})

test('product and merch configurators render as purchase panels', () => {
  assert.match(productConfiguratorSource(), /PurchasePanel/)
  assert.match(productConfiguratorSource(), /In production/)
  assert.match(merchConfiguratorSource(), /PurchasePanel/)
  assert.match(merchConfiguratorSource(), /In stock|Back ordered/)
})
