type PrintTemplate = {
  printLabJobId?: string | null
  successfulGcodeId?: string | null
  printerName?: string | null
  fileName?: string | null
  plateGcode?: string | null
  plateIndex?: string | null
  subtaskName?: string | null
  completedAt?: string | null
  useAms?: boolean | null
  amsMapping?: number[] | null
  exactMaterials?: Array<{ material: string; grams: number; colors?: string[] }>
}

function formatDate(value?: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
}

function formatPlate(template: PrintTemplate) {
  if (template.plateIndex) return `Plate ${template.plateIndex}`
  return template.plateGcode || template.subtaskName || 'Default'
}

export default function PrintLabTemplateCard({ templates }: { templates: PrintTemplate[] }) {
  const visibleTemplates = templates.slice(0, 3)
  if (visibleTemplates.length === 0) return null

  return (
    <div className="glass rounded-xl p-4 space-y-3 text-sm">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Captured PrintLab G-code</div>
        <p className="text-xs text-slate-400 mt-1">Successful shop prints captured from PrintLab for this model.</p>
      </div>
      {visibleTemplates.map((template) => {
        const completedAt = formatDate(template.completedAt)
        const materials = Array.isArray(template.exactMaterials) ? template.exactMaterials : []
        return (
          <div key={template.successfulGcodeId || template.printLabJobId || template.fileName || template.completedAt || 'printlab-template'} className="rounded-lg border border-white/10 p-3 space-y-2">
            <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-2">
              <div className="text-slate-400">Printer</div>
              <div>{template.printerName || 'PrintLab'}</div>
              <div className="text-slate-400">G-code</div>
              <div className="break-words">{template.fileName || template.successfulGcodeId || 'Successful record'}</div>
              <div className="text-slate-400">Plate</div>
              <div>{formatPlate(template)}</div>
              <div className="text-slate-400">Completed</div>
              <div>{completedAt || 'Recorded by PrintLab'}</div>
              <div className="text-slate-400">AMS</div>
              <div>{template.useAms ? `Used${template.amsMapping?.length ? ` (${template.amsMapping.join(', ')})` : ''}` : 'Not recorded'}</div>
            </div>
            {materials.length > 0 ? (
              <div className="text-xs text-slate-300">
                Materials: {materials.map((entry) => `${entry.material} ${entry.grams.toFixed(1)}g${entry.colors?.length ? ` ${entry.colors.join('/')}` : ''}`).join(', ')}
              </div>
            ) : (
              <div className="text-xs text-amber-200">Exact material grams were not recorded for this capture.</div>
            )}
          </div>
        )
      })}
      {templates.length > visibleTemplates.length ? (
        <div className="text-xs text-slate-400">
          Showing {visibleTemplates.length} of {templates.length} captured records.
        </div>
      ) : null}
    </div>
  )
}
