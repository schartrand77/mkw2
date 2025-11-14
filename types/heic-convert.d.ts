declare module 'heic-convert' {
  type SupportedFormat = 'JPEG' | 'PNG'
  type ConvertOptions = {
    buffer: ArrayBuffer | Uint8Array | Buffer
    format: SupportedFormat
    quality?: number
  }

  function heicConvert(options: ConvertOptions): Promise<Buffer | Uint8Array | ArrayBuffer>
  export = heicConvert
}
