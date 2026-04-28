import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { facadeCassetteTypes } from './entities/catalog/facade-cassette-types'
import { cassetteCodeToFamily, cassettePriceCatalog } from './entities/catalog/cassette-price-catalog'
import type { Facade, Opening, OpeningType, Project } from './entities/project/types'
import { calculateProjectGeometry } from './features/calculator/model/geometry'
import {
  buildUploadedPriceIndex,
  normalizePriceCode,
  parsePriceWorkbook,
  type UploadedPriceData,
} from './features/calculator/model/price-upload'

const uploadedPriceStorageKey = 'insi-calculator-uploaded-price'
const uploadedPriceFileStorageKey = 'insi-calculator-uploaded-price-file'
const priceParserVersion = 2
const sharedPriceUrl = './price.json'
const cassetteThicknessOptions = [0.7, 1.0, 1.2] as const
const maxSubsystemBracketVerticalStepMm = 800
const maxSubsystemVerticalProfileStepMm = 800
const subsystemEdgeBracketOffsetMm = 125
const subsystemProfileStockLengthMm = 3000
const subsystemBracketMountReserveMm = 10
const trimSideFastenerStepMm = 600
const trimTopFastenerStepMm = 400
const openingTrimReturnReserveMm = 30
const membraneRollWidthM = 1.6
const membraneRollLengthM = 43.75
const membraneRollAreaM2 = membraneRollWidthM * membraneRollLengthM
const membraneOverlapMm = 200
const membraneOverlapFactor = membraneRollWidthM / (membraneRollWidthM - membraneOverlapMm / 1000)
const membranePriceItem = {
  code: '0000002024',
  name: 'Пленка Гекса Изоспан-АМ (1,6х43,75)',
  unit: 'm2',
  price: 89.14,
}
const insulationDowelPriceItem = {
  code: null,
  name: 'Дюбель тарельчатый для крепления утеплителя',
  price: null as number | null,
}
const subsystemAnchorPriceItem = {
  code: null,
  name: 'Анкерный крепеж / фасадный дюбель для кронштейнов',
  price: null as number | null,
}

function createQuickTestProject(): Project {
  return {
    id: 'quick-test-project',
    name: 'Тестовый расчет ИНСИ',
    city: 'Екатеринбург',
    description: 'Быстрое заполнение для проверки расчета КФ-1.',
    estimateMode: 'project',
    outsideCorners: 4,
    insideCorners: 0,
    selectedCassetteType: 'КФ-1',
    cassetteThicknessMm: 1.0,
    layoutMode: 'horizontal',
    hasCornerCassettes: true,
    subsystem: {
      code: 'standard_p_vertical',
      visibleGuideColor: true,
      airGapMm: 60,
    },
    facades: [
      {
        id: 'quick-facade-a',
        name: 'Фасад A',
        quantity: 1,
        widthMm: 15000,
        heightMm: 6500,
        hasOpenings: true,
        openings: [
          {
            id: 'quick-facade-a-window',
            type: 'window',
            widthMm: 1510,
            heightMm: 1210,
            quantity: 3,
          },
          {
            id: 'quick-facade-a-door',
            type: 'door',
            widthMm: 1170,
            heightMm: 2071,
            quantity: 1,
          },
        ],
      },
      {
        id: 'quick-facade-b',
        name: 'Фасад B',
        quantity: 1,
        widthMm: 15000,
        heightMm: 6500,
        hasOpenings: false,
        openings: [],
      },
      {
        id: 'quick-facade-c',
        name: 'Фасад C',
        quantity: 1,
        widthMm: 12000,
        heightMm: 6500,
        hasOpenings: false,
        openings: [],
      },
      {
        id: 'quick-facade-d',
        name: 'Фасад D',
        quantity: 1,
        widthMm: 12000,
        heightMm: 6500,
        hasOpenings: false,
        openings: [],
      },
    ],
    insulation: {
      enabled: true,
      layers: 1,
      thicknessMm: 150,
      membrane: false,
    },
  }
}

function createBlankProject(): Project {
  return {
    id: 'blank-project',
    name: '',
    city: '',
    description: '',
    estimateMode: 'project',
    outsideCorners: 0,
    insideCorners: 0,
    selectedCassetteType: 'КФ-1',
    cassetteThicknessMm: 1.0,
    layoutMode: 'horizontal',
    hasCornerCassettes: false,
    subsystem: {
      code: 'standard_p_vertical',
      visibleGuideColor: true,
      airGapMm: 60,
    },
    facades: [
      {
        id: 'blank-facade-a',
        name: 'Фасад А',
        quantity: 1,
        widthMm: 0,
        heightMm: 0,
        hasOpenings: false,
        openings: [],
      },
    ],
    insulation: {
      enabled: false,
      layers: 1,
      thicknessMm: 150,
      membrane: false,
    },
  }
}

type PriceUnit = 'pcs' | 'lm' | 'm2'

interface SubsystemPriceItem {
  key: string
  family: string
  coating: 'galvanized' | 'colorflow_1s' | 'colorflow_2s' | 'none'
  code: string | null
  name: string
  unit: PriceUnit
  price: number | null
}

interface TrimPriceItem {
  key: string
  family: string
  code: string | null
  name: string
  standardLengthMm: number
  unit: 'pcs'
  price: number | null
}

type CatalogItemWithPrice = {
  code: string | null
  name: string
  unit?: string | null
  price: number | null
}

interface HelpModalProps {
  title: string
  subtitle: string
  onClose: () => void
  children: ReactNode
}

function HelpModal({ title, subtitle, onClose, children }: HelpModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <div className="section-title" id="help-modal-title">{title}</div>
            <div className="section-sub">{subtitle}</div>
          </div>
          <button className="btn btn-quiet" type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>
        <div className="help-content">{children}</div>
      </div>
    </div>
  )
}

interface StoredUploadedPriceFile {
  fileName: string
  dataUrl: string
}

const trimPriceItems: TrimPriceItem[] = [
  {
    key: 'outer-angle-usns',
    family: 'outer_angle_complex',
    code: '2235',
    name: 'Угол наружный (УСНс) 3м',
    standardLengthMm: 3000,
    unit: 'pcs',
    price: 900,
  },
  {
    key: 'inner-angle-usvs',
    family: 'inner_angle_complex',
    code: '2234',
    name: 'Угол внутренний (УСВс) 3м',
    standardLengthMm: 3000,
    unit: 'pcs',
    price: 740,
  },
  {
    key: 'outer-angle-uns-visible',
    family: 'outer_angle_visible',
    code: null,
    name: 'Уголок наружный (УНс) 3м, видимое крепление',
    standardLengthMm: 3000,
    unit: 'pcs',
    price: null,
  },
  {
    key: 'inner-angle-uvs-visible',
    family: 'inner_angle_visible',
    code: null,
    name: 'Уголок внутренний (УВс) 3м, видимое крепление',
    standardLengthMm: 3000,
    unit: 'pcs',
    price: null,
  },
  {
    key: 'aquilon-aks',
    family: 'aquilon',
    code: '2168',
    name: 'Аквилон (Акс) 3м',
    standardLengthMm: 3000,
    unit: 'pcs',
    price: 502,
  },
  {
    key: 'top-flashing-ovs',
    family: 'top_flashing',
    code: '2207',
    name: 'Отлив верхний (Овс) 3м',
    standardLengthMm: 3000,
    unit: 'pcs',
    price: 422,
  },
  {
    key: 'drip-vs180',
    family: 'drip',
    code: '2170',
    name: 'Водоотлив 180 (Вс180) 3м',
    standardLengthMm: 3000,
    unit: 'pcs',
    price: 740,
  },
  {
    key: 'drip-vs250',
    family: 'drip',
    code: '2172',
    name: 'Водоотлив 250 (Вс250) 3м',
    standardLengthMm: 3000,
    unit: 'pcs',
    price: 900,
  },
  {
    key: 'starter-strip-nps',
    family: 'starter_strip',
    code: '2215',
    name: 'Планка начальная (НПс) 3м',
    standardLengthMm: 3000,
    unit: 'pcs',
    price: 313,
  },
  {
    key: 'starter-strip-kf2',
    family: 'starter_strip_kf2',
    code: '2649',
    name: 'Планка начальная КФ-2 (ПНКФ2) 0,7х3м',
    standardLengthMm: 3000,
    unit: 'pcs',
    price: 655,
  },
  {
    key: 'starter-strip-kf3',
    family: 'starter_strip_kf3',
    code: '60150',
    name: 'Планка начальная КФ-3 (ПНКФ3) 0,7х3м',
    standardLengthMm: 3000,
    unit: 'pcs',
    price: 605,
  },
  {
    key: 'slope-element-oek190',
    family: 'slope_element',
    code: '26592',
    name: 'Откосный элемент 190 (ОЭк190) 3м',
    standardLengthMm: 3000,
    unit: 'pcs',
    price: 900,
  },
  {
    key: 'slope-element-oek260',
    family: 'slope_element',
    code: '26593',
    name: 'Откосный элемент 260 (ОЭк260) 3м',
    standardLengthMm: 3000,
    unit: 'pcs',
    price: 1059,
  },
]

const subsystemPriceItems: SubsystemPriceItem[] = [
  {
    key: 'kvgu-50-120-1-2-galvanized',
    family: 'kvgu',
    coating: 'galvanized',
    code: '118224',
    name: 'КВГУ 50х120 1,2 (Оцинк.)',
    unit: 'pcs',
    price: 12,
  },
  {
    key: 'kvgu-50-120-1-2-colorflow',
    family: 'kvgu',
    coating: 'colorflow_2s',
    code: '118181',
    name: 'КВГУ 50х120 1,2 (Колор-поток с двух сторон)',
    unit: 'pcs',
    price: 33,
  },
  {
    key: 'kvgu-50-150-1-5-galvanized',
    family: 'kvgu',
    coating: 'galvanized',
    code: '118228',
    name: 'КВГУ 50х150 1,5 (Оцинк.)',
    unit: 'pcs',
    price: 19,
  },
  {
    key: 'kvgu-50-150-1-5-colorflow',
    family: 'kvgu',
    coating: 'colorflow_2s',
    code: '118185',
    name: 'КВГУ 50х150 1,5 (Колор-поток с двух сторон)',
    unit: 'pcs',
    price: 45,
  },
  {
    key: 'kvgu-50-180-2-galvanized',
    family: 'kvgu',
    coating: 'galvanized',
    code: '118232',
    name: 'КВГУ 50х180 2,0 (Оцинк.)',
    unit: 'pcs',
    price: 28,
  },
  {
    key: 'kvgu-50-180-2-colorflow',
    family: 'kvgu',
    coating: 'colorflow_2s',
    code: '118189',
    name: 'КВГУ 50х180 2,0 (Колор-поток с двух сторон)',
    unit: 'pcs',
    price: 59,
  },
  {
    key: 'kvgu-50-200-2-galvanized',
    family: 'kvgu',
    coating: 'galvanized',
    code: '118235',
    name: 'КВГУ 50х200 2,0 (Оцинк.)',
    unit: 'pcs',
    price: 31,
  },
  {
    key: 'kvgu-50-230-2-galvanized',
    family: 'kvgu',
    coating: 'galvanized',
    code: '118238',
    name: 'Кронштейн выравнивающий усиленный Г-50х230 (КВГУ 50х230) 2,0 (Оцинк.)',
    unit: 'pcs',
    price: 34,
  },
  {
    key: 'kvgu-50-230-2-colorflow',
    family: 'kvgu',
    coating: 'colorflow_2s',
    code: '118195',
    name: 'Кронштейн выравнивающий усиленный Г-50х230 (КВГУ 50х230) 2,0 (Колор-поток с двух сторон)',
    unit: 'pcs',
    price: 67,
  },
  {
    key: 'kvgu-95-100-1-5-galvanized',
    family: 'kvgu',
    coating: 'galvanized',
    code: '118245',
    name: 'КВГУ 95х100 1,5 (Оцинк.)',
    unit: 'pcs',
    price: 24,
  },
  {
    key: 'kvgu-95-100-2-galvanized',
    family: 'kvgu',
    coating: 'galvanized',
    code: '118246',
    name: 'КВГУ 95х100 2,0 (Оцинк.)',
    unit: 'pcs',
    price: 29,
  },
  {
    key: 'kvgu-95-130-1-5-galvanized',
    family: 'kvgu',
    coating: 'galvanized',
    code: '118247',
    name: 'КВГУ 95х130 1,5 (Оцинк.)',
    unit: 'pcs',
    price: 31,
  },
  {
    key: 'kvgu-95-130-2-galvanized',
    family: 'kvgu',
    coating: 'galvanized',
    code: '118248',
    name: 'КВГУ 95х130 2,0 (Оцинк.)',
    unit: 'pcs',
    price: 38,
  },
  {
    key: 'kvgu-95-150-1-5-galvanized',
    family: 'kvgu',
    coating: 'galvanized',
    code: '118249',
    name: 'КВГУ 95х150 1,5 (Оцинк.)',
    unit: 'pcs',
    price: 35,
  },
  {
    key: 'kvgu-95-150-2-galvanized',
    family: 'kvgu',
    coating: 'galvanized',
    code: '118250',
    name: 'КВГУ 95х150 2,0 (Оцинк.)',
    unit: 'pcs',
    price: 43,
  },
  {
    key: 'kvgu-95-240-2-galvanized',
    family: 'kvgu',
    coating: 'galvanized',
    code: '118258',
    name: 'КВГУ 95х240 2,0 (Оцинк.)',
    unit: 'pcs',
    price: 72,
  },
  {
    key: 'kvgu-95-250-2-galvanized',
    family: 'kvgu',
    coating: 'galvanized',
    code: '118260',
    name: 'КВГУ 95х250 2,0 (Оцинк.)',
    unit: 'pcs',
    price: 74,
  },
  {
    key: 'kvgu-95-300-2-galvanized',
    family: 'kvgu',
    coating: 'galvanized',
    code: '118262',
    name: 'КВГУ 95х300 2,0 (Оцинк.)',
    unit: 'pcs',
    price: 85,
  },
  {
    key: 'kvgu-95-350-2-galvanized',
    family: 'kvgu',
    coating: 'galvanized',
    code: '118264',
    name: 'КВГУ 95х350 2,0 (Оцинк.)',
    unit: 'pcs',
    price: 97,
  },
  {
    key: 'kvp-200-galvanized',
    family: 'kvp',
    coating: 'galvanized',
    code: '118267',
    name: 'Кронштейн выравнивающий П-200 (КВП 200) (Оцинк.)',
    unit: 'pcs',
    price: 19,
  },
  {
    key: 'kvp-200-colorflow',
    family: 'kvp',
    coating: 'colorflow_2s',
    code: '118177',
    name: 'Кронштейн выравнивающий П-200 (КВП 200) (Колор-поток с двух сторон)',
    unit: 'pcs',
    price: 44,
  },
  {
    key: 'npg-50-1-5-galvanized',
    family: 'npg',
    coating: 'galvanized',
    code: '118130',
    name: 'Направляющий профиль Г-образный 50 (НПГ 50) 1,5 (Оцинк.)',
    unit: 'lm',
    price: 167,
  },
  {
    key: 'npg-50-1-5-colorflow',
    family: 'npg',
    coating: 'colorflow_2s',
    code: '118423',
    name: 'Направляющий профиль Г-образный 50 (НПГ 50) 1,5 (Колор-поток с двух сторон)',
    unit: 'lm',
    price: 337,
  },
  {
    key: 'npp-60-27-1-galvanized',
    family: 'npp',
    coating: 'galvanized',
    code: '117900',
    name: 'НПП 60х27х1,0 (Оцинк.)',
    unit: 'lm',
    price: 128,
  },
  {
    key: 'npp-60-27-1-colorflow',
    family: 'npp',
    coating: 'colorflow_2s',
    code: '118269',
    name: 'НПП 60х27х1,0 (Колор-поток с двух сторон)',
    unit: 'lm',
    price: 286,
  },
  {
    key: 'npp-60-27-1-colorflow-face',
    family: 'npp',
    coating: 'colorflow_1s',
    code: '118270',
    name: 'НПП 60х27х1,0 (Колор-поток с лицевой стороны)',
    unit: 'lm',
    price: 237,
  },
  {
    key: 'npsh-20-50-20-1-galvanized',
    family: 'npsh',
    coating: 'galvanized',
    code: '118058',
    name: 'НПШ 20х50х20 1,0 (Оцинк.)',
    unit: 'lm',
    price: 121,
  },
  {
    key: 'npsh-20-80-20-1-galvanized',
    family: 'npsh',
    coating: 'galvanized',
    code: '118061',
    name: 'Профиль шляпный 20х80х20 (НПШ 20х80х20) 1,0 (Оцинк.)',
    unit: 'lm',
    price: 151,
  },
  {
    key: 'npsh-20-80-20-1-colorflow',
    family: 'npsh',
    coating: 'colorflow_2s',
    code: '118360',
    name: 'Профиль шляпный 20х80х20 (НПШ 20х80х20) 1,0 (Колор-поток с двух сторон)',
    unit: 'lm',
    price: 358,
  },
  {
    key: 'pz-outer-corner-engineering',
    family: 'pz',
    coating: 'colorflow_2s',
    code: '121007',
    name: 'Профиль Z-образный 20х20х40х1,2 RAL 3м',
    unit: 'lm',
    price: null,
  },
  {
    key: 'rivet-4-8-8',
    family: 'rivet',
    coating: 'none',
    code: '10367',
    name: 'Заклепки сталь/сталь 4,8х8',
    unit: 'pcs',
    price: 2.48,
  },
  {
    key: 'screw-4-2-16-galvanized',
    family: 'self_drilling_screw',
    coating: 'none',
    code: '1800',
    name: 'Саморез 4,2х16 оцинк. сверло',
    unit: 'pcs',
    price: 0.85,
  },
  {
    key: 'screw-4-8-19-20-galvanized',
    family: 'cassette_screw',
    coating: 'none',
    code: '1801',
    name: 'Саморез 4,8х19/20 оцинк.',
    unit: 'pcs',
    price: 2.64,
  },
  {
    key: 'screw-4-8-35-galvanized',
    family: 'cassette_screw_long',
    coating: 'none',
    code: '1803',
    name: 'Саморез 4,8х35 оцинк.',
    unit: 'pcs',
    price: 3.06,
  },
  {
    key: 'screw-4-8-70-galvanized',
    family: 'cassette_screw_long',
    coating: 'none',
    code: '2985',
    name: 'Саморез 4,8х70 оцинк.',
    unit: 'pcs',
    price: 4.54,
  },
  {
    key: 'screw-4-8-16-hex-galvanized',
    family: 'cassette_screw_hex',
    coating: 'none',
    code: '1866',
    name: 'Саморез 4,8х16 6-гр головка, без шайбы, цинк',
    unit: 'pcs',
    price: 1.65,
  },
  {
    key: 'screw-4-8-19-20-ral',
    family: 'cassette_screw',
    coating: 'colorflow_1s',
    code: '2039',
    name: 'Саморез 4,8х19/20 (RAL)',
    unit: 'pcs',
    price: 3.26,
  },
  {
    key: 'washer-sh50-galvanized',
    family: 'bracket_washer',
    coating: 'galvanized',
    code: '8284',
    name: 'Шайба усиления кронштейна Ш50',
    unit: 'pcs',
    price: 6,
  },
  {
    key: 'washer-sh50-colorflow',
    family: 'bracket_washer',
    coating: 'colorflow_2s',
    code: '40926',
    name: 'Шайба усиления кронштейна Ш50 (Колор-поток с двух сторон)',
    unit: 'pcs',
    price: 14,
  },
  {
    key: 'paronite-gasket',
    family: 'paronite_gasket',
    coating: 'none',
    code: '3096',
    name: 'Паронитовая прокладка ПОН-Б 55x65x4',
    unit: 'pcs',
    price: 7.36,
  },
  {
    key: 'paronite-gasket-kvgu-95-engineering',
    family: 'paronite_gasket_95',
    coating: 'none',
    code: '119971',
    name: 'Паронитовая прокладка ПОН-Б 95x95x2',
    unit: 'pcs',
    price: 7.24,
  },
]

function createFacadeId() {
  return `facade-${Math.random().toString(36).slice(2, 8)}`
}

function createOpeningId() {
  return `opening-${Math.random().toString(36).slice(2, 8)}`
}

const openingSizePresets: Record<OpeningType, Array<{ label: string; widthMm: number; heightMm: number }>> = {
  window: [
    { label: '610 × 910', widthMm: 910, heightMm: 610 },
    { label: '910 × 1210', widthMm: 1210, heightMm: 910 },
    { label: '1210 × 1510', widthMm: 1510, heightMm: 1210 },
    { label: '1510 × 1510', widthMm: 1510, heightMm: 1510 },
    { label: '1510 × 1810', widthMm: 1810, heightMm: 1510 },
    { label: '1810 × 1510', widthMm: 1510, heightMm: 1810 },
  ],
  door: [
    { label: '2071 × 670', widthMm: 670, heightMm: 2071 },
    { label: '2071 × 770', widthMm: 770, heightMm: 2071 },
    { label: '2071 × 870', widthMm: 870, heightMm: 2071 },
    { label: '2071 × 970', widthMm: 970, heightMm: 2071 },
    { label: '2071 × 1170', widthMm: 1170, heightMm: 2071 },
    { label: '2371 × 970', widthMm: 970, heightMm: 2371 },
  ],
  gate: [
    { label: '2500 × 3000', widthMm: 3000, heightMm: 2500 },
    { label: '3000 × 3000', widthMm: 3000, heightMm: 3000 },
    { label: '3500 × 4000', widthMm: 4000, heightMm: 3500 },
    { label: '4000 × 4000', widthMm: 4000, heightMm: 4000 },
    { label: '4500 × 5000', widthMm: 5000, heightMm: 4500 },
    { label: '6000 × 6000', widthMm: 6000, heightMm: 6000 },
  ],
}

function getDefaultOpeningSize(type: OpeningType) {
  return openingSizePresets[type][0]
}

function createEmptyOpening(type: OpeningType = 'window'): Opening {
  const defaultSize = getDefaultOpeningSize(type)

  return {
    id: createOpeningId(),
    type,
    widthMm: defaultSize.widthMm,
    heightMm: defaultSize.heightMm,
    quantity: 1,
  }
}

function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function createEmptyFacade(index: number): Facade {
  return {
    id: createFacadeId(),
    name: `Фасад ${String.fromCharCode(1040 + index)}`,
    quantity: 1,
    widthMm: 12000,
    heightMm: 6500,
    hasOpenings: false,
    openings: [],
  }
}

function formatInt(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value)
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function parseMm(value: string | number) {
  return Math.max(0, Number(value) || 0)
}

function formatQty(value: number, unit: PriceUnit) {
  if (unit === 'lm' || unit === 'm2') {
    const rounded = Math.round(value * 100) / 100
    return Number.isInteger(rounded) ? formatInt(rounded) : rounded.toFixed(2).replace('.', ',')
  }
  return formatInt(Math.ceil(value))
}

function formatAreaRounded(value: number) {
  return formatInt(Math.round(value))
}

function roundUpToStockLength(valueLm: number, stockLengthMm = subsystemProfileStockLengthMm) {
  const stockLm = stockLengthMm / 1000
  if (valueLm <= 0) return 0
  return Math.ceil(valueLm / stockLm) * stockLm
}

function roundUpToStockPieces(valueLm: number, stockLengthMm = subsystemProfileStockLengthMm) {
  const stockLm = stockLengthMm / 1000
  if (valueLm <= 0) return 0
  return Math.ceil(valueLm / stockLm)
}

function countFastenersOnLine(lengthMm: number, stepMm: number) {
  if (lengthMm <= 0 || stepMm <= 0) return 0

  return Math.ceil(lengthMm / stepMm) + 1
}

interface PackagingCassetteInput {
  key: string
  name: string
  hMm: number
  lMm: number
  pieces: number
}

interface PackagingCassetteRow {
  key: string
  name: string
  hMm: number
  lMm: number
  pieces: number
}

interface PackagingItemSummary {
  key: string
  name: string
  hMm: number
  lMm: number
  pieces: number
}

interface PackagingPackage {
  id: number
  lengthMm: number
  widthMm: number
  heightMm: number
  rows: PackagingCassetteRow[]
  items: PackagingItemSummary[]
  rowCount: number
  pieceCount: number
  note: string
}

function getCassettePackagingDepthMm(code: Project['selectedCassetteType']) {
  if (code === 'КФ-3' || code === 'КФ-4 (17)') return 17
  return 30
}

function getCassettePackagingPiecesPerRow(lMm: number) {
  return lMm <= 1000 ? 2 : 1
}

function createPackagingRows(items: PackagingCassetteInput[]) {
  return items
    .filter((item) => item.pieces > 0 && item.hMm > 0 && item.lMm > 0)
    .sort((a, b) => b.lMm - a.lMm || b.hMm - a.hMm)
    .flatMap((item) => {
      const piecesPerRow = getCassettePackagingPiecesPerRow(item.lMm)
      const fullRows = Math.floor(item.pieces / piecesPerRow)
      const remainder = item.pieces % piecesPerRow
      const rows: PackagingCassetteRow[] = Array.from({ length: fullRows }, () => ({
        key: item.key,
        name: item.name,
        hMm: item.hMm,
        lMm: item.lMm,
        pieces: piecesPerRow,
      }))

      if (remainder > 0) {
        rows.push({
          key: item.key,
          name: item.name,
          hMm: item.hMm,
          lMm: item.lMm,
          pieces: remainder,
        })
      }

      return rows
    })
}

function summarizePackagingItems(rows: PackagingCassetteRow[]) {
  return Object.values(
    rows.reduce<Record<string, PackagingItemSummary>>((acc, row) => {
      const key = `${row.key}-${row.hMm}-${row.lMm}`
      acc[key] = acc[key] ?? {
        key,
        name: row.name,
        hMm: row.hMm,
        lMm: row.lMm,
        pieces: 0,
      }
      acc[key].pieces += row.pieces
      return acc
    }, {}),
  ).sort((a, b) => b.lMm - a.lMm || b.pieces - a.pieces)
}

function calculatePackagingOuterSize(rows: PackagingCassetteRow[], lengthMm: number) {
  const rowWidths = rows.map((row) => row.lMm * row.pieces)
  const maxRowWidthMm = Math.max(0, ...rowWidths)
  const maxHeightMm = Math.max(0, ...rows.map((row) => row.hMm))
  const widthReserveMm = 150
  const heightReserveMm = 168

  return {
    lengthMm,
    widthMm: Math.min(2000, Math.ceil((maxRowWidthMm + widthReserveMm) / 10) * 10),
    heightMm: Math.min(1400, Math.ceil((maxHeightMm + heightReserveMm) / 10) * 10),
  }
}

function createPackagingPackage(id: number, rows: PackagingCassetteRow[], lengthMm: number): PackagingPackage {
  const size = calculatePackagingOuterSize(rows, lengthMm)

  return {
    id,
    ...size,
    rows,
    items: summarizePackagingItems(rows),
    rowCount: rows.length,
    pieceCount: rows.reduce((sum, row) => sum + row.pieces, 0),
    note:
      lengthMm > 2200
        ? 'исключение по длине'
        : rows.length > 72
          ? 'добивка остатка'
          : rows.some((row) => row.pieces > 1)
            ? '2 кассеты в ряду'
            : 'стандарт',
  }
}

function calculateCassettePackaging(items: PackagingCassetteInput[], cassetteType: Project['selectedCassetteType']) {
  const rows = createPackagingRows(items)
  const packages: PackagingPackage[] = []
  const standardRowsPerPackage = cassetteType === 'КФ-3' || cassetteType === 'КФ-4 (17)' ? 129 : 72
  const defaultLengthMm = 2200
  const exceptionLengthMm = 2300
  const maxDefaultRows = Math.floor(defaultLengthMm / getCassettePackagingDepthMm(cassetteType))
  const maxExceptionRows = Math.floor(exceptionLengthMm / getCassettePackagingDepthMm(cassetteType))

  for (let index = 0; index < rows.length; index += standardRowsPerPackage) {
    packages.push(createPackagingPackage(packages.length + 1, rows.slice(index, index + standardRowsPerPackage), defaultLengthMm))
  }

  const lastPackage = packages[packages.length - 1]
  if (lastPackage && packages.length > 1 && lastPackage.rowCount <= packages.length - 1) {
    packages.pop()
    lastPackage.rows.forEach((row, index) => {
      packages[index % packages.length].rows.push(row)
    })
  } else if (lastPackage && packages.length > 1 && lastPackage.rowCount <= 4) {
    const previousPackage = packages[packages.length - 2]
    if (previousPackage.rows.length + lastPackage.rows.length <= maxExceptionRows) {
      packages.pop()
      previousPackage.rows.push(...lastPackage.rows)
    }
  }

  return packages.map((pack, index) => {
    const lengthMm = pack.rows.length > maxDefaultRows && pack.rows.length <= maxExceptionRows ? exceptionLengthMm : defaultLengthMm
    return createPackagingPackage(index + 1, pack.rows, lengthMm)
  })
}

function loadUploadedPriceData(): UploadedPriceData | null {
  try {
    const raw = localStorage.getItem(uploadedPriceStorageKey)
    if (!raw) return null

    const parsed = JSON.parse(raw) as UploadedPriceData
    if (parsed.parserVersion !== priceParserVersion) {
      localStorage.removeItem(uploadedPriceStorageKey)
      return null
    }

    return parsed
  } catch {
    return null
  }
}

function parseSharedPriceData(value: unknown): UploadedPriceData | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<UploadedPriceData>
  if (raw.parserVersion !== priceParserVersion || !Array.isArray(raw.rows)) return null

  const rows = raw.rows
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null
      const current = row as Partial<UploadedPriceData['rows'][number]>
      const price = Number(current.price)
      const name = typeof current.name === 'string' ? current.name.trim() : ''
      if (!name || !Number.isFinite(price) || price <= 0) return null

      return {
        code: current.code === null || current.code === undefined ? null : String(current.code),
        name,
        unit: current.unit === null || current.unit === undefined ? null : String(current.unit),
        price,
        sheet: typeof current.sheet === 'string' ? current.sheet : 'price.json',
        rowNumber: typeof current.rowNumber === 'number' ? current.rowNumber : index + 1,
      }
    })
    .filter((row): row is UploadedPriceData['rows'][number] => row !== null)

  return {
    fileName: typeof raw.fileName === 'string' ? raw.fileName : 'price.json',
    uploadedAt: typeof raw.uploadedAt === 'string' ? raw.uploadedAt : new Date().toISOString(),
    parserVersion: raw.parserVersion,
    rows,
  }
}

function saveUploadedPriceData(data: UploadedPriceData) {
  localStorage.setItem(uploadedPriceStorageKey, JSON.stringify(data))
}

function clearUploadedPriceData() {
  localStorage.removeItem(uploadedPriceStorageKey)
  localStorage.removeItem(uploadedPriceFileStorageKey)
}

function normalizeComparablePriceUnit(unit: string | null | undefined) {
  const normalized = String(unit ?? '').trim().toLowerCase().replace(/\s/g, '')
  if (['m2', 'м2', 'м²'].includes(normalized)) return 'm2'
  if (['pcs', 'шт'].includes(normalized)) return 'pcs'
  if (['lm', 'пм', 'п.м', 'п.м.', 'мп', 'м.п.', 'м'].includes(normalized)) return 'lm'
  if (['рул', 'рул.', 'рулон'].includes(normalized)) return 'roll'
  return ''
}

function priceUnitsAreCompatible(uploadedUnit: string | null | undefined, catalogUnit: string | null | undefined) {
  const uploaded = normalizeComparablePriceUnit(uploadedUnit)
  const catalog = normalizeComparablePriceUnit(catalogUnit)
  return !uploaded || !catalog || uploaded === catalog
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function formatUploadDate(isoDate: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate))
}

function maxFacadeHeight(facades: Facade[]) {
  return facades.reduce((max, facade) => Math.max(max, facade.heightMm), 0)
}


function getSubsystemFinishMode(project: Project) {
  return project.estimateMode === 'project' ? 'painted' : 'galvanized'
}

function calculateBracketRowsAlongProfile(heightMm: number, stepMm: number, edgeOffsetMm: number) {
  if (heightMm <= 0) return 0
  if (heightMm <= edgeOffsetMm * 2) return 2
  return 2 + Math.ceil((heightMm - edgeOffsetMm * 2) / stepMm)
}

function getMaxBracketLengthForSubsystem(subsystemCode: Project['subsystem']['code']) {
  if (subsystemCode === 'standard_g') {
    return 350
  }

  if (subsystemCode === 'standard_p_vertical' || subsystemCode === 'standard_p_double_level') {
    return 250
  }

  return 350
}

function getCornerSubsystemProjectionMm(project: Project) {
  const insulationThicknessMm = project.insulation.enabled ? project.insulation.thicknessMm : 0
  const baseOffsetMm = insulationThicknessMm + project.subsystem.airGapMm

  if (project.subsystem.code === 'standard_p_vertical') {
    return baseOffsetMm + 27
  }

  if (project.subsystem.code === 'standard_p_double_level') {
    return baseOffsetMm + 20
  }

  if (project.subsystem.code === 'standard_g') {
    return baseOffsetMm + 20
  }

  return baseOffsetMm
}

function pickOpeningSlopeElementKey(requiredDepthMm: number) {
  return requiredDepthMm <= 190 ? 'slope-element-oek190' : 'slope-element-oek260'
}

function pickOpeningDripKey(requiredDepthMm: number) {
  return requiredDepthMm <= 180 ? 'drip-vs180' : 'drip-vs250'
}

function pickKvguPriceItemByStaticCatalog(requiredReachMm: number, coating: 'galvanized' | 'colorflow_2s') {
  const options = subsystemPriceItems
    .filter((item) => item.family === 'kvgu')
    .map((item) => {
      const match = item.key.match(/^kvgu-(\d+)-(\d+)-([\d-]+)-/)
      if (!match) return null
      return {
        item,
        series: Number(match[1]),
        length: Number(match[2]),
      }
    })
    .filter((item): item is { item: SubsystemPriceItem; series: number; length: number } => item !== null)
    .sort((a, b) => a.length - b.length || a.series - b.series)

  const preferredSuitable = options.find((option) => option.item.coating === coating && option.length >= requiredReachMm)
  if (preferredSuitable) return preferredSuitable

  const galvanizedSuitable = options.find((option) => option.item.coating === 'galvanized' && option.length >= requiredReachMm)
  if (galvanizedSuitable) return galvanizedSuitable

  return options[options.length - 1] ?? null
}

function getCassetteStandardSizes(code: Project['selectedCassetteType']) {
  if (code === 'КФ-1') {
    return { l: 'Ст. L: 572, 1197 мм', h: 'Ст. H: 572, 1197 мм' }
  }
  if (code === 'КФ-2') {
    return { l: 'Ст. L: 555, 1180 мм', h: 'Ст. H: 550, 1175 мм' }
  }
  if (code === 'КФ-3') {
    return { l: 'Ст. L: 580 мм', h: 'Ст. H: 580 мм' }
  }
  if (code === 'КФ-4 (30)') {
    return { l: 'Ст. L: 555 мм', h: 'Ст. H: 572 мм' }
  }
  return { l: 'Ст. L: 580 мм', h: 'Ст. H: 598 мм' }
}

function getCassetteSizeLimits(code: Project['selectedCassetteType']) {
  if (code === 'КФ-1') {
    return { l: 'Мин/макс: 297–1897 мм', h: 'Мин/макс: 297–1897 мм', note: '' }
  }
  if (code === 'КФ-2') {
    return { l: 'Мин/макс: 360–1860 мм', h: 'Мин/макс: 200–1845 мм', note: '' }
  }
  if (code === 'КФ-3') {
    return { l: 'Мин/макс: 210–1205 мм', h: 'Мин/макс: 360–1205 мм', note: '' }
  }
  if (code === 'КФ-4 (30)') {
    return { l: 'Мин/макс: 200–1180 мм', h: 'Мин/макс: 407–1197 мм', note: '' }
  }
  return { l: 'Мин/макс: 200–1205 мм', h: 'Мин/макс: 394–1223 мм', note: '' }
}

function getCassetteNumericLimits(code: Project['selectedCassetteType']) {
  if (code === 'КФ-1') {
    return {
      l: { min: 297, max: 1897 },
      h: { min: 297, max: 1897 },
    }
  }

  if (code === 'КФ-2') {
    return {
      l: { min: 360, max: 1860 },
      h: { min: 200, max: 1845 },
    }
  }

  if (code === 'КФ-3') {
    return {
      l: { min: 210, max: 1205 },
      h: { min: 360, max: 1205 },
    }
  }

  if (code === 'КФ-4 (30)') {
    return {
      l: { min: 200, max: 1180 },
      h: { min: 407, max: 1197 },
    }
  }

  return {
    l: { min: 200, max: 1205 },
    h: { min: 394, max: 1223 },
  }
}

function getCassetteStandardRule(code: Project['selectedCassetteType']) {
  if (code === 'КФ-1') {
    return {
      standardL: [572, 1197],
      standardH: [572, 1197],
    }
  }

  if (code === 'КФ-2') {
    return {
      standardL: [555, 1180],
      standardH: [550, 1175],
    }
  }

  if (code === 'КФ-3') {
    return {
      standardL: [580],
      standardH: [580],
    }
  }

  if (code === 'КФ-4 (30)') {
    return {
      standardL: [555],
      standardH: [572],
    }
  }

  return {
    standardL: [580],
    standardH: [598],
  }
}

function getAvailableCassetteThicknesses(code: Project['selectedCassetteType']) {
  if (code === 'КФ-1' || code === 'КФ-2') {
    return cassetteThicknessOptions as readonly (0.7 | 1.0 | 1.2)[]
  }

  return cassetteThicknessOptions.filter((item) => item !== 1.0) as readonly (0.7 | 1.0 | 1.2)[]
}

function getCassetteRustMm(code: Project['selectedCassetteType']) {
  if (code === 'КФ-1') return 30
  if (code === 'КФ-2') return 20
  if (code === 'КФ-3') return 5
  if (code === 'КФ-4 (30)') return 30
  return 17
}

function getCassetteLayoutOverlap(code: Project['selectedCassetteType']) {
  if (code === 'КФ-1') {
    return {
      horizontalMm: 15,
      verticalMm: 25,
    }
  }

  return null
}

function getCornerCassetteFamily(code: Project['selectedCassetteType']) {
  if (code === 'КФ-1') return 'УКФ1'
  if (code === 'КФ-2') return 'УКФ2'
  if (code === 'КФ-3') return 'УКФ3'
  if (code === 'КФ-4 (30)') return 'УКФ4/30'
  return 'УКФ4/17'
}

function calculateCornerCassetteByFacade(
  facadeWidthMm: number,
  cassetteWidthMm: number,
  rustMm: number,
  cornerProjectionMm = 0,
  cornerMinMm = 200,
  cornerMaxMm = 700,
  overlapMm = 0,
) {
  if (facadeWidthMm <= 0 || cassetteWidthMm <= 0) return null

  const effectiveCornerMinMm = cornerMinMm + cornerProjectionMm
  const effectiveCornerMaxMm = cornerMaxMm + cornerProjectionMm
  const rowCassetteStepMm = overlapMm > 0 ? cassetteWidthMm - overlapMm : cassetteWidthMm + rustMm

  if (rowCassetteStepMm <= 0) return null

  const maxRowCassetteCount =
    overlapMm > 0
      ? Math.floor((facadeWidthMm - 2 * effectiveCornerMinMm) / rowCassetteStepMm)
      : Math.floor((facadeWidthMm - 2 * effectiveCornerMinMm - rustMm) / rowCassetteStepMm)

  for (let rowCassetteCount = Math.max(0, maxRowCassetteCount); rowCassetteCount >= 0; rowCassetteCount -= 1) {
    const seamsCount = rowCassetteCount + 1
    const rowCassettesWidthMm =
      overlapMm > 0
        ? rowCassetteCount * rowCassetteStepMm
        : rowCassetteCount * cassetteWidthMm + seamsCount * rustMm
    const cornerWidthMm = (facadeWidthMm - rowCassettesWidthMm) / 2

    if (cornerWidthMm >= effectiveCornerMinMm && cornerWidthMm <= effectiveCornerMaxMm) {
      return {
        rowCassetteCount,
        cornerWidthMm: Math.round(cornerWidthMm),
        planarCornerWidthMm: Math.round(Math.max(0, cornerWidthMm - cornerProjectionMm)),
      }
    }
  }

  return null
}

function calculateCassetteColumnsAlongLength(
  lengthMm: number,
  cassetteWidthMm: number,
  rustMm: number,
  minAdditionalWidthMm: number,
  overlapMm = 0,
) {
  if (lengthMm <= 0 || cassetteWidthMm <= 0) {
    return { standardColumns: 0, additionalWidthMm: 0, totalColumns: 0 }
  }

  if (overlapMm > 0) {
    const layoutStepMm = cassetteWidthMm - overlapMm

    if (layoutStepMm <= 0) {
      return { standardColumns: 0, additionalWidthMm: Math.round(lengthMm), totalColumns: 1 }
    }

    const maxStandardColumns = Math.max(0, Math.floor((lengthMm + rustMm) / layoutStepMm))

    for (let standardColumns = maxStandardColumns; standardColumns >= 0; standardColumns -= 1) {
      const coveredByStandardColumns = standardColumns > 0 ? standardColumns * layoutStepMm : 0
      const remainingWithSeam = lengthMm - coveredByStandardColumns
      const additionalWidthMm =
        remainingWithSeam > rustMm ? Math.round(remainingWithSeam + overlapMm) : 0

      if (additionalWidthMm === 0 || additionalWidthMm >= minAdditionalWidthMm) {
        return {
          standardColumns,
          additionalWidthMm,
          totalColumns: standardColumns + (additionalWidthMm > 0 ? 1 : 0),
        }
      }
    }

    return { standardColumns: 0, additionalWidthMm: Math.round(lengthMm), totalColumns: 1 }
  }

  const maxStandardColumns = Math.max(0, Math.floor((lengthMm + rustMm) / (cassetteWidthMm + rustMm)))

  for (let standardColumns = maxStandardColumns; standardColumns >= 0; standardColumns -= 1) {
    const coveredByStandardColumns =
      standardColumns > 0 ? standardColumns * cassetteWidthMm + Math.max(0, standardColumns - 1) * rustMm : 0
    const remainingWithSeam = lengthMm - coveredByStandardColumns
    const additionalWidthMm =
      remainingWithSeam > rustMm ? Math.round(remainingWithSeam - (standardColumns > 0 ? rustMm : 0)) : 0

    if (additionalWidthMm === 0 || additionalWidthMm >= minAdditionalWidthMm) {
      return {
        standardColumns,
        additionalWidthMm,
        totalColumns: standardColumns + (additionalWidthMm > 0 ? 1 : 0),
      }
    }
  }

  return { standardColumns: 0, additionalWidthMm: Math.round(lengthMm), totalColumns: 1 }
}

function calculateCassetteRowsAlongHeight(heightMm: number, cassetteHeightMm: number, rustMm: number, overlapMm = 0) {
  if (!Number.isFinite(heightMm) || !Number.isFinite(cassetteHeightMm) || heightMm <= 0 || cassetteHeightMm <= 0) {
    return { standardRows: 0, additionalHeightMm: 0, totalRows: 0 }
  }

  if (overlapMm > 0) {
    const layoutStepMm = cassetteHeightMm - overlapMm

    if (layoutStepMm <= 0) {
      return { standardRows: 0, additionalHeightMm: Math.round(heightMm), totalRows: 1 }
    }

    const standardRows = Math.max(0, Math.floor((heightMm + rustMm) / layoutStepMm))
    const coveredByStandardRows = standardRows > 0 ? standardRows * layoutStepMm : 0
    const remainingWithSeam = heightMm - coveredByStandardRows
    const additionalHeightMm =
      remainingWithSeam > rustMm ? Math.round(remainingWithSeam + overlapMm) : 0

    return {
      standardRows,
      additionalHeightMm,
      totalRows: standardRows + (additionalHeightMm > 0 ? 1 : 0),
    }
  }

  const standardRows = Math.max(0, Math.floor((heightMm + rustMm) / (cassetteHeightMm + rustMm)))
  const coveredByStandardRows =
    standardRows > 0 ? standardRows * cassetteHeightMm + (standardRows - 1) * rustMm : 0
  const remainingWithSeam = heightMm - coveredByStandardRows
  const additionalHeightMm =
    remainingWithSeam > rustMm ? Math.round(remainingWithSeam - (standardRows > 0 ? rustMm : 0)) : 0

  return {
    standardRows,
    additionalHeightMm,
    totalRows: standardRows + (additionalHeightMm > 0 ? 1 : 0),
  }
}

function findEconomicalCassetteSize(
  facades: Facade[],
  hasCornerCassettes: boolean,
  standardRule: ReturnType<typeof getCassetteStandardRule>,
  limits: ReturnType<typeof getCassetteNumericLimits>,
  rustMm: number,
  cornerProjectionMm: number,
  standardByLength: boolean,
  standardByHeight: boolean,
  overlap: ReturnType<typeof getCassetteLayoutOverlap>,
) {
  const candidateMap = new Map<string, { l: number; h: number; fittedHeight: boolean }>()
  const preferredL = Math.min(...standardRule.standardL)
  const preferredH = Math.min(...standardRule.standardH)
  const maxComfortAreaMm2 = preferredL * preferredH
  const candidateLengths = standardByLength ? standardRule.standardL : [preferredL]

  for (const l of candidateLengths) {
    for (const h of standardByHeight ? standardRule.standardH : standardRule.standardH) {
      candidateMap.set(`${l}-${h}`, { l, h, fittedHeight: false })
    }

    if (!standardByHeight) {
      for (const facade of facades) {
        const minRowStepMm = overlap ? limits.h.min - overlap.verticalMm : limits.h.min + rustMm
        const maxRows = Math.max(1, Math.ceil((facade.heightMm + rustMm) / minRowStepMm))

        for (let rows = 1; rows <= maxRows; rows += 1) {
          const fittedHeight = overlap
            ? Math.round(facade.heightMm / rows + overlap.verticalMm)
            : Math.round((facade.heightMm - (rows - 1) * rustMm) / rows)

          if (fittedHeight >= limits.h.min && fittedHeight <= limits.h.max) {
            candidateMap.set(`${l}-${fittedHeight}`, { l, h: fittedHeight, fittedHeight: true })
          }
        }
      }
    }
  }

  const candidates = Array.from(candidateMap.values())

  return candidates
    .filter(({ l, h }) => l >= limits.l.min && l <= limits.l.max && h >= limits.h.min && h <= limits.h.max)
    .map(({ l, h, fittedHeight }) => {
      let totalPieces = 0
      let additionalPieces = 0
      let additionalAreaM2 = 0
      const additionalHeights = new Set<number>()

      for (const facade of facades) {
        const cornerFieldWidthMm = facade.widthMm + cornerProjectionMm * 2
        const cornerLayout = hasCornerCassettes
          ? calculateCornerCassetteByFacade(cornerFieldWidthMm, l, rustMm, cornerProjectionMm, 200, 700, overlap?.horizontalMm ?? 0)
          : null
        const columns = hasCornerCassettes
          ? (cornerLayout?.rowCassetteCount ?? Number.POSITIVE_INFINITY)
          : calculateCassetteColumnsAlongLength(facade.widthMm, l, rustMm, limits.l.min, overlap?.horizontalMm ?? 0).totalColumns
        const heightLayout = calculateCassetteRowsAlongHeight(facade.heightMm, h, rustMm, overlap?.verticalMm ?? 0)

        if (!Number.isFinite(columns)) {
          return { l, h, score: Number.POSITIVE_INFINITY, additionalPieces: Number.POSITIVE_INFINITY, additionalAreaM2: Number.POSITIVE_INFINITY }
        }

        const facadeAdditionalPieces = heightLayout.additionalHeightMm > 0 ? columns * facade.quantity : 0
        totalPieces += columns * heightLayout.totalRows * facade.quantity
        additionalPieces += facadeAdditionalPieces
        additionalAreaM2 += facadeAdditionalPieces * ((l * heightLayout.additionalHeightMm) / 1_000_000)

        if (heightLayout.additionalHeightMm > 0) {
          additionalHeights.add(heightLayout.additionalHeightMm)
        }
      }

      return {
        l,
        h,
        additionalPieces,
        additionalAreaM2,
        score:
          additionalAreaM2 * 1_000_000 +
          additionalPieces * 10_000 +
          additionalHeights.size * 1_000 +
          (standardByLength ? Math.max(0, l - preferredL) * 1_000_000 : 0) +
          (standardByHeight ? Math.max(0, h - preferredH) * 1_000_000 : 0) +
          Math.max(0, l * h - maxComfortAreaMm2) / 20 +
          Math.max(0, h - preferredH) * 150 +
          totalPieces * 5 +
          (fittedHeight ? 0 : 100),
      }
    })
    .sort((a, b) => a.score - b.score)[0]
}

const cornerCassettePriceCatalog = [
  { family: 'УКФ1', thickness: 0.7, coating: 'polyester', code: '2178', name: 'Кассета угловая 1 (УКФ1) 0,7', unit: 'm2', price: 1650 },
  { family: 'УКФ1', thickness: 0.7, coating: 'colorflow_1s', code: '1473', name: 'Кассета угловая 1 (УКФ1) 0,7 (Колор-поток)', unit: 'm2', price: 1741 },
  { family: 'УКФ1', thickness: 1.0, coating: 'colorflow_1s', code: '1474', name: 'Кассета угловая 1 (УКФ1) 1,0 (Колор-поток)', unit: 'm2', price: 2052 },
  { family: 'УКФ1', thickness: 1.2, coating: 'colorflow_1s', code: '113368', name: 'Кассета угловая 1 (УКФ1) 1,2 (Колор-поток)', unit: 'm2', price: 2626 },
  { family: 'УКФ2', thickness: 0.7, coating: 'polyester', code: '2179', name: 'Кассета угловая 2 (УКФ2) 0,7', unit: 'm2', price: 1650 },
  { family: 'УКФ2', thickness: 0.7, coating: 'colorflow_1s', code: '1475', name: 'Кассета угловая 2 (УКФ2) 0,7 (Колор-поток)', unit: 'm2', price: 1741 },
  { family: 'УКФ2', thickness: 1.0, coating: 'colorflow_1s', code: '1476', name: 'Кассета угловая 2 (УКФ2) 1,0 (Колор-поток)', unit: 'm2', price: 2052 },
  { family: 'УКФ2', thickness: 1.2, coating: 'colorflow_1s', code: '58026', name: 'Кассета угловая 2 (УКФ2) 1,2 (Колор-поток)', unit: 'm2', price: 2626 },
  { family: 'УКФ3', thickness: 0.7, coating: 'polyester', code: '57733', name: 'Кассета угловая 3 (УКФ3) 0,7', unit: 'm2', price: 1650 },
  { family: 'УКФ3', thickness: 0.7, coating: 'colorflow_1s', code: '57750', name: 'Кассета угловая 3 (УКФ3) 0,7 (Колор-поток)', unit: 'm2', price: 1741 },
  { family: 'УКФ3', thickness: 1.2, coating: 'colorflow_1s', code: '58031', name: 'Кассета угловая 3 (УКФ3) 1,2 (Колор-поток)', unit: 'm2', price: 2626 },
  { family: 'УКФ4/17', thickness: 0.7, coating: 'polyester', code: '71690', name: 'Кассета угловая 4/17 (УКФ4/17) 0,7', unit: 'm2', price: 1650 },
  { family: 'УКФ4/17', thickness: 0.7, coating: 'colorflow_1s', code: '71691', name: 'Кассета угловая 4/17 (УКФ4/17) 0,7 (Колор-поток)', unit: 'm2', price: 1741 },
  { family: 'УКФ4/17', thickness: 1.2, coating: 'colorflow_1s', code: '71696', name: 'Кассета угловая 4/17 (УКФ4/17) 1,2 (Колор-поток)', unit: 'm2', price: 2626 },
  { family: 'УКФ4/30', thickness: 0.7, coating: 'polyester', code: '71717', name: 'Кассета угловая 4/30 (УКФ4/30) 0,7', unit: 'm2', price: 1650 },
  { family: 'УКФ4/30', thickness: 0.7, coating: 'colorflow_1s', code: '71718', name: 'Кассета угловая 4/30 (УКФ4/30) 0,7 (Колор-поток)', unit: 'm2', price: 1741 },
  { family: 'УКФ4/30', thickness: 1.2, coating: 'colorflow_1s', code: '71723', name: 'Кассета угловая 4/30 (УКФ4/30) 1,2 (Колор-поток)', unit: 'm2', price: 2626 },
] as const

function EngineeringMethodologyPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="page theme-mono methodology-page">
      <header className="methodology-hero">
        <button className="btn btn-primary" type="button" onClick={onBack}>
          ← Вернуться к калькулятору
        </button>
        <div className="calc-kicker">ИНСИ / инженерная методика</div>
        <h1>Ядро расчета фасадной системы</h1>
        <p>
          Страница фиксирует действующую логику калькулятора: какие входные данные используются, как считаются кассеты,
          подсистема, утеплитель, пленка, крепеж, комплектующие и итоговая стоимость. Документ предназначен для инженера
          проектировщика и последующей проверки расчетных допущений.
        </p>
      </header>

      <section className="methodology-section">
        <h2>1. Входные данные</h2>
        <p>
          Расчет строится от геометрии фасадов: ширина, высота, количество одинаковых фасадов, проемы, наружные и
          внутренние углы. Отдельно задаются тип кассеты, толщина металла, покрытие, тип подсистемы, воздушный зазор,
          утепление, пленка и режим оформления наружных углов.
        </p>
        <ul>
          <li>Размеры фасадов и проемов задаются в миллиметрах.</li>
          <li>Площади для спецификации переводятся в квадратные метры.</li>
          <li>Профили и комплектующие переводятся в погонные метры и затем округляются до стандартных хлыстов 3 м.</li>
          <li>Цены берутся из встроенного каталога или из загруженного Excel-прайса по коду номенклатуры.</li>
        </ul>
      </section>

      <section className="methodology-section">
        <h2>2. Геометрия кассет</h2>
        <p>
          Для каждого фасада рассчитывается раскладка по длине и высоте. Калькулятор подбирает количество стандартных
          кассет и доборных элементов по остаткам. Если включен режим стандартного размера по длине или высоте, размер
          кассеты подбирается автоматически с минимизацией доборов и отходов.
        </p>
        <div className="methodology-formula">колонки = floor((ширина фасада + руст) / (L + руст))</div>
        <div className="methodology-formula">ряды = floor((высота фасада + руст) / (H + руст))</div>
        <div className="methodology-formula">добор = остаток после размещения стандартных кассет и рустов</div>
        <p>
          Проемы вычитаются из площади рядовых кассет перед расчетом стоимости. Количество кассет по раскладке при этом
          остается геометрическим, потому что фактический раскрой и добор вокруг проемов требует отдельной монтажной схемы.
        </p>
      </section>

      <section className="methodology-section">
        <h2>3. Углы и угловые элементы</h2>
        <p>
          Наружные углы могут оформляться угловыми кассетами или фасонными уголками. Внутренние углы учитываются отдельно.
          Для угловых кассет расчетная полка увеличивается на вынос подсистемы.
        </p>
        <div className="methodology-formula">вынос угла = утеплитель + вентзазор + профиль</div>
        <ul>
          <li>П-образная одноуровневая система: утеплитель + вентзазор + 27 мм.</li>
          <li>П-образная двухуровневая система: утеплитель + вентзазор + 20 мм.</li>
          <li>Г-образная система: утеплитель + вентзазор + 20 мм.</li>
          <li>Если утеплитель отключен, его толщина в выносе принимается равной 0 мм.</li>
        </ul>
        <p>
          Для кассет скрытого типа крепления КФ-2/КФ-3 применяются углы УСНс/УСВс. Для кассет открытого типа крепления
          КФ-1/КФ-4 применяются УНс/УВс и отдельный открытый крепеж 4,8х20 с ЭПДМ.
        </p>
      </section>

      <section className="methodology-section">
        <h2>4. Подсистема</h2>
        <p>
          В калькуляторе реализованы Г-образная, П-образная одноуровневая и П-образная двухуровневая схемы. Основной
          расчет подсистемы строится от линий направляющих, высоты фасада, шага кронштейнов и типа кассет.
        </p>
        <ul>
          <li>Кронштейны считаются по вертикальным линиям и рядам крепления по высоте.</li>
          <li>Шаг кронштейнов ограничен расчетным максимумом 800 мм.</li>
          <li>Профили округляются до хлыстов по 3 м.</li>
          <li>Для Г-системы КВГУ подбирается по требуемому вылету: утеплитель + воздушный зазор.</li>
          <li>Для наружного угла Г-системы учитывается отдельный Z-профиль.</li>
          <li>Для П-системы на наружных и внутренних углах добавляются дополнительные угловые направляющие.</li>
        </ul>
      </section>

      <section className="methodology-section">
        <h2>5. Проемы, откосы и комплектующие</h2>
        <p>
          Проемы участвуют в трех частях расчета: вычитание площади кассет, рамка подсистемы вокруг проема и доборные
          элементы. Для проемов шире 1200 мм добавляются промежуточные вертикальные элементы рамки.
        </p>
        <div className="methodology-formula">глубина откоса = вынос системы + толщина кассеты + запас 30 мм</div>
        <p>
          По рассчитанной глубине подбираются типовые элементы ОЭк190/ОЭк260 и водоотливы Вс180/Вс250. Если расчетная
          глубина превышает типовые позиции, калькулятор показывает предупреждение о необходимости индивидуального
          доборного элемента.
        </p>
      </section>

      <section className="methodology-section">
        <h2>6. Утеплитель и мембрана</h2>
        <p>
          Утеплитель включается отдельной кнопкой. Если утеплитель отключен, объем утеплителя, мембрана и крепеж
          утеплителя не попадают в спецификацию. При включении утеплителя объем считается по площади фасада за вычетом
          проемов и толщине слоя.
        </p>
        <div className="methodology-formula">объем утеплителя = площадь утепления × толщина / 1000</div>
        <div className="methodology-formula">мембрана с нахлестом = площадь × 1,6 / (1,6 - 0,2)</div>
        <ul>
          <li>Используемая мембрана: Пленка Гекса Изоспан-АМ (1,6х43,75), код 0000002024.</li>
          <li>Площадь рулона: 70 м².</li>
          <li>Расчетный нахлест: 200 мм.</li>
          <li>Дюбели утеплителя: 5 шт/м² для одного слоя, 10 шт/м² для двухслойного утепления.</li>
        </ul>
      </section>

      <section className="methodology-section">
        <h2>7. Крепеж</h2>
        <p>
          Крепеж разделен по назначению: заклепки подсистемы, анкеры кронштейнов, дюбели утеплителя, саморезы
          комплектующих и крепеж кассет. Для КФ-2/КФ-3 применяется скрытый тип крепления, для КФ-1/КФ-4 открытый тип
          крепления.
        </p>
        <ul>
          <li>КФ-2/КФ-3: 2 самореза на кассету при L до 799 мм, 3 при L больше 799 мм.</li>
          <li>КФ-4: 4 самореза на кассету, для крупных кассет L больше 800 мм принято 6 саморезов.</li>
          <li>Крепеж фасонных элементов: боковые линии 600 мм, верхние и водоотводящие элементы 400 мм.</li>
          <li>Анкерный крепеж: 1 шт на кронштейн.</li>
        </ul>
      </section>

      <section className="methodology-section">
        <h2>8. Прайс и сопоставление цен</h2>
        <p>
          Встроенный каталог хранит номенклатуру, коды и базовые цены. Загруженный Excel-прайс заменяет цены по коду.
          Парсер ищет колонки кода, наименования, цены и единицы измерения по заголовкам, поэтому порядок колонок в Excel
          не критичен. Для 1С-выгрузок с многострочной шапкой заголовки объединяются по мере чтения строк.
        </p>
        <ul>
          <li>Сопоставление идет по нормализованному коду номенклатуры.</li>
          <li>Ведущие нули в кодах игнорируются при сравнении.</li>
          <li>Если код не найден, остается встроенная цена или строка помечается как требующая подтверждения прайса.</li>
          <li>Загруженный файл и дата загрузки сохраняются в браузере.</li>
        </ul>
      </section>

      <section className="methodology-section">
        <h2>9. Итоговая стоимость</h2>
        <p>
          Сводная спецификация суммирует разделы: кассеты, подсистема, крепеж, комплектующие, утеплитель и пленки. Цена за
          квадратный метр рассчитывается от итоговой суммы и расчетной площади спецификации.
        </p>
        <div className="methodology-formula">
          итог = кассеты + подсистема + крепеж + комплектующие + утеплитель и пленки
        </div>
        <div className="methodology-formula">цена за м² = итог / расчетная площадь</div>
        <p>
          Блоки проектирования и монтажной схемы пока вынесены в раздел «Дополнительные расчеты» со статусом
          «В разработке». Их алгоритмы будут добавлены после утверждения правил.
        </p>
      </section>

      <section className="methodology-section">
        <h2>10. Расчет упаковок</h2>
        <p>
          Упаковки считаются по рядовым кассетам. В одной упаковке должны быть кассеты одного цвета и одного типа.
          Базовая упаковка формируется на 72 ряда, а небольшой остаток допускается добивать в уже сформированные упаковки.
        </p>
        <div className="methodology-formula">ряд упаковки = 1 кассета при L &gt; 1000 мм или 2 кассеты при L ≤ 1000 мм</div>
        <div className="methodology-formula">длина пачки = количество рядов × D</div>
        <ul>
          <li>Для КФ-1, КФ-2 и КФ-4/30 рабочая глубина D принимается 30 мм.</li>
          <li>Для КФ-3 и КФ-4/17 рабочая глубина D принимается 17 мм.</li>
          <li>По умолчанию используется длина упаковки 2200 мм.</li>
          <li>Длина 2300 мм допускается как исключение для плотной добивки, когда 2200 мм не хватает по количеству рядов.</li>
          <li>Разные ширины в одной упаковке допускаются, если сохраняются цвет, тип кассеты и габаритные ограничения упаковки.</li>
          <li>Угловые кассеты в текущей версии показываются в спецификации отдельно и пока не включаются в расчет упаковок.</li>
        </ul>
      </section>

      <section className="methodology-section">
        <h2>11. Использованные источники</h2>
        <ul className="methodology-sources">
          <li>Документация/md/calculator-current-rules.md — текущие правила калькулятора и проверочные сценарии.</li>
          <li>Документация/md/cassette-rules.md — типы КФ, стандартность, крепление, ограничения по КФ-4.</li>
          <li>Документация/md/sto-td-002-kassety.md — геометрическая база фасадных кассет.</li>
          <li>Документация/md/corner-elements-rules.md — угловые кассеты, УСНс/УСВс, УНс/УВс, правила уголков.</li>
          <li>Документация/md/subsystem-corners-rules.md — подсистема на наружных и внутренних углах.</li>
          <li>Документация/md/g-shaped-subsystem-rules.md — Г-образная подсистема и Z-профиль наружного угла.</li>
          <li>Документация/md/p-shaped-single-level-subsystem-rules.md — П-образная одноуровневая система.</li>
          <li>Документация/md/subsystem-types-rules.md — типы подсистем и состав профилей.</li>
          <li>Документация/md/opening-subsystem-rules.md — рамки проемов и промежуточные профили.</li>
          <li>Документация/md/insulation-and-membrane-rules.md — утеплитель, мембрана и нахлесты.</li>
          <li>Документация/md/fastening-and-joint-rules.md — крепеж кассет, уголков и доборных элементов.</li>
          <li>Документация/md/accessories-and-trims-rules.md — комплектующие и фасонные элементы.</li>
          <li>Документация/md/price-import-and-matching.md — принципы импорта и сопоставления прайса.</li>
          <li>прайс март2026.xlsx — текущий локальный прайс для проверки кодов и цен.</li>
        </ul>
      </section>

      <section className="methodology-section">
        <h2>12. Ограничения текущей версии</h2>
        <ul>
          <li>Калькулятор не заменяет рабочую монтажную схему и не выполняет 3D-узел каждого примыкания.</li>
          <li>Раскрой вокруг проемов учитывается через вычитание площади, но не через индивидуальные карты раскроя.</li>
          <li>Ветровые зоны и повышенные нормы крепления в краевых зонах пока не детализированы в итоговой формуле.</li>
          <li>Стоимость проектирования, монтажной схемы и упаковки пока не входит в итог.</li>
        </ul>
      </section>
    </div>
  )
}

interface FacadeLayoutPreview {
  facadeId: string
  facadeName: string
  facadeQuantity: number
  columns: number
  standardColumns: number
  additionalColumnWidthMm: number
  rows: number
  standardRows: number
  additionalRowHeightMm: number
  perFacadePieces: number
  totalPieces: number
}

function CassetteLayoutVisualizationPage({
  project,
  cassetteL,
  cassetteH,
  cassetteRust,
  cornerProjectionMm,
  subsystemBracketStepMm,
  layouts,
  onBack,
  onMoveOpening,
}: {
  project: Project
  cassetteL: number
  cassetteH: number
  cassetteRust: number
  cornerProjectionMm: number
  subsystemBracketStepMm: number
  layouts: FacadeLayoutPreview[]
  onBack: () => void
  onMoveOpening: (facadeId: string, openingId: string, positionIndex: number, xMm: number, yMm: number) => void
}) {
  const [visualMode, setVisualMode] = useState<'cassette' | 'facade' | 'subsystem'>('cassette')
  const overlap = getCassetteLayoutOverlap(project.selectedCassetteType)
  const horizontalOverlap = overlap?.horizontalMm ?? 0
  const verticalOverlap = overlap?.verticalMm ?? 0
  const standardDisplayWidth = Math.max(1, overlap ? cassetteL - horizontalOverlap : cassetteL + cassetteRust)
  const standardDisplayHeight = Math.max(1, overlap ? cassetteH - verticalOverlap : cassetteH + cassetteRust)

  return (
    <div className="page theme-mono visualization-page">
      <header className="visualization-hero">
        <div>
          <div className="calc-kicker">ИНСИ / визуальная раскладка</div>
          <h1>Раскладка кассет</h1>
          <p>
            Схема показывает текущую расчетную раскладку по фасадам: стандартные кассеты, доборы по длине и высоте,
            количество рядов и колонок. Проемы можно перетаскивать мышкой прямо по фасаду.
          </p>
        </div>
        <div className="visualization-legend" aria-label="Обозначения">
          <span><i className="legend-standard" />Стандартная кассета</span>
          <span><i className="legend-extra" />Добор</span>
          <span><i className="legend-corner" />Угловая кассета</span>
          <span><i className="legend-opening" />Проем</span>
          <span><i className="legend-rust" />Руст / шаг</span>
        </div>
      </header>

      <section className="visualization-rule-strip">
        <div>
          <span>Тип</span>
          <strong>{project.selectedCassetteType}</strong>
        </div>
        <div>
          <span>Размер рядовой кассеты</span>
          <strong>{Number.isFinite(cassetteL) && Number.isFinite(cassetteH) ? `H ${cassetteH}; L ${cassetteL} мм` : '—'}</strong>
        </div>
        <div>
          <span>Расчетный руст</span>
          <strong>{cassetteRust} мм</strong>
        </div>
        <div>
          <span>Шаг раскладки</span>
          <strong>
            {overlap
              ? `${standardDisplayWidth} × ${standardDisplayHeight} мм`
              : `${cassetteL + cassetteRust} × ${cassetteH + cassetteRust} мм`}
          </strong>
        </div>
        <div>
          <span>Вынос системы</span>
          <strong>{Math.round(cornerProjectionMm)} мм</strong>
        </div>
      </section>
      <section className="visualization-mode-bar" aria-label="Режим визуализации">
        <button className="btn btn-primary" type="button" onClick={onBack}>
          ← Вернуться к калькулятору
        </button>
        <div className="visualization-mode-actions">
          <button
            className={`btn visualization-mode-btn ${visualMode === 'cassette' ? 'active' : ''}`}
            type="button"
            onClick={() => setVisualMode('cassette')}
          >
            Кассетное поле
          </button>
          <button
            className={`btn visualization-mode-btn ${visualMode === 'facade' ? 'active' : ''}`}
            type="button"
            onClick={() => setVisualMode('facade')}
          >
            Фасад здания
          </button>
          <button
            className={`btn visualization-mode-btn ${visualMode === 'subsystem' ? 'active' : ''}`}
            type="button"
            onClick={() => setVisualMode('subsystem')}
          >
            Подсистема
          </button>
        </div>
      </section>

      {layouts.length > 0 ? (
        <div className="visualization-list">
          {layouts.map((layout) => {
            const facade = project.facades.find((item) => item.id === layout.facadeId)
            if (!facade) return null

            const columns = [
              ...Array.from({ length: layout.standardColumns }, (_, index) => ({
                key: `std-col-${index}`,
                kind: 'standard' as const,
                width: standardDisplayWidth,
                label: `${cassetteL}`,
              })),
              ...(layout.additionalColumnWidthMm > 0
                ? [{
                    key: 'extra-col',
                    kind: 'extra' as const,
                    width: Math.max(1, layout.additionalColumnWidthMm - horizontalOverlap),
                    label: `${layout.additionalColumnWidthMm}`,
                  }]
                : []),
            ]
            const rows = [
              ...Array.from({ length: layout.standardRows }, (_, index) => ({
                key: `std-row-${index}`,
                kind: 'standard' as const,
                height: standardDisplayHeight,
                label: `${cassetteH}`,
              })),
              ...(layout.additionalRowHeightMm > 0
                ? [{
                    key: 'extra-row',
                    kind: 'extra' as const,
                    height: Math.max(1, layout.additionalRowHeightMm - verticalOverlap),
                    label: `${layout.additionalRowHeightMm}`,
                  }]
                : []),
            ]
            const safeWidth = Math.max(1, facade.widthMm)
            const safeHeight = Math.max(1, facade.heightMm)
            const facadeInsetX = Math.max(0, Math.round(cornerProjectionMm))
            const facadeInsetY = 0
            const fieldWidth = safeWidth + facadeInsetX * 2
            const fieldHeight = safeHeight
            const subsystemIsGVisual = project.subsystem.code === 'standard_g'
            const subsystemIsPDoubleVisual = project.subsystem.code === 'standard_p_double_level'
            const subsystemBracketRows = Math.max(
              2,
              calculateBracketRowsAlongProfile(safeHeight, subsystemBracketStepMm, subsystemEdgeBracketOffsetMm),
            )
            const subsystemBracketY = Array.from({ length: subsystemBracketRows }, (_, index) => {
              if (subsystemBracketRows === 1) return safeHeight / 2
              return subsystemEdgeBracketOffsetMm +
                ((safeHeight - subsystemEdgeBracketOffsetMm * 2) * index) / Math.max(1, subsystemBracketRows - 1)
            })
            const subsystemHorizontalRows = subsystemIsGVisual
              ? subsystemBracketY.map((y, index) => ({
                  key: `subsystem-g-horizontal-${index}`,
                  kind: 'g' as const,
                  y,
                }))
              : subsystemIsPDoubleVisual
                ? (() => {
                    const rowCount = Math.max(2, Math.ceil(safeHeight / maxSubsystemVerticalProfileStepMm) + 1)
                    return Array.from({ length: rowCount }, (_, index) => ({
                      key: `subsystem-horizontal-${index}`,
                      kind: 'p-double' as const,
                      y: (safeHeight * index) / Math.max(1, rowCount - 1),
                    }))
                  })()
                : []
            const cornerCalculation =
              project.hasCornerCassettes && project.outsideCorners > 0
                ? calculateCornerCassetteByFacade(
                    fieldWidth,
                    cassetteL,
                    cassetteRust,
                    cornerProjectionMm,
                    200,
                    700,
                    horizontalOverlap,
                  )
                : null
            const cornerZoneWidth = cornerCalculation?.cornerWidthMm ?? 0
            const visualColumns = columns
            const seamPositions = [0]
            if (cornerZoneWidth > 0) seamPositions.push(cornerZoneWidth)
            visualColumns.reduce((x, column) => {
              const nextX = x + column.width
              seamPositions.push(nextX)
              return nextX
            }, cornerZoneWidth)
            if (cornerZoneWidth > 0) {
              seamPositions.push(fieldWidth - cornerZoneWidth, fieldWidth)
            }
            const subsystemVerticalLines = [...new Set(seamPositions.map((x) => Math.round(clampValue(x, 0, fieldWidth))))]
              .sort((a, b) => a - b)
              .map((x, index) => ({
                key: `subsystem-line-${index}`,
                x,
              }))
            const doubleLevelOffset = subsystemIsPDoubleVisual ? Math.max(20, Math.min(42, safeWidth * 0.0025)) : 0
            const adjustedRows = rows
            const visualRows = adjustedRows.reduce<Array<(typeof adjustedRows)[number] & { y: number }>>((acc, row) => {
              const previous = acc[acc.length - 1]
              acc.push({
                ...row,
                y: previous ? previous.y + previous.height : 0,
              })
              return acc
            }, [])
            const openingItems = facade.hasOpenings
              ? facade.openings.flatMap((opening) =>
                  Array.from({ length: opening.quantity }, (_, index) => ({
                    ...opening,
                    openingId: opening.id,
                    positionIndex: index,
                    markerId: `${opening.id}-${index}`,
                  })),
                )
              : []
            const openingGap = openingItems.length > 0 ? safeWidth / (openingItems.length + 1) : 0
            const openingMarkers = openingItems.map((opening, index) => {
              const width = Math.min(opening.widthMm, safeWidth * 0.22)
              const height = Math.min(opening.heightMm, safeHeight * 0.42)
              const savedPosition = opening.positions?.[opening.positionIndex]
              const rawX = openingGap * (index + 1) - width / 2
              const defaultX = clampValue(rawX, 80, Math.max(80, safeWidth - width - 80))
              const defaultY =
                opening.type === 'door' || opening.type === 'gate'
                  ? Math.max(0, safeHeight - height)
                  : clampValue(safeHeight * 0.38 - height / 2, 120, Math.max(120, safeHeight - height - 220))
              const x = savedPosition ? clampValue(savedPosition.xMm, 0, Math.max(0, safeWidth - width)) : defaultX
              const y = savedPosition
                ? clampValue(safeHeight - savedPosition.yMm - height, 0, Math.max(0, safeHeight - height))
                : defaultY

              return { ...opening, x, y, yFromBottomMm: Math.round(safeHeight - y - height), width, height }
            })
            const sortedOpeningMarkers = [...openingMarkers].sort((a, b) => a.x - b.x)
            const windowOpeningMarkers = sortedOpeningMarkers.filter((opening) => opening.type === 'window')
            const openingXAxisControls = sortedOpeningMarkers.map((opening, index) => ({
              key: `x-${opening.markerId}`,
              label: `Проем ${index + 1}: X от 0`,
              value: Math.round(opening.x),
              onChange: (xMm: number) => {
                const nextX = clampValue(xMm, 0, Math.max(0, safeWidth - opening.width))
                onMoveOpening(facade.id, opening.openingId, opening.positionIndex, Math.round(nextX), opening.yFromBottomMm)
              },
            }))
            const alignWindowsByY = () => {
              if (windowOpeningMarkers.length < 2) return
              const targetY = windowOpeningMarkers[0].yFromBottomMm
              windowOpeningMarkers.forEach((opening) => {
                onMoveOpening(facade.id, opening.openingId, opening.positionIndex, Math.round(opening.x), targetY)
              })
            }
            const distributeWindowsByX = () => {
              if (windowOpeningMarkers.length < 2) return
              const totalOpeningWidth = windowOpeningMarkers.reduce((sum, opening) => sum + opening.width, 0)
              const gap = Math.max(0, (safeWidth - totalOpeningWidth) / (windowOpeningMarkers.length + 1))
              let nextX = gap
              windowOpeningMarkers.forEach((opening) => {
                onMoveOpening(
                  facade.id,
                  opening.openingId,
                  opening.positionIndex,
                  Math.round(clampValue(nextX, 0, Math.max(0, safeWidth - opening.width))),
                  opening.yFromBottomMm,
                )
                nextX += opening.width + gap
              })
            }
            const getSvgPoint = (event: ReactPointerEvent<SVGGElement>) => {
              const svg = event.currentTarget.ownerSVGElement
              if (!svg) return null
              const screenMatrix = svg.getScreenCTM()
              if (!screenMatrix) return null
              const point = svg.createSVGPoint()
              point.x = event.clientX
              point.y = event.clientY
              return point.matrixTransform(screenMatrix.inverse())
            }

            return (
              <section className="visualization-card" key={layout.facadeId}>
                <div className="visualization-card-head">
                  <div>
                    <h2>{layout.facadeName}</h2>
                    <div className="visualization-size-lines">
                      <span>Размер стены: {facade.widthMm} × {facade.heightMm} мм</span>
                      <span>Размер кассетного поля: {fieldWidth} × {fieldHeight} мм</span>
                      {layout.facadeQuantity > 1 ? <span>Количество: {layout.facadeQuantity}</span> : null}
                    </div>
                  </div>
                  <div className="visualization-card-total">
                    <span>Итого</span>
                    <strong>{layout.totalPieces} шт</strong>
                  </div>
                </div>

                <div className="visualization-drawing-wrap">
                  <svg
                    className={`visualization-drawing ${visualMode === 'facade' ? 'facade-view' : ''} ${visualMode === 'subsystem' ? 'subsystem-view' : ''}`}
                    viewBox={`0 0 ${fieldWidth} ${fieldHeight}`}
                    role="img"
                    aria-label={`Раскладка ${layout.facadeName}`}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <defs>
                      <pattern id={`rust-${layout.facadeId}`} width="80" height="80" patternUnits="userSpaceOnUse">
                        <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(23,32,29,0.13)" strokeWidth="3" />
                      </pattern>
                      <clipPath id={`clip-${layout.facadeId}`}>
                        <rect x="0" y="0" width={fieldWidth} height={fieldHeight} rx="0" />
                      </clipPath>
                    </defs>
                    <rect
                      x={facadeInsetX}
                      y={facadeInsetY}
                      width={safeWidth}
                      height={safeHeight}
                      className="facade-surface"
                    />
                    <rect
                      x="0"
                      y="0"
                      width={fieldWidth}
                      height={fieldHeight}
                      className="cassette-field-background"
                      fill={`url(#rust-${layout.facadeId})`}
                    />
                    <g clipPath={`url(#clip-${layout.facadeId})`}>
                      <g className="cassette-field-layer">
                        {cornerZoneWidth > 0
                          ? visualRows.map((row) => {
                            return (
                              <g key={`corner-row-${row.key}`}>
                                <rect
                                  x="0"
                                  y={row.y}
                                  width={cornerZoneWidth}
                                  height={row.height}
                                  className="visual-corner-cell"
                                />
                                <rect
                                  x={fieldWidth - cornerZoneWidth}
                                  y={row.y}
                                  width={cornerZoneWidth}
                                  height={row.height}
                                  className="visual-corner-cell"
                                />
                              </g>
                            )
                          })
                          : null}
                        <g transform={`translate(${cornerZoneWidth} 0)`}>
                          {visualRows.flatMap((row) => {
                            let x = 0
                            const currentY = row.y

                            return visualColumns.map((column) => {
                              const currentX = x
                              x += column.width
                              const isExtra = row.kind === 'extra' || column.kind === 'extra'
                              const width = Math.max(1, column.width)
                              const height = Math.max(1, row.height)

                              return (
                                <g key={`${row.key}-${column.key}`}>
                                  <rect
                                    x={currentX}
                                    y={currentY}
                                    width={width}
                                    height={height}
                                    className={isExtra ? 'cassette-cell cassette-cell-extra' : 'cassette-cell cassette-cell-standard'}
                                  />
                                </g>
                              )
                            })
                          })}
                        </g>
                      </g>
                      <g className="subsystem-layer">
                        {subsystemHorizontalRows.map((row) => (
                          <line
                            key={row.key}
                            x1={facadeInsetX}
                            y1={facadeInsetY + row.y}
                            x2={facadeInsetX + safeWidth}
                            y2={facadeInsetY + row.y}
                            className={row.kind === 'g' ? 'subsystem-horizontal-guide subsystem-horizontal-guide-g' : 'subsystem-horizontal-guide'}
                          />
                        ))}
                        {subsystemVerticalLines.map((line) => (
                          <line
                            key={line.key}
                            x1={line.x}
                            y1={facadeInsetY}
                            x2={line.x}
                            y2={facadeInsetY + safeHeight}
                            className={`subsystem-vertical-guide ${subsystemIsGVisual ? 'subsystem-vertical-guide-g' : ''} ${subsystemIsPDoubleVisual ? 'subsystem-vertical-guide-p-double' : ''}`}
                          />
                        ))}
                        {subsystemIsPDoubleVisual
                          ? subsystemVerticalLines.map((line) => {
                              const x = clampValue(line.x + doubleLevelOffset, 0, fieldWidth)
                              return (
                                <line
                                  key={`${line.key}-front`}
                                  x1={x}
                                  y1={facadeInsetY}
                                  x2={x}
                                  y2={facadeInsetY + safeHeight}
                                  className="subsystem-front-vertical-guide"
                                />
                              )
                            })
                          : null}
                        {subsystemVerticalLines.flatMap((line) =>
                          subsystemBracketY.map((y, index) => (
                            <circle
                              key={`${line.key}-bracket-${index}`}
                              cx={line.x}
                              cy={facadeInsetY + y}
                              r={Math.max(24, Math.min(42, safeWidth * 0.004))}
                              className={`subsystem-bracket ${subsystemIsGVisual ? 'subsystem-bracket-g' : ''}`}
                            />
                          )),
                        )}
                      </g>
                      {openingMarkers.map((opening) => (
                        <g
                          key={opening.markerId}
                          className="visual-opening-group"
                          onPointerDown={(event) => {
                            event.currentTarget.setPointerCapture(event.pointerId)
                          }}
                          onPointerMove={(event) => {
                            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
                            const point = getSvgPoint(event)
                            if (!point) return
                            const xMm = Math.round(clampValue(point.x - facadeInsetX - opening.width / 2, 0, Math.max(0, safeWidth - opening.width)))
                            const yTopMm = clampValue(point.y - facadeInsetY - opening.height / 2, 0, Math.max(0, safeHeight - opening.height))
                            const yMm = Math.round(safeHeight - yTopMm - opening.height)
                            onMoveOpening(facade.id, opening.openingId, opening.positionIndex, xMm, yMm)
                          }}
                          onPointerUp={(event) => {
                            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                              event.currentTarget.releasePointerCapture(event.pointerId)
                            }
                          }}
                          onPointerCancel={(event) => {
                            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                              event.currentTarget.releasePointerCapture(event.pointerId)
                            }
                          }}
                        >
                          <rect
                            x={opening.x + facadeInsetX}
                            y={opening.y + facadeInsetY}
                            width={opening.width}
                            height={opening.height}
                            className="visual-opening"
                          />
                          <text
                            x={opening.x + facadeInsetX + opening.width / 2}
                            y={opening.y + facadeInsetY + opening.height / 2}
                            className="visual-opening-label"
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            {opening.type === 'gate' ? 'ворота' : opening.type === 'door' ? 'дверь' : 'окно'}
                          </text>
                        </g>
                      ))}
                    </g>
                    <rect x="0" y="0" width={fieldWidth} height={fieldHeight} className="cassette-field-outline" />
                    <rect
                      x={facadeInsetX}
                      y={facadeInsetY}
                      width={safeWidth}
                      height={safeHeight}
                      className="facade-outline"
                    />
                  </svg>
                </div>

                {openingXAxisControls.length > 0 ? (
                  <div className="opening-distance-panel" aria-label="Положение проемов от нуля">
                    <div className="opening-distance-head">
                      <span>Положение проемов по X от 0, мм</span>
                      {windowOpeningMarkers.length > 1 ? (
                        <div className="opening-distance-actions">
                          <label>
                            <input type="checkbox" checked={false} onChange={alignWindowsByY} />
                            выровнять оконные проемы по Y
                          </label>
                          <label>
                            <input type="checkbox" checked={false} onChange={distributeWindowsByX} />
                            распределить оконные проемы по X
                          </label>
                        </div>
                      ) : null}
                    </div>
                    <div className="opening-distance-grid">
                      {openingXAxisControls.map((control) => (
                        <label className="opening-distance-field" key={control.key}>
                          <span>{control.label}</span>
                          <input
                            className="input"
                            defaultValue={control.value}
                            inputMode="numeric"
                            key={`${control.key}-${control.value}`}
                            min={0}
                            type="number"
                            onBlur={(event) => {
                              if (event.currentTarget.value.trim() === '') return
                              const distanceMm = parseMm(event.currentTarget.value)
                              control.onChange(Math.max(0, distanceMm))
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter' || event.currentTarget.value.trim() === '') return
                              event.currentTarget.blur()
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="visualization-stats">
                  <div>
                    <span>По длине</span>
                    <strong>
                      {layout.standardColumns} ст.
                      {layout.additionalColumnWidthMm > 0 ? ` + добор ${layout.additionalColumnWidthMm} мм` : ''}
                    </strong>
                  </div>
                  <div>
                    <span>По высоте</span>
                    <strong>
                      {layout.standardRows} ряд.
                      {layout.additionalRowHeightMm > 0 ? ` + добор ${layout.additionalRowHeightMm} мм` : ''}
                    </strong>
                  </div>
                  <div>
                    <span>На фасад</span>
                    <strong>{layout.perFacadePieces} шт</strong>
                  </div>
                  <div>
                    <span>Угловые кассеты</span>
                    <strong>{cornerZoneWidth > 0 ? `${cornerZoneWidth} мм слева/справа` : 'нет'}</strong>
                  </div>
                  <div>
                    <span>Проемы</span>
                    <strong>{openingItems.length > 0 ? `${openingItems.length} шт` : 'нет'}</strong>
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <section className="visualization-card">
          <div className="hint">Нет данных для визуализации. Проверьте размеры фасада и кассеты.</div>
        </section>
      )}
    </div>
  )
}

export default function App() {
  const [project, setProject] = useState<Project>(() => createQuickTestProject())
  const [uploadedPrice, setUploadedPrice] = useState<UploadedPriceData | null>(() => loadUploadedPriceData())
  const [sharedPrice, setSharedPrice] = useState<UploadedPriceData | null>(null)
  const [sharedPriceStatus, setSharedPriceStatus] = useState<'loading' | 'ready' | 'missing' | 'invalid'>('loading')
  const [priceUploadMessage, setPriceUploadMessage] = useState('')
  const [methodologyOpen, setMethodologyOpen] = useState(false)
  const [visualizationOpen, setVisualizationOpen] = useState(false)
  const [cornerHeightMode, setCornerHeightMode] = useState<'auto' | 'manual'>('auto')
  const [manualCornerHeight, setManualCornerHeight] = useState<number>(maxFacadeHeight(createQuickTestProject().facades))
  const [cassetteSizeL, setCassetteSizeL] = useState('572')
  const [cassetteSizeH, setCassetteSizeH] = useState('567')
  const [cassetteCoating, setCassetteCoating] = useState<'polyester' | 'colorflow'>('colorflow')
  const [standardSelectionMode, setStandardSelectionMode] = useState<'none' | 'length' | 'height'>('none')
  const [subsystemBracketStepMm, setSubsystemBracketStepMm] = useState(600)
  const [facadesHelpOpen, setFacadesHelpOpen] = useState(false)
  const [cornersHelpOpen, setCornersHelpOpen] = useState(false)
  const [subsystemTypeHelpOpen, setSubsystemTypeHelpOpen] = useState(false)
  const [pLevelsHelpOpen, setPLevelsHelpOpen] = useState(false)
  const [cassettesHelpOpen, setCassettesHelpOpen] = useState(false)
  const [insulationHelpOpen, setInsulationHelpOpen] = useState(false)
  const [specHelpOpen, setSpecHelpOpen] = useState(false)
  const [pendingCostsHelpOpen, setPendingCostsHelpOpen] = useState(false)
  const activePrice = uploadedPrice ?? sharedPrice
  const activePriceSource = uploadedPrice ? 'local' : sharedPrice ? 'shared' : 'builtin'
  const uploadedPriceIndex = useMemo(
    () => buildUploadedPriceIndex(activePrice?.rows ?? []),
    [activePrice],
  )
  const applyUploadedPrice = <T extends CatalogItemWithPrice>(item: T | null | undefined): T | null => {
    if (!item) return null
    const uploaded = uploadedPriceIndex.get(normalizePriceCode(item.code))
    return uploaded && priceUnitsAreCompatible(uploaded.unit, item.unit)
      ? { ...item, name: uploaded.name || item.name, price: uploaded.price }
      : item
  }

  useEffect(() => {
    let cancelled = false

    async function loadSharedPrice() {
      try {
        const response = await fetch(sharedPriceUrl, { cache: 'no-store' })
        if (!response.ok) {
          if (!cancelled) setSharedPriceStatus('missing')
          return
        }

        const parsed = parseSharedPriceData(await response.json())
        if (!cancelled) {
          if (parsed) {
            setSharedPrice(parsed)
            setSharedPriceStatus('ready')
          } else {
            setSharedPrice(null)
            setSharedPriceStatus('invalid')
          }
        }
      } catch {
        if (!cancelled) setSharedPriceStatus('missing')
      }
    }

    void loadSharedPrice()

    return () => {
      cancelled = true
    }
  }, [])

  const activeCassettePriceCatalog = useMemo(
    () =>
      cassettePriceCatalog.map((item) => {
        const uploaded = uploadedPriceIndex.get(normalizePriceCode(item.code))
        return uploaded && priceUnitsAreCompatible(uploaded.unit, item.unit)
          ? { ...item, name: uploaded.name || item.name, price: uploaded.price }
          : item
      }),
    [uploadedPriceIndex],
  )
  const findSubsystemPriceItem = (
    family: string,
    coating: 'galvanized' | 'colorflow_1s' | 'colorflow_2s' | 'none',
  ) => applyUploadedPrice(subsystemPriceItems.find((item) => item.family === family && item.coating === coating))
  const findSubsystemPriceItemByKey = (key: string) =>
    applyUploadedPrice(subsystemPriceItems.find((item) => item.key === key))
  const findTrimPriceItemByKey = (key: string) =>
    applyUploadedPrice(trimPriceItems.find((item) => item.key === key))
  const pickKvguPriceItem = (requiredReachMm: number, coating: 'galvanized' | 'colorflow_2s') => {
    const selected = pickKvguPriceItemByStaticCatalog(requiredReachMm, coating)
    return selected ? { ...selected, item: applyUploadedPrice(selected.item) ?? selected.item } : null
  }

  useMemo(() => calculateProjectGeometry(project), [project])
  const autoCornerHeight = maxFacadeHeight(project.facades)
  const cornerHeight = cornerHeightMode === 'auto' ? autoCornerHeight : manualCornerHeight
  const hasOutsideCorners = project.outsideCorners > 0
  const cornerSubsystemProjectionMm = hasOutsideCorners ? getCornerSubsystemProjectionMm(project) : 0
  const subsystemFinishMode = getSubsystemFinishMode(project)
  const cassetteStandardSizes = getCassetteStandardSizes(project.selectedCassetteType)
  const cassetteSizeLimits = getCassetteSizeLimits(project.selectedCassetteType)
  const cassetteNumericLimits = getCassetteNumericLimits(project.selectedCassetteType)
  const cassetteStandardRule = getCassetteStandardRule(project.selectedCassetteType)
  const availableCassetteThicknesses = getAvailableCassetteThicknesses(project.selectedCassetteType)
  const cassetteRustMm = getCassetteRustMm(project.selectedCassetteType)
  const cassetteLayoutOverlap = getCassetteLayoutOverlap(project.selectedCassetteType)
  const economicalCassetteSize = findEconomicalCassetteSize(
    project.facades,
    project.hasCornerCassettes && hasOutsideCorners,
    cassetteStandardRule,
    cassetteNumericLimits,
    cassetteRustMm,
    cornerSubsystemProjectionMm,
    standardSelectionMode === 'length',
    standardSelectionMode === 'height',
    cassetteLayoutOverlap,
  )
  const cornerCassetteFamily = getCornerCassetteFamily(project.selectedCassetteType)
  const polyesterAvailable = project.cassetteThicknessMm === 0.7
  const autoCassetteSize =
    standardSelectionMode !== 'none' && economicalCassetteSize && Number.isFinite(economicalCassetteSize.score)
      ? economicalCassetteSize
      : null
  const effectiveCassetteSizeL = autoCassetteSize ? String(autoCassetteSize.l) : cassetteSizeL
  const effectiveCassetteSizeH = autoCassetteSize ? String(autoCassetteSize.h) : cassetteSizeH
  const cassetteLValue = Number(effectiveCassetteSizeL)
  const cassetteHValue = Number(effectiveCassetteSizeH)
  const cassetteTypeResult =
    Number.isFinite(cassetteLValue) &&
    cassetteLValue > 0 &&
    Number.isFinite(cassetteHValue) &&
    cassetteHValue > 0
      ? cassetteStandardRule.standardL.includes(cassetteLValue) ||
        cassetteStandardRule.standardH.includes(cassetteHValue)
        ? 'Стандартная'
        : 'Доборная'
      : 'Не определена'
  const matchedCassetteRole =
    cassetteTypeResult === 'Стандартная'
      ? 'standard'
      : cassetteTypeResult === 'Доборная'
        ? 'additional'
        : null
  const matchedCassetteCoating = cassetteCoating === 'colorflow' ? 'colorflow_1s' : 'polyester'
  const matchedCassettePriceItem = matchedCassetteRole
    ? activeCassettePriceCatalog.find(
        (item) =>
          item.family === cassetteCodeToFamily(project.selectedCassetteType) &&
          item.role === matchedCassetteRole &&
          item.thickness === project.cassetteThicknessMm &&
          item.coating === matchedCassetteCoating,
      )
    : null
  const standardCassettePriceItem = activeCassettePriceCatalog.find(
    (item) =>
      item.family === cassetteCodeToFamily(project.selectedCassetteType) &&
      item.role === 'standard' &&
      item.thickness === project.cassetteThicknessMm &&
      item.coating === matchedCassetteCoating,
  )
  const additionalCassettePriceItem = activeCassettePriceCatalog.find(
    (item) =>
      item.family === cassetteCodeToFamily(project.selectedCassetteType) &&
      item.role === 'additional' &&
      item.thickness === project.cassetteThicknessMm &&
      item.coating === matchedCassetteCoating,
  )
  const cornerHeightLayout = calculateCassetteRowsAlongHeight(
    cornerHeight,
    cassetteHValue,
    cassetteRustMm,
    cassetteLayoutOverlap?.verticalMm ?? 0,
  )
  const cornerCassettePerCornerCount = cornerHeightLayout.totalRows
  const totalCornerCassetteCount = project.hasCornerCassettes && hasOutsideCorners ? project.outsideCorners * cornerCassettePerCornerCount : 0
  const matchedCornerCassettePriceItem = project.hasCornerCassettes && hasOutsideCorners
    ? applyUploadedPrice(cornerCassettePriceCatalog.find(
        (item) =>
          item.family === cornerCassetteFamily &&
          item.thickness === project.cassetteThicknessMm &&
          item.coating === matchedCassetteCoating,
      ))
    : null
  const cornerCassettePreview =
    project.hasCornerCassettes &&
    hasOutsideCorners &&
    Number.isFinite(cassetteLValue) &&
    cassetteLValue > 0 &&
    Number.isFinite(cassetteHValue) &&
    cassetteHValue > 0
      ? project.facades.map((facade) => ({
          facadeId: facade.id,
          facadeName: facade.name,
          facadeQuantity: facade.quantity,
          calculation: calculateCornerCassetteByFacade(
            facade.widthMm + cornerSubsystemProjectionMm * 2,
            cassetteLValue,
            cassetteRustMm,
            cornerSubsystemProjectionMm,
            200,
            700,
            cassetteLayoutOverlap?.horizontalMm ?? 0,
          ),
        }))
      : []
  const regularCassettePreview =
    Number.isFinite(cassetteLValue) &&
    cassetteLValue > 0 &&
    Number.isFinite(cassetteHValue) &&
    cassetteHValue > 0
      ? project.facades.map((facade) => {
          const cassetteFieldWidthMm =
            project.hasCornerCassettes && hasOutsideCorners
              ? facade.widthMm + cornerSubsystemProjectionMm * 2
              : facade.widthMm
          const cornerLengthLayout =
            project.hasCornerCassettes && hasOutsideCorners
              ? calculateCornerCassetteByFacade(
                  cassetteFieldWidthMm,
                  cassetteLValue,
                  cassetteRustMm,
                  cornerSubsystemProjectionMm,
                  200,
                  700,
                  cassetteLayoutOverlap?.horizontalMm ?? 0,
                )
              : null
          const lengthLayout =
            project.hasCornerCassettes && hasOutsideCorners
              ? {
                  standardColumns: cornerLengthLayout?.rowCassetteCount ?? 0,
                  additionalWidthMm: 0,
                  totalColumns: cornerLengthLayout?.rowCassetteCount ?? 0,
                }
              : calculateCassetteColumnsAlongLength(
                  cassetteFieldWidthMm,
                  cassetteLValue,
                  cassetteRustMm,
                  cassetteNumericLimits.l.min,
                  cassetteLayoutOverlap?.horizontalMm ?? 0,
                )
          const columns = lengthLayout.totalColumns
          const heightLayout = calculateCassetteRowsAlongHeight(
            facade.heightMm,
            cassetteHValue,
            cassetteRustMm,
            cassetteLayoutOverlap?.verticalMm ?? 0,
          )
          const perFacadePieces = lengthLayout.totalColumns * heightLayout.totalRows
          const totalPieces = perFacadePieces * facade.quantity
          const cassetteAreaM2 = (cassetteLValue * cassetteHValue) / 1_000_000
          const additionalRowAreaM2 = (cassetteLValue * heightLayout.additionalHeightMm) / 1_000_000
          const isMainSizeStandard =
            cassetteStandardRule.standardL.includes(cassetteLValue) || cassetteStandardRule.standardH.includes(cassetteHValue)
          const mainPieces = lengthLayout.standardColumns * heightLayout.standardRows * facade.quantity
          const lengthAdditionalPieces =
            lengthLayout.additionalWidthMm > 0 ? heightLayout.standardRows * facade.quantity : 0
          const heightAdditionalPieces = heightLayout.additionalHeightMm > 0 ? lengthLayout.standardColumns * facade.quantity : 0
          const cornerAdditionalPieces =
            lengthLayout.additionalWidthMm > 0 && heightLayout.additionalHeightMm > 0 ? facade.quantity : 0
          const standardPieces = isMainSizeStandard ? mainPieces : 0
          const additionalPieces =
            (isMainSizeStandard ? 0 : mainPieces) + lengthAdditionalPieces + heightAdditionalPieces + cornerAdditionalPieces
          const standardAreaM2 = standardPieces * cassetteAreaM2
          const additionalAreaM2 =
            (isMainSizeStandard ? 0 : mainPieces * cassetteAreaM2) +
            lengthAdditionalPieces * ((lengthLayout.additionalWidthMm * cassetteHValue) / 1_000_000) +
            heightAdditionalPieces * additionalRowAreaM2 +
            cornerAdditionalPieces * ((lengthLayout.additionalWidthMm * heightLayout.additionalHeightMm) / 1_000_000)

          return {
            facadeId: facade.id,
            facadeName: facade.name,
            facadeQuantity: facade.quantity,
            columns,
            standardColumns: lengthLayout.standardColumns,
            additionalColumnWidthMm: lengthLayout.additionalWidthMm,
            rows: heightLayout.totalRows,
            standardRows: heightLayout.standardRows,
            additionalRowHeightMm: heightLayout.additionalHeightMm,
            perFacadePieces,
            totalPieces,
            totalAreaM2:
              mainPieces * cassetteAreaM2 +
              lengthAdditionalPieces * ((lengthLayout.additionalWidthMm * cassetteHValue) / 1_000_000) +
              heightAdditionalPieces * additionalRowAreaM2 +
              cornerAdditionalPieces * ((lengthLayout.additionalWidthMm * heightLayout.additionalHeightMm) / 1_000_000),
            standardPieces,
            additionalPieces,
            standardAreaM2,
            additionalAreaM2,
          }
        })
      : []
  const totalRegularCassettePieces = regularCassettePreview.reduce((sum, item) => sum + item.totalPieces, 0)
  const totalRegularCassetteAreaM2 = regularCassettePreview.reduce((sum, item) => sum + item.totalAreaM2, 0)
  const totalStandardCassettePieces = regularCassettePreview.reduce((sum, item) => sum + item.standardPieces, 0)
  const totalAdditionalCassettePieces = regularCassettePreview.reduce((sum, item) => sum + item.additionalPieces, 0)
  const totalStandardCassetteAreaM2 = regularCassettePreview.reduce((sum, item) => sum + item.standardAreaM2, 0)
  const totalAdditionalCassetteAreaM2 = regularCassettePreview.reduce((sum, item) => sum + item.additionalAreaM2, 0)
  const kf1FastenersPerJointByHeight = 4
  const kf4FastenersPerPiece = cassetteLValue > 800 ? 6 : 4
  const kf1VisibleFastenerPieces = regularCassettePreview.reduce((sum, facade) => {
    const verticalFastenerLines = facade.columns + 1
    const standardRowFasteners = facade.standardRows * kf1FastenersPerJointByHeight
    const additionalRowFasteners = facade.additionalRowHeightMm > 0 ? kf1FastenersPerJointByHeight : 0

    return sum + verticalFastenerLines * (standardRowFasteners + additionalRowFasteners) * facade.facadeQuantity
  }, 0)
  const subsystemCoating = subsystemFinishMode === 'painted' ? 'colorflow_2s' : 'galvanized'
  const subsystemIsG = project.subsystem.code === 'standard_g'
  const subsystemIsPSingleLevel = project.subsystem.code === 'standard_p_vertical'
  const subsystemIsPDoubleLevel = project.subsystem.code === 'standard_p_double_level'
  const cassetteNeedsVisibleColoredVerticalProfile =
    subsystemIsG && (project.selectedCassetteType === 'КФ-2' || project.selectedCassetteType === 'КФ-3')
  const cassetteNeedsVisibleColoredGuide =
    subsystemIsPSingleLevel && (project.selectedCassetteType === 'КФ-2' || project.selectedCassetteType === 'КФ-3')
  const requiresIntermediateVerticalProfile = cassetteLValue > 800
  const intermediateProfilesPerCassetteBay = requiresIntermediateVerticalProfile ? Math.max(1, Math.ceil(cassetteLValue / 600) - 1) : 0
  const hiddenCassetteFastenersPerPiece = cassetteLValue > 799 ? 3 : 2
  const subsystemMaxBracketLengthMm = getMaxBracketLengthForSubsystem(project.subsystem.code)
  const subsystemMaxInsulationThicknessMm = Math.max(
    0,
    subsystemMaxBracketLengthMm - project.subsystem.airGapMm - subsystemBracketMountReserveMm,
  )
  const effectiveInsulationThicknessMm = project.insulation.enabled ? project.insulation.thicknessMm : 0
  const subsystemRequiredReachMm = effectiveInsulationThicknessMm + project.subsystem.airGapMm
  const subsystemSelectedKvgu = subsystemIsG ? pickKvguPriceItem(subsystemRequiredReachMm, subsystemCoating) : null
  const subsystemSelectedKvguSeries = subsystemSelectedKvgu?.series ?? null
  const subsystemSelectedParoniteItem =
    subsystemIsG && subsystemSelectedKvguSeries === 95
      ? findSubsystemPriceItemByKey('paronite-gasket-kvgu-95-engineering')
      : findSubsystemPriceItem('paronite_gasket', 'none')
  const subsystemInsulationExceeded = project.insulation.enabled && project.insulation.thicknessMm > subsystemMaxInsulationThicknessMm
  const subsystemFacadeLayouts = project.facades.map((facade) => {
    const cassetteLayout = regularCassettePreview.find((item) => item.facadeId === facade.id)
    const verticalLines = cassetteLayout
      ? Math.max(2, cassetteLayout.columns + 1)
      : Math.max(2, Math.ceil(facade.widthMm / 800) + 1)
    const horizontalGuideRows = Math.max(2, Math.ceil(facade.heightMm / maxSubsystemVerticalProfileStepMm) + 1)
    const bracketRows = calculateBracketRowsAlongProfile(
      facade.heightMm,
      subsystemBracketStepMm,
      subsystemEdgeBracketOffsetMm,
    )
    const profilePiecesPerLine = Math.ceil(facade.heightMm / subsystemProfileStockLengthMm)

    return {
      facadeId: facade.id,
      facadeName: facade.name,
      facadeQuantity: facade.quantity,
      verticalLines,
      seamVisibleLines: verticalLines,
      outerCornerLines: subsystemIsG ? (project.outsideCorners > 0 ? Math.min(project.outsideCorners, 2) : 0) : 0,
      intermediateLines:
        cassetteLayout && requiresIntermediateVerticalProfile
          ? cassetteLayout.columns * facade.quantity * intermediateProfilesPerCassetteBay
          : 0,
      horizontalGuideRows,
      bracketRows,
      profilePiecesPerLine,
      totalProfilePieces: profilePiecesPerLine * verticalLines * facade.quantity,
      verticalProfileLm: (verticalLines * facade.heightMm * facade.quantity) / 1000,
      horizontalProfileByBracketRowsLm: (bracketRows * facade.widthMm * facade.quantity) / 1000,
      horizontalGuideLm: (horizontalGuideRows * facade.widthMm * facade.quantity) / 1000,
      bracketPieces: verticalLines * bracketRows * facade.quantity,
    }
  })
  const subsystemVerticalProfileLm = subsystemFacadeLayouts.reduce((sum, item) => sum + item.verticalProfileLm, 0)
  const subsystemVerticalProfilePieces = subsystemFacadeLayouts.reduce((sum, item) => sum + item.totalProfilePieces, 0)
  const subsystemVisibleGuideLm = subsystemFacadeLayouts.reduce(
    (sum, item) => sum + (item.seamVisibleLines * project.facades.find((facade) => facade.id === item.facadeId)!.heightMm * item.facadeQuantity) / 1000,
    0,
  )
  const subsystemPOuterCornerGuideLm =
    (subsystemIsPSingleLevel || subsystemIsPDoubleLevel) && project.outsideCorners > 0
      ? (project.outsideCorners * cornerHeight * 2) / 1000
      : 0
  const subsystemPInnerCornerGuideLm =
    (subsystemIsPSingleLevel || subsystemIsPDoubleLevel) && project.insideCorners > 0
      ? (project.insideCorners * cornerHeight * 2) / 1000
      : 0
  const subsystemPOuterCornerNpshLm =
    subsystemIsPDoubleLevel && project.outsideCorners > 0
      ? (project.outsideCorners * cornerHeight * 2) / 1000
      : 0
  const subsystemPInnerCornerNpshLm =
    subsystemIsPDoubleLevel && project.insideCorners > 0
      ? (project.insideCorners * cornerHeight * 2) / 1000
      : 0
  const subsystemOuterCornerVerticalLm = subsystemIsG
    ? (project.outsideCorners * cornerHeight) / 1000
    : 0
  const subsystemIntermediateGuideLm = subsystemFacadeLayouts.reduce(
    (sum, item) => sum + (item.intermediateLines * project.facades.find((facade) => facade.id === item.facadeId)!.heightMm) / 1000,
    0,
  )
  const subsystemGHorizontalProfileLm = subsystemFacadeLayouts.reduce(
    (sum, item) => sum + item.horizontalProfileByBracketRowsLm,
    0,
  )
  const subsystemHorizontalGuideLm = subsystemFacadeLayouts.reduce((sum, item) => sum + item.horizontalGuideLm, 0)
  const subsystemBracketPieces = subsystemFacadeLayouts.reduce((sum, item) => sum + item.bracketPieces, 0)
  const subsystemGHorizontalRivetPieces = subsystemBracketPieces * 2
  const subsystemGVerticalLinePieces = subsystemFacadeLayouts.reduce(
    (sum, item) => sum + item.verticalLines * item.bracketRows * item.facadeQuantity,
    0,
  )
  const subsystemGVerticalRivetPieces = subsystemGVerticalLinePieces * 2
  const subsystemGIntermediateRivetPieces =
    requiresIntermediateVerticalProfile
      ? subsystemFacadeLayouts.reduce((sum, item) => sum + item.intermediateLines * item.bracketRows, 0) * 2
      : 0
  const subsystemGOuterCornerRivetPieces = project.outsideCorners > 0 ? project.outsideCorners * 2 : 0
  const subsystemPSingleCornerRivetPieces =
    Math.ceil((subsystemPOuterCornerGuideLm + subsystemPInnerCornerGuideLm) * 1000 / subsystemProfileStockLengthMm) * 4
  const subsystemPDoubleCornerGuideRivetPieces =
    Math.ceil((subsystemPOuterCornerGuideLm + subsystemPInnerCornerGuideLm) * 1000 / subsystemProfileStockLengthMm) * 4
  const subsystemPDoubleCornerNpshRivetPieces =
    Math.ceil((subsystemPOuterCornerNpshLm + subsystemPInnerCornerNpshLm) * 1000 / subsystemProfileStockLengthMm) * 4
  const subsystemRivetPieces = subsystemIsPSingleLevel
    ? subsystemBracketPieces * 2 + subsystemPSingleCornerRivetPieces
    : subsystemIsPDoubleLevel
      ? subsystemBracketPieces * 4 + subsystemPDoubleCornerGuideRivetPieces + subsystemPDoubleCornerNpshRivetPieces
      : subsystemGHorizontalRivetPieces +
        Math.ceil(subsystemGVerticalRivetPieces) +
        Math.ceil(subsystemGIntermediateRivetPieces) +
        subsystemGOuterCornerRivetPieces
  const openingRows = project.facades.flatMap((facade) =>
    facade.hasOpenings
      ? facade.openings.map((opening) => ({
          ...opening,
          facadeQuantity: facade.quantity,
          totalQuantity: facade.quantity * opening.quantity,
          frameWidthMm: opening.widthMm + 200,
          frameHeightMm: opening.heightMm + 200,
          intermediateVerticals: opening.widthMm > 1200 ? Math.max(1, Math.ceil(opening.widthMm / 1200) - 1) : 0,
        }))
      : [],
  )
  const openingCountTotal = openingRows.reduce((sum, opening) => sum + opening.totalQuantity, 0)
  const openingFrameProfileLm = openingRows.reduce(
    (sum, opening) =>
      sum +
      ((2 * opening.frameHeightMm + 2 * opening.frameWidthMm + opening.intermediateVerticals * opening.frameHeightMm) /
        1000) *
        opening.totalQuantity,
    0,
  )
  const openingIntermediateVerticalCount = openingRows.reduce(
    (sum, opening) => sum + opening.intermediateVerticals * opening.totalQuantity,
    0,
  )
  const openingSideRevealLm = openingRows.reduce(
    (sum, opening) => sum + ((2 * opening.heightMm) / 1000) * opening.totalQuantity,
    0,
  )
  const openingTopRevealLm = openingRows.reduce(
    (sum, opening) => sum + (opening.widthMm / 1000) * opening.totalQuantity,
    0,
  )
  const openingBottomRevealLm = openingTopRevealLm
  const openingTrimRequiredDepthMm = getCornerSubsystemProjectionMm(project) + project.cassetteThicknessMm + openingTrimReturnReserveMm
  const openingSlopeElementKey = pickOpeningSlopeElementKey(openingTrimRequiredDepthMm)
  const openingDripKey = pickOpeningDripKey(openingTrimRequiredDepthMm)
  const openingSlopeElementOversized = openingTrimRequiredDepthMm > 260
  const openingDripOversized = openingTrimRequiredDepthMm > 250
  const openingAquilonLm = openingSideRevealLm + openingTopRevealLm
  const openingSlopeElementLm = openingSideRevealLm + openingTopRevealLm
  const openingTopFlashingLm = openingTopRevealLm
  const openingDripLm = openingBottomRevealLm
  const starterStripLm = project.facades.reduce((sum, facade) => sum + (facade.widthMm * facade.quantity) / 1000, 0)
  const starterStripKey =
    project.selectedCassetteType === 'КФ-2'
      ? 'starter-strip-kf2'
      : project.selectedCassetteType === 'КФ-3'
        ? 'starter-strip-kf3'
        : 'starter-strip-nps'
  const trimRowFromLength = (key: string, item: string, requiredLm: number) => {
    const priceItem = findTrimPriceItemByKey(key)
    const pieces = priceItem ? roundUpToStockPieces(requiredLm, priceItem.standardLengthMm) : 0

    return {
      key,
      item,
      requiredLm,
      pieces,
      priceItem,
      totalPrice: priceItem?.price ? pieces * priceItem.price : null,
    }
  }
  const cassetteHasVisibleFastening =
    project.selectedCassetteType === 'КФ-1' ||
    project.selectedCassetteType === 'КФ-4 (30)' ||
    project.selectedCassetteType === 'КФ-4 (17)'
  const outerCornerTrimKey = cassetteHasVisibleFastening ? 'outer-angle-uns-visible' : 'outer-angle-usns'
  const innerCornerTrimKey = cassetteHasVisibleFastening ? 'inner-angle-uvs-visible' : 'inner-angle-usvs'
  const trimRows = [
    ...(!project.hasCornerCassettes && project.outsideCorners > 0
      ? [
          trimRowFromLength(
            outerCornerTrimKey,
            cassetteHasVisibleFastening
              ? 'Уголок наружный УНс вместо угловой кассеты'
              : 'Угол наружный УСНс вместо угловой кассеты',
            (project.outsideCorners * cornerHeight) / 1000,
          ),
        ]
      : []),
    ...(project.insideCorners > 0
      ? [
          trimRowFromLength(
            innerCornerTrimKey,
            cassetteHasVisibleFastening ? 'Уголок внутренний УВс' : 'Угол внутренний УСВс',
            (project.insideCorners * cornerHeight) / 1000,
          ),
        ]
      : []),
    ...(openingAquilonLm > 0 ? [trimRowFromLength('aquilon-aks', 'Аквилон откосов проемов', openingAquilonLm)] : []),
    ...(openingSlopeElementLm > 0
      ? [
          trimRowFromLength(
            openingSlopeElementKey,
            `Откосный элемент проемов, глубина ${Math.round(openingTrimRequiredDepthMm)} мм`,
            openingSlopeElementLm,
          ),
        ]
      : []),
    ...(openingTopFlashingLm > 0 ? [trimRowFromLength('top-flashing-ovs', 'Отлив верхний проемов', openingTopFlashingLm)] : []),
    ...(openingDripLm > 0
      ? [
          trimRowFromLength(
            openingDripKey,
            `Водоотлив нижнего откоса, глубина ${Math.round(openingTrimRequiredDepthMm)} мм`,
            openingDripLm,
          ),
        ]
      : []),
    ...(starterStripLm > 0 ? [trimRowFromLength(starterStripKey, 'Планка начальная облицовки', starterStripLm)] : []),
  ].filter((row) => row.requiredLm > 0)
  const trimSpecTotalPrice = trimRows.reduce((sum, row) => sum + (row.totalPrice ?? 0), 0)
  const starterStripFastenerPieces = subsystemFacadeLayouts.reduce(
    (sum, facade) => sum + facade.verticalLines * facade.facadeQuantity,
    0,
  )
  const openingTrimFastenerPieces = openingRows.reduce((sum, opening) => {
    const verticalSideFasteners = 2 * countFastenersOnLine(opening.heightMm, trimSideFastenerStepMm)
    const topFasteners = countFastenersOnLine(opening.widthMm, trimTopFastenerStepMm)
    const bottomFasteners = countFastenersOnLine(opening.widthMm, trimTopFastenerStepMm)

    return sum + (verticalSideFasteners * 2 + topFasteners * 3 + bottomFasteners) * opening.totalQuantity
  }, 0)
  const outerCornerTrimFastenerPieces =
    !project.hasCornerCassettes && project.outsideCorners > 0
      ? project.outsideCorners * countFastenersOnLine(cornerHeight, trimSideFastenerStepMm)
      : 0
  const innerCornerTrimFastenerPieces =
    project.insideCorners > 0 ? project.insideCorners * countFastenersOnLine(cornerHeight, trimSideFastenerStepMm) : 0
  const cornerTrimFastenerPieces = outerCornerTrimFastenerPieces + innerCornerTrimFastenerPieces
  const visibleCornerTrimFastenerPieces = cassetteHasVisibleFastening ? cornerTrimFastenerPieces : 0
  const hiddenCornerTrimFastenerPieces = cassetteHasVisibleFastening ? 0 : cornerTrimFastenerPieces
  const trimScrewPieces = starterStripFastenerPieces + openingTrimFastenerPieces + hiddenCornerTrimFastenerPieces
  const facadeGrossAreaM2 = project.facades.reduce(
    (sum, facade) => sum + (facade.widthMm * facade.heightMm * facade.quantity) / 1_000_000,
    0,
  )
  const openingAreaM2 = openingRows.reduce(
    (sum, opening) => sum + (opening.widthMm * opening.heightMm * opening.totalQuantity) / 1_000_000,
    0,
  )
  const insulationAreaM2 = project.insulation.enabled ? Math.max(0, facadeGrossAreaM2 - openingAreaM2) : 0
  const openingInsulationBorderAreaM2 = openingRows.reduce(
    (sum, opening) => sum + ((2 * (opening.widthMm + opening.heightMm)) / 1000) * 0.15 * opening.totalQuantity,
    0,
  )
  const insulationVolumeM3 = project.insulation.enabled ? (insulationAreaM2 * project.insulation.thicknessMm) / 1000 : 0
  const openingInsulationBorderVolumeM3 = project.insulation.enabled
    ? (openingInsulationBorderAreaM2 * project.insulation.thicknessMm) / 1000
    : 0
  const membraneAreaM2 = project.insulation.enabled && project.insulation.membrane ? insulationAreaM2 : 0
  const membraneAreaWithOverlapM2 = membraneAreaM2 * membraneOverlapFactor
  const membraneRolls =
    project.insulation.enabled && project.insulation.membrane ? Math.ceil(membraneAreaWithOverlapM2 / membraneRollAreaM2) : 0
  const membraneTotalPrice = membraneAreaWithOverlapM2 * membranePriceItem.price
  const insulationDowelRatePerM2 = project.insulation.layers === 2 ? 10 : 5
  const insulationDowelPieces =
    project.insulation.enabled ? Math.ceil((insulationAreaM2 + openingInsulationBorderAreaM2) * insulationDowelRatePerM2) : 0
  const openingFrameProfilePriceItem = subsystemIsG
    ? subsystemCoating === 'colorflow_2s'
      ? findSubsystemPriceItemByKey('npg-50-1-5-colorflow')
      : findSubsystemPriceItemByKey('npg-50-1-5-galvanized')
    : findSubsystemPriceItem('npp', subsystemCoating)
  const subsystemRowsBase = subsystemIsPSingleLevel
    ? [
        {
          key: 'bracket',
          item: 'Кронштейн П-образный',
          qty: subsystemBracketPieces,
          unit: 'pcs' as PriceUnit,
          priceItem: findSubsystemPriceItem('kvp', subsystemCoating),
        },
        {
          key: 'visible-guide',
          item: cassetteNeedsVisibleColoredGuide
            ? 'Видимая направляющая НПП 60x27 в шве'
            : 'Вертикальная направляющая НПП 60x27',
          qty: cassetteNeedsVisibleColoredGuide ? subsystemVisibleGuideLm : subsystemVerticalProfileLm,
          unit: 'lm' as PriceUnit,
          priceItem: cassetteNeedsVisibleColoredGuide
            ? findSubsystemPriceItem('npp', subsystemFinishMode === 'painted' ? 'colorflow_2s' : 'colorflow_1s')
            : findSubsystemPriceItem('npp', subsystemCoating),
        },
        ...(cassetteNeedsVisibleColoredGuide && subsystemIntermediateGuideLm > 0
          ? [
              {
                key: 'intermediate-guide',
                item: 'Промежуточный вертикальный профиль',
                qty: subsystemIntermediateGuideLm,
                unit: 'lm' as PriceUnit,
                priceItem: findSubsystemPriceItem('npp', subsystemCoating),
              },
            ]
          : []),
        ...(subsystemPOuterCornerGuideLm > 0
          ? [
              {
                key: 'outer-corner-guide',
                item: 'Дополнительная угловая направляющая НПП 60x27 наружного угла',
                qty: subsystemPOuterCornerGuideLm,
                unit: 'lm' as PriceUnit,
                priceItem: findSubsystemPriceItem('npp', subsystemCoating),
              },
            ]
          : []),
        ...(subsystemPInnerCornerGuideLm > 0
          ? [
              {
                key: 'inner-corner-guide',
                item: 'Дополнительная угловая направляющая НПП 60x27 внутреннего угла',
                qty: subsystemPInnerCornerGuideLm,
                unit: 'lm' as PriceUnit,
                priceItem: findSubsystemPriceItem('npp', subsystemCoating),
              },
            ]
          : []),
        {
          key: 'rivet',
          item: 'Заклепки крепления направляющей к кронштейну',
          qty: subsystemRivetPieces,
          unit: 'pcs' as PriceUnit,
          priceItem: findSubsystemPriceItem('rivet', 'none'),
        },
        {
          key: 'washer',
          item: 'Шайба усиления кронштейна',
          qty: subsystemBracketPieces,
          unit: 'pcs' as PriceUnit,
          priceItem: findSubsystemPriceItem('bracket_washer', subsystemCoating),
        },
        {
          key: 'paronite',
          item: 'Паронитовая прокладка',
          qty: subsystemBracketPieces,
          unit: 'pcs' as PriceUnit,
          priceItem: findSubsystemPriceItem('paronite_gasket', 'none'),
        },
      ]
    : subsystemIsPDoubleLevel
      ? [
          {
            key: 'bracket',
            item: 'Кронштейн П-образный',
            qty: subsystemBracketPieces,
            unit: 'pcs' as PriceUnit,
            priceItem: findSubsystemPriceItem('kvp', subsystemCoating),
          },
          {
            key: 'vertical-guide',
            item: 'Вертикальная направляющая НПП 60x27',
            qty: subsystemVerticalProfileLm,
            unit: 'lm' as PriceUnit,
            priceItem: findSubsystemPriceItem('npp', subsystemCoating),
          },
          {
            key: 'horizontal-guide',
            item: 'Горизонтальная направляющая НПП 60x27',
            qty: subsystemHorizontalGuideLm,
            unit: 'lm' as PriceUnit,
            priceItem: findSubsystemPriceItem('npp', subsystemCoating),
          },
          ...(subsystemPOuterCornerGuideLm > 0
            ? [
                {
                  key: 'outer-corner-guide',
                  item: 'Дополнительная угловая направляющая НПП 60x27 наружного угла',
                  qty: subsystemPOuterCornerGuideLm,
                  unit: 'lm' as PriceUnit,
                  priceItem: findSubsystemPriceItem('npp', subsystemCoating),
                },
              ]
            : []),
          ...(subsystemPInnerCornerGuideLm > 0
            ? [
                {
                  key: 'inner-corner-guide',
                  item: 'Дополнительная угловая направляющая НПП 60x27 внутреннего угла',
                  qty: subsystemPInnerCornerGuideLm,
                  unit: 'lm' as PriceUnit,
                  priceItem: findSubsystemPriceItem('npp', subsystemCoating),
                },
              ]
            : []),
          {
            key: 'npsh-main',
            item: 'Основной вертикальный профиль НПШ 20x80x20 1,0',
            qty: subsystemVerticalProfileLm,
            unit: 'lm' as PriceUnit,
            priceItem: findSubsystemPriceItemByKey(
              subsystemCoating === 'colorflow_2s' ? 'npsh-20-80-20-1-colorflow' : 'npsh-20-80-20-1-galvanized',
            ),
          },
          ...(subsystemPOuterCornerNpshLm > 0
            ? [
                {
                  key: 'outer-corner-npsh',
                  item: 'Дополнительный угловой профиль НПШ 20x80x20 1,0 наружного угла',
                  qty: subsystemPOuterCornerNpshLm,
                  unit: 'lm' as PriceUnit,
                  priceItem: findSubsystemPriceItemByKey(
                    subsystemCoating === 'colorflow_2s' ? 'npsh-20-80-20-1-colorflow' : 'npsh-20-80-20-1-galvanized',
                  ),
                },
              ]
            : []),
          ...(subsystemPInnerCornerNpshLm > 0
            ? [
                {
                  key: 'inner-corner-npsh',
                  item: 'Дополнительный угловой профиль НПШ 20x80x20 1,0 внутреннего угла',
                  qty: subsystemPInnerCornerNpshLm,
                  unit: 'lm' as PriceUnit,
                  priceItem: findSubsystemPriceItemByKey(
                    subsystemCoating === 'colorflow_2s' ? 'npsh-20-80-20-1-colorflow' : 'npsh-20-80-20-1-galvanized',
                  ),
                },
              ]
            : []),
          ...(cassetteLValue > 800
            ? [
                {
                  key: 'npsh-intermediate',
                  item: 'Промежуточный вертикальный профиль НПШ 20x80x20 1,0',
                  qty: subsystemIntermediateGuideLm,
                  unit: 'lm' as PriceUnit,
                  priceItem: findSubsystemPriceItemByKey(
                    subsystemCoating === 'colorflow_2s' ? 'npsh-20-80-20-1-colorflow' : 'npsh-20-80-20-1-galvanized',
                  ),
                },
              ]
            : []),
          {
            key: 'rivet',
            item: 'Заклепки подсистемы',
            qty: subsystemRivetPieces,
            unit: 'pcs' as PriceUnit,
            priceItem: findSubsystemPriceItem('rivet', 'none'),
          },
          {
            key: 'washer',
            item: 'Шайба усиления кронштейна',
            qty: subsystemBracketPieces,
            unit: 'pcs' as PriceUnit,
            priceItem: findSubsystemPriceItem('bracket_washer', subsystemCoating),
          },
          {
            key: 'paronite',
            item: 'Паронитовая прокладка',
            qty: subsystemBracketPieces,
            unit: 'pcs' as PriceUnit,
            priceItem: findSubsystemPriceItem('paronite_gasket', 'none'),
          },
        ]
    : [
        {
          key: 'bracket',
          item: subsystemSelectedKvgu
            ? `Кронштейн Г-образный ${subsystemSelectedKvgu.item.name.replace(/\s+\(Оцинк\.\)|\s+\(Колор-поток с двух сторон\)/, '')}`
            : 'Кронштейн Г-образный КВГУ',
          qty: subsystemBracketPieces,
          unit: 'pcs' as PriceUnit,
          priceItem: subsystemSelectedKvgu?.item ?? null,
        },
        {
          key: 'horizontal-profile',
          item: 'Горизонтальный профиль НПГ 50 1,5',
          qty: subsystemGHorizontalProfileLm,
          unit: 'lm' as PriceUnit,
          priceItem:
            subsystemCoating === 'colorflow_2s'
              ? findSubsystemPriceItemByKey('npg-50-1-5-colorflow')
              : findSubsystemPriceItemByKey('npg-50-1-5-galvanized'),
        },
        {
          key: 'vertical-profile',
          item: cassetteNeedsVisibleColoredVerticalProfile
            ? 'Основной вертикальный профиль НПШ 20x80x20 1,0 в шве'
            : 'Основной вертикальный профиль НПШ 20x80x20 1,0',
          qty: subsystemVerticalProfileLm,
          unit: 'lm' as PriceUnit,
          priceItem: findSubsystemPriceItemByKey(
            subsystemFinishMode === 'painted'
              ? 'npsh-20-80-20-1-colorflow'
              : cassetteNeedsVisibleColoredVerticalProfile
                ? 'npsh-20-80-20-1-colorflow'
              : 'npsh-20-80-20-1-galvanized',
          ),
        },
        ...(requiresIntermediateVerticalProfile
          ? [
              {
                key: 'vertical-profile-intermediate',
                item: 'Промежуточный вертикальный профиль НПШ 20x80x20 1,0',
                qty: subsystemIntermediateGuideLm,
                unit: 'lm' as PriceUnit,
                priceItem: findSubsystemPriceItemByKey(
                  subsystemCoating === 'colorflow_2s' ? 'npsh-20-80-20-1-colorflow' : 'npsh-20-80-20-1-galvanized',
                ),
              },
            ]
          : []),
        ...(project.outsideCorners > 0
          ? [
              {
                key: 'outer-corner-z',
                item: 'Вертикальный Z-профиль наружного угла 20х20х40х1,2',
                qty: subsystemOuterCornerVerticalLm,
                unit: 'lm' as PriceUnit,
                priceItem: findSubsystemPriceItemByKey('pz-outer-corner-engineering'),
              },
            ]
          : []),
        {
          key: 'rivet',
          item: 'Заклепки подсистемы',
          qty: subsystemRivetPieces,
          unit: 'pcs' as PriceUnit,
          priceItem: findSubsystemPriceItem('rivet', 'none'),
        },
        {
          key: 'paronite',
          item: 'Паронитовая прокладка',
          qty: subsystemBracketPieces,
          unit: 'pcs' as PriceUnit,
          priceItem: subsystemSelectedParoniteItem,
        },
      ]
  const subsystemRowsWithOpenings = [
    ...subsystemRowsBase,
    ...(openingFrameProfileLm > 0
      ? [
          {
            key: 'opening-frame-profile',
            item: subsystemIsG ? 'Профили рамки проемов НПГ 50 1,5' : 'Профили рамки проемов НПП 60x27',
            qty: openingFrameProfileLm,
            unit: 'lm' as PriceUnit,
            priceItem: openingFrameProfilePriceItem,
          },
        ]
      : []),
  ]
  const subsystemRows = subsystemRowsWithOpenings.map((row) => {
    const roundedQty =
      row.unit === 'lm' && (row.key === 'opening-frame-profile' || ['npp', 'npg', 'npsh', 'pz'].includes(row.priceItem?.family ?? ''))
        ? roundUpToStockLength(row.qty)
        : row.qty

    return {
      ...row,
      qty: roundedQty,
      totalPrice: row.priceItem?.price ? roundedQty * row.priceItem.price : null,
    }
  })
  const subsystemMaterialRows = subsystemRows.filter((row) => row.key !== 'rivet')
  const subsystemSpecTotalPrice = subsystemMaterialRows.reduce((sum, row) => sum + (row.totalPrice ?? 0), 0)
  const subsystemRivetPriceItem = findSubsystemPriceItem('rivet', 'none')
  const trimScrewPriceItem = findSubsystemPriceItemByKey('screw-4-2-16-galvanized')
  const hiddenCassetteScrewPriceItem = findSubsystemPriceItemByKey('screw-4-8-19-20-galvanized')
  const visibleCassetteScrewPriceItem = findSubsystemPriceItemByKey('screw-4-8-19-20-ral')
  const fastenerRows = [
    {
      key: 'subsystem-rivets',
      item: 'Заклепки 4,8х8',
      purpose: subsystemIsPSingleLevel
        ? 'крепление НПП к П-образным кронштейнам и угловым направляющим'
        : subsystemIsPDoubleLevel
          ? 'крепление НПП/НПШ в П-образной двухуровневой подсистеме'
          : 'крепление НПГ/НПШ и углового Z-профиля в Г-образной подсистеме',
      qtyText: formatInt(Math.ceil(subsystemRivetPieces)),
      unitText: 'шт',
      priceItem: subsystemRivetPriceItem,
      totalPrice: subsystemRivetPriceItem?.price ? Math.ceil(subsystemRivetPieces) * subsystemRivetPriceItem.price : null,
    },
    {
      key: 'subsystem-anchors',
      item: 'Анкерный крепеж',
      purpose: 'крепление кронштейнов подсистемы к основанию; 1 шт/кронштейн',
      qtyText: formatInt(Math.ceil(subsystemBracketPieces)),
      unitText: 'шт',
      priceItem: subsystemAnchorPriceItem,
      totalPrice: subsystemAnchorPriceItem.price ? Math.ceil(subsystemBracketPieces) * subsystemAnchorPriceItem.price : null,
    },
    ...(project.insulation.enabled
      ? [
          {
            key: 'insulation-dowels',
            item: 'Дюбели утеплителя',
            purpose: `крепление утеплителя; ${insulationDowelRatePerM2} шт/м² для ${project.insulation.layers === 2 ? 'двухслойного' : 'однослойного'} утепления`,
            qtyText: formatInt(insulationDowelPieces),
            unitText: 'шт',
            priceItem: insulationDowelPriceItem,
            totalPrice: insulationDowelPriceItem.price ? insulationDowelPieces * insulationDowelPriceItem.price : null,
          },
        ]
      : []),
    ...(trimScrewPieces > 0
      ? [
          {
            key: 'trim-screws',
            item: 'Саморезы 4,2х16',
            purpose: `крепление начальной планки по несущим профилям; аквилонов/откосов: боковые линии шаг ${trimSideFastenerStepMm} мм, верх и водоотлив шаг ${trimTopFastenerStepMm} мм; скрытых уголков УСНс/УСВс шаг ${trimSideFastenerStepMm} мм`,
            qtyText: formatInt(trimScrewPieces),
            unitText: 'шт',
            priceItem: trimScrewPriceItem,
            totalPrice: trimScrewPriceItem?.price ? trimScrewPieces * trimScrewPriceItem.price : null,
          },
        ]
      : []),
    ...(visibleCornerTrimFastenerPieces > 0
      ? [
          {
            key: 'visible-corner-trim-screws',
            item: 'Саморезы 4,8х20 с ЭПДМ',
            purpose: `открытое крепление уголков УНс/УВс; шаг ${trimSideFastenerStepMm} мм по высоте угла`,
            qtyText: formatInt(visibleCornerTrimFastenerPieces),
            unitText: 'шт',
            priceItem: visibleCassetteScrewPriceItem,
            totalPrice: visibleCassetteScrewPriceItem?.price
              ? visibleCornerTrimFastenerPieces * visibleCassetteScrewPriceItem.price
              : null,
          },
        ]
      : []),
    ...(cassetteHasVisibleFastening
      ? [
          {
            key: 'visible-cassette-screws',
            item: 'Саморезы 4,8х20 с ЭПДМ',
            purpose:
              project.selectedCassetteType === 'КФ-1'
                ? `открытый тип крепления КФ-1 в вертикальном шве; отверстия соседних кассет совмещаются, принято ${kf1FastenersPerJointByHeight} отверстия на кассету по высоте`
                : `открытый тип крепления КФ-4 по верхним и нижним отгибкам; ${kf4FastenersPerPiece} шт/кассету${cassetteLValue > 800 ? ' при L > 800 мм' : ''}`,
            qtyText:
              project.selectedCassetteType === 'КФ-1'
                ? formatInt(kf1VisibleFastenerPieces)
                : formatInt(totalRegularCassettePieces * kf4FastenersPerPiece),
            unitText: 'шт',
            priceItem: visibleCassetteScrewPriceItem,
            totalPrice:
              visibleCassetteScrewPriceItem?.price
                ? (project.selectedCassetteType === 'КФ-1' ? kf1VisibleFastenerPieces : totalRegularCassettePieces * kf4FastenersPerPiece) *
                  visibleCassetteScrewPriceItem.price
                : null,
          },
        ]
      : []),
    ...(project.selectedCassetteType === 'КФ-2' || project.selectedCassetteType === 'КФ-3'
      ? [
          {
            key: 'hidden-cassette-screws',
            item: 'Саморезы 4,8х20 с ЭПДМ',
            purpose: `скрытый тип крепления ${project.selectedCassetteType} к направляющим; ${hiddenCassetteFastenersPerPiece} шт/кассету${cassetteLValue > 799 ? ' с учетом центрального крепежного отверстия при L > 799 мм' : ''}`,
            qtyText: formatInt((totalRegularCassettePieces + totalCornerCassetteCount) * hiddenCassetteFastenersPerPiece),
            unitText: 'шт',
            priceItem: hiddenCassetteScrewPriceItem,
            totalPrice:
              hiddenCassetteScrewPriceItem?.price
                ? (totalRegularCassettePieces + totalCornerCassetteCount) *
                  hiddenCassetteFastenersPerPiece *
                  hiddenCassetteScrewPriceItem.price
                : null,
          },
        ]
      : []),
  ]
  const fastenerSpecTotalPrice = fastenerRows.reduce((sum, row) => sum + (row.totalPrice ?? 0), 0)
  const expandedCornerFacades = cornerCassettePreview
    .filter((item) => item.calculation)
    .map((item) => ({
      facadeName: item.facadeName,
      planarShelfMm: item.calculation?.planarCornerWidthMm ?? 0,
      shelfMm: item.calculation?.cornerWidthMm ?? 0,
    }))
  const calculatedCornerCassettes =
    expandedCornerFacades.length > 0 && cassetteHValue > 0
      ? Array.from({ length: project.outsideCorners }, (_, index) => {
          const leftFacade = expandedCornerFacades[index % expandedCornerFacades.length]
          const rightFacade = expandedCornerFacades[(index + 1) % expandedCornerFacades.length]
          const leftShelfMm = Math.min(leftFacade.shelfMm, rightFacade.shelfMm)
          const rightShelfMm = Math.max(leftFacade.shelfMm, rightFacade.shelfMm)
          return { leftShelfMm, rightShelfMm }
        })
      : []
  const calculatedCornerCassetteRows = calculatedCornerCassettes.flatMap((item) => [
    ...(cornerHeightLayout.standardRows > 0
      ? [
          {
            ...item,
            heightMm: cassetteHValue,
            pieces: cornerHeightLayout.standardRows,
          },
        ]
      : []),
    ...(cornerHeightLayout.additionalHeightMm > 0
      ? [
          {
            ...item,
            heightMm: cornerHeightLayout.additionalHeightMm,
            pieces: 1,
          },
        ]
      : []),
  ])
  const calculatedTotalCornerCassetteAreaM2 = calculatedCornerCassetteRows.reduce(
    (sum, item) => sum + (((item.leftShelfMm + item.rightShelfMm) * item.heightMm) / 1_000_000) * item.pieces,
    0,
  )
  const calculatedCornerSizeSummary = Object.values(
    calculatedCornerCassetteRows.reduce<Record<string, { count: number; size: string }>>((acc, item) => {
      const size = `H ${item.heightMm}; L1 ${item.leftShelfMm}; L2 ${item.rightShelfMm}`
      acc[size] = acc[size] ? { ...acc[size], count: acc[size].count + item.pieces } : { count: item.pieces, size }
      return acc
    }, {}),
  )
    .map((item) => item.size)
    .join('; ')
  const cornerCassetteExceedsRecommendedLimits = calculatedCornerCassetteRows.some(
    (item) => item.leftShelfMm > 700 || item.rightShelfMm > 700,
  )
  const regularSpecRows = Object.values(
    regularCassettePreview.reduce<
      Record<
        string,
        {
          key: string
          item: string
          size: string
          hMm: number
          lMm: number
          pieces: number
          areaM2: number
          priceItem: typeof standardCassettePriceItem
        }
      >
    >((acc, facade) => {
      const mainPieces = facade.standardColumns * facade.standardRows * facade.facadeQuantity
      const mainSizeIsStandard =
        cassetteStandardRule.standardL.includes(cassetteLValue) || cassetteStandardRule.standardH.includes(cassetteHValue)
      const mainRole = mainSizeIsStandard ? 'standard' : 'additional'
      const mainKey = `${mainRole}-${cassetteLValue}-${cassetteHValue}`

      if (mainPieces > 0) {
        acc[mainKey] = acc[mainKey] ?? {
          key: mainKey,
          item: mainSizeIsStandard ? 'Стандартная кассета' : 'Доборная кассета',
          size: `H ${effectiveCassetteSizeH || '—'}; L ${effectiveCassetteSizeL || '—'}`,
          hMm: cassetteHValue,
          lMm: cassetteLValue,
          pieces: 0,
          areaM2: 0,
          priceItem: mainSizeIsStandard ? standardCassettePriceItem : additionalCassettePriceItem,
        }
        acc[mainKey].pieces += mainPieces
        acc[mainKey].areaM2 += mainPieces * ((cassetteLValue * cassetteHValue) / 1_000_000)
      }

      if (facade.additionalColumnWidthMm > 0) {
        const lengthAdditionalPieces = facade.standardRows * facade.facadeQuantity
        const lengthKey = `additional-${facade.additionalColumnWidthMm}-${cassetteHValue}`
        acc[lengthKey] = acc[lengthKey] ?? {
          key: lengthKey,
          item: 'Доборная кассета',
          size: `H ${effectiveCassetteSizeH || '—'}; L ${facade.additionalColumnWidthMm}`,
          hMm: cassetteHValue,
          lMm: facade.additionalColumnWidthMm,
          pieces: 0,
          areaM2: 0,
          priceItem: additionalCassettePriceItem,
        }
        acc[lengthKey].pieces += lengthAdditionalPieces
        acc[lengthKey].areaM2 += lengthAdditionalPieces * ((facade.additionalColumnWidthMm * cassetteHValue) / 1_000_000)
      }

      if (facade.additionalRowHeightMm > 0) {
        const additionalPieces = facade.standardColumns * facade.facadeQuantity
        const heightRowIsStandard = cassetteStandardRule.standardL.includes(cassetteLValue)
        const heightRowKey = `${heightRowIsStandard ? 'standard' : 'additional'}-${cassetteLValue}-${facade.additionalRowHeightMm}`
        const heightRowPriceItem = heightRowIsStandard ? standardCassettePriceItem : additionalCassettePriceItem
        acc[heightRowKey] = acc[heightRowKey] ?? {
          key: heightRowKey,
          item: heightRowIsStandard ? 'Стандартная кассета' : 'Доборная кассета',
          size: `H ${facade.additionalRowHeightMm}; L ${effectiveCassetteSizeL || '—'}`,
          hMm: facade.additionalRowHeightMm,
          lMm: cassetteLValue,
          pieces: 0,
          areaM2: 0,
          priceItem: heightRowPriceItem,
        }
        acc[heightRowKey].pieces += additionalPieces
        acc[heightRowKey].areaM2 += additionalPieces * ((cassetteLValue * facade.additionalRowHeightMm) / 1_000_000)
      }

      if (facade.additionalColumnWidthMm > 0 && facade.additionalRowHeightMm > 0) {
        const cornerKey = `additional-${facade.additionalColumnWidthMm}-${facade.additionalRowHeightMm}`
        acc[cornerKey] = acc[cornerKey] ?? {
          key: cornerKey,
          item: 'Доборная кассета',
          size: `H ${facade.additionalRowHeightMm}; L ${facade.additionalColumnWidthMm}`,
          hMm: facade.additionalRowHeightMm,
          lMm: facade.additionalColumnWidthMm,
          pieces: 0,
          areaM2: 0,
          priceItem: additionalCassettePriceItem,
        }
        acc[cornerKey].pieces += facade.facadeQuantity
        acc[cornerKey].areaM2 += facade.facadeQuantity * ((facade.additionalColumnWidthMm * facade.additionalRowHeightMm) / 1_000_000)
      }

      return acc
    }, {}),
  )
  const grossRegularSpecAreaM2 = regularSpecRows.reduce((sum, row) => sum + row.areaM2, 0)
  const cassetteOpeningDeductionM2 = Math.min(openingAreaM2, grossRegularSpecAreaM2)
  const cassetteSpecRows = [
    ...regularSpecRows.map((row) => ({
      ...row,
      areaM2:
        grossRegularSpecAreaM2 > 0
          ? Math.max(0, row.areaM2 - cassetteOpeningDeductionM2 * (row.areaM2 / grossRegularSpecAreaM2))
          : row.areaM2,
      areaText:
        grossRegularSpecAreaM2 > 0
          ? Math.max(0, row.areaM2 - cassetteOpeningDeductionM2 * (row.areaM2 / grossRegularSpecAreaM2)).toFixed(2).replace('.', ',')
          : row.areaM2.toFixed(2).replace('.', ','),
      totalPrice:
        row.priceItem?.unit === 'm2'
          ? (grossRegularSpecAreaM2 > 0
              ? Math.max(0, row.areaM2 - cassetteOpeningDeductionM2 * (row.areaM2 / grossRegularSpecAreaM2))
              : row.areaM2) * row.priceItem.price
          : null,
    })),
            ...(project.hasCornerCassettes && hasOutsideCorners
      ? [
          {
            key: 'corner',
            item: 'Угловая кассета',
            size: calculatedCornerSizeSummary || '—',
            pieces: totalCornerCassetteCount,
            areaText: calculatedTotalCornerCassetteAreaM2 > 0 ? calculatedTotalCornerCassetteAreaM2.toFixed(2).replace('.', ',') : '—',
            priceItem: matchedCornerCassettePriceItem,
            totalPrice:
              matchedCornerCassettePriceItem?.unit === 'm2'
                ? calculatedTotalCornerCassetteAreaM2 * matchedCornerCassettePriceItem.price
                : null,
          },
        ]
      : []),
  ]
  const visibleCassetteSpecRows = cassetteSpecRows.filter((row) => row.pieces > 0)
  const packagingInputRows = regularSpecRows.map((row) => ({
    key: row.key,
    name: row.item,
    hMm: row.hMm,
    lMm: row.lMm,
    pieces: row.pieces,
  }))
  const packagingRows = calculateCassettePackaging(packagingInputRows, project.selectedCassetteType)
  const totalPackagingRows = packagingRows.reduce((sum, row) => sum + row.rowCount, 0)
  const totalPackagingPieces = packagingRows.reduce((sum, row) => sum + row.pieceCount, 0)
  const packagingHasCornerCassettesOutside =
    project.hasCornerCassettes && hasOutsideCorners && totalCornerCassetteCount > 0
  const cassetteSpecTotalPrice = visibleCassetteSpecRows.reduce((sum, row) => sum + (row.totalPrice ?? 0), 0)
  const totalCassetteSpecPieces = visibleCassetteSpecRows.reduce((sum, row) => sum + row.pieces, 0)
  const totalCassetteSpecAreaM2 = visibleCassetteSpecRows.reduce(
    (sum, row) => sum + ('areaM2' in row ? row.areaM2 : Number(row.areaText.replace(',', '.')) || 0),
    0,
  )
  const insulationAndMembraneTotalPrice = membraneTotalPrice
  const fullSpecTotalPrice =
    cassetteSpecTotalPrice + subsystemSpecTotalPrice + trimSpecTotalPrice + fastenerSpecTotalPrice + insulationAndMembraneTotalPrice
  const fullSpecAreaM2 = totalCassetteSpecAreaM2 > 0 ? totalCassetteSpecAreaM2 : insulationAreaM2
  const fullSpecPricePerM2 = fullSpecAreaM2 > 0 ? fullSpecTotalPrice / fullSpecAreaM2 : 0

  function updateProject<K extends keyof Project>(key: K, value: Project[K]) {
    setProject((current) => ({ ...current, [key]: value }))
  }

  function resetProject() {
    const nextProject = createBlankProject()
    setProject(nextProject)
    setCornerHeightMode('auto')
    setManualCornerHeight(maxFacadeHeight(nextProject.facades))
    setCassetteSizeL('')
    setCassetteSizeH('')
    setCassetteCoating('colorflow')
    setStandardSelectionMode('none')
    setSubsystemBracketStepMm(600)
    setPLevelsHelpOpen(false)
  }

  function applyQuickTestProject() {
    const nextProject = createQuickTestProject()
    setProject(nextProject)
    setCornerHeightMode('auto')
    setManualCornerHeight(maxFacadeHeight(nextProject.facades))
    setCassetteSizeL('572')
    setCassetteSizeH('567')
    setCassetteCoating('colorflow')
    setStandardSelectionMode('none')
    setSubsystemBracketStepMm(600)
    setPLevelsHelpOpen(false)
  }

  function updateCassetteType(code: Project['selectedCassetteType']) {
    const nextThicknesses = getAvailableCassetteThicknesses(code)
    const nextThickness = nextThicknesses.some((item) => item === project.cassetteThicknessMm)
      ? project.cassetteThicknessMm
      : nextThicknesses[0]

    setProject((current) => ({
      ...current,
      selectedCassetteType: code,
      cassetteThicknessMm: nextThickness,
    }))

    if (nextThickness !== 0.7) {
      setCassetteCoating('colorflow')
    }
  }

  function updateSubsystem<K extends keyof Project['subsystem']>(
    key: K,
    value: Project['subsystem'][K],
  ) {
    setProject((current) => ({
      ...current,
      subsystem: { ...current.subsystem, [key]: value },
    }))
  }

  function updateSubsystemFinishMode(mode: 'painted' | 'galvanized') {
    setProject((current) => ({
      ...current,
      estimateMode: mode === 'painted' ? 'project' : 'mounting',
      subsystem: {
        ...current.subsystem,
        visibleGuideColor: mode === 'painted' ? true : current.subsystem.visibleGuideColor,
      },
    }))
  }

  function updateCassetteThickness(thickness: 0.7 | 1.0 | 1.2) {
    setProject((current) => ({
      ...current,
      cassetteThicknessMm: thickness,
    }))

    if (thickness !== 0.7) {
      setCassetteCoating('colorflow')
    }
  }

  function handleCassetteSizeChange(axis: 'L' | 'H', value: string) {
    setStandardSelectionMode('none')
    if (axis === 'L') setCassetteSizeL(value)
    else setCassetteSizeH(value)
  }

  function updateStandardSelection(mode: 'length' | 'height') {
    const nextMode = standardSelectionMode === mode ? 'none' : mode

    setCassetteSizeL('')
    setCassetteSizeH('')
    setStandardSelectionMode(nextMode)

  }

  function normalizeCassetteSize(axis: 'L' | 'H') {
    const limits = axis === 'L' ? cassetteNumericLimits.l : cassetteNumericLimits.h
    const raw = axis === 'L' ? effectiveCassetteSizeL.trim() : effectiveCassetteSizeH.trim()

    if (raw === '') {
      return
    }

    const numeric = Number(raw.replace(',', '.'))
    if (!Number.isFinite(numeric)) {
      if (axis === 'L') setCassetteSizeL('')
      else setCassetteSizeH('')
      return
    }

    const normalized = Math.min(Math.max(Math.round(numeric), limits.min), limits.max)
    if (axis === 'L') setCassetteSizeL(String(normalized))
    else setCassetteSizeH(String(normalized))
  }

  function updateFacade(facadeId: string, updater: (facade: Facade) => Facade) {
    setProject((current) => ({
      ...current,
      facades: current.facades.map((facade) => (facade.id === facadeId ? updater(facade) : facade)),
    }))
  }

  function addFacade() {
    setProject((current) => ({
      ...current,
      facades: [...current.facades, createEmptyFacade(current.facades.length)],
    }))
  }

  function duplicateFacade(facadeId: string) {
    setProject((current) => {
      const index = current.facades.findIndex((facade) => facade.id === facadeId)
      if (index === -1) return current
      const source = current.facades[index]
      const duplicate: Facade = {
        ...source,
        id: createFacadeId(),
        name: `${source.name} копия`,
        openings: source.openings.map((opening) => ({ ...opening, id: createOpeningId() })),
      }
      const next = [...current.facades]
      next.splice(index + 1, 0, duplicate)
      return { ...current, facades: next }
    })
  }

  function removeFacade(facadeId: string) {
    setProject((current) => ({
      ...current,
      facades: current.facades.length === 1
        ? current.facades
        : current.facades.filter((facade) => facade.id !== facadeId),
    }))
  }

  function addOpening(facadeId: string) {
    updateFacade(facadeId, (facade) => ({
      ...facade,
      hasOpenings: true,
      openings: [...facade.openings, createEmptyOpening()],
    }))
  }

  function removeOpening(facadeId: string, openingId: string) {
    updateFacade(facadeId, (facade) => {
      const openings = facade.openings.filter((opening) => opening.id !== openingId)
      return {
        ...facade,
        hasOpenings: openings.length > 0,
        openings,
      }
    })
  }

  function updateOpening(facadeId: string, openingId: string, updater: (opening: Opening) => Opening) {
    updateFacade(facadeId, (facade) => ({
      ...facade,
      openings: facade.openings.map((opening) => (opening.id === openingId ? updater(opening) : opening)),
    }))
  }

  function moveOpeningOnLayout(facadeId: string, openingId: string, positionIndex: number, xMm: number, yMm: number) {
    updateOpening(facadeId, openingId, (opening) => {
      const positions = [...(opening.positions ?? [])]
      positions[positionIndex] = { xMm, yMm }
      return { ...opening, positions }
    })
  }

  async function handlePriceFileUpload(file: File | null) {
    if (!file) return

    setPriceUploadMessage('Загружаю и разбираю Excel...')
    try {
      const [buffer, dataUrl] = await Promise.all([file.arrayBuffer(), readFileAsDataUrl(file)])
      const rows = parsePriceWorkbook(buffer)
      const nextUploadedPrice: UploadedPriceData = {
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        parserVersion: priceParserVersion,
        rows,
      }

      saveUploadedPriceData(nextUploadedPrice)
      localStorage.setItem(
        uploadedPriceFileStorageKey,
        JSON.stringify({ fileName: file.name, dataUrl } satisfies StoredUploadedPriceFile),
      )
      setUploadedPrice(nextUploadedPrice)
      setPriceUploadMessage(`Прайс загружен: найдено ${formatInt(rows.length)} строк с ценами.`)
    } catch (error) {
      setPriceUploadMessage(error instanceof Error ? error.message : 'Не удалось загрузить прайс.')
    }
  }

  function openActivePriceFile() {
    if (!uploadedPrice && sharedPrice) {
      window.open(sharedPriceUrl, '_blank', 'noreferrer')
      return
    }

    try {
      const raw = localStorage.getItem(uploadedPriceFileStorageKey)
      if (!raw) {
        setPriceUploadMessage('Файл прайса не найден в хранилище браузера.')
        return
      }

      const stored = JSON.parse(raw) as StoredUploadedPriceFile
      const link = document.createElement('a')
      link.href = stored.dataUrl
      link.download = stored.fileName
      link.target = '_blank'
      link.rel = 'noreferrer'
      link.click()
    } catch {
      setPriceUploadMessage('Не удалось открыть сохраненный файл прайса.')
    }
  }

  function resetUploadedPrice() {
    clearUploadedPriceData()
    setUploadedPrice(null)
    setPriceUploadMessage(sharedPrice ? 'Локальный прайс удален. Используется общий прайс.' : 'Локальный прайс удален. Используются встроенные цены.')
  }

  if (methodologyOpen) {
    return <EngineeringMethodologyPage onBack={() => setMethodologyOpen(false)} />
  }

  if (visualizationOpen) {
    return (
      <CassetteLayoutVisualizationPage
        project={project}
        cassetteL={cassetteLValue}
        cassetteH={cassetteHValue}
        cassetteRust={cassetteRustMm}
        cornerProjectionMm={cornerSubsystemProjectionMm}
        subsystemBracketStepMm={subsystemBracketStepMm}
        layouts={regularCassettePreview}
        onBack={() => setVisualizationOpen(false)}
        onMoveOpening={moveOpeningOnLayout}
      />
    )
  }

  const headerSpecTotalText = fullSpecTotalPrice > 0 ? `${formatInt(Math.round(fullSpecTotalPrice))} ₽` : '—'
  const headerPricePerM2Text = fullSpecPricePerM2 > 0 ? `${formatPrice(fullSpecPricePerM2)} ₽/м²` : '—'
  const headerAreaText = insulationAreaM2 > 0 ? `${formatAreaRounded(insulationAreaM2)} м²` : `${formatAreaRounded(facadeGrossAreaM2)} м²`
  const headerCassetteText = totalRegularCassettePieces + totalCornerCassetteCount > 0
    ? `${formatInt(totalRegularCassettePieces + totalCornerCassetteCount)} шт`
    : '—'
  const headerSubsystemText =
    project.subsystem.code === 'standard_g'
      ? 'Г-образная'
      : project.subsystem.code === 'standard_p_vertical'
        ? 'П-образная 1 ур.'
        : project.subsystem.code === 'standard_p_double_level'
          ? 'П-образная 2 ур.'
          : 'Каркас'

  return (
    <div className="page theme-mono">
      <header className="calc-hero">
        <div className="calc-hero__rail" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="calc-hero__main">
          <div>
            <div className="calc-kicker">ИНСИ / фасадные кассеты</div>
            <h1>Расчет фасадной системы ИНСИ</h1>
            <div className="calc-hero__meta">
              <span>Тип кассет: {project.selectedCassetteType}</span>
              <span>Толщина: {project.cassetteThicknessMm.toString().replace('.', ',')} мм</span>
              <span>{headerSubsystemText}</span>
            </div>
          </div>
          <div className="calc-hero__total">
            <div className="calc-hero__total-label">Итог расчета</div>
            <div className="calc-hero__total-value">{headerSpecTotalText}</div>
            <div className="calc-hero__total-sub">{headerPricePerM2Text}</div>
          </div>
        </div>
        <div className="calc-metrics">
          <div className="calc-metric">
            <span>Площадь</span>
            <strong>{headerAreaText}</strong>
          </div>
          <div className="calc-metric">
            <span>Кассеты</span>
            <strong>{headerCassetteText}</strong>
          </div>
          <div className="calc-metric">
            <span>Вентзазор</span>
            <strong>{project.subsystem.airGapMm} мм</strong>
          </div>
          <div className="calc-metric">
            <span>Утепление</span>
            <strong>{project.insulation.enabled ? `${project.insulation.thicknessMm} мм` : 'нет'}</strong>
          </div>
        </div>
      </header>
      <section className="quick-action-panel" aria-label="Быстрые действия">
        <button className="btn btn-quick-action" type="button" onClick={applyQuickTestProject}>
          Заполнить тестовыми данными
        </button>
        <button className="btn btn-quick-action" type="button" onClick={resetProject}>
          Очистить данные
        </button>
        <button className="btn btn-quick-action btn-quick-action-primary" type="button" onClick={() => setVisualizationOpen(true)}>
          Раскладка кассетного поля
        </button>
      </section>
      <section className="price-upload-panel" aria-label="Загрузка прайса">
        <div>
          <div className="price-upload-title">Прайс Excel</div>
          <div className="price-upload-sub">
            {activePrice
              ? `${activePriceSource === 'local' ? 'Локальный тестовый прайс' : 'Общий прайс'}: ${activePrice.fileName}, обновлен ${formatUploadDate(activePrice.uploadedAt)}, цен: ${formatInt(activePrice.rows.length)}`
              : sharedPriceStatus === 'loading'
                ? 'Загружаю общий прайс...'
                : sharedPriceStatus === 'invalid'
                  ? 'Общий price.json поврежден или создан старым парсером. Используются встроенные цены.'
                  : 'Общий price.json не найден. Используются встроенные цены; Excel можно загрузить локально для проверки.'}
          </div>
          {priceUploadMessage ? <div className="price-upload-message">{priceUploadMessage}</div> : null}
        </div>
        <form className="price-upload-actions" onSubmit={(event) => event.preventDefault()}>
          <label className="btn btn-primary price-upload-file">
            Загрузить прайс
            <input
              type="file"
              accept=".xlsx,.xls,.xlsm,.csv"
              onChange={(event) => {
                void handlePriceFileUpload(event.target.files?.[0] ?? null)
                event.currentTarget.value = ''
              }}
            />
          </label>
          <button className="btn btn-quiet" type="button" disabled={!activePrice} onClick={openActivePriceFile}>
            Открыть прайс
          </button>
          <button className="btn btn-danger" type="button" disabled={!uploadedPrice} onClick={resetUploadedPrice}>
            Сбросить локальный
          </button>
        </form>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <div className="section-title-line">
              <div className="section-title">Фасады</div>
              <button className="field-help field-help-header" type="button" onClick={() => setFacadesHelpOpen(true)} aria-label="Справка по фасадам">
                ?
              </button>
            </div>
          </div>
          <div className="section-sub">Добавьте фасады и задайте размеры. Для одинаковых фасадов используйте количество.</div>
        </div>

        <div className="facade-list">
          {project.facades.map((facade, index) => (
            <div className="facade-card" key={facade.id}>
              <div className="facade-top">
                <div className="facade-name-row">
                  <div className="facade-badge">{String.fromCharCode(65 + index)}</div>
                  <div>
                    <div className="facade-title">{facade.name}</div>
                    <div className="facade-sub">Типовой фасад</div>
                  </div>
                </div>
                <div className="actions">
                  <button className="btn btn-quiet" type="button" onClick={() => duplicateFacade(facade.id)}>
                    Дублировать
                  </button>
                  <button
                    className="btn btn-danger"
                    type="button"
                    disabled={project.facades.length === 1}
                    onClick={() => removeFacade(facade.id)}
                  >
                    Удалить
                  </button>
                </div>
              </div>

              <div className="facade-body">
                <div className="grid-5">
                  <div className="field">
                    <label className="label">Название</label>
                    <input
                      className="input"
                      value={facade.name}
                      onChange={(event) => updateFacade(facade.id, (current) => ({ ...current, name: event.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label className="label">Ширина, мм</label>
                    <input
                      className="input"
                      value={facade.widthMm}
                      onChange={(event) => updateFacade(facade.id, (current) => ({ ...current, widthMm: parseMm(event.target.value) }))}
                    />
                  </div>
                  <div className="field">
                    <label className="label">Высота, мм</label>
                    <input
                      className="input"
                      value={facade.heightMm}
                      onChange={(event) => updateFacade(facade.id, (current) => ({ ...current, heightMm: parseMm(event.target.value) }))}
                    />
                  </div>
                  <div className="field">
                    <label className="label">Количество</label>
                    <input
                      className="input"
                      value={facade.quantity}
                      onChange={(event) => updateFacade(facade.id, (current) => ({ ...current, quantity: Math.max(1, parseMm(event.target.value)) }))}
                    />
                    <div className="hint">для одинаковых фасадов</div>
                  </div>
                  <div className="field">
                    <label className="label">Проёмы</label>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={facade.hasOpenings}
                        onChange={(event) =>
                          updateFacade(facade.id, (current) => ({
                            ...current,
                            hasOpenings: event.target.checked,
                            openings: event.target.checked ? current.openings : [],
                          }))
                        }
                      />
                      Есть проёмы
                    </label>
                  </div>
                </div>

                {facade.hasOpenings ? (
                  <div className="openings">
                    <div className="openings-head">
                      <div className="openings-title">Проёмы</div>
                      <button className="btn btn-primary" type="button" onClick={() => addOpening(facade.id)}>
                        + Добавить проём
                      </button>
                    </div>
                    <div className="opening-list">
                      {facade.openings.length === 0 ? (
                        <div className="opening-row">
                          <div className="hint">Пока нет проемов. Добавьте первое окно или дверь.</div>
                        </div>
                      ) : (
                        facade.openings.map((opening) => (
                          <div className="opening-row" key={opening.id}>
                            <div className="opening-grid">
                              <div className="field">
                                <label className="label">Тип</label>
                                <select
                                  className="select"
                                  value={opening.type}
                                  onChange={(event) => {
                                    const nextType = event.target.value as OpeningType
                                    const defaultSize = getDefaultOpeningSize(nextType)
                                    updateOpening(facade.id, opening.id, (current) => ({
                                      ...current,
                                      type: nextType,
                                      widthMm: defaultSize.widthMm,
                                      heightMm: defaultSize.heightMm,
                                      positions: undefined,
                                    }))
                                  }}
                                >
                                  <option value="window">Окно</option>
                                  <option value="door">Дверь</option>
                                  <option value="gate">Ворота</option>
                                </select>
                              </div>
                              <div className="field">
                                <label className="label">Типовой размер</label>
                                <select
                                  className="select"
                                  value={
                                    openingSizePresets[opening.type].some(
                                      (preset) => preset.widthMm === opening.widthMm && preset.heightMm === opening.heightMm,
                                    )
                                      ? `${opening.widthMm}x${opening.heightMm}`
                                      : 'manual'
                                  }
                                  onChange={(event) => {
                                    if (event.target.value === 'manual') return
                                    const [widthMm, heightMm] = event.target.value.split('x').map((value) => Number(value))
                                    updateOpening(facade.id, opening.id, (current) => ({
                                      ...current,
                                      widthMm,
                                      heightMm,
                                      positions: undefined,
                                    }))
                                  }}
                                >
                                  <option value="manual">Ручной размер</option>
                                  {openingSizePresets[opening.type].map((preset) => (
                                    <option key={`${preset.widthMm}x${preset.heightMm}`} value={`${preset.widthMm}x${preset.heightMm}`}>
                                      {preset.label}
                                    </option>
                                  ))}
                                </select>
                                <div className="hint">Можно выбрать типовой или ввести ниже вручную.</div>
                              </div>
                              <div className="field">
                                <label className="label">Ширина, мм</label>
                                <input
                                  className="input"
                                  value={opening.widthMm}
                                  onChange={(event) =>
                                    updateOpening(facade.id, opening.id, (current) => ({
                                      ...current,
                                      widthMm: parseMm(event.target.value),
                                    }))
                                  }
                                />
                              </div>
                              <div className="field">
                                <label className="label">Высота, мм</label>
                                <input
                                  className="input"
                                  value={opening.heightMm}
                                  onChange={(event) =>
                                    updateOpening(facade.id, opening.id, (current) => ({
                                      ...current,
                                      heightMm: parseMm(event.target.value),
                                    }))
                                  }
                                />
                              </div>
                              <div className="field">
                                <label className="label">Количество</label>
                                <input
                                  className="input"
                                  value={opening.quantity}
                                  onChange={(event) =>
                                    updateOpening(facade.id, opening.id, (current) => ({
                                      ...current,
                                      quantity: Math.max(1, parseMm(event.target.value)),
                                    }))
                                  }
                                />
                              </div>
                              <div className="field opening-delete-field">
                                <label className="label">&nbsp;</label>
                                <button className="btn btn-danger opening-delete-btn" type="button" onClick={() => removeOpening(facade.id, opening.id)}>
                                  Удалить проём
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <button className="btn btn-primary" type="button" onClick={addFacade}>
          + Добавить фасад
        </button>
        <button className="btn btn-quiet" type="button" onClick={resetProject} style={{ marginLeft: 8 }}>
          Сбросить расчет
        </button>

      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <div className="section-title-line">
              <div className="section-title">Углы</div>
              <button className="field-help field-help-header" type="button" onClick={() => setCornersHelpOpen(true)} aria-label="Справка по углам">
                ?
              </button>
            </div>
          </div>
          <div className="section-sub">Высота углов подставляется по самому высокому фасаду, но ее можно изменить вручную.</div>
        </div>

        <div className="corner-auto">
          <div className="corner-row">
            <div className="field">
              <label className="label">Количество внешних</label>
              <input
                className="input"
                value={project.outsideCorners}
                onChange={(event) => updateProject('outsideCorners', parseMm(event.target.value))}
              />
            </div>
            <div className="field">
              <label className="label">Количество внутренних</label>
              <input
                className="input"
                value={project.insideCorners === 0 ? '' : project.insideCorners}
                onChange={(event) => updateProject('insideCorners', parseMm(event.target.value))}
              />
            </div>
            <div className="field">
              <label className="label">Высота углов, мм</label>
              <input
                className="input"
                value={cornerHeight}
                onChange={(event) => {
                  setCornerHeightMode('manual')
                  setManualCornerHeight(parseMm(event.target.value))
                }}
              />
            </div>
            <div className="field">
              <label className="label">Оформление внешних</label>
              <div className="choice-row" style={{ marginTop: 0 }}>
                <div
                  className={`choice ${project.hasCornerCassettes ? 'active' : ''}`}
                  onClick={() => {
                    if (hasOutsideCorners) updateProject('hasCornerCassettes', true)
                  }}
                  role="button"
                  tabIndex={0}
                  style={{ opacity: hasOutsideCorners ? 1 : 0.45, pointerEvents: hasOutsideCorners ? 'auto' : 'none' }}
                >
                  <div className="choice-name">Угловая кассета</div>
                </div>
                <div
                  className={`choice ${!project.hasCornerCassettes ? 'active' : ''}`}
                  onClick={() => {
                    if (hasOutsideCorners) updateProject('hasCornerCassettes', false)
                  }}
                  role="button"
                  tabIndex={0}
                  style={{ opacity: hasOutsideCorners ? 1 : 0.45, pointerEvents: hasOutsideCorners ? 'auto' : 'none' }}
                >
                  <div className="choice-name">Уголок</div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <div className="section-title-line">
              <div className="section-title">Подсистема</div>
              <button className="field-help field-help-header" type="button" onClick={() => setSubsystemTypeHelpOpen(true)} aria-label="Справка по подсистеме">
                ?
              </button>
            </div>
          </div>
          <div className="section-sub">Выберите тип подсистемы. Для П-образной подсистемы дополнительно укажите количество уровней.</div>
        </div>

        <div className="corners-grid" style={{ marginBottom: 10 }}>
          <div className="corner-card">
            <div className="corner-head">
              <div className="corner-title">Тип подсистемы</div>
              <button
                className="field-help field-help-header"
                type="button"
                onClick={() => setSubsystemTypeHelpOpen(true)}
                aria-label="Справка по типу подсистемы"
              >
                ?
              </button>
            </div>
            <div className="corner-body">
              <div className="choice-row">
                <div
                  className={`choice ${project.subsystem.code === 'standard_g' ? 'active' : ''}`}
                  onClick={() => updateSubsystem('code', 'standard_g')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="choice-name">Г-образная</div>
                </div>
                <div
                  className={`choice ${project.subsystem.code !== 'standard_g' && project.subsystem.code !== 'frame' ? 'active' : ''}`}
                  onClick={() => updateSubsystem('code', 'standard_p_vertical')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="choice-name">П-образная</div>
                </div>
              </div>
            </div>
          </div>

          <div className="corner-card" style={{ opacity: project.subsystem.code === 'standard_g' ? 0.55 : 1 }}>
            <div className="corner-head">
              <div className="corner-title">Уровни подсистемы</div>
              <button
                className="field-help field-help-header"
                type="button"
                onClick={() => setPLevelsHelpOpen(true)}
                aria-label="Справка по уровням П-образной подсистемы"
              >
                ?
              </button>
            </div>
            <div className="corner-body">
              <div className="choice-row">
                <div
                  className={`choice ${project.subsystem.code === 'standard_p_vertical' ? 'active' : ''}`}
                  onClick={() => updateSubsystem('code', 'standard_p_vertical')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="choice-name">Одноуровневая</div>
                </div>
                <div
                  className={`choice ${project.subsystem.code === 'standard_p_double_level' ? 'active' : ''}`}
                  onClick={() => updateSubsystem('code', 'standard_p_double_level')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="choice-name">Двухуровневая</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="corners-grid subsystem-settings-grid">
          <div className="corner-card subsystem-finish-card">
            <div className="corner-head">
              <div className="corner-title">Исполнение подсистемы</div>
            </div>
            <div className="corner-body">
              <div className="choice-row" style={{ marginTop: 0 }}>
                <div
                  className={`choice ${subsystemFinishMode === 'painted' ? 'active' : ''}`}
                  onClick={() => updateSubsystemFinishMode('painted')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="choice-name">Окрашенная</div>
                </div>
                <div
                  className={`choice ${subsystemFinishMode === 'galvanized' ? 'active' : ''}`}
                  onClick={() => updateSubsystemFinishMode('galvanized')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="choice-name">Оцинкованная</div>
                </div>
              </div>
            </div>
          </div>

          <div className="corner-card">
            <div className="corner-head">
              <div className="corner-title">Шаг кронштейнов, мм</div>
            </div>
            <div className="corner-body">
              <input
                className="input"
                type="number"
                min={100}
                max={maxSubsystemBracketVerticalStepMm}
                value={subsystemBracketStepMm}
                onChange={(event) =>
                  setSubsystemBracketStepMm(
                    Math.min(maxSubsystemBracketVerticalStepMm, Math.max(100, parseMm(event.target.value))),
                  )
                }
              />
              <div className="hint">Макс. {maxSubsystemBracketVerticalStepMm} мм</div>
            </div>
          </div>

          <div className="corner-card">
            <div className="corner-head">
              <div className="corner-title">Воздушный зазор, мм</div>
            </div>
            <div className="corner-body">
              <input
                className="input"
                value={project.subsystem.airGapMm}
                onChange={(event) => updateSubsystem('airGapMm', parseMm(event.target.value))}
              />
              <div className="hint">Шаг профилей: ≤ {maxSubsystemVerticalProfileStepMm} мм</div>
            </div>
          </div>
        </div>

        <div className="summary" style={{ display: 'none' }}>
          <div className="summary-head">Спецификация подсистемы</div>
          <div className="cassette-spec-table-wrap">
            <table className="cassette-spec-table">
              <thead>
                <tr>
                  <th>Элемент</th>
                  <th>Кол-во</th>
                  <th>Ед.</th>
                  <th>Код</th>
                  <th>Наименование</th>
                  <th>Цена</th>
                  <th>Сумма, руб.</th>
                </tr>
              </thead>
              <tbody>
                {subsystemRows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.item}</td>
                    <td>{formatQty(row.qty, row.unit)}</td>
                    <td>{row.unit === 'lm' ? 'п.м' : 'шт'}</td>
                    <td>{row.priceItem?.code ?? '—'}</td>
                    <td>{row.priceItem?.name ?? 'Нет позиции в прайсе'}</td>
                    <td>{row.priceItem?.price ? `${formatInt(row.priceItem.price)} ₽/${row.unit === 'lm' ? 'п.м' : 'шт'}` : '—'}</td>
                    <td>{row.totalPrice ? `${formatInt(Math.round(row.totalPrice))} ₽` : '—'}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={6}>Итого по подсистеме</td>
                  <td>{subsystemSpecTotalPrice > 0 ? `${formatInt(Math.round(subsystemSpecTotalPrice))} ₽` : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="cassette-spec-notes">
            {subsystemIsPSingleLevel ? (
              <div className="hint" style={{ textAlign: 'left' }}>
                Для П-образной одноуровневой системы крайние кронштейны принимаются на расстоянии 100-150 мм от концов направляющей, в расчете используется середина диапазона: {subsystemEdgeBracketOffsetMm} мм.
              </div>
            ) : null}
            {subsystemIsG ? (
              <div className="hint" style={{ textAlign: 'left' }}>
                Для Г-образной системы кронштейн КВГУ подбирается по требуемому вылету: толщина утеплителя {effectiveInsulationThicknessMm} мм + воздушный зазор {project.subsystem.airGapMm} мм = {subsystemRequiredReachMm} мм. Сейчас выбран {subsystemSelectedKvgu?.item.name ?? 'неподтвержденный КВГУ'}.
              </div>
            ) : null}
            {!subsystemIsG && (subsystemIsPSingleLevel || subsystemIsPDoubleLevel) ? (
              <div className="hint" style={{ textAlign: 'left' }}>
                Для П-образной системы предельная толщина утеплителя считается от максимального кронштейна {subsystemMaxBracketLengthMm} мм: {subsystemMaxBracketLengthMm} - {project.subsystem.airGapMm} - {subsystemBracketMountReserveMm} = {subsystemMaxInsulationThicknessMm} мм.
              </div>
            ) : null}
            <div className="hint" style={{ textAlign: 'left', marginTop: 4 }}>
              Шаг кронштейнов по высоте: {subsystemBracketStepMm} мм, максимум 800 мм. Температурный зазор в стыках направляющих: 5-10 мм.
            </div>
            {cassetteNeedsVisibleColoredGuide ? (
              <div className="hint" style={{ textAlign: 'left', marginTop: 4 }}>
                Для {project.selectedCassetteType} видимые НПП в вертикальном шве считаются окрашенными. При оцинкованной подсистеме окрашивается только лицевая сторона; при окрашенной подсистеме — обе стороны. Если длина кассеты больше 800 мм, промежуточный вертикальный профиль считается отдельно и не окрашивается при оцинкованной системе.
              </div>
            ) : null}
            {requiresIntermediateVerticalProfile ? (
              <div className="hint" style={{ textAlign: 'left', marginTop: 4 }}>
                При L кассеты больше 800 мм добавляются промежуточные вертикальные профили с шагом не более 600 мм: сейчас {intermediateProfilesPerCassetteBay} промежуточн. проф. на один кассетный пролет.
              </div>
            ) : null}
            {subsystemIsPSingleLevel && hasOutsideCorners ? (
              <div className="hint" style={{ textAlign: 'left', marginTop: 4 }}>
                Для наружного угла учитывается узловое требование: направляющий профиль у угла ставится на расстоянии не менее 130 мм от линии угла.
              </div>
            ) : null}
            {(subsystemIsPSingleLevel || subsystemIsPDoubleLevel) && (project.outsideCorners > 0 || project.insideCorners > 0) ? (
              <div className="hint" style={{ textAlign: 'left', marginTop: 4 }}>
                Для П-образной системы углы считаются отдельными дополнительными НПП по высоте угла: по две направляющие на каждый наружный и внутренний угол. Для двухуровневой системы в зоне угла дополнительно учитываются и вертикальные НПШ.
              </div>
            ) : null}
            {subsystemIsG && subsystemSelectedKvguSeries === 95 ? (
              <div className="hint" style={{ textAlign: 'left', marginTop: 4 }}>
                Для КВГУ 95x85 прокладка ПОН-Б 55x65x4 не применяется. В спецификации используется отдельная позиция ПОН-Б 95x95x2.
              </div>
            ) : null}
            {subsystemInsulationExceeded ? (
              <div className="hint" style={{ textAlign: 'left', marginTop: 4, color: '#8f1d1d' }}>
                Текущая толщина утеплителя {project.insulation.thicknessMm} мм превышает допустимый максимум для выбранной подсистемы при вентзазоре {project.subsystem.airGapMm} мм. Максимум сейчас: {subsystemMaxInsulationThicknessMm} мм.
              </div>
            ) : null}
            <div className="hint" style={{ textAlign: 'left', marginTop: 4 }}>
              Профили считаются хлыстами по {subsystemProfileStockLengthMm / 1000} м и округляются вверх до кратности 3 м. Для вертикальных направляющих сейчас это {subsystemVerticalProfilePieces} шт по {subsystemProfileStockLengthMm / 1000} м.
            </div>
            <div className="hint" style={{ textAlign: 'left', marginTop: 4 }}>
              Раскладка подсистемы:{' '}
              {subsystemFacadeLayouts
                .map(
                  (item) =>
                    `${item.facadeName}${item.facadeQuantity > 1 ? ` × ${item.facadeQuantity}` : ''}: ${item.verticalLines} вертикальных линий, ${item.bracketRows} рядов кронштейнов, ${item.profilePiecesPerLine} проф. по 3 м на линию`,
                )
                .join('; ')}
            </div>
          </div>
        </div>

      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <div className="section-title-line">
              <div className="section-title">Кассеты</div>
              <button className="field-help field-help-header" type="button" onClick={() => setCassettesHelpOpen(true)} aria-label="Справка по кассетам">
                ?
              </button>
            </div>
          </div>
          <div className="section-sub">Параметры выбранного типа кассеты и раскладки.</div>
        </div>

        <div className="switches" style={{ marginTop: 0, marginBottom: 10 }}>
          <label className="check">
            <input
              type="checkbox"
              checked={standardSelectionMode === 'length'}
              onChange={() => updateStandardSelection('length')}
            />
            Стандарт по длине
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={standardSelectionMode === 'height'}
              onChange={() => updateStandardSelection('height')}
            />
            Стандарт по высоте
          </label>
          {standardSelectionMode !== 'none' && economicalCassetteSize && Number.isFinite(economicalCassetteSize.score) ? (
            <div className="hint" style={{ alignSelf: 'center' }}>
              Подбор: L {economicalCassetteSize.l} мм, H {economicalCassetteSize.h} мм.
            </div>
          ) : standardSelectionMode !== 'none' ? (
            <div className="hint" style={{ alignSelf: 'center' }}>
              Для текущих фасадов не найден экономичный вариант в допустимых размерах.
            </div>
          ) : null}
        </div>

        <div className="grid-5">
          <div className="field">
            <label className="label">Тип кассеты</label>
            <select
              className="select"
              value={project.selectedCassetteType}
              onChange={(event) => updateCassetteType(event.target.value as Project['selectedCassetteType'])}
            >
              {facadeCassetteTypes.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">Толщина кассеты, мм</label>
            <select
              className="select"
              value={project.cassetteThicknessMm}
              onChange={(event) => updateCassetteThickness(Number(event.target.value) as 0.7 | 1.0 | 1.2)}
            >
              {availableCassetteThicknesses.map((item) => (
                <option key={item} value={item}>
                  {item.toFixed(1).replace('.', ',')}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">L, мм</label>
            <input
              className="input"
              type="number"
              min={cassetteNumericLimits.l.min}
              max={cassetteNumericLimits.l.max}
              value={effectiveCassetteSizeL}
              onChange={(event) => handleCassetteSizeChange('L', event.target.value)}
              onBlur={() => normalizeCassetteSize('L')}
              placeholder="Например: 1180"
            />
            <div className="hint">{cassetteStandardSizes.l}</div>
            <div className="hint">{cassetteSizeLimits.l}</div>
          </div>
          <div className="field">
            <label className="label">H, мм</label>
            <input
              className="input"
              type="number"
              min={cassetteNumericLimits.h.min}
              max={cassetteNumericLimits.h.max}
              value={effectiveCassetteSizeH}
              onChange={(event) => handleCassetteSizeChange('H', event.target.value)}
              onBlur={() => normalizeCassetteSize('H')}
              placeholder="Например: 550"
            />
            <div className="hint">{cassetteStandardSizes.h}</div>
            <div className="hint">{cassetteSizeLimits.h}</div>
          </div>
          <div className="field">
            <label className="label">Вид покрытия</label>
            <div className="choice-row" style={{ marginTop: 0 }}>
              <div
                className={`choice ${cassetteCoating === 'polyester' ? 'active' : ''}`}
                onClick={() => {
                  if (polyesterAvailable) setCassetteCoating('polyester')
                }}
                role="button"
                tabIndex={0}
                style={{ opacity: polyesterAvailable ? 1 : 0.45, pointerEvents: polyesterAvailable ? 'auto' : 'none' }}
              >
                <div className="choice-name">Полиэстер</div>
              </div>
              <div
                className={`choice ${cassetteCoating === 'colorflow' ? 'active' : ''}`}
                onClick={() => setCassetteCoating('colorflow')}
                role="button"
                tabIndex={0}
              >
                <div className="choice-name">Колор поток</div>
              </div>
            </div>
          </div>
        </div>
        {cassetteSizeLimits.note ? (
          <div className="hint" style={{ marginTop: 8, textAlign: 'center' }}>{cassetteSizeLimits.note}</div>
        ) : null}

        <div className="summary" style={{ display: 'none' }}>
          <div className="summary-head">Спецификация кассет</div>
          <div className="cassette-spec-table-wrap">
            <table className="cassette-spec-table">
              <thead>
                <tr>
                  <th>Элемент</th>
                  <th>Размер, мм</th>
                  <th>Шт</th>
                  <th>м²</th>
                  <th>Код</th>
                  <th>Наименование</th>
                  <th>Цена</th>
                  <th>Сумма, руб.</th>
                </tr>
              </thead>
              <tbody>
                {visibleCassetteSpecRows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.item}</td>
                    <td>{row.size}</td>
                    <td>{row.pieces || '—'}</td>
                    <td>{row.areaText}</td>
                    <td>{row.priceItem?.code ?? '—'}</td>
                    <td>{row.priceItem?.name ?? 'Нет позиции в прайсе'}</td>
                    <td>{row.priceItem ? `${formatInt(row.priceItem.price)} ₽/${row.priceItem.unit}` : '—'}</td>
                    <td>{row.totalPrice ? `${formatInt(Math.round(row.totalPrice))} ₽` : '—'}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={7}>Итого по спецификации</td>
                  <td>{cassetteSpecTotalPrice > 0 ? `${formatInt(Math.round(cassetteSpecTotalPrice))} ₽` : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="cassette-spec-notes">
            <div className="hint" style={{ textAlign: 'left' }}>
              Тип кассеты: {project.selectedCassetteType}. Покрытие: {cassetteCoating === 'colorflow' ? 'Колор поток' : 'Полиэстер'}.
            </div>
            <div className="hint" style={{ textAlign: 'left', marginTop: 4 }}>
              Итого рядовых: {totalRegularCassettePieces} шт, {totalRegularCassetteAreaM2.toFixed(2).replace('.', ',')} м².
            </div>
            {regularCassettePreview.length > 0 ? (
              <div className="hint" style={{ textAlign: 'left', marginTop: 4 }}>
                Раскладка фасадов:{' '}
                {regularCassettePreview
                  .map(
                    (item) =>
                      `${item.facadeName}${item.facadeQuantity > 1 ? ` × ${item.facadeQuantity}` : ''}: ${item.standardColumns} ст. по L${
                        item.additionalColumnWidthMm > 0 ? ` + добор ${item.additionalColumnWidthMm}` : ''
                      }, ${item.standardRows} ряд. по H${item.additionalRowHeightMm > 0 ? ` + добор ${item.additionalRowHeightMm}` : ''}`,
                  )
                  .join('; ')}
              </div>
            ) : null}
            {project.hasCornerCassettes && hasOutsideCorners ? (
              <div className="hint" style={{ textAlign: 'left', marginTop: 4 }}>
                Угловые кассеты: {cornerCassettePerCornerCount || '—'} шт на угол, всего {totalCornerCassetteCount || '—'} шт.
              </div>
            ) : null}
            {project.hasCornerCassettes && hasOutsideCorners ? (
              <div className="hint" style={{ textAlign: 'left', marginTop: 4 }}>
                Полки угловых кассет увеличены на вынос подсистемы: {cornerSubsystemProjectionMm} мм
                (`утеплитель + вентзазор + профиль`). Это уже учтено в размерах `L1/L2`.
              </div>
            ) : null}
            {project.hasCornerCassettes && hasOutsideCorners && cornerCassetteExceedsRecommendedLimits ? (
              <div className="hint" style={{ textAlign: 'left', marginTop: 4, color: '#8f1d1d' }}>
                После учета выноса подсистемы часть полок угловых кассет превышает рекомендуемые `700 мм`.
              </div>
            ) : null}
          </div>
        </div>

        <div className="summary" style={{ display: 'none' }}>
          <div className="summary-head">Итого по кассетам</div>
          <div className="summary-grid">
            <div className="summary-item">
              <div className="summary-name">Тип кассеты</div>
              <div className="summary-val">{project.selectedCassetteType}</div>
            </div>
            <div className="summary-item">
              <div className="summary-name">Размер</div>
              <div className="summary-val">
                {effectiveCassetteSizeL || '—'} × {effectiveCassetteSizeH || '—'}
              </div>
            </div>
            <div className="summary-item">
              <div className="summary-name">Исполнение</div>
              <div className="summary-val">{cassetteTypeResult}</div>
            </div>
            <div className="summary-item">
              <div className="summary-name">Покрытие</div>
              <div className="summary-val">{cassetteCoating === 'colorflow' ? 'Колор поток' : 'Полиэстер'}</div>
            </div>
          </div>
          {project.hasCornerCassettes ? (
            <div style={{ padding: '11px 14px', borderTop: '1px solid var(--border2)' }}>
              <div className="summary-name" style={{ marginBottom: 8 }}>Угловая кассета</div>
              {cornerCassettePreview.length > 0 ? (
                cornerCassettePreview.map((item) => (
                  <div key={item.facadeId} className="hint" style={{ textAlign: 'left', marginTop: 4 }}>
                    {item.calculation
                      ? `${item.facadeName}${item.facadeQuantity > 1 ? ` × ${item.facadeQuantity}` : ''}: ${cornerCassetteFamily} ${item.calculation.cornerWidthMm} × ${item.calculation.cornerWidthMm} × ${cassetteHValue} мм, рядовых по ширине ${item.calculation.rowCassetteCount} шт, руст ${cassetteRustMm} мм`
                      : `${item.facadeName}${item.facadeQuantity > 1 ? ` × ${item.facadeQuantity}` : ''}: РЅРµ удалось подобрать ширину УКФ РІ диапазоне 200–700 мм`}
                  </div>
                ))
              ) : (
                <div className="hint" style={{ textAlign: 'left' }}>
                  Заполните L и H основной кассеты, чтобы посчитать угловую.
                </div>
              )}
              <div className="hint" style={{ textAlign: 'left', marginTop: 8 }}>
                Количество по высоте: {cornerCassettePerCornerCount || '—'} шт на угол, всего {totalCornerCassetteCount || '—'} шт
              </div>
              <div className="hint" style={{ textAlign: 'left', marginTop: 4 }}>
                Позиция из прайса: {matchedCornerCassettePriceItem ? `${matchedCornerCassettePriceItem.code} — ${matchedCornerCassettePriceItem.name}, ${formatInt(matchedCornerCassettePriceItem.price)} ₽/${matchedCornerCassettePriceItem.unit}` : 'не найдена для выбранной толщины и покрытия'}
              </div>
            </div>
          ) : null}
          <div style={{ padding: '11px 14px', borderTop: '1px solid var(--border2)' }}>
            <div className="summary-name" style={{ marginBottom: 8 }}>Рядовые кассеты</div>
            {regularCassettePreview.length > 0 ? (
              <>
                {regularCassettePreview.map((item) => (
                  <div key={item.facadeId} className="hint" style={{ textAlign: 'left', marginTop: 4 }}>
                    {item.facadeName}
                    {item.facadeQuantity > 1 ? ` × ${item.facadeQuantity}` : ''}: {item.columns} по ширине × {item.rows} по высоте = {item.perFacadePieces} шт на фасад, всего {item.totalPieces} шт, {item.totalAreaM2.toFixed(2).replace('.', ',')} м²
                  </div>
                ))}
                <div className="hint" style={{ textAlign: 'left', marginTop: 8 }}>
                  Итого рядовых: {totalRegularCassettePieces} шт, {totalRegularCassetteAreaM2.toFixed(2).replace('.', ',')} м²
                </div>
                <div className="hint" style={{ textAlign: 'left', marginTop: 4 }}>
                  Стандартные: {totalStandardCassettePieces} шт, {totalStandardCassetteAreaM2.toFixed(2).replace('.', ',')} м²
                </div>
                <div className="hint" style={{ textAlign: 'left', marginTop: 4 }}>
                  Доборные: {totalAdditionalCassettePieces} шт, {totalAdditionalCassetteAreaM2.toFixed(2).replace('.', ',')} м²
                </div>
              </>
            ) : (
              <div className="hint" style={{ textAlign: 'left' }}>
                Заполните L и H основной кассеты, чтобы посчитать рядовые.
              </div>
            )}
          </div>
        </div>
        <div className="summary" style={{ display: 'none' }}>
          <div className="summary-head">Позиция из прайса</div>
          <div className="summary-grid price-summary-grid">
            <div className="summary-item">
              <div className="summary-name">Код</div>
              <div className="summary-val">{matchedCassettePriceItem?.code ?? 'Не найден'}</div>
            </div>
            <div className="summary-item">
              <div className="summary-name">Наименование</div>
              <div className="summary-val">{matchedCassettePriceItem?.name ?? 'Нет точного совпадения'}</div>
            </div>
            <div className="summary-item">
              <div className="summary-name">Цена</div>
              <div className="summary-val">
                {matchedCassettePriceItem ? `${formatInt(matchedCassettePriceItem.price)} ₽/${matchedCassettePriceItem.unit}` : '—'}
              </div>
            </div>
            <div className="summary-item">
              <div className="summary-name">Роль</div>
              <div className="summary-val">
                {matchedCassetteRole === 'standard' ? 'Стандартная' : matchedCassetteRole === 'additional' ? 'Доборная' : 'Не определена'}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <div className="section-title-line">
              <div className="section-title">Утеплитель и пленки</div>
              <button className="field-help field-help-header" type="button" onClick={() => setInsulationHelpOpen(true)} aria-label="Справка по утеплителю и пленкам">
                ?
              </button>
            </div>
          </div>
          <div className="section-sub">Базовые параметры утепления и ветрозащитной мембраны.</div>
        </div>

        <div className="grid-4">
          <div className="field">
            <label className="label">Утеплитель</label>
            <div className="choice-row" style={{ marginTop: 0 }}>
              <div
                className={`choice ${project.insulation.enabled ? 'active' : ''}`}
                onClick={() =>
                  setProject((current) => ({
                    ...current,
                    insulation: { ...current.insulation, enabled: true },
                  }))
                }
                role="button"
                tabIndex={0}
              >
                <div className="choice-name">Есть</div>
              </div>
              <div
                className={`choice ${!project.insulation.enabled ? 'active' : ''}`}
                onClick={() =>
                  setProject((current) => ({
                    ...current,
                    insulation: { ...current.insulation, enabled: false, membrane: false },
                  }))
                }
                role="button"
                tabIndex={0}
              >
                <div className="choice-name">Нет</div>
              </div>
            </div>
          </div>
          {project.insulation.enabled ? (
            <div className="field">
              <label className="label">Толщина утеплителя, мм</label>
              <input
                className="input"
                type="number"
                max={subsystemMaxInsulationThicknessMm}
                value={project.insulation.thicknessMm}
                onChange={(event) =>
                  setProject((current) => ({
                    ...current,
                    insulation: {
                      ...current.insulation,
                      thicknessMm: Math.min(
                        Math.max(0, parseMm(event.target.value)),
                        Math.max(
                          0,
                          getMaxBracketLengthForSubsystem(current.subsystem.code) -
                            current.subsystem.airGapMm -
                            subsystemBracketMountReserveMm,
                        ),
                      ),
                    },
                  }))
                }
              />
              <div className="hint">Общая толщина слоя утепления.</div>
              <div className="hint">
                Макс. для {subsystemIsG ? 'Г-образной' : subsystemIsPSingleLevel || subsystemIsPDoubleLevel ? 'П-образной' : 'подсистемы'}: {subsystemMaxInsulationThicknessMm} мм
              </div>
            </div>
          ) : null}
          {project.insulation.enabled ? (
            <>
              <div className="field">
                <label className="label">Пленка</label>
                <div className="choice-row" style={{ marginTop: 0 }}>
                  <div
                    className={`choice ${project.insulation.membrane ? 'active' : ''}`}
                    onClick={() =>
                      setProject((current) => ({
                        ...current,
                        insulation: { ...current.insulation, membrane: true },
                      }))
                    }
                    role="button"
                    tabIndex={0}
                  >
                    <div className="choice-name">Есть</div>
                  </div>
                  <div
                    className={`choice ${!project.insulation.membrane ? 'active' : ''}`}
                    onClick={() =>
                      setProject((current) => ({
                        ...current,
                        insulation: { ...current.insulation, membrane: false },
                      }))
                    }
                    role="button"
                    tabIndex={0}
                  >
                    <div className="choice-name">Нет</div>
                  </div>
                </div>
              </div>
              <div className="field">
                <label className="label">Тип пленки</label>
                <input
                  className="input"
                  value={project.insulation.membrane ? membranePriceItem.name : 'Не требуется'}
                  readOnly
                />
                <div className="hint">Рулон {membraneRollWidthM.toString().replace('.', ',')}×{membraneRollLengthM.toString().replace('.', ',')} м, нахлест {membraneOverlapMm} мм.</div>
              </div>
            </>
          ) : null}
        </div>

      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <div className="section-title-line">
              <div className="section-title">Сводная спецификация</div>
              <button className="field-help field-help-header" type="button" onClick={() => setSpecHelpOpen(true)} aria-label="Справка по сводной спецификации">
                ?
              </button>
            </div>
          </div>
          <div className="section-sub">Кассеты, подсистема, комплектующие, утеплитель и пленки в одной итоговой таблице.</div>
        </div>

        <div className="cassette-spec-table-wrap summary-spec-table-wrap">
          <table className="cassette-spec-table summary-spec-table">
            <colgroup>
              <col className="spec-col-section" />
              <col className="spec-col-element" />
              <col className="spec-col-name" />
              <col className="spec-col-qty" />
              <col className="spec-col-unit" />
              <col className="spec-col-price" />
              <col className="spec-col-total" />
            </colgroup>
            <thead>
              <tr>
                <th>Раздел</th>
                <th>Элемент</th>
                <th>Наименование</th>
                <th>Кол-во</th>
                <th>Ед.</th>
                <th>Цена</th>
                <th>Сумма, руб.</th>
              </tr>
            </thead>
            <tbody>
              <tr className="spec-section-row">
                <td colSpan={7}>Кассеты</td>
              </tr>
              {visibleCassetteSpecRows.length > 0 ? (
                visibleCassetteSpecRows.map((row) => (
                  <tr key={`cassette-${row.key}`}>
                    <td>Кассеты</td>
                    <td>{row.item} ({row.size})</td>
                    <td>{row.priceItem?.name ?? 'Нет позиции в прайсе'}</td>
                    <td>{row.pieces ? `${formatInt(row.pieces)} шт` : '—'}</td>
                    <td>{formatAreaRounded(Number(row.areaText.replace(',', '.')))} м²</td>
                    <td>{row.priceItem ? `${formatInt(row.priceItem.price)} ₽/${row.priceItem.unit}` : '—'}</td>
                    <td>{row.totalPrice ? `${formatInt(Math.round(row.totalPrice))} ₽` : '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td>Кассеты</td>
                  <td colSpan={6}>Заполните размер L и H, чтобы получить спецификацию кассет.</td>
                </tr>
              )}
              <tr className="spec-total-row">
                <td colSpan={2}>Итого по разделу: Кассеты</td>
                <td>Сумма по кассетам</td>
                <td>{totalCassetteSpecPieces > 0 ? `${formatInt(totalCassetteSpecPieces)} шт` : '—'}</td>
                <td>{totalCassetteSpecAreaM2 > 0 ? `${formatAreaRounded(totalCassetteSpecAreaM2)} м²` : '—'}</td>
                <td>—</td>
                <td>{cassetteSpecTotalPrice > 0 ? `${formatInt(Math.round(cassetteSpecTotalPrice))} ₽` : '—'}</td>
              </tr>

              <tr className="spec-section-row">
                <td colSpan={7}>Подсистема</td>
              </tr>
              {subsystemMaterialRows.map((row) => (
                <tr key={`subsystem-${row.key}`}>
                  <td>Подсистема</td>
                  <td>{row.item}</td>
                  <td>{row.priceItem?.name ?? 'Нет позиции в прайсе'}</td>
                  <td>{formatQty(row.qty, row.unit)}</td>
                  <td>{row.unit === 'lm' ? 'п.м' : 'шт'}</td>
                  <td>{row.priceItem?.price ? `${formatInt(row.priceItem.price)} ₽/${row.unit === 'lm' ? 'п.м' : 'шт'}` : '—'}</td>
                  <td>{row.totalPrice ? `${formatInt(Math.round(row.totalPrice))} ₽` : '—'}</td>
                </tr>
              ))}
              <tr className="spec-total-row">
                <td colSpan={6}>Итого по разделу: Подсистема</td>
                <td>{subsystemSpecTotalPrice > 0 ? `${formatInt(Math.round(subsystemSpecTotalPrice))} ₽` : '—'}</td>
              </tr>

              <tr className="spec-section-row">
                <td colSpan={7}>Крепеж</td>
              </tr>
              {fastenerRows.map((row) => (
                <tr key={`fastener-${row.key}`}>
                  <td>Крепеж</td>
                  <td>{row.item}: {row.purpose}</td>
                  <td>{row.priceItem?.name ?? 'Позиция крепежа требует подтверждения прайса'}</td>
                  <td>{row.qtyText}</td>
                  <td>{row.unitText}</td>
                  <td>{row.priceItem?.price ? `${formatInt(row.priceItem.price)} ₽/шт` : '—'}</td>
                  <td>{row.totalPrice ? `${formatInt(Math.round(row.totalPrice))} ₽` : '—'}</td>
                </tr>
              ))}
              <tr className="spec-total-row">
                <td colSpan={6}>Итого по разделу: Крепеж</td>
                <td>{fastenerSpecTotalPrice > 0 ? `${formatInt(Math.round(fastenerSpecTotalPrice))} ₽` : '—'}</td>
              </tr>

              <tr className="spec-section-row">
                <td colSpan={7}>Комплектующие</td>
              </tr>
              {trimRows.length > 0 ? (
                trimRows.map((row) => (
                  <tr key={`trim-${row.key}`}>
                    <td>Комплектующие</td>
                    <td>{row.item}</td>
                    <td>{row.priceItem?.name ?? 'Нет позиции в прайсе'}</td>
                    <td>{row.pieces}</td>
                    <td>шт</td>
                    <td>{row.priceItem?.price ? `${formatInt(row.priceItem.price)} ₽/шт` : '—'}</td>
                    <td>{row.totalPrice ? `${formatInt(Math.round(row.totalPrice))} ₽` : '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td>Комплектующие</td>
                  <td colSpan={6}>Нет проемов и фасонных углов для расчета комплектующих.</td>
                </tr>
              )}
              <tr className="spec-total-row">
                <td colSpan={6}>Итого по разделу: Комплектующие</td>
                <td>{trimSpecTotalPrice > 0 ? `${formatInt(Math.round(trimSpecTotalPrice))} ₽` : '—'}</td>
              </tr>

              <tr className="spec-section-row">
                <td colSpan={7}>Утеплитель и пленки</td>
              </tr>
              {project.insulation.enabled ? (
                <tr>
                  <td>Утеплитель</td>
                  <td>Минераловатный утеплитель, толщина {project.insulation.thicknessMm} мм</td>
                  <td>Позиция утеплителя подбирается по проекту</td>
                  <td>{insulationVolumeM3.toFixed(3).replace('.', ',')}</td>
                  <td>м³</td>
                  <td>—</td>
                  <td>—</td>
                </tr>
              ) : null}
              {project.insulation.enabled && openingInsulationBorderAreaM2 > 0 ? (
                <tr>
                  <td>Утеплитель</td>
                  <td>Окантовка проемов минераловатной плитой 150 мм</td>
                  <td>Отдельная полоса вокруг окон и дверей</td>
                  <td>{openingInsulationBorderVolumeM3.toFixed(3).replace('.', ',')}</td>
                  <td>м³</td>
                  <td>—</td>
                  <td>—</td>
                </tr>
              ) : null}
              {project.insulation.enabled && project.insulation.membrane ? (
                <tr>
                  <td>Пленки</td>
                  <td>Ветрозащитная мембрана</td>
                  <td>{membranePriceItem.name}</td>
                  <td>{membraneRolls > 0 ? formatInt(membraneRolls) : '—'}</td>
                  <td>рул.</td>
                  <td>{`${formatPrice(membranePriceItem.price)} ₽/м²`}</td>
                  <td>{membraneTotalPrice > 0 ? `${formatInt(Math.round(membraneTotalPrice))} ₽` : '—'}</td>
                </tr>
              ) : null}
              <tr className="spec-total-row">
                <td colSpan={6}>Итого по разделу: Утеплитель и пленки</td>
                <td>
                  {insulationAndMembraneTotalPrice > 0 ? `${formatInt(Math.round(insulationAndMembraneTotalPrice))} ₽` : '—'}
                </td>
              </tr>
              <tr>
                <td colSpan={5}>Итого по сводной спецификации</td>
                <td>{fullSpecPricePerM2 > 0 ? `${formatPrice(fullSpecPricePerM2)} ₽/м²` : '—'}</td>
                <td>{fullSpecTotalPrice > 0 ? `${formatInt(Math.round(fullSpecTotalPrice))} ₽` : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="cassette-spec-notes">
          <div className="hint" style={{ textAlign: 'left' }}>
            Итого: кассеты {cassetteSpecTotalPrice > 0 ? `${formatInt(Math.round(cassetteSpecTotalPrice))} ₽` : '—'}, подсистема {subsystemSpecTotalPrice > 0 ? `${formatInt(Math.round(subsystemSpecTotalPrice))} ₽` : '—'}, крепеж {fastenerSpecTotalPrice > 0 ? `${formatInt(Math.round(fastenerSpecTotalPrice))} ₽` : '—'}, комплектующие {trimSpecTotalPrice > 0 ? `${formatInt(Math.round(trimSpecTotalPrice))} ₽` : '—'}.
          </div>
          {openingCountTotal > 0 ? (
            <div className="hint" style={{ textAlign: 'left', marginTop: 4 }}>
              Проемы: {openingCountTotal} шт. В подсистеме добавлена рамка обрамления проемов: {roundUpToStockLength(openingFrameProfileLm).toFixed(2).replace('.', ',')} п.м профилей, включая {openingIntermediateVerticalCount} промежуточных вертикальных профилей для проемов шире 1200 мм.
            </div>
          ) : null}
          {openingCountTotal > 0 ? (
            <div className="hint" style={{ textAlign: 'left', marginTop: 4 }}>
              Глубина откосных элементов рассчитана с учетом выноса системы: {Math.round(openingTrimRequiredDepthMm)} мм = утеплитель + вентзазор + профиль + толщина кассеты + запас {openingTrimReturnReserveMm} мм.
            </div>
          ) : null}
          {openingCountTotal > 0 && (openingSlopeElementOversized || openingDripOversized) ? (
            <div className="hint" style={{ textAlign: 'left', marginTop: 4, color: '#8f1d1d' }}>
              Внимание: расчетная глубина проема больше типовых позиций {openingSlopeElementOversized ? 'ОЭк260' : ''}{openingSlopeElementOversized && openingDripOversized ? ' и ' : ''}{openingDripOversized ? 'Вс250' : ''}; требуется индивидуальный доборный элемент.
            </div>
          ) : null}
          {!project.hasCornerCassettes && project.outsideCorners > 0 ? (
            <div className="hint" style={{ textAlign: 'left', marginTop: 4 }}>
              Наружные углы оформляются уголком, поэтому угол наружный добавлен в комплектующие по высоте углов.
            </div>
          ) : null}
          <div className="hint" style={{ textAlign: 'left', marginTop: 4 }}>
            Фасонные элементы считаются по расчетной длине и переводятся в стандартные элементы 3 м с округлением вверх. Для кассет скрытого типа крепления КФ-2/КФ-3 применяются углы УСНс/УСВс, для кассет открытого типа крепления КФ-1/КФ-4 — уголки УНс/УВс. Крепеж: боковые линии 600 мм, верхние и водоотводящие элементы 400 мм, начальная планка по несущим профилям.
          </div>
        </div>
      </section>

      <section className="section packaging-section">
        <div className="section-head">
          <div>
            <div className="section-title">Расчет упаковок</div>
          </div>
          <div className="section-sub">
            {packagingRows.length > 0
              ? `${formatInt(packagingRows.length)} упак. / ${formatInt(totalPackagingPieces)} шт`
              : 'Заполните кассеты'}
          </div>
        </div>

        <div className="packaging-summary-grid">
          <div className="summary-item">
            <div className="summary-name">Тип кассеты</div>
            <div className="summary-val">{project.selectedCassetteType}</div>
          </div>
          <div className="summary-item">
            <div className="summary-name">Глубина D</div>
            <div className="summary-val">{getCassettePackagingDepthMm(project.selectedCassetteType)} мм</div>
          </div>
          <div className="summary-item">
            <div className="summary-name">Рядов</div>
            <div className="summary-val">{totalPackagingRows > 0 ? formatInt(totalPackagingRows) : '—'}</div>
          </div>
          <div className="summary-item">
            <div className="summary-name">Упаковок</div>
            <div className="summary-val">{packagingRows.length > 0 ? formatInt(packagingRows.length) : '—'}</div>
          </div>
        </div>

        <div className="cassette-spec-table-wrap packaging-table-wrap">
          <table className="cassette-spec-table packaging-table">
            <thead>
              <tr>
                <th>Уп.</th>
                <th>Габариты упаковки (ДхШхВ)</th>
                <th>Ряды</th>
                <th>Кассеты</th>
                <th>Состав</th>
                <th>Примечание</th>
              </tr>
            </thead>
            <tbody>
              {packagingRows.length > 0 ? (
                packagingRows.map((row) => (
                  <tr key={row.id}>
                    <td>уп{row.id}</td>
                    <td>{row.lengthMm}х{row.widthMm}х{row.heightMm}</td>
                    <td>{formatInt(row.rowCount)}</td>
                    <td>{formatInt(row.pieceCount)} шт</td>
                    <td>
                      {row.items.map((item) => (
                        <div className="packaging-item-line" key={item.key}>
                          {item.name}: H {item.hMm}; L {item.lMm} - {formatInt(item.pieces)} шт
                        </div>
                      ))}
                    </td>
                    <td>{row.note}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>Заполните размер кассет и фасады, чтобы получить расчет упаковок.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {packagingHasCornerCassettesOutside ? (
          <div className="cassette-spec-notes">
            <div className="hint" style={{ textAlign: 'left' }}>
              Угловые кассеты пока показаны в спецификации отдельно и не включены в этот расчет упаковок.
            </div>
          </div>
        ) : null}
      </section>

      <section className="section pending-costs-section">
        <div className="section-head">
          <div>
            <div className="section-title-line">
              <div className="section-title">Дополнительные расчеты</div>
              <button className="field-help field-help-header" type="button" onClick={() => setPendingCostsHelpOpen(true)} aria-label="Справка по дополнительным расчетам">
                ?
              </button>
            </div>
          </div>
          <div className="section-sub">Проектирование и монтажная схема будут рассчитаны после утверждения алгоритмов.</div>
        </div>

        <div className="pending-costs-grid">
          <div className="pending-cost-card">
            <div className="pending-cost-name">Стоимость проектирования</div>
            <div className="pending-cost-status">В разработке</div>
          </div>
          <div className="pending-cost-card">
            <div className="pending-cost-name">Стоимость разработки монтажной схемы</div>
            <div className="pending-cost-status">В разработке</div>
          </div>
        </div>
      </section>

      <section className="methodology-link-section">
        <div>
          <div className="methodology-link-title">Методика расчета</div>
          <div className="methodology-link-sub">
            Подробное описание расчетного ядра, формул, допущений, источников и текущих ограничений калькулятора.
          </div>
        </div>
        <div className="methodology-link-actions">
          <button className="btn btn-primary" type="button" onClick={() => setMethodologyOpen(true)}>
            Открыть методику расчета
          </button>
        </div>
      </section>

      {facadesHelpOpen ? (
        <HelpModal title="Фасады" subtitle="Что менеджеру уточнить у клиента перед расчетом." onClose={() => setFacadesHelpOpen(false)}>
          <h3>Как объяснить клиенту</h3>
          <p>Фасад в калькуляторе — это отдельная плоскость здания: например лицевая сторона, торец или одинаковая секция. Для каждой плоскости задаются ширина, высота и количество повторов.</p>
          <h3>Что уточнить</h3>
          <p>Нужны размеры в миллиметрах, количество одинаковых фасадов и наличие окон или дверей. Если есть проемы, их размеры важно внести отдельно: они уменьшают площадь кассет и добавляют обрамление.</p>
          <h3>Фраза для клиента</h3>
          <p>«Чтобы расчет был ближе к реальности, мне нужны размеры каждой стороны фасада и отдельно окна/двери. Одинаковые участки можно указать количеством, это ускорит расчет».</p>
        </HelpModal>
      ) : null}

      {cornersHelpOpen ? (
        <HelpModal title="Углы" subtitle="Как объяснить оформление наружных и внутренних углов." onClose={() => setCornersHelpOpen(false)}>
          <h3>Что это значит</h3>
          <p>Углы — это места стыка фасадных плоскостей. Их можно оформить угловой кассетой или отдельным уголком. Высота углов обычно равна высоте самого высокого фасада, но ее можно изменить вручную.</p>
          <h3>Что сказать клиенту</h3>
          <p>Угловая кассета выглядит цельнее и аккуратнее, но требует правильного учета полок и выноса подсистемы. Уголок проще и часто дешевле, но визуально это отдельный фасонный элемент.</p>
          <h3>Что уточнить</h3>
          <p>Количество наружных и внутренних углов, желаемый внешний вид и есть ли требование делать угол без отдельного видимого уголка.</p>
        </HelpModal>
      ) : null}

      {subsystemTypeHelpOpen ? (
        <HelpModal title="Подсистема" subtitle="Короткая справка для ответа клиенту при выборе Г-образной или П-образной системы." onClose={() => setSubsystemTypeHelpOpen(false)}>
          <h3>Что такое подсистема</h3>
          <p>Подсистема — это несущий металлический каркас между стеной и фасадными кассетами. Она держит облицовку, формирует вентиляционный зазор, помогает выставить плоскость фасада и передает нагрузку на основание через кронштейны и анкеры.</p>
          <h3>Г-образная система</h3>
          <p>Г-образная подсистема обычно воспринимается как более простая и экономичная схема. Ее удобно предлагать для типовых фасадов, когда основание позволяет выставить плоскость без сложной регулировки.</p>
          <h3>П-образная система</h3>
          <p>П-образная подсистема дает больше жесткости и возможностей для раскладки направляющих. Она лучше подходит, когда фасад сложнее, есть требования к выносу, утеплению, крупным кассетам или более точной геометрии облицовки.</p>
          <h3>Как выбрать в разговоре</h3>
          <p>Если клиент просит «оптимально по цене» и фасад простой, начинаем с более рациональной схемы. Если объект сложный, основание неровное, кассеты крупные или важна точная плоскость, объясняем пользу П-образной и двухуровневой системы.</p>
        </HelpModal>
      ) : null}

      {pLevelsHelpOpen ? (
        <HelpModal title="Уровни П-образной подсистемы" subtitle="Единая справка по одноуровневой и двухуровневой П-образной системе." onClose={() => setPLevelsHelpOpen(false)}>
          <h3>Одноуровневая</h3>
          <p>Более простая схема: кронштейны крепятся к стене, к ним ставятся вертикальные направляющие, а на них монтируются кассеты. Обычно это рациональнее по стоимости и быстрее в монтаже для типовых ровных фасадов.</p>
          <h3>Двухуровневая</h3>
          <p>Более гибкая схема: сначала формируется первый уровень направляющих, затем второй уровень под раскладку кассет. Ее стоит предлагать при неровном основании, сложной геометрии, крупных кассетах и повышенных требованиях к плоскости.</p>
          <h3>Как объяснить разницу клиенту</h3>
          <p>«Одноуровневая система проще и обычно дешевле. Двухуровневая дороже из-за большего количества профилей, но дает больше регулировки и помогает аккуратнее вывести фасад на сложных объектах».</p>
          <h3>Что считает калькулятор</h3>
          <p>Для одноуровневой схемы считаются КВП, НПП, прокладки, шайбы, анкеры и заклепки. Для двухуровневой дополнительно учитываются горизонтальные/вертикальные профили и промежуточный НПШ для кассет длиной больше 800 мм.</p>
        </HelpModal>
      ) : null}

      {cassettesHelpOpen ? (
        <HelpModal title="Кассеты" subtitle="Как менеджеру объяснить тип крепления, размер и раскладку." onClose={() => setCassettesHelpOpen(false)}>
          <h3>Что выбираем</h3>
          <p>В этом разделе выбирается тип кассет, толщина металла, покрытие и рабочий размер L/H. От этих параметров зависит цена, количество кассет и часть крепежа.</p>
          <h3>Открытый и скрытый тип крепления</h3>
          <p>Кассеты открытого типа крепления проще объяснять как вариант с видимым крепежом. Кассеты скрытого типа крепления дают более чистый внешний вид, потому что крепеж визуально меньше заметен.</p>
          <h3>Что уточнить</h3>
          <p>Желаемый внешний вид, направление раскладки, допустимые размеры кассет, цвет/покрытие и есть ли ограничения по стандартным размерам. Проемы в расчете вычитаются из площади кассет.</p>
        </HelpModal>
      ) : null}

      {insulationHelpOpen ? (
        <HelpModal title="Утеплитель и пленки" subtitle="Как объяснить клиенту утепление, мембрану и влияние на расчет." onClose={() => setInsulationHelpOpen(false)}>
          <h3>Если утеплитель есть</h3>
          <p>Калькулятор учитывает толщину утеплителя, объем материала, крепеж утеплителя и ветрозащитную мембрану, если она включена. Толщина влияет на вынос подсистемы и подбор кронштейнов.</p>
          <h3>Если утеплителя нет</h3>
          <p>Расчет ведется как фасад без утепления: толщина утеплителя принимается равной нулю, а кронштейны и угловые выносы считаются только от вентзазора и профиля.</p>
          <h3>Фраза для клиента</h3>
          <p>«Утепление влияет не только на материал, но и на вынос фасада: чем толще утеплитель, тем больше нужен кронштейн и тем меняется состав подсистемы».</p>
        </HelpModal>
      ) : null}

      {specHelpOpen ? (
        <HelpModal title="Сводная спецификация" subtitle="Как читать итоговую таблицу и объяснять ее клиенту." onClose={() => setSpecHelpOpen(false)}>
          <h3>Что показывает таблица</h3>
          <p>Сводная спецификация собирает в одном месте кассеты, подсистему, крепеж, комплектующие, утеплитель и пленки. Итоговая сумма и цена за квадратный метр считаются по заполненным позициям.</p>
          <h3>Почему могут быть пустые цены</h3>
          <p>Если по позиции нет цены или позиции нет в прайсе, калькулятор показывает прочерк. Это значит, что менеджеру нужно уточнить цену или загрузить актуальный прайс Excel.</p>
          <h3>Что говорить клиенту</h3>
          <p>«Это предварительная спецификация по введенным размерам. После проверки проекта, узлов и актуального прайса итоговая стоимость может быть уточнена».</p>
        </HelpModal>
      ) : null}

      {pendingCostsHelpOpen ? (
        <HelpModal title="Дополнительные расчеты" subtitle="Что будет добавлено после утверждения алгоритмов." onClose={() => setPendingCostsHelpOpen(false)}>
          <h3>Что здесь будет</h3>
          <p>В этот блок будут добавлены стоимость проектирования, разработка монтажной схемы и стоимость упаковки. Количество упаковок уже считается отдельным разделом на основной странице.</p>
          <h3>Как объяснить клиенту</h3>
          <p>«Материалы уже считаются в спецификации. Проектирование, монтажная схема и упаковка будут добавлены отдельными строками, когда будут утверждены правила расчета».</p>
        </HelpModal>
      ) : null}
    </div>
  )
}

