import type { Project } from '../../../entities/project/types'

export function createDemoProject(): Project {
  return {
    id: 'demo-project',
    name: 'Демо-объект: административный фасад',
    description:
      'Тестовая структура для будущего калькулятора. На ней удобно проверять геометрию, раскладку кассет, утепление и итоговую спецификацию.',
    selectedCassetteType: 'КФ-2',
    facades: [
      {
        id: 'facade-a',
        name: 'Фасад А',
        widthMm: 24000,
        heightMm: 9600,
        outsideCorners: 2,
        insideCorners: 0,
        openings: [
          {
            id: 'opening-a1',
            type: 'window',
            widthMm: 1800,
            heightMm: 1500,
            quantity: 6,
          },
          {
            id: 'opening-a2',
            type: 'door',
            widthMm: 1200,
            heightMm: 2400,
            quantity: 2,
          },
        ],
      },
    ],
    insulation: {
      layers: 2,
      thicknessMm: 150,
      membrane: true,
    },
  }
}
