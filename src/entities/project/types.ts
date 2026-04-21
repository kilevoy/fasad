export type CassetteCode = 'КФ-1' | 'КФ-2' | 'КФ-3' | 'КФ-4'

export type OpeningType = 'window' | 'door'

export interface Opening {
  id: string
  type: OpeningType
  widthMm: number
  heightMm: number
  quantity: number
}

export interface Facade {
  id: string
  name: string
  widthMm: number
  heightMm: number
  outsideCorners: number
  insideCorners: number
  openings: Opening[]
}

export interface InsulationSetup {
  layers: 1 | 2
  thicknessMm: number
  membrane: boolean
}

export interface Project {
  id: string
  name: string
  description: string
  selectedCassetteType: CassetteCode
  facades: Facade[]
  insulation: InsulationSetup
}

export interface FacadeCassetteType {
  code: CassetteCode
  name: string
  description: string
  fastenerVisibility: string
  recommendedSizes: string[]
}

export interface InventoryModule {
  code: string
  name: string
  description: string
  items: string[]
}
