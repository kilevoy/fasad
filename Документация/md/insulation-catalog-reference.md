# Нормализованный Справочник Утеплителя И Мембраны

Этот файл задает структуру данных для утеплителя, мембраны и дюбелей,
чтобы калькулятор мог отдельно:
- считать инженерные объемы и площади;
- хранить подтвержденные нормы;
- позже матчить реальные позиции прайса.

Связанные файлы:
- [insulation-and-membrane-rules.md](C:\КАЛЬКУЛЯТОР КАССЕТ\Документация\md\insulation-and-membrane-rules.md)
- [insulation-catalog.seed.json](C:\КАЛЬКУЛЯТОР КАССЕТ\Документация\data\insulation-catalog.seed.json)

## 1. Базовые семейства

| Семейство | Что это |
| --- | --- |
| `mineral_wool` | Минераловатный утеплитель |
| `glass_wool` | Стекловолокнистый утеплитель |
| `windproof_vapor_permeable` | Влаговетрозащитная паропроницаемая мембрана |
| `insulation_dowel` | Тарельчатый дюбель утеплителя |
| `membrane_joint_tape` | Скотч/лента для проклейки стыков мембраны |

## 2. Нормализованные типы записей

### 2.1. Утеплитель

```json
{
  "productType": "insulation",
  "family": "mineral_wool",
  "usage": "outer_layer | inner_layer | inner_layer_only",
  "densityMinKgM3": 75,
  "densityRecommendedKgM3": 80,
  "thermalConductivity": 0.045,
  "unit": "m3",
  "code": null,
  "price": null,
  "status": "needs_price"
}
```

### 2.2. Мембрана

```json
{
  "productType": "membrane",
  "family": "windproof_vapor_permeable",
  "brandHint": "TYVEK",
  "overlapMinMm": 150,
  "overlapMaxMm": 200,
  "jointTapeRequired": true,
  "unit": "m2",
  "code": null,
  "price": null,
  "status": "needs_price"
}
```

### 2.3. Дюбель утеплителя

```json
{
  "productType": "fastener",
  "family": "insulation_dowel",
  "usage": "single_layer_main_zone",
  "ratePerM2": 5,
  "plateDiameterMinMm": null,
  "unit": "pcs",
  "code": null,
  "price": null,
  "status": "needs_price"
}
```

## 3. Режимы применения утеплителя

Поддерживать как минимум такие режимы:

| `usage` | Смысл |
| --- | --- |
| `outer_layer` | наружный слой |
| `inner_layer` | внутренний слой |
| `inner_layer_only` | допустим только как внутренний слой |

## 4. Ключевые инженерные поля

### Для утеплителя
- `densityMinKgM3`
- `densityRecommendedKgM3`
- `thermalConductivity`
- `outerLayerRequiredMinMm`

### Для мембраны
- `overlapMinMm`
- `overlapMaxMm`
- `jointTapeRequired`

### Для дюбелей
- `usage`
- `ratePerM2`
- `plateDiameterMinMm`

## 5. Нормативные режимы расхода дюбелей

| Режим | `usage` | Норма |
| --- | --- | --- |
| Однослойное утепление, основная зона | `single_layer_main_zone` | `5 шт/м2` |
| Однослойное утепление, угловая/краевая зона | `single_layer_corner_zone` | `6 шт/м2` |
| Двухслойное утепление, основная зона | `double_layer_main_zone` | `10 шт/м2` |
| Двухслойное утепление, угловая/краевая зона | `double_layer_corner_zone` | `12 шт/м2` |

Отдельное правило:
- для мягкого первого слоя (`30–40 кг/м3`) тарелка дюбеля не менее `150 мм`.

## 6. Правила матчинга будущего прайса

### Для утеплителя

Искать по полям:
- `productType`
- `family`
- `usage`
- `densityMinKgM3` или ближайшая подходящая нормативная плотность
- `thickness` при появлении прайса

### Для мембраны

Искать по полям:
- `productType`
- `family`
- `brandHint`
- `rollWidth` и `rollLength`, когда они появятся в прайсе

### Для дюбелей

Искать по полям:
- `productType`
- `family`
- `plateDiameterMinMm`
- `length`
- `material`

## 7. Что уже можно брать в код

Уже можно использовать как нормативный seed:
- режимы однослойного и двухслойного утепления;
- нормы расхода дюбелей;
- мембрану как отдельную сущность;
- признак обязательной проклейки стыков мембраны;
- ограничение по стекловолокнистому утеплителю.

## 8. Что пока без цены

Пока как инженерные записи без прайсовых кодов:
- утеплитель;
- мембрана;
- дюбели утеплителя;
- лента для стыков мембраны.

Поэтому все стартовые записи пока имеют:
- `status = needs_price`

## 9. Практическое правило для калькулятора

Расчетный модуль сначала должен выдавать:
- площадь утепления;
- объем утеплителя;
- площадь мембраны;
- количество дюбелей;
- длину ленты для стыков, если этот режим включен.

И только потом слой прайса должен матчить это на реальные позиции склада.
