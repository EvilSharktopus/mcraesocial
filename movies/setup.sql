-- Summer Movie Wager 2026 — Supabase Schema
-- Paste this into Supabase SQL Editor and run.
-- Also create a Storage bucket named "avatars" with public access.

CREATE TABLE movies (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  release_date DATE,
  poster_path TEXT,
  tmdb_id INTEGER,
  domestic_gross BIGINT DEFAULT 0,
  box_office_rank INTEGER,
  is_eligible BOOLEAN DEFAULT true
);

CREATE TABLE participants (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  picks_submitted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE picks (
  id SERIAL PRIMARY KEY,
  participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
  movie_id INTEGER REFERENCES movies(id),
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 10),
  is_dark_horse BOOLEAN DEFAULT false,
  UNIQUE(participant_id, rank),
  UNIQUE(participant_id, movie_id)
);

-- Row Level Security (all public since no auth)
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_movies"        ON movies        FOR SELECT USING (true);
CREATE POLICY "public_read_participants"  ON participants  FOR SELECT USING (true);
CREATE POLICY "public_read_picks"         ON picks         FOR SELECT USING (true);

CREATE POLICY "public_insert_participants" ON participants FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_participants" ON participants FOR UPDATE USING (true);

CREATE POLICY "public_insert_picks"       ON picks FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_picks"       ON picks FOR UPDATE USING (true);
CREATE POLICY "public_delete_picks"       ON picks FOR DELETE USING (true);

CREATE POLICY "public_update_movies"      ON movies FOR UPDATE USING (true);

-- Summer 2026 theatrical wide releases (May 8 – Labour Day)
-- Source: Rotten Tomatoes Summer Movie Calendar 2026
-- Streaming-only titles (Netflix/Prime/Apple) are excluded.
INSERT INTO movies (title, release_date) VALUES
  -- May 8
  ('Billie Eilish: Hit Me Hard and Soft (Live in 3D)', '2026-05-08'),
  ('Mortal Kombat II',                                  '2026-05-08'),
  ('The Sheep Detectives',                              '2026-05-08'),
  -- May 15
  ('In the Grey',                                       '2026-05-15'),
  -- May 22
  ('I Love Boosters',                                   '2026-05-22'),
  ('Star Wars: The Mandalorian & Grogu',                '2026-05-22'),
  -- May 29
  ('Backrooms',                                         '2026-05-29'),
  ('Pressure',                                          '2026-05-29'),
  ('The Breadwinner',                                   '2026-05-29'),
  ('Tuner',                                             '2026-05-29'),
  -- June 5
  ('Power Ballad',                                      '2026-06-05'),
  ('Scary Movie',                                       '2026-06-05'),
  -- June 12
  ('Disclosure Day',                                    '2026-06-12'),
  -- June 19
  ('The Death of Robin Hood',                           '2026-06-19'),
  ('Toy Story 5',                                       '2026-06-19'),
  -- June 26
  ('The Invite',                                        '2026-06-26'),
  ('Jackass: Best and Last',                            '2026-06-26'),
  ('Supergirl',                                         '2026-06-26'),
  -- July 1
  ('Minions & Monsters',                                '2026-07-01'),
  -- July 3
  ('Young Washington',                                  '2026-07-03'),
  -- July 10
  ('Evil Dead Burn',                                    '2026-07-10'),
  ('Gail Daughtry and the Celebrity Sex Pass',          '2026-07-10'),
  ('Moana',                                             '2026-07-10'),
  -- July 17
  ('The Odyssey',                                       '2026-07-17'),
  -- July 31
  ('I Want Your Sex',                                   '2026-07-31'),
  ('Spider-Man: Brand New Day',                         '2026-07-31'),
  -- August 7
  ('Ice Cream Man',                                     '2026-08-07'),
  ('Super Troopers 3',                                  '2026-08-07'),
  ('Teenage Sex and Death at Camp Miasma',              '2026-08-07'),
  -- August 14
  ('The End of Oak Street',                             '2026-08-14'),
  ('PAW Patrol: The Dino Movie',                        '2026-08-14'),
  -- August 21
  ('Insidious: Out of the Further',                     '2026-08-21'),
  ('Spa Weekend',                                       '2026-08-21'),
  -- August 28
  ('Coyote vs. Acme',                                   '2026-08-28'),
  ('The Dog Stars',                                     '2026-08-28'),
  ('Idiots',                                            '2026-08-28');
