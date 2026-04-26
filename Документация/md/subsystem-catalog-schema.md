# Нормализованный справочник подсистемы

Этот файл задает структуру данных для калькулятора по элементам подсистемы.

## 1. Общая модель записи

Каждая позиция подсистемы должна приводиться к единому виду:

```json
{
  "productType": "bracket | profile | fastener | reinforcement",
  "family": "kvp | kvgu | npp | npsh | npg | npgs | pz | rivet | bracket_washer",
  "code": "118238",
  "name": "Кронштейн выравнивающий усиленный Г-50х230 (КВГУ 50х230) 2,0 (Оцинк.)",
  "unit": "pcs | lm",
  "price": 34,
  "weight": 0.239,
  "coating": "galvanized | colorflow_2s | colorflow_1s | other",
  "steelGrade": "none | p350 | p390",
  "status": "active | do_not_use | temporary"
}
```

## 2. Кронштейны

### 2.1. КВП

```json
{
  "productType": "bracket",
  "family": "kvp",
  "series": "p",
  "size": "125m | 200 | 250",
  "code": "118267",
  "unit": "pcs",
  "price": 19,
  "coating": "galvanized"
}
```

Поля:
- `series`: всегда `p`
- `size`: `125m | 200 | 250`

### 2.2. КВГУ

```json
{
  "productType": "bracket",
  "family": "kvgu",
  "series": "g",
  "widthSeries": 50,
  "length": 230,
  "thickness": 2.0,
  "code": "118238",
  "unit": "pcs",
  "price": 34,
  "coating": "galvanized",
  "steelGrade": "none"
}
```

Поля:
- `series`: всегда `g`
- `widthSeries`: `50 | 95`
- `length`: длина кронштейна в мм
- `thickness`: толщина металла

## 3. Направляющие и профили

### 3.1. НПП

```json
{
  "productType": "profile",
  "family": "npp",
  "width": 60,
  "height": 27,
  "thickness": 1.0,
  "code": "117900",
  "unit": "lm",
  "price": 128,
  "coating": "galvanized"
}
```

### 3.2. НПГ

```json
{
  "productType": "profile",
  "family": "npg",
  "leg": 50,
  "thickness": 1.0,
  "code": "118128",
  "unit": "lm",
  "price": 96,
  "coating": "galvanized"
}
```

Поля:
- `leg`: `40 | 50`

### 3.3. НПШ

```json
{
  "productType": "profile",
  "family": "npsh",
  "profileType": "hat",
  "dimensions": [20, 50, 20],
  "thickness": 1.0,
  "code": "118058",
  "unit": "lm",
  "price": 121,
  "coating": "galvanized"
}
```

Дополнительно:
- для позиции `НПШ20 0,7х3м`:
  - `dimensions = [20]`
  - `unit = pcs`
  - `length = 3000`

### 3.4. НПГС / ПГС

```json
{
  "productType": "profile",
  "family": "npgs",
  "dimensions": [103, 50],
  "thickness": 1.0,
  "code": "137914",
  "unit": "lm",
  "price": 212,
  "coating": "galvanized"
}
```

### 3.5. PZ / Z

```json
{
  "productType": "profile",
  "family": "pz",
  "dimensions": [105],
  "perforation": false,
  "thickness": 1.2,
  "code": "117902",
  "unit": "lm",
  "price": 263,
  "coating": "galvanized"
}
```

## 4. Крепеж подсистемы

### 4.1. Заклепки

```json
{
  "productType": "fastener",
  "family": "rivet",
  "materialPair": "steel_steel",
  "diameter": 4.8,
  "length": 8,
  "code": "10367",
  "unit": "pcs",
  "price": 2.48,
  "finish": "plain"
}
```

Поля:
- `materialPair`: `steel_steel | stainless_stainless | other`
- `finish`: `plain | ral`

### 4.2. Шайба усиления кронштейна

```json
{
  "productType": "reinforcement",
  "family": "bracket_washer",
  "size": "sh50",
  "code": "8284",
  "unit": "pcs",
  "price": 6,
  "coating": "galvanized"
}
```

## 5. Нормализация покрытий

Использовать единый словарь:

| Исходное название | Нормализованное значение |
| --- | --- |
| `Оцинк.` | `galvanized` |
| `Колор-поток с двух сторон` | `colorflow_2s` |
| `Колор-поток с лицевой стороны` | `colorflow_1s` |
| `П350 (Оцинк.)` | `galvanized`, `steelGrade = p350` |
| `П390 (Оцинк.)` | `galvanized`, `steelGrade = p390` |

## 6. Нормализация статуса позиции

| Признак в названии | `status` |
| --- | --- |
| без специальных пометок | `active` |
| `Не использовать!` | `do_not_use` |
| `[[врем]]` | `temporary` |

## 7. Примеры реальных записей

### КВП 200

```json
{
  "productType": "bracket",
  "family": "kvp",
  "series": "p",
  "size": "200",
  "code": "118267",
  "name": "Кронштейн выравнивающий П-200 (КВП 200) (Оцинк.)",
  "unit": "pcs",
  "price": 19,
  "weight": 0.15,
  "coating": "galvanized",
  "steelGrade": "none",
  "status": "active"
}
```

### КВГУ 50x230 2.0

```json
{
  "productType": "bracket",
  "family": "kvgu",
  "series": "g",
  "widthSeries": 50,
  "length": 230,
  "thickness": 2.0,
  "code": "118238",
  "name": "Кронштейн выравнивающий усиленный Г-50х230 (КВГУ 50х230) 2,0 (Оцинк.)",
  "unit": "pcs",
  "price": 34,
  "weight": 0.239,
  "coating": "galvanized",
  "steelGrade": "none",
  "status": "active"
}
```

### НПП 60x27x1.0

```json
{
  "productType": "profile",
  "family": "npp",
  "width": 60,
  "height": 27,
  "thickness": 1.0,
  "code": "117900",
  "name": "НПП 60х27х1,0 (Оцинк.)",
  "unit": "lm",
  "price": 128,
  "weight": 1.0097,
  "coating": "galvanized",
  "steelGrade": "none",
  "status": "active"
}
```

### НПГ 50 1.0

```json
{
  "productType": "profile",
  "family": "npg",
  "leg": 50,
  "thickness": 1.0,
  "code": "118128",
  "name": "Направляющий профиль Г-образный 50 (НПГ 50) 1,0 (Оцинк.)",
  "unit": "lm",
  "price": 96,
  "weight": 0.7592,
  "coating": "galvanized",
  "steelGrade": "none",
  "status": "active"
}
```

### Заклепка 4.8x8

```json
{
  "productType": "fastener",
  "family": "rivet",
  "materialPair": "steel_steel",
  "diameter": 4.8,
  "length": 8,
  "code": "10367",
  "name": "Заклепки сталь/сталь 4,8x8",
  "unit": "pcs",
  "price": 2.48,
  "weight": 0.003,
  "finish": "plain",
  "status": "active"
}
```

## 8. Что еще нужно добрать

- `ССП`, если найдем в следующей версии прайса
- термоизолирующие прокладки
- анкеры / фасадные дюбели как отдельные нормализованные позиции
