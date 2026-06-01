import { describe, expect, it } from 'vitest'
import { calculateProjectGeometry } from './geometry'
import type { Facade, Opening, Project } from '../../../entities/project/types'

function makeOpening(p: Partial<Opening> = {}): Opening {
  return { id: 'o1', type: 'window', widthMm: 1000, heightMm: 1000, quantity: 1, ...p }
}

function makeFacade(p: Partial<Facade> = {}): Facade {
  return {
    id: 'f1', name: 'Фасад', quantity: 1,
    widthMm: 10_000, heightMm: 3_000, hasOpenings: false, openings: [],
    ...p,
  }
}

function makeProject(facades: Facade[], p: Partial<Project> = {}): Project {
  return {
    id: 'p1', name: 'Проект', city: '', description: '', estimateMode: 'project',
    outsideCorners: 0, insideCorners: 0, selectedCassetteType: 'КФ-1',
    cassetteThicknessMm: 1, layoutMode: 'horizontal', hasCornerCassettes: false,
    subsystem: { code: 'standard_g', visibleGuideColor: false, airGapMm: 50 },
    facades,
    insulation: { enabled: false, layers: 1, thicknessMm: 0, membrane: false },
    ...p,
  }
}

describe('calculateProjectGeometry', () => {
  it('считает площадь глухого фасада (мм² → м²)', () => {
    const r = calculateProjectGeometry(makeProject([makeFacade()]))
    expect(r.totalGrossAreaM2).toBeCloseTo(30, 6)   // 10000*3000/1e6
    expect(r.totalNetAreaM2).toBeCloseTo(30, 6)      // нет проёмов
    expect(r.totalOpeningAreaM2).toBe(0)
    expect(r.facadeCount).toBe(1)
  })

  it('вычитает площадь проёмов из чистой площади', () => {
    const facade = makeFacade({ hasOpenings: true, openings: [makeOpening()] }) // 1 м²
    const r = calculateProjectGeometry(makeProject([facade]))
    expect(r.totalOpeningAreaM2).toBeCloseTo(1, 6)
    expect(r.totalNetAreaM2).toBeCloseTo(29, 6)
    expect(r.totalOpeningCount).toBe(1)
  })

  it('чистая площадь не уходит в минус при проёмах больше фасада', () => {
    const facade = makeFacade({
      widthMm: 1000, heightMm: 1000, hasOpenings: true,         // 1 м²
      openings: [makeOpening({ widthMm: 2000, heightMm: 2000 })], // 4 м²
    })
    const r = calculateProjectGeometry(makeProject([facade]))
    expect(r.totalNetAreaM2).toBe(0)
  })

  it('масштабирует площадь на количество фасадов', () => {
    const r = calculateProjectGeometry(makeProject([makeFacade({ quantity: 2 })]))
    expect(r.totalGrossAreaM2).toBeCloseTo(60, 6)
  })

  it('суммирует по фасадам и берёт углы из проекта', () => {
    const r = calculateProjectGeometry(
      makeProject([makeFacade({ id: 'a' }), makeFacade({ id: 'b' })],
        { outsideCorners: 3, insideCorners: 2 }),
    )
    expect(r.facadeCount).toBe(2)
    expect(r.totalGrossAreaM2).toBeCloseTo(60, 6)
    expect(r.totalOutsideCorners).toBe(3)
    expect(r.totalInsideCorners).toBe(2)
  })
})
