const fs = require('fs')
const path = require('path')

const cwd = process.cwd()
const target = path.join(cwd, '.env')
const template = path.join(cwd, '.env.example')

function copyTemplate() {
  if (!fs.existsSync(template)) {
    console.warn('MakerWorks: missing .env.example; copy it to .env manually.')
    return
  }
  fs.copyFileSync(template, target)
  console.log('MakerWorks: created .env from .env.example')
}

try {
  if (!fs.existsSync(target)) {
    copyTemplate()
  }
} catch (err) {
  console.warn('MakerWorks: unable to ensure .env exists:', err.message)
}
