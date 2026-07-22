ALTER TABLE meetings
ADD COLUMN type TEXT CHECK (type IN ('Online', 'Physical')) DEFAULT 'Online',
ADD COLUMN location TEXT;
