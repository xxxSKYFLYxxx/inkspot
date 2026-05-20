"""
Заходит на сайт как реальный пользователь:
- регистрируется через /register
- загружает аватарку через /profile/edit
- создаёт посты через /create (с обложкой)
- комментирует и лайкает посты других

Запуск:
    1) В одном терминале:  python3 app.py
    2) В другом:           python3 seed_via_site.py
"""
import os
import random
import time
from io import BytesIO

import requests
from PIL import Image, ImageDraw, ImageFilter, ImageFont

BASE_URL = os.environ.get('INKSPOT_URL', 'http://127.0.0.1:5000')
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
TMP_DIR = os.path.join(BASE_DIR, '.seed_tmp')
os.makedirs(TMP_DIR, exist_ok=True)


# ─── Генерация картинок (без сети) ───────────────────────────────────────────
def find_font(size, bold=False):
    candidates = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def make_gradient(size, color_a, color_b):
    w, h = size
    base = Image.new('RGB', size, color_a)
    top = Image.new('RGB', size, color_b)
    mask = Image.new('L', size)
    md = mask.load()
    for y in range(h):
        for x in range(w):
            md[x, y] = int(255 * ((x + y) / (w + h)))
    base.paste(top, (0, 0), mask)
    return base


AVATAR_PALETTES = [
    ('#ff6b6b', '#ffa502'),
    ('#5f27cd', '#ee5a6f'),
    ('#0abde3', '#48dbfb'),
    ('#10ac84', '#1dd1a1'),
    ('#ff9ff3', '#f368e0'),
    ('#576574', '#222f3e'),
    ('#feca57', '#ff6b6b'),
    ('#54a0ff', '#5f27cd'),
    ('#00d2d3', '#54a0ff'),
    ('#ee5253', '#ff9f43'),
]


def build_avatar_png(initials, palette, size=256):
    a, b = palette
    grad = make_gradient((size, size), hex_to_rgb(a), hex_to_rgb(b))
    avatar = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size, size), fill=255)
    avatar.paste(grad, (0, 0), mask)
    draw = ImageDraw.Draw(avatar)
    font = find_font(int(size * 0.42), bold=True)
    bbox = draw.textbbox((0, 0), initials, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size - tw) / 2 - bbox[0], (size - th) / 2 - bbox[1] - 4),
              initials, fill=(255, 255, 255, 240), font=font)
    buf = BytesIO()
    avatar.save(buf, 'PNG')
    buf.seek(0)
    return buf


COVER_THEMES = {
    'tech':       [('#0f2027', '#2c5364'), ('#1a2980', '#26d0ce'), ('#000428', '#004e92')],
    'design':     [('#ff6b9d', '#c06c84'), ('#f3ec78', '#af4261'), ('#ee0979', '#ff6a00')],
    'education':  [('#2193b0', '#6dd5ed'), ('#373b44', '#4286f4'), ('#134e5e', '#71b280')],
    'travel':     [('#ff9966', '#ff5e62'), ('#2980b9', '#6dd5fa'), ('#56ab2f', '#a8e063')],
    'lifestyle':  [('#834d9b', '#d04ed6'), ('#fc466b', '#3f5efb'), ('#ffafbd', '#ffc3a0')],
}
ICON_BY_CATEGORY = {
    'tech': '⌬', 'design': '✦', 'education': '✎',
    'travel': '✈', 'lifestyle': '❀',
}


def build_cover_jpg(category_slug, title, size=(1200, 700)):
    palettes = COVER_THEMES.get(category_slug, COVER_THEMES['lifestyle'])
    a, b = random.choice(palettes)
    img = make_gradient(size, hex_to_rgb(a), hex_to_rgb(b))

    overlay = Image.new('RGBA', size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for _ in range(7):
        r = random.randint(80, 260)
        x = random.randint(-50, size[0])
        y = random.randint(-50, size[1])
        alpha = random.randint(18, 50)
        od.ellipse((x - r, y - r, x + r, y + r),
                   fill=(255, 255, 255, alpha))
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=18))
    img = Image.alpha_composite(img.convert('RGBA'), overlay)

    grad_dim = Image.new('RGBA', size, (0, 0, 0, 0))
    gd = grad_dim.load()
    for y in range(size[1]):
        a_val = int(140 * (y / size[1]) ** 2)
        for x in range(size[0]):
            gd[x, y] = (0, 0, 0, a_val)
    img = Image.alpha_composite(img, grad_dim)

    draw = ImageDraw.Draw(img)
    draw.text((60, 50), ICON_BY_CATEGORY.get(category_slug, '✶'),
              fill=(255, 255, 255, 200), font=find_font(120))

    title_font = find_font(60, bold=True)
    max_w = size[0] - 120
    words = title.split()
    lines, cur = [], ''
    for w in words:
        test = (cur + ' ' + w).strip()
        if draw.textlength(test, font=title_font) <= max_w:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    y = size[1] - 72 * len(lines) - 80
    for line in lines:
        draw.text((60, y), line, fill=(255, 255, 255, 250), font=title_font)
        y += 72

    buf = BytesIO()
    img.convert('RGB').save(buf, 'JPEG', quality=88)
    buf.seek(0)
    return buf


# ─── Демо-контент ────────────────────────────────────────────────────────────
USERS = [
    ('anna_writes',   'anna@inkspot.ru',   'АП',
     'Пишу о привычках, продуктивности и осознанной жизни. '
     'Веду блог уже четыре года и каждый день учусь чему-то новому.'),
    ('mikhail_dev',   'mikhail@inkspot.ru', 'МС',
     'Senior Python-разработчик. Рассказываю простыми словами о '
     'сложных штуках: архитектуре, базах данных и DevOps.'),
    ('elena_design',  'elena@inkspot.ru',  'ЕВ',
     'Продуктовый дизайнер. Изучаю UX-исследования, типографику '
     'и делюсь находками о цвете и композиции.'),
    ('dmitry_code',   'dmitry@inkspot.ru', 'ДО',
     'Frontend-инженер, фанат React и аккуратного CSS. '
     'Веду заметки о веб-разработке и инструментах.'),
    ('sofya_teach',   'sofya@inkspot.ru',  'СК',
     'Преподаватель английского и автор курсов. Помогаю учить языки '
     'без зубрёжки и стресса.'),
    ('artem_travels', 'artem@inkspot.ru',  'АМ',
     'Путешественник и фотограф. За плечами 32 страны и десятки '
     'удивительных историй. Делюсь маршрутами и заметками.'),
    ('victoria_ui',   'victoria@inkspot.ru', 'ВЛ',
     'UI-дизайнер и иллюстратор. Люблю спокойные интерфейсы, '
     'мягкие тени и хорошо подобранные шрифты.'),
    ('ilya_life',     'ilya@inkspot.ru',   'ИЖ',
     'Пишу о минимализме, спорте и балансе между работой и жизнью. '
     'Кофеман, бегун и любитель книг.'),
    ('maria_edu',     'maria@inkspot.ru',  'МБ',
     'Методист онлайн-курсов. Рассказываю, как учиться эффективно '
     'и не выгорать в процессе.'),
    ('nikita_road',   'nikita@inkspot.ru', 'НГ',
     'Цифровой кочевник: работаю удалённо и живу в разных городах. '
     'Рассказываю о жизни на дороге и продуктивности.'),
]

POSTS = [
    ('mikhail_dev', 'tech',
     'Почему Python остаётся языком №1 в 2026 году',
     'За последние десять лет Python несколько раз провожали в отставку, '
     'но он по-прежнему уверенно занимает первую строчку рейтингов. '
     'Разберёмся, почему так происходит и что изменилось в экосистеме.\n\n'
     'Главный козырь — простота входа. Новичок может за выходные собрать '
     'веб-приложение, обучить модель и опубликовать пакет в PyPI.\n\n'
     'Если вы только начинаете путь в IT, Python — отличный первый язык. '
     'А если уже пишете на нём годами, попробуйте uv, ruff и mypy в strict-режиме.'),

    ('dmitry_code', 'tech',
     'Состояние в React: где хранить данные в 2026',
     'Когда я только начинал писать на React, useState казался '
     'универсальным ответом. Но проекты растут, и однажды просыпаешься '
     'с тридцатью провайдерами в App.tsx.\n\n'
     'Сегодня выбор шире: Zustand, Jotai, Redux Toolkit, TanStack Query, '
     'Server Components. Главный вопрос — клиентские или серверные данные.\n\n'
     'Простое правило: всё из API — в TanStack Query. UI-состояния — '
     'в useState. Глобальное (тема, авторизация, корзина) — в Zustand.'),

    ('mikhail_dev', 'tech',
     'PostgreSQL для бэкендера: 7 трюков, которые я узнал поздно',
     '1. EXPLAIN (ANALYZE, BUFFERS) — ваш лучший друг.\n\n'
     '2. Партициальные индексы для частых WHERE по статусу.\n\n'
     '3. GENERATED ALWAYS AS для вычисляемых полей.\n\n'
     '4. LATERAL JOIN для "топ-3 каждой группы".\n\n'
     '5. pg_stat_statements — топ медленных запросов в проде.\n\n'
     '6. jsonb_path_ops для индексов по JSONB.\n\n'
     '7. CTE больше не материализуется по умолчанию.'),

    ('nikita_road', 'tech',
     'Мой рабочий стек цифрового кочевника',
     'За пять лет жизни в дороге у меня сложился набор инструментов, '
     'без которых я не представляю удалённую работу.\n\n'
     'Железо: ноутбук с автономностью от 12 часов, портативный монитор, '
     'компактная механическая клавиатура.\n\n'
     'Софт: Obsidian для заметок, Linear для задач, Raycast вместо Spotlight, '
     'Tailscale для безопасного доступа к домашнему серверу.\n\n'
     'Связь: eSIM в каждой стране, оффлайн-карты и обязательный 4G-роутер.'),

    ('elena_design', 'design',
     'Цвет в интерфейсе: правила, которые работают',
     'Цвет — один из самых сильных и самых недооценённых инструментов '
     'дизайнера. Я собрала принципы, проверенные в десятках проектов.\n\n'
     'Начинайте с серой шкалы. Если интерфейс читается в оттенках серого — '
     'добавление цвета только усилит его. Если нет — цвет не спасёт.\n\n'
     'Используйте акцентный цвет редко. Один или два акцента на экран — оптимально.'),

    ('victoria_ui', 'design',
     'Тёмная тема: как сделать её хорошо',
     'Тёмная тема — это не "поменять #fff на #000". За последний год '
     'я переделала тёмный режим в трёх продуктах.\n\n'
     'Чистый чёрный утомляет глаза. Берите тёплый тёмно-серый — #0f0f12 или #1a1a1f.\n\n'
     'Тени работают наоборот: вместо drop shadow используйте подсветку границ.\n\n'
     'Насыщенные цвета бренда часто выглядят кислотно — уменьшайте saturation на 10–20%.'),

    ('elena_design', 'design',
     'Типографика для веба: с чего начать',
     'Хорошая типографика делает интерфейс понятным даже без иллюстраций.\n\n'
     'Выбирайте максимум два шрифта: один для заголовков, один для текста.\n\n'
     'Базовый текст — не меньше 16px. Длина строки — 60–80 символов. '
     'Интерлиньяж — 1.5 для основного текста.\n\n'
     'И главное: не центрируйте абзацы длиннее одной строки. Никогда.'),

    ('victoria_ui', 'design',
     'Дизайн-система с нуля: чек-лист на старте',
     'Шаг 1: токены. Цвета, типографика, отступы, скругления, тени.\n\n'
     'Шаг 2: атомарные компоненты — кнопка, инпут, чекбокс.\n\n'
     'Шаг 3: документация. Лучшая дизайн-система — та, которой пользуются. '
     'Если разработчики не знают, как взять компонент, всё было зря.'),

    ('sofya_teach', 'education',
     'Как учить иностранный язык, если у вас час в день',
     'Самый частый вопрос моих учеников: "Можно ли выучить английский, '
     'занимаясь по часу в день?". Можно, если час действительно ваш.\n\n'
     'Разделите время: 20 минут — пассивный контент, 20 минут — слова и грамматика, '
     '20 минут — говорение и письмо.\n\n'
     'Активная практика важнее любой теории. Ошибки — это нормально.'),

    ('maria_edu', 'education',
     'Почему мы забываем то, что выучили',
     'Через неделю после курса в голове остаётся 20% информации. '
     'Через месяц — пять. Это так устроен мозг.\n\n'
     'Спасение — интервальные повторения. Возвращайтесь к материалу с '
     'растущими промежутками: час, день, неделя, месяц.\n\n'
     'Идеальный инструмент — флеш-карточки в Anki или Quizlet.'),

    ('sofya_teach', 'education',
     'Топ-5 ошибок при изучении английского',
     '1. Учить грамматику без контекста.\n\n'
     '2. Бояться говорить. Молчание не учит.\n\n'
     '3. Зубрить списки слов вне фраз.\n\n'
     '4. Перепрыгивать с курса на курс.\n\n'
     '5. Ставить нереальные сроки. Свободный английский за месяц — миф.'),

    ('maria_edu', 'education',
     'Конспекты, которые работают: метод Корнелла',
     'Большинство конспектируют неправильно: пишут всё подряд и потом '
     'не понимают свои же записи. Метод Корнелла решает эту проблему.\n\n'
     'Лист делится на три зоны: справа — заметки, слева — ключевые слова '
     'и вопросы, снизу — короткое резюме.\n\n'
     'Магия — в зоне слева. После лекции пишите туда вопросы к каждой части. '
     'Через неделю закрываете правую колонку и пытаетесь ответить.'),

    ('artem_travels', 'travel',
     'Грузия за неделю: маршрут вне туристических троп',
     'Тбилиси, Батуми и Казбеги — это, конечно, прекрасно. Но настоящая '
     'Грузия — в маленьких городках.\n\n'
     'День 1–2: Кутаиси, монастырь Гелати, каньон Окаце.\n'
     'День 3: Сванетия, башни Ушгули, ледник Шхара.\n'
     'День 4–5: Сигнахи и Кахетия, винные подвалы.\n'
     'День 6–7: Боржоми и пещерный город Вардзия.\n\n'
     'Бюджет на двоих — около 70 тысяч рублей с жильём и арендой авто.'),

    ('nikita_road', 'travel',
     'Чек-лист перед поездкой на месяц',
     'Я уезжаю в дальние поездки минимум раз в квартал.\n\n'
     'Документы: паспорт, страховка, копии в облаке.\n\n'
     'Финансы: две карты разных банков, наличные в местной валюте.\n\n'
     'Связь: eSIM, оффлайн-карты, переводчик с оффлайн-режимом.\n\n'
     'И самое главное — лёгкий чемодан. Если можете унести его одной рукой '
     'по лестнице — вы упаковались правильно.'),

    ('artem_travels', 'travel',
     'Япония осенью: где смотреть момидзи',
     'Сезон момидзи — японской красной осени — короткий и стоит того, '
     'чтобы спланировать поездку именно под него.\n\n'
     'Киото в середине ноября — золотой стандарт. Храмы Эйкан-до и Тофуку-дзи '
     'особенно прекрасны.\n\n'
     'Если хочется тишины — Никко или полуостров Идзу. Виды не хуже, '
     'а туристов в десять раз меньше.'),

    ('anna_writes', 'lifestyle',
     'Как я научилась писать каждый день',
     'Четыре года назад я не могла осилить пост раз в две недели. '
     'Сейчас пишу по часу каждое утро без напоминаний.\n\n'
     'Главное открытие: дисциплина важнее вдохновения. Сажусь за стол '
     'в 7:00 — без соцсетей и почты.\n\n'
     'Не редактируйте, пока пишете. Первый черновик всегда плохой, и это нормально.\n\n'
     'Через год писать становится частью жизни.'),

    ('ilya_life', 'lifestyle',
     'Минимализм без фанатизма: 7 шагов',
     '1. Начните с одной зоны: стол, шкаф, сумка.\n\n'
     '2. Правило одного года: не пользовались — расставайтесь.\n\n'
     '3. Дублей не нужно.\n\n'
     '4. Цифровой минимализм важнее физического.\n\n'
     '5. Покупка с паузой: захотелось — отложите на неделю.\n\n'
     '6. Считайте не вещи, а время.\n\n'
     '7. Будьте к себе снисходительны.'),

    ('anna_writes', 'lifestyle',
     'Утренние ритуалы, которые меняют день',
     'Я несколько лет экспериментировала с утренними практиками.\n\n'
     'Стакан тёплой воды сразу после пробуждения. Кофе подождёт двадцать минут.\n\n'
     'Десять минут движения — просто разминка, не тренировка.\n\n'
     'Письмо в дневнике. Три страницы свободного потока.\n\n'
     'Только после этого — телефон. Если открыть телефон первым делом, '
     'вы проиграете весь день ещё до завтрака.'),

    ('ilya_life', 'lifestyle',
     'Бег в большом городе: с чего начать',
     'Год назад я не мог пробежать километр без одышки. Сейчас бегаю полумарафоны.\n\n'
     'Не покупайте сразу дорогие кроссовки. Начните в тех, что есть.\n\n'
     'Не гонитесь за скоростью. Первые два месяца бегайте так медленно, '
     'чтобы могли разговаривать на бегу.\n\n'
     'Чередуйте бег и ходьбу. Минута бега, две — шагом.\n\n'
     'И выходите на улицу. Беговая дорожка — это другой спорт.'),

    ('maria_edu', 'lifestyle',
     'Книги, которые я перечитываю каждый год',
     '«Атомные привычки» Джеймса Клира — самая практичная книга о '
     'малых шагах.\n\n'
     '«Поток» Чиксентмихайи — о состоянии полного погружения в работу.\n\n'
     '«Думай медленно, решай быстро» Канемана — после неё иначе смотришь '
     'на свои решения.\n\n'
     '«Маленький принц» — просто напоминание о том, что важно.'),

    ('elena_design', 'lifestyle',
     'Цифровой детокс: мой опыт недели без соцсетей',
     'В прошлом месяце я провела семь дней без Instagram, Telegram-каналов '
     'и YouTube.\n\n'
     'Первые два дня — ломка. Рука тянулась к телефону каждые десять минут.\n\n'
     'День три-четыре — пустота. Освободилось много времени.\n\n'
     'День пять-семь — кайф. Концентрация выросла настолько, что я закончила '
     'два проекта.\n\n'
     'После эксперимента я не вернулась полностью. Удалила Instagram, '
     'поставила лимиты на YouTube.'),
]

COMMENTS = [
    'Спасибо, очень полезно! Сохранил в закладки.',
    'Согласен с каждым пунктом. Особенно с тем, что про регулярность.',
    'А что насчёт второго пункта? Кажется, тут есть нюансы.',
    'Отличная статья, как раз искала что-то подобное.',
    'Подписываюсь под каждым словом. Сам через это прошёл.',
    'Спасибо за подборку! Часть уже использую, часть попробую.',
    'Интересный взгляд. Не со всем согласен, но повод задуматься.',
    'Хороший разбор, спасибо. Особенно зашёл последний абзац.',
    'У меня был похожий опыт, могу подтвердить — работает.',
    'Кратко и по делу. Побольше бы таких материалов.',
    'А есть ли продолжение этой темы? Хотелось бы углубиться.',
    'Прочитал на одном дыхании. Жду новых публикаций!',
    'Никогда не думал об этом с такой стороны. Спасибо!',
    'Поделюсь с коллегами, как раз обсуждали похожий вопрос.',
    'Попробую с понедельника. Расскажу, что получилось.',
]


# ─── Действия пользователя на сайте ──────────────────────────────────────────
def register(session, username, email, password):
    r = session.get(f'{BASE_URL}/register')
    r.raise_for_status()
    r = session.post(f'{BASE_URL}/register', data={
        'username': username, 'email': email, 'password': password,
    }, allow_redirects=True)
    r.raise_for_status()
    return r


def login(session, login_value, password):
    r = session.post(f'{BASE_URL}/login', data={
        'login': login_value, 'password': password,
    }, allow_redirects=True)
    r.raise_for_status()
    return r


def update_profile(session, bio, avatar_buf, avatar_name):
    files = {'avatar': (avatar_name, avatar_buf, 'image/png')}
    r = session.post(f'{BASE_URL}/profile/edit',
                     data={'bio': bio}, files=files,
                     allow_redirects=True)
    r.raise_for_status()
    return r


def get_category_id(session, slug):
    """Категории создаются в seed() при старте app, читаем их id из html-формы."""
    r = session.get(f'{BASE_URL}/create')
    r.raise_for_status()
    html = r.text
    # ищем <option value="X">Имя</option>, где slug известен по словарю
    name_by_slug = {
        'tech': 'Технологии', 'design': 'Дизайн', 'education': 'Образование',
        'travel': 'Путешествия', 'lifestyle': 'Стиль жизни',
    }
    name = name_by_slug.get(slug, '')
    import re
    m = re.search(r'<option\s+value="(\d+)"\s*>\s*' + re.escape(name) + r'\s*</option>', html)
    return m.group(1) if m else ''


def create_post(session, title, content, category_id, cover_buf, cover_name):
    files = {'image': (cover_name, cover_buf, 'image/jpeg')}
    data = {'title': title, 'content': content, 'category_id': category_id}
    r = session.post(f'{BASE_URL}/create', data=data, files=files,
                     allow_redirects=True)
    r.raise_for_status()
    # URL финальной страницы — /post/<id>
    import re
    m = re.search(r'/post/(\d+)', r.url)
    return int(m.group(1)) if m else None


def list_post_ids(session):
    """Идём по ленте и собираем все /post/<id>."""
    ids = set()
    page = 1
    while True:
        r = session.get(f'{BASE_URL}/?page={page}')
        r.raise_for_status()
        import re
        page_ids = set(int(x) for x in re.findall(r'/post/(\d+)', r.text))
        if not page_ids - ids:
            break
        ids.update(page_ids)
        page += 1
        if page > 20:
            break
    return sorted(ids)


def comment_post(session, post_id, text):
    r = session.post(f'{BASE_URL}/post/{post_id}',
                     data={'content': text}, allow_redirects=True)
    r.raise_for_status()


def like_post(session, post_id):
    r = session.post(f'{BASE_URL}/post/{post_id}/like', allow_redirects=True)
    r.raise_for_status()


# ─── Основной сценарий ───────────────────────────────────────────────────────
def wait_for_server():
    for _ in range(30):
        try:
            r = requests.get(f'{BASE_URL}/', timeout=2)
            if r.status_code == 200:
                return True
        except requests.exceptions.RequestException:
            pass
        time.sleep(1)
    return False


def main():
    random.seed(42)
    if not wait_for_server():
        raise SystemExit(f'Сервер на {BASE_URL} не отвечает. Запустите python3 app.py')

    print(f'Сервер {BASE_URL} доступен.')

    sessions = {}      # username -> requests.Session
    post_ids_by_user = {}

    # 1) регистрация + аватарка + bio
    for i, (username, email, initials, bio) in enumerate(USERS):
        s = requests.Session()
        print(f'[{username}] регистрация…')
        register(s, username, email, 'demo1234')
        # проверим, что мы залогинены, посмотрев главную
        r = s.get(f'{BASE_URL}/')
        if username not in r.text:
            # если регистрация не залогинила (например, уже существует), логинимся
            login(s, username, 'demo1234')

        print(f'[{username}] загрузка аватарки и био…')
        avatar_buf = build_avatar_png(initials,
                                      AVATAR_PALETTES[i % len(AVATAR_PALETTES)])
        update_profile(s, bio, avatar_buf, f'avatar_{username}.png')

        sessions[username] = s
        post_ids_by_user[username] = []

    # 2) создание постов
    for idx, (username, slug, title, content) in enumerate(POSTS, 1):
        s = sessions[username]
        cat_id = get_category_id(s, slug)
        print(f'[{username}] публикация поста: {title[:50]}…')
        cover_buf = build_cover_jpg(slug, title)
        post_id = create_post(s, title, content, cat_id, cover_buf,
                              f'post_{idx:02d}_{slug}.jpg')
        if post_id:
            post_ids_by_user[username].append(post_id)

    # 3) комментарии и лайки
    print('Комментарии и лайки…')
    all_ids = list_post_ids(requests.Session())
    print(f'  найдено постов на сайте: {len(all_ids)}')

    for username, s in sessions.items():
        # каждый комментирует ~4-6 чужих постов
        others = [pid for pid in all_ids if pid not in post_ids_by_user[username]]
        for pid in random.sample(others, k=min(5, len(others))):
            comment_post(s, pid, random.choice(COMMENTS))
        # и лайкает ~8-12 чужих постов
        for pid in random.sample(others, k=min(10, len(others))):
            like_post(s, pid)

    print('\nГотово! Демо-пароль для всех пользователей: demo1234')


if __name__ == '__main__':
    main()
