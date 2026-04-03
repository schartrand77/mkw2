const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { extract3mfFilamentColors } = require('../lib/model-preview-queue');

const prisma = new PrismaClient();

function storageRoot() {
  const envRoot = process.env.STORAGE_DIR;
  if (envRoot && fs.existsSync(envRoot)) return envRoot;
  return path.join(process.cwd(), 'storage');
}

async function loadBuffer(storedPath) {
  const rel = storedPath.replace(/^\/+/, '');
  const full = path.join(storageRoot(), rel);
  return fs.promises.readFile(full);
}

async function main() {
  const models = await prisma.model.findMany({
    where: {
      defaultColors: null,
      OR: [
        { filePath: { endsWith: '.3mf' } },
        { parts: { some: { filePath: { endsWith: '.3mf' } } } },
      ],
    },
    select: {
      id: true,
      title: true,
      filePath: true,
      parts: { select: { filePath: true } },
    },
  });

  let updated = 0;
  for (const model of models) {
    const candidates = [];
    if (model.filePath && model.filePath.toLowerCase().endsWith('.3mf')) {
      candidates.push(model.filePath);
    }
    for (const part of model.parts || []) {
      if (part.filePath && part.filePath.toLowerCase().endsWith('.3mf')) {
        candidates.push(part.filePath);
      }
    }
    let colors = null;
    for (const filePath of candidates) {
      try {
        const buf = await loadBuffer(filePath);
        const parsed = await extract3mfFilamentColors(buf);
        if (parsed && parsed.length) {
          colors = parsed;
          break;
        }
      } catch (err) {
        console.warn('Color extract failed', model.id, filePath, err?.message || err);
      }
    }
    if (colors && colors.length) {
      await prisma.model.update({ where: { id: model.id }, data: { defaultColors: colors } });
      updated += 1;
      console.log('Updated', model.id, model.title, colors);
    }
  }

  console.log('Done. Updated', updated, 'models.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
