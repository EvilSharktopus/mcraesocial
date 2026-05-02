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

-- Summer 2026 movie list (May 8 – Labour Day, Sept 7)
-- Add/remove titles as needed before the deadline.
INSERT INTO movies (title, release_date) VALUES
  ('Star Wars: The Mandalorian & Grogu',  '2026-05-22'),
  ('The Backrooms',                        '2026-05-29'),
  ('Masters of the Universe',              '2026-06-05'),
  ('Scary Movie',                          '2026-06-05'),
  ('Disclosure Day',                       '2026-06-12'),
  ('Toy Story 5',                          '2026-06-19'),
  ('Jackass: Best and Last',               '2026-06-26'),
  ('Supergirl: Woman of Tomorrow',         '2026-06-26'),
  ('Minions & Monsters',                   '2026-07-01'),
  ('Moana (Live-Action)',                  '2026-07-10'),
  ('The Odyssey',                          '2026-07-17'),
  ('Spider-Man: Brand New Day',            '2026-07-31'),
  ('Animal Farm',                          '2026-08-07'),
  ('Paw Patrol: The Mighty Movie 2',       '2026-08-14'),
  ('Super Troopers 3',                     '2026-08-21');
