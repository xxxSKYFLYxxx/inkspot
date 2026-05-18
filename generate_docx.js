// Generates the course project Word document — ЧРТ template style
// Run: node generate_docx.js
// Structure follows ПЗ_для студентов.docx (2026) methodology

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
// ГОСТ margins: top/bottom 20mm=1134, left 30mm=1701, right 15mm=850
const MARGIN = { top: 1134, right: 850, bottom: 1134, left: 1701 };
// Usable content width = 11906 - 1701 - 850 = 9355 dxa
const CONTENT_W = 9355;

// --- Paragraph helpers ---

function body(text, opts = {}) {
    const runs = [];
    if (opts.runs) {
        opts.runs.forEach(r => runs.push(new TextRun({ font: FONT, size: SZ, ...r })));
    } else {
        runs.push(new TextRun({ text, font: FONT, size: SZ, bold: !!opts.bold, italics: !!opts.italics }));
    }
    return new Paragraph({
        alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
        spacing: { line: LINE15, after: 0 },
        indent: opts.noIndent ? undefined : { firstLine: INDENT },
        children: runs,
    });
}

function h1(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 120, line: LINE15 },
        pageBreakBefore: true,
        children: [new TextRun({ text, font: FONT, size: SZ, bold: true })],
    });
}

function h1nb(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 120, line: LINE15 },
        children: [new TextRun({ text, font: FONT, size: SZ, bold: true })],
    });
}

function h2(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 120, line: LINE15 },
        children: [new TextRun({ text, font: FONT, size: SZ, bold: true })],
    });
}

function h3(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_3,
        alignment: AlignmentType.LEFT,
        spacing: { before: 180, after: 80, line: LINE15 },
        children: [new TextRun({ text, font: FONT, size: SZ, bold: true })],
    });
}

function bullet(text) {
    return new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: LINE15, after: 0 },
        children: [new TextRun({ text, font: FONT, size: SZ })],
    });
}

function numbered(text) {
    return new Paragraph({
        numbering: { reference: 'numbers', level: 0 },
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: LINE15, after: 0 },
        children: [new TextRun({ text, font: FONT, size: SZ })],
    });
}

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

function tocSub2(title, page) {
    return new Paragraph({
        spacing: { line: LINE15, after: 0 },
        indent: { left: 720 },
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W - 100, leader: 'dot' }],
        children: [
            new TextRun({ text: title, font: FONT, size: SZ }),
            new TextRun({ text: `\t${page}`, font: FONT, size: SZ }),
        ],
    });
}

function ctr(text, opts = {}) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { line: LINE15, before: opts.before || 0, after: opts.after || 0 },
        children: [new TextRun({ text, font: FONT, size: opts.size || SZ, bold: !!opts.bold, italics: !!opts.italics })],
    });
}

function lft(text, opts = {}) {
    return new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { line: LINE15, before: opts.before || 0, after: opts.after || 0 },
        children: [new TextRun({ text, font: FONT, size: opts.size || SZ })],
    });
}

function blank() {
    return new Paragraph({ spacing: { line: LINE15, after: 0 }, children: [new TextRun({ text: '', font: FONT, size: SZ })] });
}

function tblCaption(text) {
    return new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { line: LINE15, before: 240, after: 120 },
        children: [new TextRun({ text, font: FONT, size: SZ })],
    });
}

function figCaption(text) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { line: LINE15, before: 120, after: 240 },
        children: [new TextRun({ text, font: FONT, size: SZ })],
    });
}

// Placeholder for a figure the user must insert
function figPlaceholder(figNum, caption) {
    return [
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: LINE15, before: 240, after: 60 },
            borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' },
                left: { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' },
                right: { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' },
            },
            children: [new TextRun({ text: `[ Вставьте рисунок ${figNum} ]`, font: FONT, size: SZ_SM, italics: true, color: '888888' })],
        }),
        figCaption(`Рисунок ${figNum} - ${caption}`),
    ];
}

function refItem(num, text) {
    return new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: LINE15, after: 0 },
        indent: { left: 360, hanging: 360 },
        children: [new TextRun({ text: `${num}. ${text}`, font: FONT, size: SZ })],
    });
}

function code(text) {
    return new Paragraph({
        spacing: { line: LINE10, after: 0 },
        children: [new TextRun({ text, font: 'Courier New', size: 22 })],
    });
}

// --- Table helpers ---
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
            alignment: opts.center ? AlignmentType.CENTER : opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
            spacing: { line: LINE10, after: 0 },
            children: [new TextRun({ text, font: FONT, size: SZ_SM, bold: !!opts.header })],
        })],
    });
}

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

// ============================================================
//  TITLE PAGE
// ============================================================
const titlePage = [
    ctr('Министерство образования Челябинской области', { after: 60 }),
    ctr('государственное бюджетное профессиональное образовательное', { after: 60 }),
    ctr('учреждение «Челябинский Радиотехнический техникум»', { after: 120 }),
    ctr('Специальность 09.02.07 «Информационные системы и программирование»', { after: 120 }),

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
                ], 4755),
            ],
        })],
    }),

    ctr('КУРСОВОЙ ПРОЕКТ', { bold: true, before: 600, after: 120 }),
    ctr('по МДК 05.01 «Проектирование и разработка информационных систем»', { after: 120 }),
    ctr('ПРОЕКТИРОВАНИЕ И РАЗРАБОТКА ВЕБ-ПЛАТФОРМЫ', { bold: true, after: 60 }),
    ctr('ДЛЯ ПУБЛИКАЦИИ КОНТЕНТА «INKSPOT»', { bold: true, after: 120 }),
    ctr('Пояснительная записка', { after: 120 }),
    ctr('ЧРТ.09.02.07.001.26.00.ПЗ', { after: 240 }),

    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [5200, 4155],
        rows: [
            new TableRow({
                children: [
                    titleCell([['Разработчик,', false], ['студент группы ИС-281:', false]], 5200),
                    titleCell([['Руководитель проекта:', false]], 4155),
                ],
            }),
            new TableRow({
                children: [
                    titleCell([['______________ М.Е. Сапрыкин', false]], 5200),
                    titleCell([['______________ ________________', false]], 4155),
                ],
            }),
        ],
    }),

    ctr('Челябинск, 2026', { before: 480, after: 0 }),
];

// ============================================================
//  ASSIGNMENT SHEET (Задание)
// ============================================================
const assignmentPage = [
    ctr('ГБПОУ «Челябинский радиотехнический техникум»', { after: 60 }),
    ctr('Рассмотрено на заседании ЦК и рекомендовано к утверждению', { after: 60 }),
    blank(),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [4600, 4755],
        rows: [new TableRow({
            children: [
                titleCell([
                    ['Председатель ЦК', false],
                    ['______________ ________________', false],
                    ['«__»__________2026 г.', false],
                ], 4600),
                titleCell([
                    ['Утверждаю', false],
                    ['Зам. директора по УР ГБПОУ «ЧРТ»', false],
                    ['___________ ________________', false],
                    ['«__»__________2026 г.', false],
                ], 4755),
            ],
        })],
    }),
    blank(),
    ctr('Задание по КУРСОВОМУ проектированию', { bold: true, before: 240, after: 120 }),
    lft('Студенту группы ИС-281 специальности 09.02.07 «Информационные системы и программирование»'),
    blank(),
    lft('Сапрыкин Матвей Евгеньевич'),
    lft('(Фамилия, Имя, Отчество)'),
    blank(),
    lft('Тема курсового проекта: Проектирование и разработка веб-платформы для публикации контента «InkSpot»'),
    blank(),
    lft('Срок сдачи студентом законченной работы: «__»___________2026 г.'),
    blank(),
    lft('Выполнение задания выполняется студентом в следующем объёме:'),
    lft('Пояснительная записка:'),
    lft('Введение. Актуальность выбранной темы, цель и поставленные задачи'),
    lft('1 Технико-экономическая характеристика предметной области'),
    lft('1.1 Анализ объекта исследования и постановка задачи'),
    lft('1.2 Описание бизнес-процессов, подлежащих автоматизации'),
    lft('1.3 Функциональные требования к информационной системе'),
    lft('1.4 Анализ и выбор средств разработки, его обоснование'),
    lft('1.5 Анализ существующих аналогичных решений'),
    lft('2 Проектирование и разработка программного продукта'),
    lft('2.1 Проектирование информационной системы'),
    lft('2.1.1 Проведение объектно-ориентированного проектирования посредством нотации UML'),
    lft('2.1.2 Проектирование базы данных информационной системы'),
    lft('2.1.3 Проектирование интерфейса информационной системы'),
    lft('2.1.4 Архитектура информационной системы'),
    lft('2.2 Разработка информационной системы'),
    lft('2.2.1 Разработка графического интерфейса информационной системы'),
    lft('2.2.2 Разработка кода информационной системы'),
    lft('2.3 Тестирование информационной системы'),
    lft('Заключение'),
    lft('Библиография'),
    lft('Приложение А. Листинг кода программы'),
    blank(),
    lft('Рекомендуемая литература:'),
    lft('ГОСТ 2.105-2019. ЕСКД. Общие требования к текстовым документам.'),
    lft('Гринберг М. Разработка веб-приложений с использованием Flask на языке Python. — М.: ДМК Пресс, 2014.'),
    lft('Документация Flask. [Электронный ресурс]. — https://flask.palletsprojects.com/'),
    lft('Документация SQLAlchemy. [Электронный ресурс]. — https://docs.sqlalchemy.org/'),
    blank(),
    lft('Дата выдачи задания: «__» ___________2026 г.'),
    blank(),
    lft('Руководитель_________________________________ ________________'),
    blank(),
    lft('Задание принял к исполнению студент _____________ М.Е. Сапрыкин'),
];

// ============================================================
//  TABLE OF CONTENTS
// ============================================================
const contents = [
    h1nb('СОДЕРЖАНИЕ'),
    tocLine('ВВЕДЕНИЕ', '4'),
    tocLine('1 ТЕОРЕТИЧЕСКАЯ ЧАСТЬ', '6'),
    tocSub('1.1 Анализ объекта исследования и постановка задачи', '6'),
    tocSub('1.2 Описание бизнес-процессов, подлежащих автоматизации', '8'),
    tocSub('1.3 Функциональные требования к информационной системе', '10'),
    tocSub('1.4 Анализ и выбор средств разработки, его обоснование', '11'),
    tocSub('1.5 Анализ существующих аналогичных решений', '13'),
    tocLine('2 ПРАКТИЧЕСКАЯ ЧАСТЬ', '15'),
    tocSub('2.1 Проектирование информационной системы', '15'),
    tocSub2('2.1.1 Проведение объектно-ориентированного проектирования посредством нотации UML', '15'),
    tocSub2('2.1.2 Проектирование базы данных информационной системы', '16'),
    tocSub2('2.1.3 Проектирование интерфейса информационной системы', '19'),
    tocSub2('2.1.4 Архитектура информационной системы', '20'),
    tocSub('2.2 Разработка информационной системы', '21'),
    tocSub2('2.2.1 Разработка графического интерфейса информационной системы', '21'),
    tocSub2('2.2.2 Разработка кода информационной системы', '24'),
    tocSub('2.3 Тестирование информационной системы', '27'),
    tocLine('ЗАКЛЮЧЕНИЕ', '29'),
    tocLine('БИБЛИОГРАФИЯ', '30'),
    tocLine('ПРИЛОЖЕНИЕ А. Листинг кода программы', '32'),
];

// ============================================================
//  INTRODUCTION
// ============================================================
const intro = [
    h1('ВВЕДЕНИЕ'),
    body('Современные блог-платформы и контентные ресурсы занимают важное место в системе интернет-коммуникаций. Авторы, сообщества и организации нуждаются в инструменте, позволяющем легко публиковать, структурировать и продвигать материалы, а читатели — искать, обсуждать и оценивать публикации.'),
    body('Несмотря на наличие крупных платформ — Medium, Habr, Яндекс Дзен — потребность в гибких, самостоятельно развёртываемых решениях остаётся актуальной для образовательных учреждений, корпоративных команд и небольших сообществ.'),
    body('Объектом исследования является веб-платформа для публикации и обмена контентом пользователей.'),
    body('Предметом исследования являются методы и средства разработки контентной платформы с использованием микрофреймворка Flask и реляционной базы данных.'),
    body('Цель курсового проекта — спроектировать и реализовать веб-платформу «InkSpot» для ведения блогов и публикации контента с поддержкой регистрации пользователей, создания статей, комментирования, оценки публикаций и панели администратора.'),
    body('Для достижения поставленной цели необходимо решить следующие задачи:'),
    numbered('изучить предметную область и провести анализ существующих аналогичных решений;'),
    numbered('определить функциональные и нефункциональные требования к платформе;'),
    numbered('выбрать технологический стек и обосновать его применение;'),
    numbered('спроектировать архитектуру и базу данных информационной системы;'),
    numbered('разработать UML-диаграммы и вайрфреймы интерфейса;'),
    numbered('реализовать серверную часть на Python/Flask;'),
    numbered('разработать клиентский интерфейс на HTML5/CSS3/Bootstrap 5;'),
    numbered('провести функциональное тестирование платформы.'),
    body('Практическая значимость работы состоит в создании работающего программного продукта, применимого как учебный пример и основа для реальных блог-проектов.'),
    body('Курсовой проект состоит из введения, теоретической и практической частей, заключения, библиографии и приложения с листингом кода.'),
];

// ============================================================
//  SECTION 1 — THEORETICAL PART
// ============================================================
const sec1 = [
    h1('1 ТЕОРЕТИЧЕСКАЯ ЧАСТЬ'),
    h2('1.1 Анализ объекта исследования и постановка задачи'),
    body('Объектом разработки является веб-платформа «InkSpot» — информационная система для публикации текстового контента, предназначенная для работы в сети Интернет. Платформа ориентирована на два типа пользователей: авторов, создающих и публикующих материалы, и читателей, просматривающих, оценивающих и комментирующих статьи.'),
    body('В настоящее время автоматизированная система публикации контента на базе существующих платформ (WordPress, Blogger и др.) требует либо платной подписки, либо сложной конфигурации. Разрабатываемая система является самостоятельно развёртываемым решением с открытым исходным кодом.'),
    body('Структура ролей системы:'),
    bullet('Администратор (1 ед.) — управляет пользователями, категориями, публикациями и комментариями;'),
    bullet('Зарегистрированный пользователь — публикует статьи, оставляет комментарии, ставит лайки, редактирует профиль;'),
    bullet('Гость — просматривает публикации, использует поиск, видит профили авторов.'),
    body('Информация, хранящаяся в базе данных:'),
    bullet('учётные записи пользователей (имя, email, хеш пароля, биография, аватар, статус);'),
    bullet('публикации (заголовок, текст, обложка, дата, автор, категория, счётчик просмотров);'),
    bullet('категории публикаций (название, slug-идентификатор);'),
    bullet('комментарии (текст, дата, автор, привязка к публикации);'),
    bullet('оценки публикаций (связь пользователь — публикация).'),
    body('Пользователями разрабатываемой ИС будут являться авторы контента и читатели, зарегистрированные на платформе, а также администратор системы.'),

    h2('1.2 Описание бизнес-процессов, подлежащих автоматизации'),
    body('В рамках анализа предметной области выявлены следующие бизнес-процессы, подлежащие автоматизации.'),
    body('Бизнес-процесс 1. «Регистрация и авторизация пользователя».'),
    body('Описание текущей ситуации. Без автоматизированной системы авторам приходится использовать внешние платформы, не допускающие самостоятельного развёртывания, либо вести публикации без персонализации (анонимно). Отсутствует единый профиль автора, история публикаций и возможность управлять содержимым.'),
    body('Описание будущей ситуации. Пользователь открывает форму регистрации, вводит имя пользователя, email и пароль. Система проверяет уникальность данных, хеширует пароль и сохраняет учётную запись. При последующих посещениях пользователь проходит аутентификацию по логину/email и паролю, после чего получает доступ к защищённым функциям.'),
    ...figPlaceholder(1, 'Схема бизнес-процесса «Регистрация и авторизация пользователя» (BPMN)'),
    body('Бизнес-процесс 2. «Создание и публикация статьи».'),
    body('Описание текущей ситуации. Без платформы автор вынужден использовать сторонние сервисы с ограниченными возможностями кастомизации, не имеет прямого контроля над своим контентом и не может связать публикации с категориями собственного проекта.'),
    body('Описание будущей ситуации. Авторизованный пользователь переходит в форму создания статьи, вводит заголовок, текст, выбирает категорию и при необходимости загружает обложку. Система сохраняет публикацию, назначает дату и связывает её с профилем автора. Статья немедленно отображается в общей ленте и на странице категории.'),
    ...figPlaceholder(2, 'Схема бизнес-процесса «Создание и публикация статьи» (BPMN)'),

    h2('1.3 Функциональные требования к информационной системе'),
    body('При разработке платформы «InkSpot» выделены следующие функциональные требования:'),
    bullet('регистрация пользователей с проверкой уникальности имени пользователя и email;'),
    bullet('аутентификация по логину/email и паролю, завершение сеанса;'),
    bullet('создание, редактирование и удаление статей авторами;'),
    bullet('загрузка изображения-обложки публикации;'),
    bullet('категоризация публикаций;'),
    bullet('постраничная лента публикаций на главной странице;'),
    bullet('поиск публикаций по заголовку и тексту;'),
    bullet('комментирование статей зарегистрированными пользователями;'),
    bullet('система лайков (выражение оценки) с возможностью снятия;'),
    bullet('просмотр и редактирование персонального профиля (аватар, биография);'),
    bullet('панель администратора: статистика, управление пользователями, публикациями, комментариями и категориями;'),
    bullet('назначение и снятие прав администратора;'),
    bullet('подсчёт и отображение количества просмотров публикации.'),
    body('Нефункциональные требования:'),
    bullet('кроссбраузерность (Chrome, Firefox, Edge актуальных версий);'),
    bullet('адаптивность интерфейса под мобильные устройства (Bootstrap 5 grid);'),
    bullet('хранение паролей в виде криптографических хешей (Werkzeug PBKDF2);'),
    bullet('защита форм от CSRF-атак (Flask-WTF / secret key);'),
    bullet('время загрузки страницы не более 2 секунд при локальном развёртывании.'),

    h2('1.4 Анализ и выбор средств разработки, его обоснование'),
    body('При разработке платформы «InkSpot» рассматривались следующие технологии.'),
    body('Серверная часть. Рассматривались Django, Flask и FastAPI. Django избыточен для данного проекта: включает ORM, систему шаблонов, аутентификацию и административный интерфейс, что усложняет изучение принципов. FastAPI ориентирован на API, не имеет встроенной системы шаблонов. Flask выбран как микрофреймворк: минимальная конфигурация, явные зависимости, высокая гибкость, большое сообщество и подробная документация.'),
    body('ORM. SQLAlchemy является промышленным стандартом для Python: поддерживает большинство СУБД, обеспечивает полный контроль над запросами и защиту от SQL-инъекций через параметризованные запросы.'),
    body('СУБД. Для разработки и развёртывания выбрана SQLite — не требует отдельного сервера, входит в стандартную библиотеку Python, поддерживается SQLAlchemy. При необходимости масштабирования возможен переход на PostgreSQL без изменения кода ORM.'),
    body('Шаблонизатор. Jinja2 интегрирован во Flask, поддерживает наследование шаблонов, макросы, фильтры и условные блоки.'),
    body('Фреймворк CSS. Bootstrap 5 предоставляет готовую адаптивную сетку, набор компонентов (навигация, карточки, модалки, алерты) и утилитарные классы, что существенно сокращает время вёрстки.'),
    body('Итоговый технологический стек приведён в таблице 1.'),
    tblCaption('Таблица 1 - Технологический стек платформы «InkSpot»'),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2200, 2400, 4755],
        rows: [
            new TableRow({ tableHeader: true, children: [
                tCell('Уровень', { header: true, center: true, w: 2200 }),
                tCell('Технология', { header: true, center: true, w: 2400 }),
                tCell('Обоснование выбора', { header: true, center: true, w: 4755 }),
            ]}),
            new TableRow({ children: [tCell('Серверная логика', {w:2200}), tCell('Python 3, Flask', {w:2400}), tCell('Микрофреймворк с минимальной конфигурацией, гибкость, богатая экосистема', {w:4755})]}),
            new TableRow({ children: [tCell('ORM', {w:2200}), tCell('SQLAlchemy', {w:2400}), tCell('Промышленный стандарт, поддержка множества СУБД, защита от SQL-инъекций', {w:4755})]}),
            new TableRow({ children: [tCell('СУБД', {w:2200}), tCell('SQLite', {w:2400}), tCell('Не требует отдельного сервера, легко переносима, поддерживается SQLAlchemy', {w:4755})]}),
            new TableRow({ children: [tCell('Шаблонизатор', {w:2200}), tCell('Jinja2', {w:2400}), tCell('Встроен во Flask, наследование шаблонов, мощные фильтры', {w:4755})]}),
            new TableRow({ children: [tCell('Разметка', {w:2200}), tCell('HTML5', {w:2400}), tCell('Современный стандарт семантической разметки', {w:4755})]}),
            new TableRow({ children: [tCell('Стилизация', {w:2200}), tCell('CSS3, Bootstrap 5', {w:2400}), tCell('Готовая адаптивная сетка, компоненты, утилиты', {w:4755})]}),
            new TableRow({ children: [tCell('Клиентский скрипт', {w:2200}), tCell('JavaScript ES6', {w:2400}), tCell('Динамическое поведение без SPA-фреймворков', {w:4755})]}),
            new TableRow({ children: [tCell('Аутентификация', {w:2200}), tCell('Flask-Login', {w:2400}), tCell('Управление сессиями, декоратор @login_required, удобная интеграция', {w:4755})]}),
        ],
    }),

    h2('1.5 Анализ существующих аналогичных решений'),
    body('Проведён сравнительный анализ четырёх популярных блог-платформ: Medium, Habr, Яндекс Дзен и LiveJournal. Результаты анализа приведены в таблице 2.'),
    tblCaption('Таблица 2 - Сравнительный анализ блог-платформ'),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2200, 1730, 1730, 1850, 1845],
        rows: [
            new TableRow({ tableHeader: true, children: [
                tCell('Критерий', { header: true, center: true, w: 2200 }),
                tCell('Medium', { header: true, center: true, w: 1730 }),
                tCell('Habr', { header: true, center: true, w: 1730 }),
                tCell('Яндекс Дзен', { header: true, center: true, w: 1850 }),
                tCell('LiveJournal', { header: true, center: true, w: 1845 }),
            ]}),
            new TableRow({ children: [tCell('Простота интерфейса',{w:2200}), tCell('Высокая',{center:true,w:1730}), tCell('Средняя',{center:true,w:1730}), tCell('Высокая',{center:true,w:1850}), tCell('Средняя',{center:true,w:1845})]}),
            new TableRow({ children: [tCell('Категоризация',{w:2200}), tCell('Теги',{center:true,w:1730}), tCell('Хабы + теги',{center:true,w:1730}), tCell('Авто',{center:true,w:1850}), tCell('Сообщества',{center:true,w:1845})]}),
            new TableRow({ children: [tCell('Бесплатность',{w:2200}), tCell('Частично',{center:true,w:1730}), tCell('Да',{center:true,w:1730}), tCell('Да',{center:true,w:1850}), tCell('Частично',{center:true,w:1845})]}),
            new TableRow({ children: [tCell('Открытый код',{w:2200}), tCell('Нет',{center:true,w:1730}), tCell('Нет',{center:true,w:1730}), tCell('Нет',{center:true,w:1850}), tCell('Нет',{center:true,w:1845})]}),
            new TableRow({ children: [tCell('Своё развёртывание',{w:2200}), tCell('Нет',{center:true,w:1730}), tCell('Нет',{center:true,w:1730}), tCell('Нет',{center:true,w:1850}), tCell('Нет',{center:true,w:1845})]}),
            new TableRow({ children: [tCell('Панель админа',{w:2200}), tCell('Ограничена',{center:true,w:1730}), tCell('Есть',{center:true,w:1730}), tCell('Ограничена',{center:true,w:1850}), tCell('Есть',{center:true,w:1845})]}),
            new TableRow({ children: [tCell('Комментарии',{w:2200}), tCell('Есть',{center:true,w:1730}), tCell('Есть',{center:true,w:1730}), tCell('Есть',{center:true,w:1850}), tCell('Есть',{center:true,w:1845})]}),
        ],
    }),
    body('Проведённый анализ показывает, что ни одна из рассмотренных платформ не допускает самостоятельного развёртывания на собственном сервере без ограничений. Все они являются закрытыми SaaS-продуктами. На основании анализа сделан вывод о целесообразности разработки собственной платформы: она обеспечит полный контроль над данными, возможность настройки и расширения функциональности.'),
];

// ============================================================
//  SECTION 2 — PRACTICAL PART
// ============================================================
const sec2 = [
    h1('2 ПРАКТИЧЕСКАЯ ЧАСТЬ'),
    h2('2.1 Проектирование информационной системы'),
    h3('2.1.1 Проведение объектно-ориентированного проектирования посредством нотации UML'),
    body('На основании функциональных требований, изложенных в разделе 1.3, разработана диаграмма вариантов использования (Use Case), отражающая отношения между актёрами и прецедентами системы.'),
    body('Выделены три актёра: Гость, Зарегистрированный пользователь и Администратор. Распределение вариантов использования:'),
    bullet('Гость: просмотр главной страницы, просмотр статьи, просмотр профиля автора, поиск, регистрация, вход в систему;'),
    bullet('Зарегистрированный пользователь (расширяет права гостя): создание/редактирование/удаление статьи, загрузка обложки, добавление/удаление комментария, постановка/снятие лайка, редактирование профиля, выход из системы;'),
    bullet('Администратор (расширяет права пользователя): управление пользователями, назначение/снятие прав, управление категориями, модерация комментариев, просмотр статистики на дашборде.'),
    ...figPlaceholder(3, 'Диаграмма вариантов использования (Use Case) платформы «InkSpot»'),

    h3('2.1.2 Проектирование базы данных информационной системы'),
    body('Проектирование базы данных включает построение ER-диаграммы, составление словаря данных и обоснование нормализации.'),
    body('При анализе предметной области выделены следующие сущности:'),
    bullet('user — учётная запись пользователя;'),
    bullet('post — публикация;'),
    bullet('category — категория публикаций;'),
    bullet('comment — комментарий к публикации;'),
    bullet('post_likes — связующая таблица для связи «пользователь — публикация» (лайки).'),
    body('При построении ER-диаграммы учтены следующие требования:'),
    bullet('один пользователь может создать несколько публикаций (один-ко-многим);'),
    bullet('одна публикация принадлежит одной категории (многие-к-одному);'),
    bullet('одна публикация может иметь несколько комментариев, один комментарий — одну публикацию (один-ко-многим);'),
    bullet('пользователь может поставить лайк многим публикациям, публикация может получить лайки от многих пользователей (многие-ко-многим через post_likes).'),
    ...figPlaceholder(4, 'ER-диаграмма базы данных платформы «InkSpot»'),
    body('Словарь данных представлен в таблице 3.'),
    tblCaption('Таблица 3 - Словарь данных (таблица user)'),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [1900, 2200, 2000, 1500, 1755],
        rows: [
            new TableRow({ tableHeader: true, children: [
                tCell('Ключ', {header:true, center:true, w:1900}),
                tCell('Поле', {header:true, center:true, w:2200}),
                tCell('Тип данных', {header:true, center:true, w:2000}),
                tCell('Обязательное', {header:true, center:true, w:1500}),
                tCell('Примечание', {header:true, center:true, w:1755}),
            ]}),
            new TableRow({ children: [tCell('Первичный',{w:1900}), tCell('id',{w:2200}), tCell('Integer',{center:true,w:2000}), tCell('Да',{center:true,w:1500}), tCell('Автоприращение',{w:1755})]}),
            new TableRow({ children: [tCell('',{w:1900}), tCell('username',{w:2200}), tCell('String(40)',{center:true,w:2000}), tCell('Да',{center:true,w:1500}), tCell('Уникальное',{w:1755})]}),
            new TableRow({ children: [tCell('',{w:1900}), tCell('email',{w:2200}), tCell('String(120)',{center:true,w:2000}), tCell('Да',{center:true,w:1500}), tCell('Уникальное',{w:1755})]}),
            new TableRow({ children: [tCell('',{w:1900}), tCell('password_hash',{w:2200}), tCell('String(255)',{center:true,w:2000}), tCell('Да',{center:true,w:1500}), tCell('PBKDF2 хеш',{w:1755})]}),
            new TableRow({ children: [tCell('',{w:1900}), tCell('bio',{w:2200}), tCell('Text',{center:true,w:2000}), tCell('Нет',{center:true,w:1500}), tCell('',{w:1755})]}),
            new TableRow({ children: [tCell('',{w:1900}), tCell('avatar',{w:2200}), tCell('String(255)',{center:true,w:2000}), tCell('Нет',{center:true,w:1500}), tCell('Имя файла',{w:1755})]}),
            new TableRow({ children: [tCell('',{w:1900}), tCell('is_admin',{w:2200}), tCell('Boolean',{center:true,w:2000}), tCell('Да',{center:true,w:1500}), tCell('По умолчанию False',{w:1755})]}),
            new TableRow({ children: [tCell('',{w:1900}), tCell('created_at',{w:2200}), tCell('DateTime',{center:true,w:2000}), tCell('Да',{center:true,w:1500}), tCell('Авто',{w:1755})]}),
        ],
    }),
    blank(),
    tblCaption('Таблица 4 - Словарь данных (таблица post)'),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [1900, 2200, 2000, 1500, 1755],
        rows: [
            new TableRow({ tableHeader: true, children: [
                tCell('Ключ', {header:true, center:true, w:1900}),
                tCell('Поле', {header:true, center:true, w:2200}),
                tCell('Тип данных', {header:true, center:true, w:2000}),
                tCell('Обязательное', {header:true, center:true, w:1500}),
                tCell('Примечание', {header:true, center:true, w:1755}),
            ]}),
            new TableRow({ children: [tCell('Первичный',{w:1900}), tCell('id',{w:2200}), tCell('Integer',{center:true,w:2000}), tCell('Да',{center:true,w:1500}), tCell('Автоприращение',{w:1755})]}),
            new TableRow({ children: [tCell('',{w:1900}), tCell('title',{w:2200}), tCell('String(200)',{center:true,w:2000}), tCell('Да',{center:true,w:1500}), tCell('',{w:1755})]}),
            new TableRow({ children: [tCell('',{w:1900}), tCell('content',{w:2200}), tCell('Text',{center:true,w:2000}), tCell('Да',{center:true,w:1500}), tCell('',{w:1755})]}),
            new TableRow({ children: [tCell('',{w:1900}), tCell('image',{w:2200}), tCell('String(255)',{center:true,w:2000}), tCell('Нет',{center:true,w:1500}), tCell('Имя файла',{w:1755})]}),
            new TableRow({ children: [tCell('',{w:1900}), tCell('created_at',{w:2200}), tCell('DateTime',{center:true,w:2000}), tCell('Да',{center:true,w:1500}), tCell('Авто',{w:1755})]}),
            new TableRow({ children: [tCell('',{w:1900}), tCell('views',{w:2200}), tCell('Integer',{center:true,w:2000}), tCell('Да',{center:true,w:1500}), tCell('По умолчанию 0',{w:1755})]}),
            new TableRow({ children: [tCell('Внешний',{w:1900}), tCell('user_id',{w:2200}), tCell('Integer',{center:true,w:2000}), tCell('Да',{center:true,w:1500}), tCell('FK -> user.id',{w:1755})]}),
            new TableRow({ children: [tCell('Внешний',{w:1900}), tCell('category_id',{w:2200}), tCell('Integer',{center:true,w:2000}), tCell('Нет',{center:true,w:1500}), tCell('FK -> category.id',{w:1755})]}),
        ],
    }),
    blank(),
    tblCaption('Таблица 5 - Словарь данных (таблицы category, comment, post_likes)'),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [1900, 2200, 2000, 1500, 1755],
        rows: [
            new TableRow({ tableHeader: true, children: [
                tCell('Ключ', {header:true, center:true, w:1900}),
                tCell('Поле', {header:true, center:true, w:2200}),
                tCell('Тип данных', {header:true, center:true, w:2000}),
                tCell('Обязательное', {header:true, center:true, w:1500}),
                tCell('Таблица', {header:true, center:true, w:1755}),
            ]}),
            new TableRow({ children: [tCell('Первичный',{w:1900}), tCell('id',{w:2200}), tCell('Integer',{center:true,w:2000}), tCell('Да',{center:true,w:1500}), tCell('category',{w:1755})]}),
            new TableRow({ children: [tCell('',{w:1900}), tCell('name',{w:2200}), tCell('String(50)',{center:true,w:2000}), tCell('Да',{center:true,w:1500}), tCell('category',{w:1755})]}),
            new TableRow({ children: [tCell('',{w:1900}), tCell('slug',{w:2200}), tCell('String(50)',{center:true,w:2000}), tCell('Да',{center:true,w:1500}), tCell('category',{w:1755})]}),
            new TableRow({ children: [tCell('Первичный',{w:1900}), tCell('id',{w:2200}), tCell('Integer',{center:true,w:2000}), tCell('Да',{center:true,w:1500}), tCell('comment',{w:1755})]}),
            new TableRow({ children: [tCell('',{w:1900}), tCell('content',{w:2200}), tCell('Text',{center:true,w:2000}), tCell('Да',{center:true,w:1500}), tCell('comment',{w:1755})]}),
            new TableRow({ children: [tCell('',{w:1900}), tCell('created_at',{w:2200}), tCell('DateTime',{center:true,w:2000}), tCell('Да',{center:true,w:1500}), tCell('comment',{w:1755})]}),
            new TableRow({ children: [tCell('Внешний',{w:1900}), tCell('user_id',{w:2200}), tCell('Integer',{center:true,w:2000}), tCell('Да',{center:true,w:1500}), tCell('comment',{w:1755})]}),
            new TableRow({ children: [tCell('Внешний',{w:1900}), tCell('post_id',{w:2200}), tCell('Integer',{center:true,w:2000}), tCell('Да',{center:true,w:1500}), tCell('comment',{w:1755})]}),
            new TableRow({ children: [tCell('Составной PK',{w:1900}), tCell('user_id',{w:2200}), tCell('Integer',{center:true,w:2000}), tCell('Да',{center:true,w:1500}), tCell('post_likes',{w:1755})]}),
            new TableRow({ children: [tCell('Составной PK',{w:1900}), tCell('post_id',{w:2200}), tCell('Integer',{center:true,w:2000}), tCell('Да',{center:true,w:1500}), tCell('post_likes',{w:1755})]}),
        ],
    }),
    body('Анализ составленной базы данных подтверждает, что значения всех атрибутов атомарны. Каждый не ключевой атрибут функционально полно зависит от ключа, каждый не ключевой атрибут не транзитивно зависит от первичного ключа, отсутствуют многозначные зависимости, не являющиеся функциональными, — база данных нормализована до третьей нормальной формы.'),

    h3('2.1.3 Проектирование интерфейса информационной системы'),
    body('Для каждого основного экрана платформы разработаны вайрфреймы — макеты, отображающие расположение элементов без декоративного оформления. Вайрфреймы выполнены в сервисе Figma.'),
    body('Спроектированы вайрфреймы следующих экранов:'),
    bullet('Главная страница — hero-секция, лента карточек публикаций, боковая панель с категориями;'),
    bullet('Страница публикации — заголовок, обложка, текст, блок комментариев, кнопка лайка;'),
    bullet('Форма регистрации — поля имени пользователя, email, пароля;'),
    bullet('Форма входа — поля логина и пароля;'),
    bullet('Профиль пользователя — аватар, биография, список публикаций;'),
    bullet('Панель администратора (дашборд) — счётчики, таблицы последних пользователей и публикаций.'),
    ...figPlaceholder(5, 'Вайрфреймы основных экранов платформы (Figma)'),

    h3('2.1.4 Архитектура информационной системы'),
    body('Платформа «InkSpot» построена по трёхзвенной архитектуре «клиент — сервер приложений — база данных».'),
    body('Уровень представления (клиент): любой современный браузер. Клиент отправляет HTTP-запросы и отображает HTML-страницы, CSS-стили и JavaScript-сценарии.'),
    body('Уровень бизнес-логики (сервер приложений): Flask-приложение на Python. Включает маршрутизацию URL, обработчики запросов, проверку аутентификации (Flask-Login), валидацию входных данных, вызовы к уровню данных, формирование ответа через Jinja2.'),
    body('Уровень данных: SQLAlchemy ORM + SQLite. Обеспечивает хранение, выборку и изменение данных.'),
    ...figPlaceholder(6, 'Архитектура информационной системы «InkSpot»'),
    body('Запрос проходит следующий путь: браузер -> HTTP -> Flask (маршрут) -> проверка прав -> SQLAlchemy -> SQLite -> ответ ORM -> Jinja2 шаблон -> HTML -> браузер.'),

    h2('2.2 Разработка информационной системы'),
    h3('2.2.1 Разработка графического интерфейса информационной системы'),
    body('Интерфейс построен на базе шаблонов Jinja2 с механизмом наследования. Базовый шаблон base.html содержит подключение стилей и скриптов, навигационную панель, блок flash-уведомлений, основной контейнер и подвал. Остальные шаблоны переопределяют блок content.'),
    body('Главная страница отображает hero-секцию с кратким описанием, ленту карточек публикаций и боковую панель с категориями и популярными статьями. Карточки адаптивны — 3 в ряд на десктопе, 2 на планшете, 1 на мобильном.'),
    body('Скриншоты разработанного интерфейса:'),
    ...figPlaceholder(7, 'Главная страница платформы «InkSpot»'),
    ...figPlaceholder(8, 'Страница статьи с комментариями'),
    ...figPlaceholder(9, 'Форма регистрации нового пользователя'),
    ...figPlaceholder(10, 'Профиль пользователя'),
    ...figPlaceholder(11, 'Панель администратора — дашборд'),
    ...figPlaceholder(12, 'Панель администратора — управление пользователями'),
    body('Для аватаров, у которых нет загруженного изображения, применяется CSS-градиентный блок с первой буквой имени пользователя. Администраторам в навигационном меню отображается дополнительная ссылка «Панель управления».'),
    body('Навигация между основными экранами системы показана на рисунке 13.'),
    ...figPlaceholder(13, 'Схема навигации между экранами платформы'),

    h3('2.2.2 Разработка кода информационной системы'),
    body('Структура проекта показана на рисунке 14.'),
    ...figPlaceholder(14, 'Структура проекта «InkSpot» в файловом менеджере'),
    body('Серверная часть реализована в модуле app.py. Перечень ключевых компонентов и их методов:'),
    body('Модель User:'),
    bullet('set_password(password) — хеширование пароля (PBKDF2, Werkzeug); листинг А.1;'),
    bullet('check_password(password) — проверка пароля по хешу; листинг А.1;'),
    bullet('liked_posts — отношение many-to-many через таблицу post_likes.'),
    body('Модель Post:'),
    bullet('excerpt(limit=180) — формирование краткого анонса публикации; листинг А.2.'),
    body('Маршруты и обработчики:'),
    bullet('index() — главная страница, постраничная лента публикаций; листинг А.3;'),
    bullet('register() — регистрация пользователя, проверка уникальности; листинг А.4;'),
    bullet('login() — аутентификация по логину/email и паролю; листинг А.4;'),
    bullet('create_post() — создание публикации с загрузкой обложки; листинг А.5;'),
    bullet('edit_post(post_id) — редактирование публикации (только автором); листинг А.5;'),
    bullet('delete_post(post_id) — удаление публикации (автором или администратором); листинг А.5;'),
    bullet('like_post(post_id) — переключение лайка (поставить / снять); листинг А.6;'),
    bullet('search() — поиск по заголовку и тексту через LIKE; листинг А.7;'),
    bullet('admin_dashboard() — дашборд с агрегированной статистикой; листинг А.8;'),
    bullet('admin_users() / admin_toggle_admin(user_id) / admin_delete_user(user_id) — управление пользователями; листинг А.9;'),
    bullet('admin_categories() / admin_delete_category(cat_id) — управление категориями; листинг А.10.'),
    body('Декоратор admin_required проверяет флаг is_admin у текущего пользователя и возвращает HTTP 403 при несоответствии.'),

    h2('2.3 Тестирование информационной системы'),
    body('Проведено функциональное тестирование, охватывающее весь реализованный функционал системы. Результаты приведены в таблице 6.'),
    tblCaption('Таблица 6 - Функциональное тестирование платформы «InkSpot»'),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [500, 700, 2500, 3100, 2555],
        rows: [
            new TableRow({ tableHeader: true, children: [
                tCell('№', {header:true, center:true, w:500}),
                tCell('Статус', {header:true, center:true, w:700}),
                tCell('Тестируемый функционал', {header:true, center:true, w:2500}),
                tCell('Ожидаемый результат', {header:true, center:true, w:3100}),
                tCell('Фактический результат', {header:true, center:true, w:2555}),
            ]}),
            new TableRow({ children: [tCell('1',{center:true,w:500}), tCell('Позитивный',{center:true,w:700}), tCell('Регистрация нового пользователя',{w:2500}), tCell('Учётная запись создана, выполнен вход',{w:3100}), tCell('Пройден',{center:true,w:2555})]}),
            new TableRow({ children: [tCell('2',{center:true,w:500}), tCell('Негативный',{center:true,w:700}), tCell('Регистрация с уже занятым именем пользователя',{w:2500}), tCell('Сообщение «Имя пользователя занято»',{w:3100}), tCell('Пройден',{center:true,w:2555})]}),
            new TableRow({ children: [tCell('3',{center:true,w:500}), tCell('Позитивный',{center:true,w:700}), tCell('Вход по логину и паролю',{w:2500}), tCell('Открывается главная страница',{w:3100}), tCell('Пройден',{center:true,w:2555})]}),
            new TableRow({ children: [tCell('4',{center:true,w:500}), tCell('Негативный',{center:true,w:700}), tCell('Вход с неверным паролем',{w:2500}), tCell('Сообщение «Неверные данные»',{w:3100}), tCell('Пройден',{center:true,w:2555})]}),
            new TableRow({ children: [tCell('5',{center:true,w:500}), tCell('Позитивный',{center:true,w:700}), tCell('Создание публикации с обложкой',{w:2500}), tCell('Статья сохранена, обложка отображается',{w:3100}), tCell('Пройден',{center:true,w:2555})]}),
            new TableRow({ children: [tCell('6',{center:true,w:500}), tCell('Негативный',{center:true,w:700}), tCell('Создание публикации с пустым заголовком',{w:2500}), tCell('Сообщение о необходимости заполнения поля',{w:3100}), tCell('Пройден',{center:true,w:2555})]}),
            new TableRow({ children: [tCell('7',{center:true,w:500}), tCell('Позитивный',{center:true,w:700}), tCell('Поиск по заголовку',{w:2500}), tCell('Выводятся релевантные публикации',{w:3100}), tCell('Пройден',{center:true,w:2555})]}),
            new TableRow({ children: [tCell('8',{center:true,w:500}), tCell('Позитивный',{center:true,w:700}), tCell('Добавление комментария',{w:2500}), tCell('Комментарий отображается под статьёй',{w:3100}), tCell('Пройден',{center:true,w:2555})]}),
            new TableRow({ children: [tCell('9',{center:true,w:500}), tCell('Позитивный',{center:true,w:700}), tCell('Постановка лайка, повторное нажатие',{w:2500}), tCell('Счётчик +1, затем -1 (переключение)',{w:3100}), tCell('Пройден',{center:true,w:2555})]}),
            new TableRow({ children: [tCell('10',{center:true,w:500}), tCell('Негативный',{center:true,w:700}), tCell('Обращение к /create без авторизации',{w:2500}), tCell('Перенаправление на страницу входа',{w:3100}), tCell('Пройден',{center:true,w:2555})]}),
            new TableRow({ children: [tCell('11',{center:true,w:500}), tCell('Негативный',{center:true,w:700}), tCell('Обращение к /admin обычным пользователем',{w:2500}), tCell('HTTP 403, страница «Доступ запрещён»',{w:3100}), tCell('Пройден',{center:true,w:2555})]}),
            new TableRow({ children: [tCell('12',{center:true,w:500}), tCell('Позитивный',{center:true,w:700}), tCell('Удаление пользователя администратором',{w:2500}), tCell('Пользователь и его публикации удалены',{w:3100}), tCell('Пройден',{center:true,w:2555})]}),
        ],
    }),
    body('При тестировании устранены замечания по обработке пустых полей форм, отображению аватаров и срабатыванию уведомлений. Совместимость с Chrome 124, Firefox 125 и Edge 124 подтверждена.'),
];

// ============================================================
//  CONCLUSION
// ============================================================
const conclusion = [
    h1('ЗАКЛЮЧЕНИЕ'),
    body('В ходе выполнения курсового проекта спроектирована и реализована веб-платформа «InkSpot» для ведения блогов и публикации контента. Поставленные задачи решены в полном объёме.'),
    body('Изучена предметная область. Проведён сравнительный анализ четырёх коммерческих платформ (Medium, Habr, Яндекс Дзен, LiveJournal), на основании которого выявлена потребность в самостоятельно развёртываемом решении и сформулированы требования.'),
    body('Выбран стек технологий: Python 3, Flask, SQLAlchemy, SQLite, Jinja2, Bootstrap 5. Обосновано применение каждой технологии.'),
    body('Разработаны диаграмма вариантов использования UML с тремя актёрами (Гость, Пользователь, Администратор) и тринадцатью прецедентами; ER-диаграмма БД из пяти таблиц; вайрфреймы шести экранов; схема архитектуры трёхзвенной системы.'),
    body('Реализованы: регистрация и аутентификация, создание и редактирование публикаций с загрузкой обложки, категоризация, поиск, комментирование, система лайков, персональные профили. Разработана полноценная панель администратора из 10 маршрутов.'),
    body('Проведено функциональное тестирование по 12 сценариям (позитивным и негативным) — все тесты пройдены. Кроссбраузерная совместимость подтверждена в трёх браузерах.'),
    body('Платформа может использоваться как учебный пример веб-приложения, а также как основа небольших тематических блогов или корпоративных площадок. Перспективы развития: поддержка Markdown, полнотекстовый поиск, система подписок, REST API, переход на PostgreSQL.'),
];

// ============================================================
//  BIBLIOGRAPHY
// ============================================================
const refs = [
    h1('БИБЛИОГРАФИЯ'),
    refItem(1,  'ГОСТ 2.105-2019. Единая система конструкторской документации. Общие требования к текстовым документам. — М.: Стандартинформ, 2019. — 30 с.'),
    refItem(2,  'Гринберг М. Разработка веб-приложений с использованием Flask на языке Python. — М.: ДМК Пресс, 2014. — 272 с.'),
    refItem(3,  'Лутц М. Изучаем Python. В 2 т. — 5-е изд. — М.: Вильямс, 2020.'),
    refItem(4,  'Дакетт Дж. HTML и CSS. Разработка и дизайн веб-сайтов. — М.: Эксмо, 2019. — 480 с.'),
    refItem(5,  'Балдин К.В., Уткин В.Б. Информационные системы в экономике: Учебник. — М.: Дашков и К, 2015. — 395 с.'),
    refItem(6,  'Документация Flask [Электронный ресурс]. — Режим доступа: https://flask.palletsprojects.com/ (дата обращения: 10.05.2026).'),
    refItem(7,  'Документация SQLAlchemy [Электронный ресурс]. — Режим доступа: https://docs.sqlalchemy.org/ (дата обращения: 10.05.2026).'),
    refItem(8,  'Документация Bootstrap 5 [Электронный ресурс]. — Режим доступа: https://getbootstrap.com/docs/5.3/ (дата обращения: 11.05.2026).'),
    refItem(9,  'Werkzeug — The WSGI Toolkit [Электронный ресурс]. — Режим доступа: https://werkzeug.palletsprojects.com/ (дата обращения: 12.05.2026).'),
    refItem(10, 'OWASP Top 10 — 2021 [Электронный ресурс]. — Режим доступа: https://owasp.org/Top10/ (дата обращения: 12.05.2026).'),
];

// ============================================================
//  APPENDIX A — CODE LISTING
// ============================================================
const appendix = [
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120, line: LINE15 },
        pageBreakBefore: true,
        children: [new TextRun({ text: 'ПРИЛОЖЕНИЕ А', font: FONT, size: SZ, bold: true })],
    }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120, line: LINE15 },
        children: [new TextRun({ text: '(обязательное)', font: FONT, size: SZ, italics: true })],
    }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240, line: LINE15 },
        children: [new TextRun({ text: 'Листинг кода программы', font: FONT, size: SZ, bold: true })],
    }),
    body('Листинг А.1 — Модель пользователя (фрагмент)', { noIndent: true }),
    code('class User(UserMixin, db.Model):'),
    code('    id = db.Column(db.Integer, primary_key=True)'),
    code('    username = db.Column(db.String(40), unique=True, nullable=False)'),
    code('    email = db.Column(db.String(120), unique=True, nullable=False)'),
    code('    password_hash = db.Column(db.String(255), nullable=False)'),
    code('    bio = db.Column(db.Text, default="")'),
    code('    avatar = db.Column(db.String(255), default="")'),
    code('    is_admin = db.Column(db.Boolean, default=False)'),
    code('    created_at = db.Column(db.DateTime, default=datetime.utcnow)'),
    code(''),
    code('    def set_password(self, password):'),
    code('        self.password_hash = generate_password_hash(password)'),
    code(''),
    code('    def check_password(self, password):'),
    code('        return check_password_hash(self.password_hash, password)'),
    blank(),
    body('Листинг А.2 — Декоратор admin_required', { noIndent: true }),
    code('def admin_required(f):'),
    code('    @wraps(f)'),
    code('    def decorated(*args, **kwargs):'),
    code('        if not current_user.is_authenticated or not current_user.is_admin:'),
    code('            abort(403)'),
    code('        return f(*args, **kwargs)'),
    code('    return decorated'),
    blank(),
    body('Листинг А.3 — Маршрут создания публикации', { noIndent: true }),
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
    blank(),
    body('Листинг А.4 — Маршрут лайка (переключение)', { noIndent: true }),
    code('@app.route("/post/<int:post_id>/like", methods=["POST"])'),
    code('@login_required'),
    code('def like_post(post_id):'),
    code('    post = Post.query.get_or_404(post_id)'),
    code('    if post in current_user.liked_posts:'),
    code('        current_user.liked_posts.remove(post)'),
    code('    else:'),
    code('        current_user.liked_posts.append(post)'),
    code('    db.session.commit()'),
    code('    return redirect(request.referrer or url_for("index"))'),
];

// ============================================================
//  BUILD DOCUMENT
// ============================================================
const allBody = [
    ...contents,
    ...intro,
    ...sec1,
    ...sec2,
    ...conclusion,
    ...refs,
    ...appendix,
];

const doc = new Document({
    creator: 'InkSpot',
    title: 'Курсовой проект — Проектирование и разработка веб-платформы «InkSpot»',
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
            {
                id: 'Heading3', name: 'Heading 3',
                basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { size: SZ, bold: true, font: FONT },
                paragraph: {
                    alignment: AlignmentType.LEFT,
                    spacing: { before: 180, after: 80, line: LINE15 },
                    outlineLevel: 2,
                },
            },
        ],
    },
    numbering: {
        config: [
            {
                reference: 'bullets',
                levels: [{
                    level: 0, format: LevelFormat.BULLET, text: '-',
                    alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } },
                }],
            },
            {
                reference: 'numbers',
                levels: [{
                    level: 0, format: LevelFormat.DECIMAL, text: '%1.',
                    alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } },
                }],
            },
        ],
    },
    sections: [
        // Section 1 — Title page
        {
            properties: {
                page: { size: { width: PAGE_W, height: PAGE_H }, margin: MARGIN },
                titlePage: true,
            },
            children: titlePage,
        },
        // Section 2 — Assignment (no page number)
        {
            properties: {
                page: { size: { width: PAGE_W, height: PAGE_H }, margin: MARGIN },
            },
            children: assignmentPage,
        },
        // Section 3 — Main body with page numbers
        {
            properties: {
                page: {
                    size: { width: PAGE_W, height: PAGE_H },
                    margin: MARGIN,
                    pageNumbers: { start: 3 },
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

const outPath = path.join(__dirname, 'Курсовой_проект_Сапрыкин.docx');
Packer.toBuffer(doc).then(buf => {
    fs.writeFileSync(outPath, buf);
    console.log(`Saved: ${outPath} (${buf.length} bytes)`);
});
