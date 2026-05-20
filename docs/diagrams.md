# Код диаграмм для курсового проекта InkSpot

Вставляй блоки в нужные редакторы. Где есть оба варианта (Mermaid и PlantUML) — бери тот, который удобнее.

- **Mermaid** → [mermaid.live](https://mermaid.live) — экспорт PNG/SVG
- **PlantUML** → [plantuml.com/plantuml](https://www.plantuml.com/plantuml/uml) — экспорт PNG/SVG
- **DBML (ER)** → [dbdiagram.io](https://dbdiagram.io) — экспорт PNG/SVG/PDF
- **draw.io** → [app.diagrams.net](https://app.diagrams.net) — для BPMN с правильной нотацией

---

## Рис. 1 — BPMN «как есть» (публикация контента вручную)

### Mermaid

```mermaid
flowchart LR
    s((Начало)) --> a[Автор пишет<br/>текст в редакторе]
    a --> b[Отправляет файл<br/>модератору в мессенджер]
    b --> c{Модератор<br/>принял?}
    c -- Нет --> a
    c -- Да --> d[Модератор размещает<br/>текст вручную]
    d --> e[Загружает<br/>обложку]
    e --> f[Публикует<br/>в соц. сети]
    f --> g((Конец))

    classDef start fill:#22c55e,stroke:#16a34a,color:#fff
    classDef ending fill:#ef4444,stroke:#b91c1c,color:#fff
    classDef gate fill:#fde047,stroke:#ca8a04
    class s start
    class g ending
    class c gate
```

---

## Рис. 2 — BPMN «как будет» (через InkSpot)

### Mermaid

```mermaid
flowchart LR
    s((Начало)) --> reg[Автор регистрируется<br/>и входит в систему]
    reg --> form[Заполняет форму<br/>«Новая статья»]
    form --> upl[Загружает обложку<br/>выбирает категорию]
    upl --> save[Система сохраняет<br/>в БД]
    save --> pub[Статья доступна<br/>всем читателям]
    pub --> mod{Модерация<br/>нужна?}
    mod -- Нет --> e((Конец))
    mod -- Да --> adm[Админ открывает<br/>панель управления]
    adm --> dec{Соответствует<br/>правилам?}
    dec -- Да --> e
    dec -- Нет --> del[Админ удаляет<br/>публикацию]
    del --> e

    classDef start fill:#22c55e,stroke:#16a34a,color:#fff
    classDef ending fill:#ef4444,stroke:#b91c1c,color:#fff
    classDef gate fill:#fde047,stroke:#ca8a04
    class s start
    class e ending
    class mod,dec gate
```

---

## Рис. 3 — UML Use Case

### PlantUML (рекомендуется — выглядит как настоящий Use Case)

```plantuml
@startuml
left to right direction
skinparam packageStyle rectangle
skinparam actorStyle awesome

actor "Гость" as guest
actor "Зарегистрированный\nпользователь" as user
actor "Администратор" as admin

user --|> guest
admin --|> user

rectangle InkSpot {
    usecase "Просмотр статей" as UC1
    usecase "Поиск по статьям" as UC2
    usecase "Фильтр по категории" as UC3
    usecase "Регистрация" as UC4
    usecase "Вход в систему" as UC5
    usecase "Публикация статьи" as UC6
    usecase "Редактирование своей статьи" as UC7
    usecase "Удаление своей статьи" as UC8
    usecase "Комментирование" as UC9
    usecase "Лайк публикации" as UC10
    usecase "Редактирование профиля" as UC11
    usecase "Управление пользователями" as UC12
    usecase "Управление категориями" as UC13
    usecase "Модерация комментариев" as UC14
    usecase "Редактирование любой статьи" as UC15
}

guest --> UC1
guest --> UC2
guest --> UC3
guest --> UC4
guest --> UC5

user --> UC6
user --> UC7
user --> UC8
user --> UC9
user --> UC10
user --> UC11

admin --> UC12
admin --> UC13
admin --> UC14
admin --> UC15
@enduml
```

### Mermaid (если PlantUML недоступен)

```mermaid
flowchart LR
    G((Гость))
    U((Пользователь))
    A((Админ))

    subgraph InkSpot
        UC1[Просмотр статей]
        UC2[Поиск]
        UC3[Регистрация]
        UC4[Вход]
        UC5[Публикация статьи]
        UC6[Редактирование своей статьи]
        UC7[Комментирование]
        UC8[Лайк]
        UC9[Профиль]
        UC10[Управление<br/>пользователями]
        UC11[Управление<br/>категориями]
        UC12[Модерация<br/>комментариев]
        UC13[Редактирование<br/>любой статьи]
    end

    G --> UC1 & UC2 & UC3 & UC4
    U --> UC5 & UC6 & UC7 & UC8 & UC9
    A --> UC10 & UC11 & UC12 & UC13
```

---

## Рис. 4 — ER-диаграмма

### DBML для dbdiagram.io (рекомендуется — самая красивая)

```dbml
Table user {
  id integer [pk, increment]
  username varchar(40) [unique, not null]
  email varchar(120) [unique, not null]
  password_hash varchar(255) [not null]
  bio text
  avatar varchar(255)
  is_admin boolean [default: false]
  created_at datetime
}

Table category {
  id integer [pk, increment]
  name varchar(50) [unique, not null]
  slug varchar(50) [unique, not null]
}

Table post {
  id integer [pk, increment]
  title varchar(200) [not null]
  content text [not null]
  image varchar(255)
  created_at datetime
  views integer [default: 0]
  user_id integer [ref: > user.id, not null]
  category_id integer [ref: > category.id]
}

Table comment {
  id integer [pk, increment]
  content text [not null]
  created_at datetime
  user_id integer [ref: > user.id, not null]
  post_id integer [ref: > post.id, not null]
}

Table post_likes {
  user_id integer [ref: > user.id, pk]
  post_id integer [ref: > post.id, pk]
}
```

### Mermaid erDiagram (если хочется в одном формате со всем остальным)

```mermaid
erDiagram
    USER ||--o{ POST          : "пишет"
    USER ||--o{ COMMENT       : "оставляет"
    USER }o--o{ POST          : "лайкает"
    POST ||--o{ COMMENT       : "содержит"
    CATEGORY ||--o{ POST      : "включает"

    USER {
        int id PK
        varchar(40) username UK
        varchar(120) email UK
        varchar(255) password_hash
        text bio
        varchar(255) avatar
        bool is_admin
        datetime created_at
    }
    POST {
        int id PK
        varchar(200) title
        text content
        varchar(255) image
        datetime created_at
        int views
        int user_id FK
        int category_id FK
    }
    COMMENT {
        int id PK
        text content
        datetime created_at
        int user_id FK
        int post_id FK
    }
    CATEGORY {
        int id PK
        varchar(50) name UK
        varchar(50) slug UK
    }
    POST_LIKES {
        int user_id PK_FK
        int post_id PK_FK
    }
```

---

## Рис. 6 — Архитектура приложения

### Mermaid

```mermaid
flowchart TB
    subgraph Клиент
        B["Браузер<br/>(HTML + Bootstrap 5 + JS)"]
    end

    subgraph Сервер["Сервер (Render.com / Gunicorn)"]
        F[Flask<br/>app.py]
        R[Маршруты<br/>и контроллеры]
        T["Шаблоны Jinja2<br/>(templates/)"]
        S["Static<br/>(CSS, JS, img)"]
        AU[Flask-Login<br/>аутентификация]
        ORM[SQLAlchemy<br/>ORM]
    end

    subgraph Данные
        DB[(SQLite<br/>blog.db)]
        UP[(Файлы:<br/>static/uploads)]
    end

    B <-- "HTTP / HTTPS" --> F
    F --> R
    R --> AU
    R --> T
    R --> ORM
    T --> S
    ORM <--> DB
    R --> UP

    classDef ext fill:#e0f2fe,stroke:#0284c7
    classDef srv fill:#fef3c7,stroke:#ca8a04
    classDef db  fill:#dcfce7,stroke:#16a34a
    class B ext
    class F,R,T,S,AU,ORM srv
    class DB,UP db
```

---

## Рис. 13 — Схема навигации сайта

### Mermaid

```mermaid
flowchart TB
    home([Главная /])
    cat[/Категория ?category=…/]
    search[/Поиск ?q=…/]
    post[Статья /post/id]
    create[Новая статья /create]
    edit[Редактировать /post/id/edit]
    profile[Профиль /user/username]
    pedit[Настройки профиля /profile/edit]
    login[Вход /login]
    register[Регистрация /register]
    about[О проекте /about]
    rules[Правила /rules]
    contacts[Контакты /contacts]

    subgraph Админ-панель
        adm([Дашборд /admin])
        users[Пользователи /admin/users]
        posts[Публикации /admin/posts]
        comments[Комментарии /admin/comments]
        cats[Категории /admin/categories]
    end

    home --> post
    home --> cat
    home --> search
    home --> login
    home --> register
    home --> create
    home --> profile
    home --> about & rules & contacts
    post --> profile
    profile --> pedit
    profile --> post
    post --> edit
    login --> home
    register --> home
    adm --> users & posts & comments & cats
    home -. "is_admin" .-> adm

    classDef pub fill:#dbeafe,stroke:#2563eb
    classDef auth fill:#fef9c3,stroke:#ca8a04
    classDef admin fill:#fee2e2,stroke:#dc2626
    class home,post,cat,search,about,rules,contacts pub
    class create,edit,profile,pedit,login,register auth
    class adm,users,posts,comments,cats admin
```

---

## Что делать с этими блоками

1. **Mermaid** — открой [mermaid.live](https://mermaid.live), вставь код, нажми **Actions → PNG/SVG**, сохрани в `docs/img/`.
2. **PlantUML** — открой [plantuml.com/plantuml](https://www.plantuml.com/plantuml/uml), вставь, скачай PNG.
3. **DBML** — открой [dbdiagram.io](https://dbdiagram.io), создай новый Diagram, вставь DBML, **Export → PNG**.
4. После того как PNG'и готовы, кинь их сюда — вставлю в `.docx` вместо серых плейсхолдеров.
