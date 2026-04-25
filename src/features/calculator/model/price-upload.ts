import * as XLSX from 'xlsx'

export interface UploadedPriceRow {
  code: string | null
  name: string
  unit: string | null
  price: number
  sheet: string
  rowNumber: number
}

export interface UploadedPriceData {
  fileName: string
  uploadedAt: string
  rows: UploadedPriceRow[]
}

type RawCell = string | number | boolean | Date | null | undefined

interface ParsedCell {
  index: number
  value: RawCell
  text: string
}

interface HeaderMap {
  code?: number
  name?: number
  unit?: number
  price?: number
}

export function normalizePriceCode(code: string | number | null | undefined) {
  if (code === null || code === undefined) return ''
  const raw = String(code).trim()
  if (!raw) return ''
  const compact = raw.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()
  return compact.replace(/^0+(?=\d)/, '')
}

export function buildUploadedPriceIndex(rows: UploadedPriceRow[]) {
  const index = new Map<string, UploadedPriceRow>()

  rows.forEach((row) => {
    const normalizedCode = normalizePriceCode(row.code)
    if (normalizedCode) index.set(normalizedCode, row)
  })

  return index
}

export function parsePriceWorkbook(buffer: ArrayBuffer): UploadedPriceRow[] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const rows: UploadedPriceRow[] = []

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    const table = XLSX.utils.sheet_to_json<RawCell[]>(sheet, {
      header: 1,
      defval: null,
      raw: true,
    })
    let headerMap: HeaderMap | null = null

    table.forEach((rawRow, rowIndex) => {
      const cells = rawRow
        .map((value, index) => ({
          index,
          value,
          text: value === null || value === undefined ? '' : String(value).trim(),
        }))
        .filter((cell) => cell.text !== '')

      if (cells.length === 0) return

      const possibleHeader = detectHeaderMap(cells)
      if (Object.keys(possibleHeader).length >= 1) {
        headerMap = { ...headerMap, ...possibleHeader }
        return
      }

      const parsed = parseRowByHeader(cells, headerMap) ?? parseRowByContent(cells)
      if (parsed) {
        rows.push({
          ...parsed,
          sheet: sheetName,
          rowNumber: rowIndex + 1,
        })
      }
    })
  })

  return rows
}

function parseRowByHeader(cells: ParsedCell[], headerMap: HeaderMap | null) {
  if (!headerMap || headerMap.price === undefined || headerMap.name === undefined) return null

  const cellByIndex = new Map(cells.map((cell) => [cell.index, cell]))
  const price = parsePrice(cellByIndex.get(headerMap.price)?.value)
  const name = cellByIndex.get(headerMap.name)?.text ?? ''
  if (!price || !isProductName(name)) return null

  return {
    code: cellByIndex.get(headerMap.code ?? -1)?.text || null,
    name,
    unit: normalizeUnit(cellByIndex.get(headerMap.unit ?? -1)?.text ?? ''),
    price,
  }
}

function parseRowByContent(cells: ParsedCell[]) {
  const unitCell = cells.find((cell) => normalizeUnit(cell.text))
  const priceCandidates = cells
    .map((cell) => ({ cell, price: parsePrice(cell.value) }))
    .filter((item) => item.price && item.price > 0)

  if (priceCandidates.length === 0) return null

  const priceCell =
    unitCell
      ? [...priceCandidates]
          .filter((item) => item.cell.index < unitCell.index)
          .sort((a, b) => Math.abs(b.cell.index - unitCell.index) - Math.abs(a.cell.index - unitCell.index))
          .pop() ?? priceCandidates[0]
      : priceCandidates[0]

  const codeCell = cells
    .filter((cell) => cell.index !== priceCell.cell.index)
    .filter((cell) => looksLikeCode(cell.text))
    .sort((a, b) => {
      const aBeforePrice = a.index < priceCell.cell.index ? 0 : 1
      const bBeforePrice = b.index < priceCell.cell.index ? 0 : 1
      return aBeforePrice - bBeforePrice || Math.abs(a.index - priceCell.cell.index) - Math.abs(b.index - priceCell.cell.index)
    })[0]

  const name = cells
    .filter((cell) => cell.index !== priceCell.cell.index && cell.index !== unitCell?.index && cell.index !== codeCell?.index)
    .filter((cell) => isProductName(cell.text))
    .sort((a, b) => b.text.length - a.text.length)[0]?.text

  if (!name || !priceCell.price) return null

  return {
    code: codeCell?.text ?? null,
    name,
    unit: normalizeUnit(unitCell?.text ?? ''),
    price: priceCell.price,
  }
}

function detectHeaderMap(cells: ParsedCell[]): HeaderMap {
  return cells.reduce<HeaderMap>((acc, cell) => {
    const normalized = normalizeText(cell.text)
    if (/(^|[^а-я])код([^а-я]|$)|артикул|номенклатур.*код/.test(normalized)) acc.code = cell.index
    if (/наимен|номенклатур|товар|продукц/.test(normalized)) acc.name = cell.index
    if (/ед.*изм|единиц|^ед$|^ед\.$/.test(normalized)) acc.unit = cell.index
    if (/цен|прайс|стоим/.test(normalized)) acc.price = cell.index
    return acc
  }, {})
}

function parsePrice(value: RawCell) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null

  const normalized = value
    .replace(/\s/g, '')
    .replace(/[₽р]/gi, '')
    .replace(',', '.')
  const price = Number(normalized)
  return Number.isFinite(price) ? price : null
}

function normalizeUnit(value: string) {
  const unit = normalizeText(value).replace(/\s/g, '')
  if (['шт', 'pcs'].includes(unit)) return 'шт'
  if (['м2', 'м²', 'm2'].includes(unit)) return 'м²'
  if (['м3', 'м³', 'm3'].includes(unit)) return 'м³'
  if (['пм', 'п.м', 'п.м.', 'мп', 'м.п.', 'м'].includes(unit)) return 'п.м'
  if (['рул', 'рул.', 'рулон'].includes(unit)) return 'рул.'
  return null
}

function looksLikeCode(value: string) {
  const trimmed = value.trim()
  return /^\d{3,12}$/.test(trimmed) || /^[a-zа-я0-9-]{4,18}$/i.test(trimmed)
}

function isProductName(value: string) {
  const normalized = normalizeText(value)
  if (normalized.length < 4) return false
  if (normalizeUnit(value)) return false
  if (parsePrice(value)) return false
  if (/полиэстер|оцинк|колор|color|ral|м2|шт|п\.?м/.test(normalized) && normalized.length < 24) return false
  return /\p{L}/u.test(value)
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, 'е')
}
