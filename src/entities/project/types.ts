export type CassetteCode = 'КФ-1' | 'КФ-2' | 'КФ-3' | 'КФ-4 (30)' | 'КФ-4 (17)'
export type CassetteLayoutMode = 'horizontal' | 'vertical' | 'square'
export type EstimateMode = 'project' | 'mounting'

export type SubsystemCode =
  | 'standard_p_vertical'
  | 'standard_p_double_level'
  | 'standard_g'
  | 'frame'

export type OpeningType = 'window' | 'door' | 'gate'

export interface Opening {
  id: string
  type: OpeningType
  widthMm: number
  heightMm: number
  quantity: number
  positions?: Array<
    | {
        xMm: number
        yMm: number
      }
    | undefined
  >
}

export interface Facade {
  id: string
  name: string
  quantity: number
  widthMm: number
  heightMm: number
  hasOpenings: boolean
  openings: Opening[]
}

export interface InsulationSetup {
  enabled: boolean
  layers: 1 | 2
  thicknessMm: number
  membrane: boolean
}

export interface SubsystemSetup {
  code: SubsystemCode
  visibleGuideColor: boolean
  airGapMm: number
}

export interface Project {
  id: string
  name: string
  city: string
  description: string
  estimateMode: EstimateMode
  outsideCorners: number
  insideCorners: number
  selectedCassetteType: CassetteCode
  cassetteThicknessMm: number
  layoutMode: CassetteLayoutMode
  hasCornerCassettes: boolean
  subsystem: SubsystemSetup
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
