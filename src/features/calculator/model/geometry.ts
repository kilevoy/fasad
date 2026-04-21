import type { Facade, Opening, Project } from '../../../entities/project/types'

export interface OpeningMetrics {
  totalAreaM2: number
  totalCount: number
}

export interface FacadeMetrics {
  facadeId: string
  facadeName: string
  grossAreaM2: number
  openingAreaM2: number
  netAreaM2: number
  openingCount: number
  outsideCorners: number
  insideCorners: number
}

export interface ProjectGeometryMetrics {
  facadeCount: number
  totalGrossAreaM2: number
  totalOpeningAreaM2: number
  totalNetAreaM2: number
  totalOpeningCount: number
  totalOutsideCorners: number
  totalInsideCorners: number
  facades: FacadeMetrics[]
}

function areaMm2ToM2(value: number) {
  return value / 1_000_000
}

function calculateOpeningMetrics(openings: Opening[]): OpeningMetrics {
  return openings.reduce(
    (accumulator, opening) => {
      const openingArea =
        areaMm2ToM2(opening.widthMm * opening.heightMm) * opening.quantity

      accumulator.totalAreaM2 += openingArea
      accumulator.totalCount += opening.quantity

      return accumulator
    },
    {
      totalAreaM2: 0,
      totalCount: 0,
    },
  )
}

function calculateFacadeMetrics(facade: Facade): FacadeMetrics {
  const grossAreaM2 = areaMm2ToM2(facade.widthMm * facade.heightMm)
  const openingMetrics = calculateOpeningMetrics(facade.openings)
  const netAreaM2 = Math.max(grossAreaM2 - openingMetrics.totalAreaM2, 0)

  return {
    facadeId: facade.id,
    facadeName: facade.name,
    grossAreaM2,
    openingAreaM2: openingMetrics.totalAreaM2,
    netAreaM2,
    openingCount: openingMetrics.totalCount,
    outsideCorners: facade.outsideCorners,
    insideCorners: facade.insideCorners,
  }
}

export function calculateProjectGeometry(project: Project): ProjectGeometryMetrics {
  const facadeMetrics = project.facades.map(calculateFacadeMetrics)

  return facadeMetrics.reduce(
    (accumulator, facade) => {
      accumulator.facadeCount += 1
      accumulator.totalGrossAreaM2 += facade.grossAreaM2
      accumulator.totalOpeningAreaM2 += facade.openingAreaM2
      accumulator.totalNetAreaM2 += facade.netAreaM2
      accumulator.totalOpeningCount += facade.openingCount
      accumulator.totalOutsideCorners += facade.outsideCorners
      accumulator.totalInsideCorners += facade.insideCorners
      accumulator.facades.push(facade)

      return accumulator
    },
    {
      facadeCount: 0,
      totalGrossAreaM2: 0,
      totalOpeningAreaM2: 0,
      totalNetAreaM2: 0,
      totalOpeningCount: 0,
      totalOutsideCorners: 0,
      totalInsideCorners: 0,
      facades: [] as FacadeMetrics[],
    },
  )
}
