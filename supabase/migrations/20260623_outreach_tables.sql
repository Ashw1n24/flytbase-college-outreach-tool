-- =============================================================================
-- Outreach module tables
-- Run this in Supabase SQL editor (Dashboard → SQL Editor → New Query)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. outreach_templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_templates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  pipeline        TEXT        NOT NULL DEFAULT 'both',     -- 'student' | 'experienced' | 'both'
  message_type    TEXT        NOT NULL DEFAULT 'initial',  -- 'initial' | 'followup_1' | 'followup_2'
  channel         TEXT        NOT NULL DEFAULT 'email',    -- 'email' | 'linkedin'
  subject_template TEXT,                                   -- null for LinkedIn
  body_template   TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. outreach_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_messages (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id       UUID        NOT NULL,
  candidate_type     TEXT        NOT NULL,    -- 'student' | 'experienced'
  pipeline_id        UUID        REFERENCES public.pipelines(id) ON DELETE SET NULL,
  campaign_id        UUID        REFERENCES public.campaigns(id) ON DELETE SET NULL,
  channel            TEXT        NOT NULL DEFAULT 'email',  -- 'email' | 'linkedin'
  status             TEXT        NOT NULL DEFAULT 'draft',
  -- 'draft' | 'approved' | 'sending' | 'sent' | 'failed' | 'replied'
  subject            TEXT,
  body               TEXT        NOT NULL DEFAULT '',
  to_email           TEXT,
  to_linkedin_url    TEXT,
  candidate_name     TEXT,
  candidate_title    TEXT,
  candidate_company  TEXT,
  template_id        UUID        REFERENCES public.outreach_templates(id) ON DELETE SET NULL,
  is_followup        BOOLEAN     NOT NULL DEFAULT FALSE,
  parent_message_id  UUID        REFERENCES public.outreach_messages(id) ON DELETE SET NULL,
  follow_up_number   INTEGER     NOT NULL DEFAULT 0,        -- 0=initial, 1=first follow-up, 2=second
  gmail_message_id   TEXT,
  gmail_thread_id    TEXT,
  sent_at            TIMESTAMPTZ,
  replied_at         TIMESTAMPTZ,
  next_follow_up_at  TIMESTAMPTZ,
  error_message      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_messages_status
  ON public.outreach_messages(status);

CREATE INDEX IF NOT EXISTS idx_outreach_messages_candidate
  ON public.outreach_messages(candidate_id, candidate_type);

CREATE INDEX IF NOT EXISTS idx_outreach_messages_followup
  ON public.outreach_messages(next_follow_up_at)
  WHERE status = 'sent' AND replied_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. updated_at trigger (shared function)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_outreach_messages_updated_at ON public.outreach_messages;
CREATE TRIGGER trg_outreach_messages_updated_at
  BEFORE UPDATE ON public.outreach_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_outreach_templates_updated_at ON public.outreach_templates;
CREATE TRIGGER trg_outreach_templates_updated_at
  BEFORE UPDATE ON public.outreach_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Seed default templates
-- ---------------------------------------------------------------------------
INSERT INTO public.outreach_templates (name, pipeline, message_type, channel, subject_template, body_template)
VALUES
(
  'Student – Initial (Email)',
  'student', 'initial', 'email',
  'Opportunity at FlytBase, {{candidate_name}}',
  'Hi {{candidate_name}},

I came across your profile and was impressed by your work. FlytBase builds enterprise autonomous drone operations software used by Fortune 500 companies globally — and we think people like you would thrive here.

We''re a 80+ person team growing fast across engineering, product, sales, and operations. If you''re open to exploring what an exciting role at a deep-tech startup looks like, I''d love to connect for a quick 20-minute call.

Would any slot this week work for you?

Best,
{{sender_name}}
Talent Team · FlytBase'
),
(
  'Experienced – Initial (Email)',
  'experienced', 'initial', 'email',
  'FlytBase — {{role}} opportunity',
  'Hi {{candidate_name}},

Your background at {{company}} caught our attention — especially your experience in {{role}}.

FlytBase builds enterprise drone automation software trusted by global clients in defence, logistics, and critical infrastructure. We''re growing our team and are looking for people who''ve owned outcomes in fast-moving environments.

Would you be open to a 20-minute call this week?

Best,
{{sender_name}}
Talent Team · FlytBase'
),
(
  'Student – Initial (LinkedIn)',
  'student', 'initial', 'linkedin',
  NULL,
  'Hi {{candidate_name}}, came across your profile — impressive work! We''re building enterprise drone software at FlytBase and are always looking for driven people. Would love to connect and share more about what we''re working on.'
),
(
  'Experienced – Initial (LinkedIn)',
  'experienced', 'initial', 'linkedin',
  NULL,
  'Hi {{candidate_name}}, your background in {{role}} at {{company}} is exactly the profile we look for at FlytBase. We build autonomous drone ops software for global enterprises — would love to connect!'
),
(
  'Follow-up 1 (Email)',
  'both', 'followup_1', 'email',
  'Following up — FlytBase',
  'Hi {{candidate_name}},

Just bumping this up in case my previous message got buried. Still very keen to chat if you''re open to it — even a brief 15-minute call would be great.

Would any time this week work?

Best,
{{sender_name}}'
),
(
  'Follow-up 2 (Email)',
  'both', 'followup_2', 'email',
  'Last note from FlytBase',
  'Hi {{candidate_name}},

One final note — I don''t want to keep filling your inbox, but I did want to give you one last chance to connect before I close the loop.

If the timing is ever right down the road, feel free to reach out. Would love to keep in touch.

Best,
{{sender_name}}'
)
ON CONFLICT DO NOTHING;
