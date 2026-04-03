export type { PrintLabPrinter as BambuPrinter } from '@/lib/printlab'
export {
  printLabDisabledResponse as bambuViewDisabledResponse,
  fetchPrintLabPrinters as fetchBambuPrinters,
  fetchPrintLabStatus as fetchBambuStatus,
  fetchPrintLabSpools as fetchBambuSpools,
} from '@/lib/printlab'

import { sendPrintLabJobAction } from '@/lib/printlab'

export async function sendBambuJobAction(printerId: string, action: 'pause' | 'resume' | 'stop' | 'start') {
  if (action === 'start') throw new Error('PrintLab job start action is not supported by this endpoint.')
  return sendPrintLabJobAction(printerId, action)
}

export async function sendBambuPrint() {
  throw new Error('PrintLab print-start requests are not supported by this endpoint.')
}
