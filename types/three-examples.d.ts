declare module 'three/examples/jsm/controls/OrbitControls' {
  export class OrbitControls {
    constructor(object: any, domElement?: any)
    enableDamping: boolean
    dampingFactor: number
    screenSpacePanning: boolean
    autoRotate: boolean
    autoRotateSpeed: number
    zoomSpeed: number
    minDistance: number
    maxDistance: number
    target: { set: (x: number, y: number, z: number) => void }
    update(): void
    dispose(): void
  }
}

declare module 'three/examples/jsm/loaders/STLLoader' {
  export class STLLoader {
    load(
      url: string,
      onLoad: (geometry: any) => void,
      onProgress?: (event: any) => void,
      onError?: (err: any) => void
    ): void
    parse(data: ArrayBuffer): any
  }
}
