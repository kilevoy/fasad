import './index.css'
import { facadeCassetteTypes } from './entities/catalog/facade-cassette-types'
import { inventoryModules } from './entities/catalog/inventory-modules'
import { createDemoProject } from './features/calculator/model/create-demo-project'
import type { FacadeCassetteType } from './entities/project/types'

const project = createDemoProject()

function formatArea(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)
}

function formatInteger(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value)
}

function CassetteCard({ cassette }: { cassette: FacadeCassetteType }) {
  return (
    <article className="card cassette-card">
      <div className="pill-row">
        <span className="pill">{cassette.code}</span>
        <span className="muted">{cassette.fastenerVisibility}</span>
      </div>
      <h3>{cassette.name}</h3>
      <p>{cassette.description}</p>
      <ul className="compact-list">
        {cassette.recommendedSizes.map((size) => (
          <li key={size}>{size}</li>
        ))}
      </ul>
    </article>
  )
}

function App() {
  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <span className="eyebrow">GitHub Pages MVP</span>
          <h1>Калькулятор фасадных кассет и подсистемы</h1>
          <p className="hero-text">
            Стартовая бесплатная версия на GitHub: весь расчет в браузере,
            документы и прайс лежат рядом с проектом, а цены позже можно
            подключить без переделки инженерного ядра.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#roadmap">
              Что уже заложено
            </a>
            <a className="secondary-action" href="#model">
              Структура расчета
            </a>
          </div>
        </div>
        <aside className="hero-panel">
          <div className="metric">
            <span className="metric-label">Типы кассет</span>
            <strong>{facadeCassetteTypes.length}</strong>
          </div>
          <div className="metric">
            <span className="metric-label">Материальные блоки</span>
            <strong>{inventoryModules.length}</strong>
          </div>
          <div className="metric">
            <span className="metric-label">Площадь demo-фасада</span>
            <strong>{formatArea(project.facades[0].widthMm * project.facades[0].heightMm / 1_000_000)} м²</strong>
          </div>
        </aside>
      </header>

      <main className="content">
        <section className="section" id="roadmap">
          <div className="section-heading">
            <span className="section-kicker">Основа MVP</span>
            <h2>Что уже есть в каркасе</h2>
          </div>
          <div className="grid two-up">
            <article className="card">
              <h3>Архитектура под расчет</h3>
              <p>
                Приложение сразу разделено на UI, расчетное ядро, справочники и
                будущий модуль цен. Это позволит сначала довести количество
                материалов, а потом просто подключить прайс.
              </p>
            </article>
            <article className="card">
              <h3>Модель материалов</h3>
              <p>
                В проект уже заложены кассеты, подсистема, утеплитель, мембрана,
                саморезы, заклепки и крепеж. Эти блоки станут основой итоговой
                спецификации.
              </p>
            </article>
          </div>
        </section>

        <section className="section" id="model">
          <div className="section-heading">
            <span className="section-kicker">Кассеты</span>
            <h2>Типы, которые должны поддерживаться</h2>
          </div>
          <div className="grid cassette-grid">
            {facadeCassetteTypes.map((cassette) => (
              <CassetteCard key={cassette.code} cassette={cassette} />
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-heading">
            <span className="section-kicker">Материалы</span>
            <h2>Что калькулятор должен считать целиком</h2>
          </div>
          <div className="grid three-up">
            {inventoryModules.map((module) => (
              <article className="card" key={module.code}>
                <span className="pill">{module.code}</span>
                <h3>{module.name}</h3>
                <p>{module.description}</p>
                <ul className="compact-list">
                  {module.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-heading">
            <span className="section-kicker">Demo-проект</span>
            <h2>Как выглядит структура расчета</h2>
          </div>
          <div className="grid two-up">
            <article className="card">
              <h3>{project.name}</h3>
              <p>{project.description}</p>
              <dl className="spec-list">
                <div>
                  <dt>Фасадов</dt>
                  <dd>{formatInteger(project.facades.length)}</dd>
                </div>
                <div>
                  <dt>Проемов</dt>
                  <dd>{formatInteger(project.facades[0].openings.length)}</dd>
                </div>
                <div>
                  <dt>Тип кассеты</dt>
                  <dd>{project.selectedCassetteType}</dd>
                </div>
                <div>
                  <dt>Утепление</dt>
                  <dd>{project.insulation.thicknessMm} мм</dd>
                </div>
              </dl>
            </article>
            <article className="card">
              <h3>Следующие шаги разработки</h3>
              <ol className="numbered-list">
                <li>Реализовать расчет геометрии фасада и проемов.</li>
                <li>Добавить раскладку кассет КФ-1...КФ-4.</li>
                <li>Подключить расчет подсистемы, утеплителя и мембраны.</li>
                <li>Посчитать саморезы, заклепки, дюбели и анкеры.</li>
                <li>Подтянуть цены из Excel-прайса и собрать коммерческий итог.</li>
              </ol>
            </article>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
