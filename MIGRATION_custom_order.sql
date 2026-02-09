-- Добавляем поле custom_order в таблицу tracks если его еще нет
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS custom_order INTEGER DEFAULT 0;

-- Добавляем поле custom_order в таблицу albums если его еще нет
ALTER TABLE albums ADD COLUMN IF NOT EXISTS custom_order INTEGER DEFAULT 0;

-- Добавляем поле custom_order в таблицу artists если его еще нет
ALTER TABLE artists ADD COLUMN IF NOT EXISTS custom_order INTEGER DEFAULT 0;

-- Создаем индексы для быстрой сортировки (опционально)
CREATE INDEX IF NOT EXISTS idx_tracks_custom_order ON tracks(custom_order DESC);
CREATE INDEX IF NOT EXISTS idx_albums_custom_order ON albums(custom_order DESC);
CREATE INDEX IF NOT EXISTS idx_artists_custom_order ON artists(custom_order DESC);
