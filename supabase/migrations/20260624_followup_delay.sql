-- Add follow_up_delay_days to outreach_messages
-- Stores how many days after the parent/initial is sent this follow-up should be dispatched.
-- NULL means "send immediately / no delay tracking".
ALTER TABLE public.outreach_messages
  ADD COLUMN IF NOT EXISTS follow_up_delay_days INTEGER;
