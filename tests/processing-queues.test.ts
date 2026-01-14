import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCoverImageWhere, buildModelImageWhere } from '../lib/image-queue'
import { buildPreviewJobWhere } from '../lib/model-preview-queue'

test('buildCoverImageWhere includes processing criteria', () => {
  assert.deepStrictEqual(buildCoverImageWhere(), {
    coverImageStatus: 'processing',
    coverImageSourcePath: { not: null },
    coverImagePath: { not: null },
  })
})

test('buildCoverImageWhere adds modelId filter', () => {
  assert.deepStrictEqual(buildCoverImageWhere({ modelId: 'model_1' }), {
    coverImageStatus: 'processing',
    coverImageSourcePath: { not: null },
    coverImagePath: { not: null },
    id: 'model_1',
  })
})

test('buildModelImageWhere adds modelId filter', () => {
  assert.deepStrictEqual(buildModelImageWhere({ modelId: 'model_2' }), {
    status: 'processing',
    sourcePath: { not: null },
    modelId: 'model_2',
  })
})

test('buildPreviewJobWhere adds modelId filter', () => {
  assert.deepStrictEqual(buildPreviewJobWhere({ modelId: 'model_3' }), {
    status: 'pending',
    modelId: 'model_3',
  })
})
