const fs = require('fs')
const path = require('path')

const cwd = process.cwd()
const target = path.join(cwd, '.env.local')
const template = path.join(cwd, '.env.local.template')

function copyTemplate() {
  if (!fs.existsSync(template)) {
    console.warn('MakerWorks: missing .env.local.template; copy .env.example manually.')
    return
  }
  fs.copyFileSync(template, target)
  console.log('MakerWorks: created .env.local from .env.local.template')
}

try {
  if (!fs.existsSync(target)) {
    copyTemplate()
  }
} catch (err) {
  console.warn('MakerWorks: unable to ensure .env.local exists:', err.message)
}
