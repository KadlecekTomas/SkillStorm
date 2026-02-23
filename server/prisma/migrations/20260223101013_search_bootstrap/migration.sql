-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Function: set_search_all
CREATE OR REPLACE FUNCTION set_search_all()
RETURNS trigger AS $$
BEGIN
  NEW.search_all :=
    unaccent(
      coalesce(NEW.title, '') || ' ' ||
      coalesce(NEW.description, '')
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: ensure_trgm_search
CREATE OR REPLACE FUNCTION ensure_trgm_search()
RETURNS void AS $$
BEGIN
  -- placeholder if needed
END;
$$ LANGUAGE plpgsql;
