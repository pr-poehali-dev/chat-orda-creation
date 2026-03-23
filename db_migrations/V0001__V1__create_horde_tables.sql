
CREATE TABLE t_p39730427_chat_orda_creation.members (
  id SERIAL PRIMARY KEY,
  nick VARCHAR(64) NOT NULL UNIQUE,
  rank VARCHAR(32) NOT NULL DEFAULT 'Новобранец',
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_online BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE t_p39730427_chat_orda_creation.messages (
  id SERIAL PRIMARY KEY,
  author VARCHAR(64) NOT NULL,
  rank VARCHAR(32) NOT NULL DEFAULT '',
  text TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE t_p39730427_chat_orda_creation.rules (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE t_p39730427_chat_orda_creation.events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(128) NOT NULL,
  event_date VARCHAR(32) NOT NULL,
  description TEXT NOT NULL
);

INSERT INTO t_p39730427_chat_orda_creation.members (nick, rank, is_online) VALUES
  ('ВеликийОрк', 'Глава', TRUE),
  ('КровавыйТопор', 'Военачальник', TRUE),
  ('ТёмнаяЧума', 'Капитан', FALSE),
  ('ЖелезноеСердце', 'Ветеран', TRUE),
  ('ТеньВолка', 'Воин', FALSE);

INSERT INTO t_p39730427_chat_orda_creation.messages (author, rank, text) VALUES
  ('ВеликийОрк', 'Глава', 'Братья! Орда непобедима! 🔥'),
  ('КровавыйТопор', 'Военачальник', 'Готов к войне!'),
  ('СИСТЕМА', '', 'ЖелезноеСердце вступил в Орду! Добро пожаловать, воин! ⚔️');

UPDATE t_p39730427_chat_orda_creation.messages SET is_system = TRUE WHERE author = 'СИСТЕМА';

INSERT INTO t_p39730427_chat_orda_creation.rules (text, sort_order) VALUES
  ('Уважай своих союзников — мы одна Орда.', 1),
  ('Участвуй в атаках Титанов и Войнах Альянсов.', 2),
  ('Не нападай на членов альянса.', 3),
  ('Сообщай о своём отсутствии более 3 дней.', 4),
  ('Делись ресурсами с союзниками в осадах.', 5);

INSERT INTO t_p39730427_chat_orda_creation.events (title, event_date, description) VALUES
  ('Война Альянсов', '28.03.2026', 'Готовьтесь к битве! Координация в чате.'),
  ('Осада Титана', '25.03.2026', 'Все на Титана! Встречаемся в 20:00.'),
  ('Турнир Героев', '30.03.2026', 'Индивидуальный турнир, призы победителям.');
