# DupeHunter — Инструкция по запуску

## Вариант 1 — Node.js прокси (рекомендуется, работает везде)

Требуется Node.js (https://nodejs.org) — версия 16+

```bash
# 1. Распакуйте архив
# 2. Откройте терминал в папке с файлами
node proxy.js

# 3. Откройте в браузере:
# http://localhost:3000
```

## Вариант 2 — Netlify (хостинг)

1. Зайдите на netlify.com
2. Sites → Add new site → Deploy manually
3. Перетащите папку с файлами (НЕ zip)
4. Убедитесь что во вкладке Functions появилась b24proxy

Структура файлов должна быть:
```
📁 (папка которую тащите)
├── index.html
├── netlify.toml
├── proxy.js
└── netlify/
    └── functions/
        └── b24proxy.js
```

## Вариант 3 — VPS / свой сервер

```bash
# Установите Node.js, скопируйте файлы на сервер
node proxy.js

# Для запуска в фоне:
npm install -g pm2
pm2 start proxy.js --name dupehunter
pm2 save
```

Откройте порт 3000 в файрволле (или настройте Nginx как reverse proxy).
