import type { CassetteCode } from '../project/types'

export type CassetteFamily = 'kf1' | 'kf2' | 'kf3' | 'kf4_17' | 'kf4_30'
export type CassetteRole = 'standard' | 'additional'
export type CassetteCoatingCode = 'polyester' | 'colorflow_1s'

export interface CassettePriceItem {
  family: CassetteFamily
  role: CassetteRole
  thickness: number
  coating: CassetteCoatingCode
  code: string
  name: string
  unit: 'm2'
  price: number
}

export const cassettePriceCatalog: CassettePriceItem[] = [
  { family: 'kf1', role: 'standard', thickness: 0.7, coating: 'polyester', code: '2182', name: 'Кассета фасадная 1 (КФ1) 0,7', unit: 'm2', price: 1477 },
  { family: 'kf1', role: 'standard', thickness: 0.7, coating: 'colorflow_1s', code: '69182', name: 'Кассета фасадная 1 (КФ1) 0,7 (Колор-поток)', unit: 'm2', price: 1566 },
  { family: 'kf1', role: 'standard', thickness: 1.0, coating: 'colorflow_1s', code: '69183', name: 'Кассета фасадная 1 (КФ1) 1,0 (Колор-поток)', unit: 'm2', price: 1823 },
  { family: 'kf1', role: 'standard', thickness: 1.2, coating: 'colorflow_1s', code: '113369', name: 'Кассета фасадная 1 (КФ1) 1,2 (Колор-поток)', unit: 'm2', price: 2336 },
  { family: 'kf1', role: 'additional', thickness: 0.7, coating: 'polyester', code: '2185', name: 'Кассета фасадная 1 доборная (КФ1) 0,7', unit: 'm2', price: 1650 },
  { family: 'kf1', role: 'additional', thickness: 0.7, coating: 'colorflow_1s', code: '69185', name: 'Кассета фасадная 1 доборная (КФ1) 0,7 (Колор-поток)', unit: 'm2', price: 1692 },
  { family: 'kf1', role: 'additional', thickness: 1.0, coating: 'colorflow_1s', code: '69186', name: 'Кассета фасадная 1 доборная (КФ1) 1,0 (Колор-поток)', unit: 'm2', price: 2004 },
  { family: 'kf1', role: 'additional', thickness: 1.2, coating: 'colorflow_1s', code: '113370', name: 'Кассета фасадная 1 доборная (КФ1) 1,2 (Колор-поток)', unit: 'm2', price: 2577 },

  { family: 'kf2', role: 'standard', thickness: 0.7, coating: 'polyester', code: '2188', name: 'Кассета фасадная 2 (КФ2) 0,7', unit: 'm2', price: 1477 },
  { family: 'kf2', role: 'standard', thickness: 0.7, coating: 'colorflow_1s', code: '68973', name: 'Кассета фасадная 2 (КФ2) 0,7 (Колор-поток)', unit: 'm2', price: 1566 },
  { family: 'kf2', role: 'standard', thickness: 1.0, coating: 'colorflow_1s', code: '68974', name: 'Кассета фасадная 2 (КФ2) 1,0 (Колор-поток)', unit: 'm2', price: 1823 },
  { family: 'kf2', role: 'standard', thickness: 1.2, coating: 'colorflow_1s', code: '68975', name: 'Кассета фасадная 2 (КФ2) 1,2 (Колор-поток)', unit: 'm2', price: 2336 },
  { family: 'kf2', role: 'additional', thickness: 0.7, coating: 'polyester', code: '2191', name: 'Кассета фасадная 2 доборная (КФ2) 0,7', unit: 'm2', price: 1650 },
  { family: 'kf2', role: 'additional', thickness: 0.7, coating: 'colorflow_1s', code: '68976', name: 'Кассета фасадная 2 доборная (КФ2) 0,7 (Колор-поток)', unit: 'm2', price: 1692 },
  { family: 'kf2', role: 'additional', thickness: 1.0, coating: 'colorflow_1s', code: '68977', name: 'Кассета фасадная 2 доборная (КФ2) 1,0 (Колор-поток)', unit: 'm2', price: 2004 },
  { family: 'kf2', role: 'additional', thickness: 1.2, coating: 'colorflow_1s', code: '68978', name: 'Кассета фасадная 2 доборная (КФ2) 1,2 (Колор-поток)', unit: 'm2', price: 2577 },

  { family: 'kf3', role: 'standard', thickness: 0.7, coating: 'polyester', code: '57738', name: 'Кассета фасадная 3 (КФ3) 0,7', unit: 'm2', price: 1477 },
  { family: 'kf3', role: 'standard', thickness: 0.7, coating: 'colorflow_1s', code: '69188', name: 'Кассета фасадная 3 (КФ3) 0,7 (Колор-поток)', unit: 'm2', price: 1566 },
  { family: 'kf3', role: 'standard', thickness: 1.2, coating: 'colorflow_1s', code: '69190', name: 'Кассета фасадная 3 (КФ3) 1,2 (Колор-поток)', unit: 'm2', price: 2336 },
  { family: 'kf3', role: 'additional', thickness: 0.7, coating: 'polyester', code: '57742', name: 'Кассета фасадная 3 доборная (КФ3) 0,7', unit: 'm2', price: 1650 },
  { family: 'kf3', role: 'additional', thickness: 0.7, coating: 'colorflow_1s', code: '69191', name: 'Кассета фасадная 3 доборная (КФ3) 0,7 (Колор-поток)', unit: 'm2', price: 1692 },
  { family: 'kf3', role: 'additional', thickness: 1.2, coating: 'colorflow_1s', code: '69193', name: 'Кассета фасадная 3 доборная (КФ3) 1,2 (Колор-поток)', unit: 'm2', price: 2577 },

  { family: 'kf4_17', role: 'standard', thickness: 0.7, coating: 'polyester', code: '71698', name: 'Кассета фасадная 4/17 (КФ4/17) 0,7', unit: 'm2', price: 1477 },
  { family: 'kf4_17', role: 'standard', thickness: 0.7, coating: 'colorflow_1s', code: '71699', name: 'Кассета фасадная 4/17 (КФ4/17) 0,7 (Колор-поток)', unit: 'm2', price: 1566 },
  { family: 'kf4_17', role: 'standard', thickness: 1.2, coating: 'colorflow_1s', code: '71706', name: 'Кассета фасадная 4/17 (КФ4/17) 1,2 (Колор-поток)', unit: 'm2', price: 2336 },
  { family: 'kf4_17', role: 'additional', thickness: 0.7, coating: 'polyester', code: '71707', name: 'Кассета фасадная 4/17 доборная (КФ4/17) 0,7', unit: 'm2', price: 1650 },
  { family: 'kf4_17', role: 'additional', thickness: 0.7, coating: 'colorflow_1s', code: '71709', name: 'Кассета фасадная 4/17 доборная (КФ4/17) 0,7 (Колор-поток)', unit: 'm2', price: 1692 },
  { family: 'kf4_17', role: 'additional', thickness: 1.2, coating: 'colorflow_1s', code: '71716', name: 'Кассета фасадная 4/17 доборная (КФ4/17) 1,2 (Колор-поток)', unit: 'm2', price: 2577 },

  { family: 'kf4_30', role: 'standard', thickness: 0.7, coating: 'polyester', code: '71724', name: 'Кассета фасадная 4/30 (КФ4/30) 0,7', unit: 'm2', price: 1477 },
  { family: 'kf4_30', role: 'standard', thickness: 0.7, coating: 'colorflow_1s', code: '71726', name: 'Кассета фасадная 4/30 (КФ4/30) 0,7 (Колор-поток)', unit: 'm2', price: 1566 },
  { family: 'kf4_30', role: 'standard', thickness: 1.2, coating: 'colorflow_1s', code: '71733', name: 'Кассета фасадная 4/30 (КФ4/30) 1,2 (Колор-поток)', unit: 'm2', price: 2336 },
  { family: 'kf4_30', role: 'additional', thickness: 0.7, coating: 'polyester', code: '71734', name: 'Кассета фасадная 4/30 доборная (КФ4/30) 0,7', unit: 'm2', price: 1650 },
  { family: 'kf4_30', role: 'additional', thickness: 0.7, coating: 'colorflow_1s', code: '71736', name: 'Кассета фасадная 4/30 доборная (КФ4/30) 0,7 (Колор-поток)', unit: 'm2', price: 1692 },
  { family: 'kf4_30', role: 'additional', thickness: 1.2, coating: 'colorflow_1s', code: '71743', name: 'Кассета фасадная 4/30 доборная (КФ4/30) 1,2 (Колор-поток)', unit: 'm2', price: 2577 },
]

export function cassetteCodeToFamily(code: CassetteCode): CassetteFamily {
  if (code === 'КФ-1') return 'kf1'
  if (code === 'КФ-2') return 'kf2'
  if (code === 'КФ-3') return 'kf3'
  if (code === 'КФ-4 (17)') return 'kf4_17'
  return 'kf4_30'
}
