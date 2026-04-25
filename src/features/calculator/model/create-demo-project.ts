import type { Project } from '../../../entities/project/types'

export function createDemoProject(): Project {
  return {
    id: 'demo-project',
    name: 'Административный корпус',
    city: 'Екатеринбург',
    description:
      'Базовый сценарий для проектирования фасадных кассет, подсистемы, утеплителя и крепежа.',
    estimateMode: 'project',
    outsideCorners: 0,
    insideCorners: 0,
    selectedCassetteType: 'КФ-2',
    cassetteThicknessMm: 1.2,
    layoutMode: 'horizontal',
    hasCornerCassettes: true,
    subsystem: {
      code: 'standard_g',
      visibleGuideColor: true,
      airGapMm: 40,
    },
    facades: [
      {
        id: 'facade-a',
        name: 'Фасад А',
        quantity: 1,
        widthMm: 12000,
        heightMm: 6500,
        hasOpenings: false,
        openings: [],
      },
    ],
    insulation: {
      enabled: true,
      layers: 2,
      thicknessMm: 150,
      membrane: true,
    },
  }
}
