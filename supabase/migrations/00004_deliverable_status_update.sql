-- Migration to add 'Changes Requested' to the deliverables status check constraint

-- PostgreSQL doesn't allow directly adding to a CHECK constraint.
-- We must drop the old constraint and add a new one.

ALTER TABLE deliverables
DROP CONSTRAINT IF EXISTS deliverables_status_check;

ALTER TABLE deliverables
ADD CONSTRAINT deliverables_status_check 
CHECK (status IN ('Pending', 'Submitted', 'Reviewed', 'Approved', 'Rejected', 'Changes Requested'));
