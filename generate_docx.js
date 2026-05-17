// Generates the course project Word document — ЧРТ template style
// Run: node generate_docx.js

const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
    ShadingType, PageBreak, PageNumber, Footer, Header, TabStopType,
    TabStopPosition, VerticalAlign
} = require('docx');
const fs = require('fs');
const path = require('path');

// --- Constants ---
const FONT   = 'Times New Roman';
const SZ     = 28;          // 14pt  (half-points)
const SZ_SM  = 24;          // 12pt  (tables)
const LINE15 = 360;         // 1.5 line spacing
const LINE10 = 240;         // single
const INDENT = 709;         // 1.25 cm first-line indent (dxa)
const PAGE_W = 11906;
const PAGE_H = 16838;
// ГОСТ margins: top/bottom 20mm = 1134, left 30mm = 1701, right 15mm = 850
const MARGIN = { top: 1134, right: 850, bottom: 1134, left: 1701 };
// Usable content width = 11906 - 1701 - 850 = 9355 dxa
const CONTENT_W = 9355;

// --- Paragraph helpers ---

/** Body paragraph: justified, 1.5, 1.25cm first-line, 14pt */
function body(text, opts = {}) {
    return new Paragraph({
        alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
        spacing: { line: LINE15, after: 0 },
        indent: opts.noIndent ? undefined : { firstLine: INDENT },
        children: [new TextRun({
            text, font: FONT, size: SZ,
            bold: !!opts.bold, italics: !!opts.italics,
        })],
    });
}

/** H1: page-break before, centered, 14pt bold, after 120, line 1.5 */
function h1(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 120, line: LINE15 },
        pageBreakBefore: true,
        children: [new TextRun({ text, font: FONT, size: SZ, bold: true })],
    });
}

/** H1 without page-break (for Contents) */
function h1nb(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 120, line: LINE15 },
        children: [new TextRun({ text, font: FONT, size: SZ, bold: true })],
    });
}

/** H2: centered, 14pt bold, before 240 after 120 */
function h2(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 120, line: LINE15 },
        children: [new TextRun({ text, font: FONT, size: SZ, bold: true })],
    });
}

/** Dash-bullet list item */
function bullet(text) {
    return new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: LINE15, after: 0 },
        children: [new TextRun({ text, font: FONT, size: SZ })],
    });
}

/** Table of contents line with dot leader */
function tocLine(title, page) {
    return new Paragraph({
        spacing: { line: LINE15, after: 0 },
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W - 100, leader: 'dot' }],
        children: [
            new TextRun({ text: title, font: FONT, size: SZ }),
            new TextRun({ text: `\t${page}`, font: FONT, size: SZ }),
        ],
    });
}

function tocSub(title, page) {
    return new Paragraph({
        spacing: { line: LINE15, after: 0 },
        indent: { left: 360 },
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W - 100, leader: 'dot' }],
        children: [
            new TextRun({ text: title, font: FONT, size: SZ }),
            new TextRun({ text: `\t${page}`, font: FONT, size: SZ }),
        ],
    });
}

/** Centered paragraph with optional spacing overrides */
function ctr(text, opts = {}) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { line: LINE15, before: opts.before || 0, after: opts.after || 0 },
        children: [new TextRun({
            text, font: FONT,
            size: opts.size || SZ,
            bold: !!opts.bold,
            italics: !!opts.italics,
        })],
    });
}

/** Left-aligned paragraph with optional spacing */
function lft(text, opts = {}) {
    return new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { line: LINE15, before: opts.before || 0, after: opts.after || 0 },
        children: [new TextRun({ text, font: FONT, size: opts.size || SZ })],
    });
}

/** Empty line */
function blank() {
    return new Paragraph({ spacing: { line: LINE15, after: 0 },
        children: [new TextRun({ text: '', font: FONT, size: SZ })] });
}

/** Table caption (left, before 240) */
function tblCaption(text) {
    return new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { line: LINE15, before: 240, after: 120 },
        children: [new TextRun({ text, font: FONT, size: SZ })],
    });
}

/** Figure caption (center) */
function figCaption(text) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { line: LINE15, before: 120, after: 240 },
        children: [new TextRun({ text, font: FONT, size: SZ })],
    });
}

/** Numbered reference list item */
function refItem(num, text) {
    return new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: LINE15, after: 0 },
        indent: { left: 360, hanging: 360 },
        children: [new TextRun({ text: `${num}. ${text}`, font: FONT, size: SZ })],
    });
}

/** Code listing line */
function code(text) {
    return new Paragraph({
        spacing: { line: LINE10, after: 0 },
        children: [new TextRun({ text, font: 'Courier New', size: 22 })],
    });
}

// --- Table helper ---
const solidBorder = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const cellBorders  = { top: solidBorder, bottom: solidBorder, left: solidBorder, right: solidBorder };
const noBorder     = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders    = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function tCell(text, opts = {}) {
    return new TableCell({
        borders: opts.noBorder ? noBorders : cellBorders,
        width: { size: opts.w || 3000, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        shading: opts.header ? { fill: 'EFEFEF', type: ShadingType.CLEAR } : undefined,
        children: [new Paragraph({
            alignment: opts.center ? AlignmentType.CENTER
                      : opts.right  ? AlignmentType.RIGHT
                      : AlignmentType.LEFT,
            spacing: { line: LINE10, after: 0 },
            children: [new TextRun({ text, font: FONT, size: SZ_SM, bold: !!opts.header })],
        })],
    });
}

// --- TITLE PAGE ---
// Matches ЧРТ template structure

/** No-border cell for title-page two-column block */
function titleCell(lines, w, align = AlignmentType.LEFT) {
    return new TableCell({
        borders: noBorders,
        width: { size: w, type: WidthType.DXA },
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        children: lines.map(([txt, bold]) => new Paragraph({
            alignment: align,
            spacing: { line: LINE15, after: 0 },
            children: [new TextRun({ text: txt, font: FONT, size: SZ, bold: !!bold })],
        })),
    });
}

const titlePage = [
    // 1. Шапка: учреждение
    ctr('Министерство образования Челябинской области', { after: 60 }),
    ctr('государственное бюджетное профессиональное образовательное', { after: 60 }),
    ctr('учреждение «Челябинский Радиотехнический техникум»', { after: 120 }),
    ctr('Специальность 09.02.07 «Информационные системы и программирование»', { after: 120 }),

    // 2. Два блока: ДОПУСТИТЬ К ЗАЩИТЕ (лево) | Проект защищен (право)
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [4600, 4755],
        rows: [new TableRow({
            children: [
                titleCell([
                    ['ДОПУСТИТЬ К ЗАЩИТЕ', true],
                    ['Заместитель директора по УР', false],
                    ['______________________', false],
                    ['«__»___________2026 г.', false],
                ], 4600),
                titleCell([
                    ['Проект защищен с оценкой', false],
                    ['_______________________', false],
                    ['«__»______________2026 г.', false],
                    ['________________________', false],
                    ['(подпись)', false],
                ], 4755, AlignmentType.LEFT),
            ],
        })],
    }),

    // 3. Название работы
    ctr('КУРСОВОЙ ПРОЕКТ', { bold: true, before: 600, after: 120 }),
    ctr('ПЛАТФОРМА ДЛЯ БЛОГИНГА И КОНТЕНТА', { bold: true, after: 120 }),
    ctr('Пояснительная записка', { after: 120 }),
    ctr('ЧРТ.09.02.07.001.26.00.ПЗ', { after: 240 }),

    // 4. Подписи: Разработчик / Руководитель
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [5200, 4155],
        rows: [
            new TableRow({
                children: [
                    titleCell([['______________ И.О. Фамилия', false]], 5200),
                    titleCell([['______________ И.О. Фамилия', false]], 4155),
                ],
            }),
            new TableRow({
                children: [
                    titleCell([['Разработчик:', false]], 5200),
                    titleCell([['Руководитель проекта:', false]], 4155),
                ],
            }),
        ],
    }),

    // 5. Город и год
    ctr('Челябинск, 2026', { before: 480, after: 0 }),
];

// --- CONTENTS ---
const contents = [
    h1nb('Содержание'),
    tocLine('Введение', '3'),
    tocLine('1 Аналитическая часть', '5'),
    tocSub('1.1 Обзор предметной области', '5'),
    tocSub('1.2 Анализ существующих решений', '7'),
    tocSub('1.3 Постановка задачи', '9'),
    tocLine('2 Проектная часть', '11'),
    tocSub('2.1 Выбор технологий разработки', '11'),
    tocSub('2.2 Проектирование архитектуры приложения', '13'),
    tocSub('2.3 Проектирование базы данных', '15'),
    tocLine('3 Практическая часть', '18'),
    tocSub('3.1 Реализация серверной части', '18'),
    tocSub('3.2 Реализация пользовательского интерфейса', '21'),
    tocSub('3.3 Тестирование и отладка', '24'),
    tocLine('Заключение', '26'),
    tocLine('Список использованных источников', '28'),
    tocLine('Приложение А. Листинг основных модулей', '30'),
];

// --- INTRODUCTION ---
const intro = [
    h1('Введение'),
    body('В современном цифровом мире блоги и контентные платформы занимают центральное место в распространении информации, обмене опытом и формировании общественного мнения. По данным аналитических агентств, ежедневно в сети публикуются миллионы новых статей, постов и заметок, а количество активных авторов и читателей онлайн-медиа продолжает стремительно расти.'),
    body('Несмотря на обилие крупных платформ — Medium, Habr, Яндекс Дзен и LiveJournal, — потребность в простых, легко развёртываемых и кастомизируемых решениях остаётся высокой. Учебные заведения, небольшие сообщества, корпоративные команды и отдельные авторы нуждаются в инструменте, который сочетал бы доступность, понятный интерфейс и возможность тонкой настройки.'),
    body('Актуальность темы обусловлена тем, что разработка собственной платформы для блогинга позволяет на практике освоить полный цикл создания современного веб-приложения: проектирование архитектуры, работу с базой данных, реализацию системы аутентификации, проектирование интерфейса и обеспечение безопасности.'),
    body('Объектом исследования являются веб-приложения, обеспечивающие функции публикации и обмена пользовательским контентом.'),
    body('Предметом исследования являются методы и средства разработки контентной платформы с использованием микрофреймворка Flask.'),
    body('Цель курсового проекта — спроектировать и реализовать веб-платформу для блогинга и публикации контента с возможностью регистрации пользователей, создания статей, комментирования и оценки публикаций.'),
    body('Для достижения поставленной цели необходимо решить следующие задачи:'),
    bullet('изучить предметную область и проанализировать существующие решения;'),
    bullet('определить функциональные и нефункциональные требования к платформе;'),
    bullet('выбрать стек технологий и обосновать его применение;'),
    bullet('спроектировать архитектуру приложения и структуру базы данных;'),
    bullet('реализовать серверную часть на языке Python с использованием Flask;'),
    bullet('разработать клиентский интерфейс с применением HTML5, CSS3 и Bootstrap 5;'),
    bullet('провести тестирование разработанного приложения.'),
    body('Практическая значимость работы заключается в создании готового программного продукта, применимого как учебный пример и основа для дальнейших разработок.'),
    body('Курсовой проект состоит из введения, трёх глав, заключения, списка источников и приложения.'),
];

// --- SECTION 1 ---
const sec1 = [
    h1('1 Аналитическая часть'),
    h2('1.1 Обзор предметной области'),
    body('Блогинг как форма публикации контента возник в конце 1990-х годов и за два с лишним десятилетия прошёл путь от простых онлайн-дневников до многомиллиардной индустрии. Современная контентная платформа представляет собой веб-приложение, обеспечивающее размещение, хранение и распространение текстового, графического и мультимедийного материала, а также взаимодействие между авторами и читателями.'),
    body('Типичная платформа для блогинга должна обеспечивать: регистрацию и авторизацию пользователей, создание и редактирование публикаций, организацию контента по категориям, поиск, комментирование, выражение оценок (лайки), персональные профили авторов.'),
    body('Особенностью таких систем является то, что основным «производителем» данных выступает сам пользователь. Это накладывает строгие требования к удобству интерфейса, скорости работы, отказоустойчивости и безопасности хранения персональных данных.'),

    h2('1.2 Анализ существующих решений'),
    body('Для определения сильных и слабых сторон существующих платформ проведён сравнительный анализ четырёх наиболее популярных в Рунете решений: Medium, Habr, Яндекс Дзен и LiveJournal. Результаты анализа представлены в таблице 1.'),
    tblCaption('Таблица 1 — Сравнительный анализ блогинг-платформ'),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2200, 1750, 1750, 1830, 1825],
        rows: [
            new TableRow({ tableHeader: true, children: [
                tCell('Критерий',    { header: true, center: true, w: 2200 }),
                tCell('Medium',     { header: true, center: true, w: 1750 }),
                tCell('Habr',       { header: true, center: true, w: 1750 }),
                tCell('Дзен',       { header: true, center: true, w: 1830 }),
                tCell('LiveJournal',{ header: true, center: true, w: 1825 }),
            ]}),
            new TableRow({ children: [tCell('Простота интерфейса',{w:2200}), tCell('Высокая',{center:true,w:1750}), tCell('Средняя',{center:true,w:1750}), tCell('Высокая',{center:true,w:1830}), tCell('Средняя',{center:true,w:1825})]}),
            new TableRow({ children: [tCell('Категоризация',{w:2200}), tCell('Теги',{center:true,w:1750}), tCell('Хабы+теги',{center:true,w:1750}), tCell('Авто',{center:true,w:1830}), tCell('Сообщества',{center:true,w:1825})]}),
            new TableRow({ children: [tCell('Бесплатность',{w:2200}), tCell('Частично',{center:true,w:1750}), tCell('Да',{center:true,w:1750}), tCell('Да',{center:true,w:1830}), tCell('Частично',{center:true,w:1825})]}),
            new TableRow({ children: [tCell('Открытый код',{w:2200}), tCell('Нет',{center:true,w:1750}), tCell('Нет',{center:true,w:1750}), tCell('Нет',{center:true,w:1830}), tCell('Нет',{center:true,w:1825})]}),
            new TableRow({ children: [tCell('Кастомизация',{w:2200}), tCell('Низкая',{center:true,w:1750}), tCell('Низкая',{center:true,w:1750}), tCell('Низкая',{center:true,w:1830}), tCell('Высокая',{center:true,w:1825})]}),
        ],
    }),
    body('Проведённый анализ показывает, что ни одно из рассмотренных решений не допускает развёртывания на собственном сервере без существенных ограничений. На основании анализа сделан вывод о целесообразности разработки собственного решения.'),

    h2('1.3 Постановка задачи'),
    body('На основании анализа сформулированы функциональные требования к платформе:'),
    bullet('регистрация пользователей с проверкой уникальности логина и email;'),
    bullet('аутентификация по логину/email и паролю;'),
    bullet('создание, редактирование и удаление статей автором;'),
    bullet('загрузка изображений-обложек публикаций;'),
    bullet('категоризация публикаций;'),
    bullet('постраничная лента публикаций;'),
    bullet('поиск по заголовку и тексту;'),
    bullet('комментирование статей зарегистрированными пользователями;'),
    bullet('выражение оценки публикаций (лайки);'),
    bullet('просмотр и редактирование персонального профиля;'),
    bullet('панель администратора: управление пользователями, публикациями, комментариями и категориями, просмотр статистики.'),
    body('Нефункциональные требования:'),
    bullet('кроссбраузерность (Chrome, Firefox, Edge актуальных версий);'),
    bullet('адаптивность интерфейса под мобильные устройства;'),
    bullet('хранение паролей в виде криптографических хешей;'),
    bullet('защита от SQL-инъекций, XSS и CSRF.'),
];

// --- SECTION 2 ---
const sec2 = [
    h1('2 Проектная часть'),
    h2('2.1 Выбор технологий разработки'),
    body('Выбор технологического стека обусловлен поставленными задачами, требованиями к производительности и опытом разработчика. Информация о применённых технологиях приведена в таблице 2.'),
    tblCaption('Таблица 2 — Технологический стек проекта'),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2400, 2400, 4555],
        rows: [
            new TableRow({ tableHeader: true, children: [
                tCell('Уровень',         { header: true, center: true, w: 2400 }),
                tCell('Технология',      { header: true, center: true, w: 2400 }),
                tCell('Обоснование',     { header: true, center: true, w: 4555 }),
            ]}),
            new TableRow({ children: [tCell('Серверная логика',{w:2400}), tCell('Python 3, Flask',{w:2400}), tCell('Лёгкий микрофреймворк, низкий порог входа, гибкая архитектура',{w:4555})]}),
            new TableRow({ children: [tCell('ORM',{w:2400}), tCell('SQLAlchemy',{w:2400}), tCell('Промышленный стандарт для Python, поддерживает большинство СУБД',{w:4555})]}),
            new TableRow({ children: [tCell('СУБД',{w:2400}), tCell('SQLite',{w:2400}), tCell('Не требует отдельного сервера, удобна для разработки',{w:4555})]}),
            new TableRow({ children: [tCell('Шаблонизатор',{w:2400}), tCell('Jinja2',{w:2400}), tCell('Интегрирован во Flask, поддерживает наследование шаблонов',{w:4555})]}),
            new TableRow({ children: [tCell('Разметка',{w:2400}), tCell('HTML5',{w:2400}), tCell('Современный стандарт семантической разметки',{w:4555})]}),
            new TableRow({ children: [tCell('Стилизация',{w:2400}), tCell('CSS3, Bootstrap 5',{w:2400}), tCell('Готовая сетка, адаптивные компоненты, единый стиль',{w:4555})]}),
            new TableRow({ children: [tCell('Клиентский скрипт',{w:2400}), tCell('JavaScript ES6',{w:2400}), tCell('Динамика интерфейса без SPA-фреймворков',{w:4555})]}),
            new TableRow({ children: [tCell('Аутентификация',{w:2400}), tCell('Flask-Login',{w:2400}), tCell('Сессии, защита маршрутов, удобная интеграция',{w:4555})]}),
        ],
    }),
    body('Использование Flask вместо более тяжёлого Django объясняется тем, что для разрабатываемого приложения избыточные «батарейки» не нужны, а компактность кодовой базы упрощает сопровождение.'),

    h2('2.2 Проектирование архитектуры приложения'),
    body('Приложение построено по классической трёхзвенной архитектуре: уровень представления, бизнес-логика и уровень доступа к данным. Такой подход обеспечивает разделение ответственности и упрощает модернизацию.'),
    body('Уровень представления формирует HTML-страницы через Jinja2-шаблоны. Стилизация — CSS и Bootstrap 5, интерактивные элементы — JavaScript.'),
    body('Уровень бизнес-логики реализован во Flask: определены маршруты, обрабатываются запросы, выполняется валидация данных и проверка прав доступа.'),
    body('Уровень доступа к данным реализован через SQLAlchemy ORM — модели описываются как классы Python и отображаются на таблицы реляционной БД.'),
    body('Обработка запроса:'),
    bullet('браузер отправляет HTTP-запрос;'),
    bullet('Flask по таблице маршрутов определяет функцию-обработчик;'),
    bullet('обработчик проверяет аутентификацию и валидирует данные;'),
    bullet('при необходимости выполняется запрос к БД через ORM;'),
    bullet('результат передаётся в шаблон Jinja2;'),
    bullet('сформированная HTML-страница возвращается клиенту.'),

    h2('2.3 Проектирование базы данных'),
    body('База данных включает четыре основные сущности и одну связующую таблицу. Описание приведено в таблице 3.'),
    tblCaption('Таблица 3 — Структура базы данных'),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [1800, 2600, 4955],
        rows: [
            new TableRow({ tableHeader: true, children: [
                tCell('Таблица',      { header: true, center: true, w: 1800 }),
                tCell('Назначение',   { header: true, center: true, w: 2600 }),
                tCell('Основные поля',{ header: true, center: true, w: 4955 }),
            ]}),
            new TableRow({ children: [tCell('user',{w:1800}),       tCell('Учётные записи',{w:2600}),          tCell('id, username, email, password_hash, bio, created_at',{w:4955})]}),
            new TableRow({ children: [tCell('post',{w:1800}),       tCell('Публикации',{w:2600}),              tCell('id, title, content, image, created_at, user_id, category_id, views',{w:4955})]}),
            new TableRow({ children: [tCell('category',{w:1800}),   tCell('Категории',{w:2600}),               tCell('id, name, slug',{w:4955})]}),
            new TableRow({ children: [tCell('comment',{w:1800}),    tCell('Комментарии',{w:2600}),             tCell('id, content, created_at, user_id, post_id',{w:4955})]}),
            new TableRow({ children: [tCell('post_likes',{w:1800}), tCell('Лайки (many-to-many)',{w:2600}),   tCell('user_id, post_id',{w:4955})]}),
        ],
    }),
    body('Между таблицами установлены связи: один пользователь — много публикаций и комментариев (один-ко-многим); одна статья — одна категория; пользователи и публикации — много-ко-многим через таблицу лайков.'),
];

// --- SECTION 3 ---
const sec3 = [
    h1('3 Практическая часть'),
    h2('3.1 Реализация серверной части'),
    body('Серверная часть реализована в единственном модуле app.py. Точкой входа является инициализация Flask. В конфигурации задаются секретный ключ, строка подключения к SQLite и путь для загрузки изображений. Авторизация — Flask-Login с декоратором @login_required для защиты маршрутов.'),
    body('Модель User содержит методы set_password и check_password на основе generate_password_hash / check_password_hash из Werkzeug. Пароли хранятся в виде хешей — восстановление невозможно.'),
    body('Маршрут лайков /post/<id>/like работает в режиме переключения: повторное обращение снимает лайк, что исключает необходимость отдельных URL для «поставить» и «снять».'),
    body('Загрузка изображений реализована через secure_filename из Werkzeug. К имени файла добавляется временная метка для исключения коллизий.'),
    body('Поиск основан на конструкции LIKE с фильтрацией по подстроке без учёта регистра — достаточно для проекта небольшого масштаба.'),
    body('Для администрирования системы реализована панель управления, защищённая декоратором admin_required. Декоратор проверяет, что текущий пользователь авторизован и имеет флаг is_admin. Панель включает 10 маршрутов: дашборд со статистикой, управление пользователями (просмотр, назначение/снятие прав администратора, удаление), управление публикациями, модерация комментариев, управление категориями (добавление, удаление). При удалении категории публикации не удаляются, а переводятся в режим «без категории».'),

    h2('3.2 Реализация пользовательского интерфейса'),
    body('Интерфейс построен на шаблонах Jinja2 с механизмом наследования. Базовый шаблон base.html содержит: подключение стилей, навигационную панель, flash-сообщения, контейнер и подвал. Остальные шаблоны переопределяют блок content.'),
    body('Главная страница отображает hero-секцию, ленту публикаций, боковую панель с категориями и блок популярных статей. Карточки публикаций — Bootstrap-сетка, адаптивная для мобильных.'),
    body('В файле style.css определены аватары из первой буквы имени (CSS-градиент), что исключает необходимость загрузки изображения по умолчанию.'),
    body('JavaScript-сценарии: автоскрытие flash-сообщений, автоувеличение textarea и кнопка «прокрутить вверх».'),
    body('Панель администратора имеет отдельный тёмный макет (admin/layout.html) с боковой навигацией (цвет #1e293b). Дашборд отображает счётчики ключевых сущностей и таблицы последних пользователей и публикаций. Страницы управления пользователями, публикациями, комментариями и категориями выполнены в виде таблиц с действиями. Ссылка на панель управления отображается в выпадающем меню навигации только для администраторов.'),

    h2('3.3 Тестирование и отладка'),
    body('Функциональное тестирование проводилось по сценариям, охватывающим основные пользовательские истории. Результаты приведены в таблице 4.'),
    tblCaption('Таблица 4 — Результаты функционального тестирования'),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [700, 3500, 3300, 1855],
        rows: [
            new TableRow({ tableHeader: true, children: [
                tCell('№',                    { header: true, center: true, w: 700 }),
                tCell('Тестовый сценарий',    { header: true, center: true, w: 3500 }),
                tCell('Ожидаемый результат',  { header: true, center: true, w: 3300 }),
                tCell('Результат',            { header: true, center: true, w: 1855 }),
            ]}),
            new TableRow({ children: [tCell('1',{center:true,w:700}), tCell('Регистрация нового пользователя',{w:3500}), tCell('Учётная запись создана, выполнен вход',{w:3300}), tCell('Пройден',{center:true,w:1855})]}),
            new TableRow({ children: [tCell('2',{center:true,w:700}), tCell('Регистрация с существующим логином',{w:3500}), tCell('Сообщение об ошибке',{w:3300}), tCell('Пройден',{center:true,w:1855})]}),
            new TableRow({ children: [tCell('3',{center:true,w:700}), tCell('Вход по логину и паролю',{w:3500}), tCell('Открывается главная страница',{w:3300}), tCell('Пройден',{center:true,w:1855})]}),
            new TableRow({ children: [tCell('4',{center:true,w:700}), tCell('Создание публикации с обложкой',{w:3500}), tCell('Статья сохранена, изображение отображается',{w:3300}), tCell('Пройден',{center:true,w:1855})]}),
            new TableRow({ children: [tCell('5',{center:true,w:700}), tCell('Поиск по заголовку и тексту',{w:3500}), tCell('Выводятся релевантные публикации',{w:3300}), tCell('Пройден',{center:true,w:1855})]}),
            new TableRow({ children: [tCell('6',{center:true,w:700}), tCell('Добавление комментария',{w:3500}), tCell('Комментарий отображается под статьёй',{w:3300}), tCell('Пройден',{center:true,w:1855})]}),
            new TableRow({ children: [tCell('7',{center:true,w:700}), tCell('Постановка и снятие лайка',{w:3500}), tCell('Счётчик корректно изменяется',{w:3300}), tCell('Пройден',{center:true,w:1855})]}),
            new TableRow({ children: [tCell('8',{center:true,w:700}), tCell('Доступ к странице без авторизации',{w:3500}), tCell('Перенаправление на страницу входа',{w:3300}), tCell('Пройден',{center:true,w:1855})]}),
            new TableRow({ children: [tCell('9',{center:true,w:700}), tCell('Открытие /admin обычным пользователем',{w:3500}), tCell('Ошибка 403, доступ запрещён',{w:3300}), tCell('Пройден',{center:true,w:1855})]}),
            new TableRow({ children: [tCell('10',{center:true,w:700}), tCell('Удаление пользователя администратором',{w:3500}), tCell('Пользователь и его публикации удалены',{w:3300}), tCell('Пройден',{center:true,w:1855})]}),
        ],
    }),
    body('При отладке устранены замечания по обработке пустых полей формы, отображению аватаров и срабатыванию уведомлений. Совместимость с Chrome 124, Firefox 125 и Edge 124 подтверждена — различий в отображении не обнаружено.'),
];

// --- CONCLUSION ---
const conclusion = [
    h1('Заключение'),
    body('В ходе выполнения курсового проекта разработана веб-платформа «InkSpot» для ведения блогов и публикации контента. Поставленные задачи решены в полном объёме.'),
    body('Проведён анализ предметной области и четырёх коммерческих платформ. На основании анализа сформулированы функциональные и нефункциональные требования.'),
    body('Выбран стек на базе Python, Flask и Bootstrap 5. Спроектирована трёхзвенная архитектура и реляционная база данных из пяти таблиц.'),
    body('Реализованы все функциональные возможности: регистрация и аутентификация, создание и редактирование публикаций, категоризация, поиск, комментирование, лайки и профили. Разработана панель администратора с управлением пользователями, публикациями, комментариями и категориями. Пароли хранятся в виде хешей; формы защищены от распространённых веб-уязвимостей.'),
    body('Проведено функциональное тестирование по десяти сценариям — все тесты пройдены. Подтверждена корректность отображения в трёх браузерах.'),
    body('Разработанная платформа может использоваться в учебных целях как пример веб-приложения, а также как основа небольших блогов или корпоративных площадок.'),
    body('Перспективы развития: полнотекстовый поиск, поддержка Markdown, система подписок, REST API, PostgreSQL в качестве СУБД.'),
];

// --- REFERENCES ---
const refs = [
    h1('Список использованных источников'),
    refItem(1,  'ГОСТ 2.105-2019. Единая система конструкторской документации. Общие требования к текстовым документам. — М.: Стандартинформ, 2019. — 30 с.'),
    refItem(2,  'Гринберг М. Разработка веб-приложений с использованием Flask на языке Python. — М.: ДМК Пресс, 2014. — 272 с.'),
    refItem(3,  'Лутц М. Изучаем Python. В 2 т. — 5-е изд. — М.: Вильямс, 2020.'),
    refItem(4,  'Никсон Р. Создаём динамические веб-сайты с помощью PHP, MySQL, JavaScript, CSS и HTML5. — 5-е изд. — СПб.: Питер, 2020. — 816 с.'),
    refItem(5,  'Дакетт Дж. HTML и CSS. Разработка и дизайн веб-сайтов. — М.: Эксмо, 2019. — 480 с.'),
    refItem(6,  'Документация Flask [Электронный ресурс]. — Режим доступа: https://flask.palletsprojects.com/ (дата обращения: 10.05.2026).'),
    refItem(7,  'Документация SQLAlchemy [Электронный ресурс]. — Режим доступа: https://docs.sqlalchemy.org/ (дата обращения: 10.05.2026).'),
    refItem(8,  'Документация Bootstrap 5 [Электронный ресурс]. — Режим доступа: https://getbootstrap.com/docs/5.3/ (дата обращения: 11.05.2026).'),
    refItem(9,  'Шкробанец М. JavaScript для веб-разработчика. — СПб.: Питер, 2021. — 416 с.'),
    refItem(10, 'OWASP Top 10 — 2021 [Электронный ресурс]. — Режим доступа: https://owasp.org/Top10/ (дата обращения: 12.05.2026).'),
    refItem(11, 'Документация MDN Web Docs [Электронный ресурс]. — Режим доступа: https://developer.mozilla.org/ (дата обращения: 12.05.2026).'),
    refItem(12, 'Werkzeug — The WSGI Toolkit [Электронный ресурс]. — Режим доступа: https://werkzeug.palletsprojects.com/ (дата обращения: 12.05.2026).'),
];

// --- APPENDIX ---
const appendix = [
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120, line: LINE15 },
        pageBreakBefore: true,
        children: [new TextRun({ text: 'Приложение А', font: FONT, size: SZ, bold: true })],
    }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120, line: LINE15 },
        children: [new TextRun({ text: '(обязательное)', font: FONT, size: SZ, italics: true })],
    }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240, line: LINE15 },
        children: [new TextRun({ text: 'Листинг основных модулей приложения', font: FONT, size: SZ, bold: true })],
    }),
    body('А.1 Фрагмент модели данных (app.py)', { noIndent: true }),
    code('class User(UserMixin, db.Model):'),
    code('    id = db.Column(db.Integer, primary_key=True)'),
    code('    username = db.Column(db.String(40), unique=True, nullable=False)'),
    code('    email = db.Column(db.String(120), unique=True, nullable=False)'),
    code('    password_hash = db.Column(db.String(255), nullable=False)'),
    code('    bio = db.Column(db.Text, default="")'),
    code(''),
    code('    def set_password(self, password):'),
    code('        self.password_hash = generate_password_hash(password)'),
    code(''),
    code('    def check_password(self, password):'),
    code('        return check_password_hash(self.password_hash, password)'),
    blank(),
    body('А.2 Маршрут создания публикации', { noIndent: true }),
    code('@app.route("/create", methods=["GET", "POST"])'),
    code('@login_required'),
    code('def create_post():'),
    code('    if request.method == "POST":'),
    code('        title = request.form.get("title", "").strip()'),
    code('        content = request.form.get("content", "").strip()'),
    code('        if not title or not content:'),
    code('            flash("Заполните заголовок и текст.", "danger")'),
    code('            return redirect(url_for("create_post"))'),
    code('        post = Post(title=title, content=content, user_id=current_user.id)'),
    code('        db.session.add(post)'),
    code('        db.session.commit()'),
    code('        return redirect(url_for("post_detail", post_id=post.id))'),
    code('    return render_template("post_form.html", post=None)'),
];

// --- Build Document ---
const allBody = [
    ...contents,
    ...intro,
    ...sec1,
    ...sec2,
    ...sec3,
    ...conclusion,
    ...refs,
    ...appendix,
];

const doc = new Document({
    creator: 'InkSpot',
    title: 'Платформа для блогинга и контента',
    styles: {
        default: { document: { run: { font: FONT, size: SZ } } },
        paragraphStyles: [
            {
                id: 'Heading1', name: 'Heading 1',
                basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { size: SZ, bold: true, font: FONT },
                paragraph: {
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 120, line: LINE15 },
                    outlineLevel: 0,
                },
            },
            {
                id: 'Heading2', name: 'Heading 2',
                basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { size: SZ, bold: true, font: FONT },
                paragraph: {
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 240, after: 120, line: LINE15 },
                    outlineLevel: 1,
                },
            },
        ],
    },
    numbering: {
        config: [{
            reference: 'bullets',
            levels: [{
                level: 0,
                format: LevelFormat.BULLET,
                text: '–',
                alignment: AlignmentType.LEFT,
                style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            }],
        }],
    },
    sections: [
        // Section 1 — Title page (no page numbers)
        {
            properties: {
                page: { size: { width: PAGE_W, height: PAGE_H }, margin: MARGIN },
                titlePage: true,
            },
            children: titlePage,
        },
        // Section 2 — Body (page numbers from 2)
        {
            properties: {
                page: {
                    size: { width: PAGE_W, height: PAGE_H },
                    margin: MARGIN,
                    pageNumbers: { start: 2 },
                },
            },
            footers: {
                default: new Footer({
                    children: [new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SZ })],
                    })],
                }),
            },
            children: allBody,
        },
    ],
});

const outPath = path.join(__dirname, 'Курсовой_проект_Платформа_для_блогинга.docx');
Packer.toBuffer(doc).then(buf => {
    fs.writeFileSync(outPath, buf);
    console.log(`Saved: ${outPath} (${buf.length} bytes)`);
});
