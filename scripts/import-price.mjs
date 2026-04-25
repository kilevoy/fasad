import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import * as XLSX from 'xlsx'

const parserVersion = 2
const outputPath = path.resolve('public', 'price.json')
const controlPrices = [
  { code: '2182', price: 1477, label: 'КФ-1 0,7' },
  { code: '68975', price: 2336, label: 'КФ-2 1,2 Колор-поток' },
  { code: '118224', price: 12, label: 'КВГУ 50х120 оцинк.' },
  { code: '118181', price: 33, label: 'КВГУ 50х120 Колор-поток' },
]

const sourcePath = process.argv[2]
if (!sourcePath) {
  console.error('Usage: npm run price:import -- "C:\\path\\price.xlsx"')
  process.exit(1)
}

const absoluteSourcePath = path.resolve(sourcePath)
if (!fs.existsSync(absoluteSourcePath)) {
  console.error(`Price file not found: ${absoluteSourcePath}`)
  process.exit(1)
}

const rows = parsePriceWorkbook(fs.readFileSync(absoluteSourcePath))
const index = buildPriceIndex(rows)
const errors = validatePriceRows(rows, index)

if (errors.length > 0) {
  console.error('Price import failed:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

const data = {
  fileName: path.basename(absoluteSourcePath),
  uploadedAt: new Date().toISOString(),
  parserVersion,
  rows,
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')

console.log(`Imported ${rows.length} price rows from ${absoluteSourcePath}`)
console.log(`Saved ${outputPath}`)
controlPrices.forEach((item) => {
  const row = index.get(normalizePriceCode(item.code))
  console.log(`OK ${item.code}: ${row.price} (${item.label})`)
})

function validatePriceRows(rows, index) {
  const errors = []
  if (rows.length < 100) errors.push(`too few parsed rows: ${rows.length}`)

  controlPrices.forEach((item) => {
    const row = index.get(normalizePriceCode(item.code))
    if (!row) {
      errors.push(`control code ${item.code} not found (${item.label})`)
      return
    }

    if (Math.abs(row.price - item.price) > 0.001) {
      errors.push(`control code ${item.code} price is ${row.price}, expected ${item.price} (${item.label})`)
    }
  })

  const suspicious = rows
    .filter((row) => ['2182', '68975', '118224', '118181'].includes(normalizePriceCode(row.code)))
    .filter((row) => row.price > 100000)
  if (suspicious.length > 0) {
    errors.push(`looks like "Цена за 1т" was imported as item price: ${suspicious.map((row) => `${row.code}=${row.price}`).join(', ')}`)
  }

  return errors
}

function parsePriceWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const rows = []

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    const table = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: true,
    })
    let headerMap = null

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

function parseRowByHeader(cells, headerMap) {
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

function parseRowByContent(cells) {
  const unitCell = cells.find((cell) => normalizeUnit(cell.text))
  const priceCandidates = cells
    .map((cell) => ({ cell, price: parsePrice(cell.value) }))
    .filter((item) => item.price && item.price > 0)

  if (priceCandidates.length === 0) return null

  const priceCell = unitCell
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

function detectHeaderMap(cells) {
  return cells.reduce((acc, cell) => {
    const normalized = normalizeText(cell.text)
    if (acc.code === undefined && /(^|[^а-я])код([^а-я]|$)|артикул|номенклатур.*код/.test(normalized)) acc.code = cell.index
    if (
      acc.name === undefined &&
      /наимен|номенклатур|товар|продукц/.test(normalized) &&
      !/групп|код/.test(normalized)
    ) {
      acc.name = cell.index
    }
    if (acc.unit === undefined && /ед.*изм|единиц|^ед$|^ед\.$/.test(normalized)) acc.unit = cell.index
    if (
      acc.price === undefined &&
      /цен|прайс|стоим/.test(normalized) &&
      !/тонн|(^|[^а-я0-9])т([^а-я0-9]|$)|1\s*т|вес/.test(normalized)
    ) {
      acc.price = cell.index
    }
    return acc
  }, {})
}

function parsePrice(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null

  const normalized = value
    .replace(/\s/g, '')
    .replace(/[₽р]/gi, '')
    .replace(',', '.')
  const price = Number(normalized)
  return Number.isFinite(price) ? price : null
}

function normalizeUnit(value) {
  const unit = normalizeText(value).replace(/\s/g, '')
  if (['шт', 'pcs'].includes(unit)) return 'шт'
  if (['м2', 'м²', 'm2'].includes(unit)) return 'м²'
  if (['м3', 'м³', 'm3'].includes(unit)) return 'м³'
  if (['пм', 'п.м', 'п.м.', 'мп', 'м.п.', 'м'].includes(unit)) return 'п.м'
  if (['рул', 'рул.', 'рулон'].includes(unit)) return 'рул.'
  return null
}

function buildPriceIndex(rows) {
  const index = new Map()
  rows.forEach((row) => {
    const normalizedCode = normalizePriceCode(row.code)
    if (normalizedCode) index.set(normalizedCode, row)
  })
  return index
}

function normalizePriceCode(code) {
  if (code === null || code === undefined) return ''
  const raw = String(code).trim()
  if (!raw) return ''
  const compact = raw.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()
  return compact.replace(/^0+(?=\d)/, '')
}

function looksLikeCode(value) {
  const trimmed = value.trim()
  return /^\d{3,12}$/.test(trimmed) || /^[a-zа-я0-9-]{4,18}$/i.test(trimmed)
}

function isProductName(value) {
  const normalized = normalizeText(value)
  if (normalized.length < 4) return false
  if (normalizeUnit(value)) return false
  if (parsePrice(value)) return false
  if (/полиэстер|оцинк|колор|color|ral|м2|шт|п\.?м/.test(normalized) && normalized.length < 24) return false
  return /\p{L}/u.test(value)
}

function normalizeText(value) {
  return value.trim().toLowerCase().replace(/ё/g, 'е')
}
