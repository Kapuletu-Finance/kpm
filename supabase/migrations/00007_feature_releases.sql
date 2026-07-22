-- Migration: Add release_id to features to link them to releases

ALTER TABLE features
ADD COLUMN release_id UUID REFERENCES releases(id) ON DELETE SET NULL;
