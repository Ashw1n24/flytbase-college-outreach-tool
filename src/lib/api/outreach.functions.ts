/**
 * Outreach module server functions.
 *
 * Flow:
 *   1. User selects candidates on the student/experienced dashboards.
 *   2. Calls addToOutreachQueueFn → creates 'draft' outreach_messages rows.
 *   3. User visits /outreach, reviews drafts, bulk-selects → approveMessagesFn.
 *   4. User clicks "Send Batch" → sendApprovedBatchFn → sends email via Gmail
 *      or queues LinkedIn messages via Phantombuster.
 *   5. processFollowUpsFn (called on page load or manually) generates follow-up
 *      drafts for sent messages with no reply after the follow-up window.
 *
 * Required env vars (in addition to Supabase):
 *   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
 *   GMAIL_FROM_EMAIL, GMAIL_SENDER_NAME
 *   PHANTOMBUSTER_API_KEY          (optional — LinkedIn only)
 *   PHANTOMBUSTER_LINKEDIN_AGENT_ID (optional — LinkedIn only)
 *   OUTREACH_FOLLOWUP_DAYS         (optional, default 3)
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase.server";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FOLLOWUP_DAYS = parseInt(process.env.OUTREACH_FOLLOWUP_DAYS ?? "3", 10);
const MAX_FOLLOWUPS = 2;

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const candidateTypeSchema = z.enum(["student", "experienced"]);
const channelSchema       = z.enum(["email", "linkedin"]);
const statusSchema        = z.enum(["draft", "approved", "sending", "sent", "failed", "replied"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Replace {{variable}} placeholders in a template string. */
function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

/** Build variable map from a student candidate row. */
function studentVars(row: {
  full_name?: string | null;
  university?: string | null;
  branch?: string | null;
  email?: string | null;
}): Record<string, string> {
  const candidateName = row.full_name ?? "";
  const university    = row.university ?? "";
  const branch        = row.branch ?? "";
  return {
    candidate_name: candidateName,
    name:           candidateName, // alias
    university,
    college:        university,    // alias
    branch,
    role:           "student",
    company:        "",
    skills:         "",
    sender_name:    process.env.GMAIL_SENDER_NAME ?? "FlytBase Talent",
  };
}

/** Build variable map from an experienced candidate row. */
function experiencedVars(row: {
  full_name?: string | null;
  current_title?: string | null;
  current_company?: string | null;
  skills?: string[] | null;
}): Record<string, string> {
  const candidateName = row.full_name ?? "";
  return {
    candidate_name: candidateName,
    name:           candidateName, // alias
    university:     "",
    college:        "",            // alias
    branch:         "",
    role:           row.current_title ?? "",
    company:        row.current_company ?? "",
    skills:         (row.skills ?? []).slice(0, 3).join(", "),
    sender_name:    process.env.GMAIL_SENDER_NAME ?? "FlytBase Talent",
  };
}

// ---------------------------------------------------------------------------
// 1. Template CRUD
// ---------------------------------------------------------------------------

export const getOutreachTemplatesFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("outreach_templates")
      .select("*")
      .order("pipeline")
      .order("message_type")
      .order("channel");
    if (error) throw new Error(`Failed to fetch templates: ${error.message}`);
    return data ?? [];
  });

export const upsertOutreachTemplateFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id:               z.string().optional(),
      name:             z.string().min(1),
      pipeline:         z.enum(["student", "experienced", "both"]),
      message_type:     z.enum(["initial", "followup_1", "followup_2"]),
      channel:          channelSchema,
      subject_template: z.string().nullable().optional(),
      body_template:    z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    const { id, ...fields } = data;
    if (id) {
      const { error } = await supabase
        .from("outreach_templates")
        .update(fields)
        .eq("id", id);
      if (error) throw new Error(`Failed to update template: ${error.message}`);
    } else {
      const { error } = await supabase
        .from("outreach_templates")
        .insert(fields);
      if (error) throw new Error(`Failed to create template: ${error.message}`);
    }
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// 2. Add candidates to outreach queue
// ---------------------------------------------------------------------------

export const addToOutreachQueueFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      candidateIds:   z.array(z.string().uuid()).min(1),
      candidateType:  candidateTypeSchema,
      channel:        channelSchema,
      templateId:     z.string().uuid(),
      campaignId:     z.string().uuid().optional(), // for experienced candidates
      pipelineId:     z.string().uuid().optional(), // for students
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();

    // 1. Fetch template
    const { data: template, error: tmplErr } = await supabase
      .from("outreach_templates")
      .select("*")
      .eq("id", data.templateId)
      .single();
    if (tmplErr || !template) throw new Error("Template not found");

    // 2. Fetch candidate details
    type StudentRow = {
      id: string;
      full_name: string;
      university: string | null;
      branch: string | null;
      email: string | null;
      linkedin_url: string | null;
    };
    type ExpRow = {
      id: string;
      full_name: string;
      current_title: string | null;
      current_company: string | null;
      email: string | null;
      linkedin_url: string | null;
      skills: string[] | null;
    };

    let rows: (StudentRow | ExpRow)[] = [];

    if (data.candidateType === "student") {
      const { data: candidates, error } = await supabase
        .from("candidates")
        .select("id, full_name, university, branch, email, linkedin_url")
        .in("id", data.candidateIds);
      if (error) throw new Error(`Failed to fetch candidates: ${error.message}`);
      rows = (candidates ?? []) as StudentRow[];
    } else {
      const { data: candidates, error } = await supabase
        .from("experienced_candidates")
        .select("id, full_name, current_title, current_company, email, linkedin_url, skills")
        .in("id", data.candidateIds);
      if (error) throw new Error(`Failed to fetch experienced candidates: ${error.message}`);
      rows = (candidates ?? []) as ExpRow[];
    }

    // 3. Deduplicate: skip candidates already in queue (draft/approved/sent)
    const { data: existing } = await supabase
      .from("outreach_messages")
      .select("candidate_id")
      .in("candidate_id", data.candidateIds)
      .in("status", ["draft", "approved", "sending", "sent"])
      .eq("channel", data.channel);

    const alreadyQueued = new Set((existing ?? []).map((r) => r.candidate_id));

    // 4. Build message rows
    const messages = rows
      .filter((r) => !alreadyQueued.has(r.id))
      .filter((r) => {
        // For email channel, skip candidates without email
        if (data.channel === "email" && !r.email) return false;
        // For linkedin channel, skip candidates without LinkedIn URL
        if (data.channel === "linkedin" && !r.linkedin_url) return false;
        return true;
      })
      .map((r) => {
        const vars =
          data.candidateType === "student"
            ? studentVars(r as StudentRow)
            : experiencedVars(r as ExpRow);

        const subject = template.subject_template
          ? renderTemplate(template.subject_template, vars)
          : null;
        const body = renderTemplate(template.body_template, vars);

        return {
          candidate_id:     r.id,
          candidate_type:   data.candidateType,
          pipeline_id:      data.pipelineId ?? null,
          campaign_id:      data.campaignId ?? null,
          channel:          data.channel,
          status:           "draft" as const,
          subject,
          body,
          to_email:         data.channel === "email" ? r.email : null,
          to_linkedin_url:  data.channel === "linkedin" ? r.linkedin_url : null,
          candidate_name:   r.full_name,
          candidate_title:  data.candidateType === "experienced"
            ? (r as ExpRow).current_title
            : null,
          candidate_company: data.candidateType === "experienced"
            ? (r as ExpRow).current_company
            : null,
          template_id:      data.templateId,
          follow_up_number: 0,
          is_followup:      false,
        };
      });

    if (messages.length === 0) {
      return { queued: 0, skipped: rows.length };
    }

    const { error: insertErr } = await supabase
      .from("outreach_messages")
      .insert(messages);
    if (insertErr) throw new Error(`Failed to queue messages: ${insertErr.message}`);

    return { queued: messages.length, skipped: rows.length - messages.length };
  });

// ---------------------------------------------------------------------------
// 3. Fetch outreach messages
// ---------------------------------------------------------------------------

export const getOutreachMessagesFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      statuses:       z.array(statusSchema).default([]),
      channel:        channelSchema.optional(),
      candidateType:  candidateTypeSchema.optional(),
      noReply:        z.boolean().optional(), // filter to replied_at IS NULL
      isFollowup:     z.boolean().optional(), // filter to is_followup = true/false
      parentIds:      z.array(z.string().uuid()).optional(), // fetch follow-ups for specific parents
      limit:          z.number().int().min(1).max(500).default(100),
      offset:         z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("outreach_messages")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);

    if (data.statuses.length > 0) {
      query = query.in("status", data.statuses);
    }
    if (data.channel) {
      query = query.eq("channel", data.channel);
    }
    if (data.candidateType) {
      query = query.eq("candidate_type", data.candidateType);
    }
    if (data.noReply) {
      query = query.is("replied_at", null);
    }
    if (data.isFollowup !== undefined) {
      query = query.eq("is_followup", data.isFollowup);
    }
    if (data.parentIds && data.parentIds.length > 0) {
      query = query.in("parent_message_id", data.parentIds);
    }

    const { data: rows, error, count } = await query;
    if (error) throw new Error(`Failed to fetch messages: ${error.message}`);
    return { messages: rows ?? [], total: count ?? 0 };
  });

// ---------------------------------------------------------------------------
// 4. Stats
// ---------------------------------------------------------------------------

export const getOutreachStatsFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("outreach_messages")
      .select("status, is_followup, next_follow_up_at");
    if (error) throw new Error(`Failed to fetch stats: ${error.message}`);

    const counts: Record<string, number> = {
      draft: 0, approved: 0, sending: 0, sent: 0, failed: 0, replied: 0, followup_due: 0,
    };
    const now = new Date();
    for (const row of data ?? []) {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
      // Follow-up due: draft follow-ups whose next_follow_up_at has passed
      if (
        row.status === "draft" &&
        row.is_followup &&
        row.next_follow_up_at &&
        new Date(row.next_follow_up_at) <= now
      ) {
        counts.followup_due++;
      }
    }
    return counts;
  });

// ---------------------------------------------------------------------------
// 5. Bulk approve / delete
// ---------------------------------------------------------------------------

export const updateMessageStatusFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ids:    z.array(z.string().uuid()).min(1),
      status: z.enum(["approved", "deleted"]),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();

    if (data.status === "deleted") {
      const { error } = await supabase
        .from("outreach_messages")
        .delete()
        .in("id", data.ids);
      if (error) throw new Error(`Failed to delete messages: ${error.message}`);
    } else {
      const { error } = await supabase
        .from("outreach_messages")
        .update({ status: data.status })
        .in("id", data.ids)
        .eq("status", "draft"); // only approve drafts
      if (error) throw new Error(`Failed to approve messages: ${error.message}`);
    }

    return { ok: true };
  });

// ---------------------------------------------------------------------------
// 6. Send approved batch
// ---------------------------------------------------------------------------

async function sendViaGmail(msg: {
  id: string;
  to_email: string;
  subject: string | null;
  body: string;
  parent_message_id: string | null;
  gmail_thread_id: string | null;
}): Promise<{ messageId: string; threadId: string }> {
  // Dynamic import so the bundle doesn't break if googleapis isn't installed yet
  const { sendEmail } = await import("@/lib/gmail.server");
  return sendEmail({
    to:       msg.to_email,
    subject:  msg.subject ?? "(no subject)",
    body:     msg.body,
    threadId: msg.gmail_thread_id ?? undefined,
  });
}

async function sendViaPhantombuster(messages: {
  to_linkedin_url: string;
  body: string;
}[]): Promise<void> {
  const apiKey  = process.env.PHANTOMBUSTER_API_KEY;
  const agentId = process.env.PHANTOMBUSTER_LINKEDIN_AGENT_ID;
  if (!apiKey || !agentId) {
    throw new Error(
      "Missing PHANTOMBUSTER_API_KEY or PHANTOMBUSTER_LINKEDIN_AGENT_ID in .env",
    );
  }

  // Phantombuster "LinkedIn Message Sender" argument format
  const argument = {
    spreadsheetUrl: undefined,
    profilesAndMessages: messages.map((m) => ({
      profileUrl: m.to_linkedin_url,
      message:    m.body,
    })),
    numberOfMessagesPerLaunch: messages.length,
  };

  const res = await fetch("https://api.phantombuster.com/api/v2/agents/launch", {
    method: "POST",
    headers: {
      "Content-Type":         "application/json",
      "X-Phantombuster-Key":  apiKey,
    },
    body: JSON.stringify({ id: agentId, argument }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Phantombuster launch failed (${res.status}): ${text}`);
  }
}

export const sendApprovedBatchFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ids: z.array(z.string().uuid()).min(1),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();

    // Fetch only approved messages in the requested IDs
    const { data: msgs, error: fetchErr } = await supabase
      .from("outreach_messages")
      .select("*")
      .in("id", data.ids)
      .eq("status", "approved");
    if (fetchErr) throw new Error(`Failed to fetch messages: ${fetchErr.message}`);
    if (!msgs || msgs.length === 0) return { sent: 0, failed: 0 };

    // Mark as 'sending' immediately to prevent double-sends
    await supabase
      .from("outreach_messages")
      .update({ status: "sending" })
      .in("id", msgs.map((m) => m.id));

    const emailMsgs    = msgs.filter((m) => m.channel === "email" && m.to_email);
    const linkedinMsgs = msgs.filter((m) => m.channel === "linkedin" && m.to_linkedin_url);

    let sent   = 0;
    let failed = 0;

    // ── Email sends (sequential to avoid Gmail rate limits) ──────────────────
    for (const msg of emailMsgs) {
      try {
        // For follow-ups queued from CSV, gmail_thread_id may not yet be set —
        // look it up from the parent message (which will have been sent by now).
        let gmailThreadId = msg.gmail_thread_id;
        if (!gmailThreadId && msg.parent_message_id) {
          const { data: parent } = await supabase
            .from("outreach_messages")
            .select("gmail_thread_id")
            .eq("id", msg.parent_message_id)
            .single();
          gmailThreadId = parent?.gmail_thread_id ?? null;
          if (gmailThreadId) {
            await supabase
              .from("outreach_messages")
              .update({ gmail_thread_id: gmailThreadId })
              .eq("id", msg.id);
          }
        }

        const result = await sendViaGmail({
          id:                msg.id,
          to_email:          msg.to_email!,
          subject:           msg.subject,
          body:              msg.body,
          parent_message_id: msg.parent_message_id,
          gmail_thread_id:   gmailThreadId,
        });

        const followUpAt = new Date();
        followUpAt.setDate(followUpAt.getDate() + FOLLOWUP_DAYS);

        await supabase.from("outreach_messages").update({
          status:           "sent",
          gmail_message_id: result.messageId,
          gmail_thread_id:  result.threadId,
          sent_at:          new Date().toISOString(),
          next_follow_up_at:
            msg.follow_up_number < MAX_FOLLOWUPS
              ? followUpAt.toISOString()
              : null,
        }).eq("id", msg.id);

        // For pre-queued follow-up drafts (CSV import flow): set next_follow_up_at
        // based on their stored follow_up_delay_days now that we know the sent_at time.
        const { data: preQueued } = await supabase
          .from("outreach_messages")
          .select("id, follow_up_delay_days")
          .eq("parent_message_id", msg.id)
          .eq("status", "draft");

        if (preQueued && preQueued.length > 0) {
          for (const fu of preQueued) {
            const delayDays = (fu as { id: string; follow_up_delay_days: number | null }).follow_up_delay_days ?? FOLLOWUP_DAYS;
            const fuAt = new Date();
            fuAt.setDate(fuAt.getDate() + delayDays);
            await supabase
              .from("outreach_messages")
              .update({ next_follow_up_at: fuAt.toISOString(), gmail_thread_id: result.threadId })
              .eq("id", (fu as { id: string }).id);
          }
        }

        sent++;
      } catch (err) {
        console.error(`[outreach] Gmail send failed for ${msg.id}:`, err);
        await supabase.from("outreach_messages").update({
          status:        "failed",
          error_message: err instanceof Error ? err.message : String(err),
        }).eq("id", msg.id);
        failed++;
      }

      // Jitter between sends — Gmail quota: 100 units per send, 250 units/sec ceiling
      if (emailMsgs.indexOf(msg) < emailMsgs.length - 1) {
        await new Promise((r) => setTimeout(r, 500 + Math.random() * 400));
      }
    }

    // ── LinkedIn batch send via Phantombuster ─────────────────────────────────
    if (linkedinMsgs.length > 0) {
      try {
        await sendViaPhantombuster(
          linkedinMsgs.map((m) => ({
            to_linkedin_url: m.to_linkedin_url!,
            body:            m.body,
          })),
        );

        const followUpAt = new Date();
        followUpAt.setDate(followUpAt.getDate() + FOLLOWUP_DAYS);

        const ids = linkedinMsgs.map((m) => m.id);
        await supabase.from("outreach_messages").update({
          status:           "sent",
          sent_at:          new Date().toISOString(),
          next_follow_up_at: followUpAt.toISOString(),
        }).in("id", ids);

        sent += linkedinMsgs.length;
      } catch (err) {
        console.error("[outreach] Phantombuster batch failed:", err);
        await supabase.from("outreach_messages").update({
          status:        "failed",
          error_message: err instanceof Error ? err.message : String(err),
        }).in("id", linkedinMsgs.map((m) => m.id));
        failed += linkedinMsgs.length;
      }
    }

    return { sent, failed };
  });

// ---------------------------------------------------------------------------
// 7. Process follow-ups
// ---------------------------------------------------------------------------

export const processFollowUpsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const supabase = getSupabaseAdmin();

    // Find sent messages that are due for a follow-up
    const { data: due, error } = await supabase
      .from("outreach_messages")
      .select("*")
      .eq("status", "sent")
      .is("replied_at", null)
      .lte("next_follow_up_at", new Date().toISOString())
      .lt("follow_up_number", MAX_FOLLOWUPS);

    if (error) throw new Error(`Failed to fetch due follow-ups: ${error.message}`);
    if (!due || due.length === 0) return { created: 0 };

    // Fetch follow-up templates
    const { data: templates } = await supabase
      .from("outreach_templates")
      .select("*")
      .in("message_type", ["followup_1", "followup_2"]);

    const tmplMap = new Map(
      (templates ?? []).map((t) => [`${t.message_type}_${t.channel}`, t]),
    );

    // Check which of these already have a pending follow-up (avoid double-queueing)
    const { data: existingFollowups } = await supabase
      .from("outreach_messages")
      .select("parent_message_id")
      .in("parent_message_id", due.map((m) => m.id))
      .in("status", ["draft", "approved", "sent"]);

    const alreadyHasFollowup = new Set(
      (existingFollowups ?? []).map((r) => r.parent_message_id),
    );

    const newMessages = due
      .filter((m) => !alreadyHasFollowup.has(m.id))
      .map((m) => {
        const nextNum  = (m.follow_up_number ?? 0) + 1;
        const tmplKey  = `followup_${nextNum}_${m.channel}`;
        const template = tmplMap.get(tmplKey);

        const vars: Record<string, string> = {
          candidate_name: m.candidate_name ?? "",
          role:           m.candidate_title ?? "",
          company:        m.candidate_company ?? "",
          university:     "",
          skills:         "",
          sender_name:    process.env.GMAIL_SENDER_NAME ?? "FlytBase Talent",
        };

        const subject = template?.subject_template
          ? renderTemplate(template.subject_template, vars)
          : `Follow-up — FlytBase`;
        const body = template?.body_template
          ? renderTemplate(template.body_template, vars)
          : `Hi ${m.candidate_name ?? "there"},\n\nJust following up on my previous message. Would love to connect!\n\nBest,\n${vars.sender_name}`;

        return {
          candidate_id:      m.candidate_id,
          candidate_type:    m.candidate_type,
          pipeline_id:       m.pipeline_id,
          campaign_id:       m.campaign_id,
          channel:           m.channel,
          status:            "draft" as const,
          subject,
          body,
          to_email:          m.to_email,
          to_linkedin_url:   m.to_linkedin_url,
          candidate_name:    m.candidate_name,
          candidate_title:   m.candidate_title,
          candidate_company: m.candidate_company,
          template_id:       template?.id ?? null,
          is_followup:       true,
          parent_message_id: m.id,
          follow_up_number:  nextNum,
          gmail_thread_id:   m.gmail_thread_id, // keep thread for Gmail threading
        };
      });

    if (newMessages.length === 0) return { created: 0 };

    const { error: insertErr } = await supabase
      .from("outreach_messages")
      .insert(newMessages);
    if (insertErr) throw new Error(`Failed to create follow-ups: ${insertErr.message}`);

    // Clear next_follow_up_at on parent messages so they don't trigger again
    await supabase
      .from("outreach_messages")
      .update({ next_follow_up_at: null })
      .in("id", due.map((m) => m.id).filter((id) => !alreadyHasFollowup.has(id)));

    return { created: newMessages.length };
  });

// ---------------------------------------------------------------------------
// 8. Mark replied
// ---------------------------------------------------------------------------

export const markRepliedFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase   = getSupabaseAdmin();
    const repliedAt  = new Date().toISOString();

    await supabase
      .from("outreach_messages")
      .update({ status: "replied", replied_at: repliedAt, next_follow_up_at: null })
      .eq("id", data.id);

    // Also cancel any pending follow-ups for this message chain
    await supabase
      .from("outreach_messages")
      .update({ status: "replied", replied_at: repliedAt })
      .eq("parent_message_id", data.id)
      .in("status", ["draft", "approved"]);

    return { ok: true };
  });

// ---------------------------------------------------------------------------
// 9. Gmail reply auto-detection
// ---------------------------------------------------------------------------

export const checkGmailRepliesFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const supabase = getSupabaseAdmin();

    // Fetch sent email messages that have a thread ID and no reply yet
    const { data: msgs, error } = await supabase
      .from("outreach_messages")
      .select("id, gmail_thread_id, parent_message_id")
      .eq("status", "sent")
      .eq("channel", "email")
      .is("replied_at", null)
      .not("gmail_thread_id", "is", null);

    if (error) throw new Error(`Failed to fetch sent messages: ${error.message}`);
    if (!msgs || msgs.length === 0) return { detected: 0, checked: 0, error: null };

    const { checkThreadForReply } = await import("@/lib/gmail.server");

    const repliedAt = new Date().toISOString();
    let detected = 0;
    let firstError: string | null = null;

    for (const msg of msgs) {
      try {
        const hasReply = await checkThreadForReply(msg.gmail_thread_id!);
        if (hasReply !== true) continue;

        // Mark this message as replied
        await supabase
          .from("outreach_messages")
          .update({ status: "replied", replied_at: repliedAt, next_follow_up_at: null })
          .eq("id", msg.id);

        // Cancel any pending follow-up drafts in this chain
        await supabase
          .from("outreach_messages")
          .update({ status: "replied", replied_at: repliedAt })
          .eq("parent_message_id", msg.id)
          .in("status", ["draft", "approved"]);

        detected++;
      } catch (err) {
        const msg2 = err instanceof Error ? err.message : String(err);
        console.warn(`[outreach] Reply check failed for thread ${msg.gmail_thread_id}:`, msg2);
        if (!firstError) firstError = msg2;
      }

      // Jitter delay between Gmail API calls to stay within quota (250 units/sec)
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 400));
    }

    return { detected, checked: msgs.length, error: firstError };
  });

// ---------------------------------------------------------------------------
// 10. CSV import → outreach queue (+ optional candidate DB save)
// ---------------------------------------------------------------------------

const candidateTypeSchema2 = z.enum(["student", "experienced"]);
const channelSchema2        = z.enum(["email", "linkedin"]);

export const importCsvToOutreachFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      rows:                z.array(z.record(z.string())).min(1).max(500),
      candidateType:       candidateTypeSchema2,
      channel:             channelSchema2,
      templateId:          z.string().uuid(),
      followUp1TemplateId: z.string().uuid().nullable().optional(),
      followUp2TemplateId: z.string().uuid().nullable().optional(),
      followUp1DelayDays:  z.number().int().min(1).max(90).default(3),
      followUp2DelayDays:  z.number().int().min(1).max(90).default(5),
      saveToDatabase:      z.boolean().default(false),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();

    // Fetch template
    const { data: template, error: tmplErr } = await supabase
      .from("outreach_templates")
      .select("*")
      .eq("id", data.templateId)
      .single();
    if (tmplErr || !template) throw new Error("Template not found");

    // Normalise raw CSV rows — accept flexible column names
    type NormalisedRow = {
      name: string;
      email: string;
      linkedin_url: string;
      college: string;
      branch: string;
      role: string;
      company: string;
    };

    const normalise = (raw: Record<string, string>): NormalisedRow => ({
      name:         raw.name ?? raw.full_name ?? "",
      email:        raw.email ?? raw.mail ?? "",
      linkedin_url: raw.linkedin_url ?? raw.linkedin ?? "",
      college:      raw.college ?? raw.university ?? "",
      branch:       raw.branch ?? raw.department ?? "",
      role:         raw.role ?? raw.title ?? raw.current_title ?? "",
      company:      raw.company ?? raw.current_company ?? "",
    });

    const rows = (data.rows as Record<string, string>[]).map(normalise).filter((r) => r.name);

    // Optionally save rows to candidate database
    let savedCandidateIds: string[] = [];

    if (data.saveToDatabase) {
      if (data.candidateType === "student") {
        const inserts = rows.map((r) => ({
          full_name:       r.name,
          university:      r.college || "Unknown",
          degree:          null,
          branch:          r.branch || null,
          graduation_year: null,
          source:          "manual" as const,
          linkedin_url:    r.linkedin_url || null,
          email:           r.email || null,
          email_confidence: null,
          github_url:      null,
        }));
        const { data: inserted, error } = await supabase
          .from("candidates")
          .insert(inserts)
          .select("id");
        if (error) console.warn("[csv import] Student DB insert failed:", error.message);
        savedCandidateIds = (inserted ?? []).map((r) => r.id);
      } else {
        // Experienced: upsert into a special "CSV Imports" campaign
        let campaignId: string;
        const IMPORT_CAMPAIGN_NAME = "CSV Imports";
        const { data: existing } = await supabase
          .from("campaigns")
          .select("id")
          .eq("name", IMPORT_CAMPAIGN_NAME)
          .maybeSingle();

        if (existing?.id) {
          campaignId = existing.id;
        } else {
          const { data: created, error: campErr } = await supabase
            .from("campaigns")
            .insert({
              name:            IMPORT_CAMPAIGN_NAME,
              jd_raw:          "",
              jd_parsed:       {},
              filters:         {},
              status:          "done",
              candidate_count: 0,
              company_count:   0,
            })
            .select("id")
            .single();
          if (campErr || !created) throw new Error("Failed to create CSV Import campaign");
          campaignId = created.id;
        }

        const inserts = rows.map((r) => ({
          campaign_id:        campaignId,
          apollo_id:          r.linkedin_url || `csv-${r.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
          full_name:          r.name,
          current_title:      r.role || null,
          current_company:    r.company || null,
          linkedin_url:       r.linkedin_url || null,
          email:              r.email || null,
          fit_tier:           "good" as const,
          fit_score:          50,
          required_match:     false,
          nice_to_have_count: 0,
          skills:             [],
          apollo_raw:         { _source: "csv_import" },
        }));
        const { data: inserted, error } = await supabase
          .from("experienced_candidates")
          .insert(inserts)
          .select("id");
        if (error) console.warn("[csv import] Experienced DB insert failed:", error.message);
        savedCandidateIds = (inserted ?? []).map((r) => r.id);
      }
    }

    // Build outreach_messages drafts
    const senderName = process.env.GMAIL_SENDER_NAME ?? "FlytBase Talent";

    const messages = rows
      .filter((r) => {
        if (data.channel === "email" && !r.email) return false;
        if (data.channel === "linkedin" && !r.linkedin_url) return false;
        return true;
      })
      .map((r, idx) => {
        const vars: Record<string, string> =
          data.candidateType === "student"
            ? {
                candidate_name: r.name,
                name:           r.name,
                university:     r.college,
                college:        r.college,
                branch:         r.branch ?? "",
                role:           r.role ?? "student",
                company:        "",
                skills:         "",
                sender_name:    senderName,
              }
            : {
                candidate_name: r.name,
                name:           r.name,
                university:     "",
                college:        "",
                branch:         "",
                role:           r.role,
                company:        r.company,
                skills:         "",
                sender_name:    senderName,
              };

        const subject = template.subject_template
          ? renderTemplate(template.subject_template, vars)
          : null;
        const body = renderTemplate(template.body_template, vars);

        const candidateId = savedCandidateIds[idx] ?? crypto.randomUUID();

        return {
          candidate_id:      candidateId,
          candidate_type:    data.candidateType,
          channel:           data.channel,
          status:            "draft" as const,
          subject,
          body,
          to_email:          data.channel === "email" ? (r.email || null) : null,
          to_linkedin_url:   data.channel === "linkedin" ? (r.linkedin_url || null) : null,
          candidate_name:    r.name,
          candidate_title:   data.candidateType === "experienced" ? (r.role || null) : null,
          candidate_company: data.candidateType === "experienced" ? (r.company || null) : null,
          template_id:       data.templateId,
          follow_up_number:  0,
          is_followup:       false,
        };
      });

    if (messages.length === 0) {
      return { queued: 0, skipped: rows.length, dbSaved: savedCandidateIds.length };
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("outreach_messages")
      .insert(messages)
      .select("id, candidate_id, candidate_type, channel, to_email, to_linkedin_url, candidate_name, candidate_title, candidate_company");
    if (insertErr) throw new Error(`Failed to queue messages: ${insertErr.message}`);

    // Queue follow-up drafts linked to each initial message
    const followUpTemplateIds = [
      data.followUp1TemplateId ? { id: data.followUp1TemplateId, num: 1, delayDays: data.followUp1DelayDays } : null,
      data.followUp2TemplateId ? { id: data.followUp2TemplateId, num: 2, delayDays: data.followUp2DelayDays } : null,
    ].filter(Boolean) as { id: string; num: number; delayDays: number }[];

    if (followUpTemplateIds.length > 0 && inserted && inserted.length > 0) {
      const senderNameFu = process.env.GMAIL_SENDER_NAME ?? "FlytBase Talent";

      for (const { id: fuTemplateId, num: fuNum, delayDays } of followUpTemplateIds) {
        const { data: fuTemplate } = await supabase
          .from("outreach_templates")
          .select("*")
          .eq("id", fuTemplateId)
          .single();
        if (!fuTemplate) continue;

        const followUpMessages = inserted.map((initial) => {
          // Find the matching CSV row by candidate name to re-render vars
          const row = messages.find((m) => m.candidate_id === initial.candidate_id);
          const vars: Record<string, string> = {
            candidate_name: initial.candidate_name ?? "",
            name:           initial.candidate_name ?? "",
            role:           initial.candidate_title ?? (data.candidateType === "student" ? "student" : ""),
            company:        initial.candidate_company ?? "",
            university:     "",
            college:        "",
            branch:         "",
            skills:         "",
            sender_name:    senderNameFu,
          };

          const subject = fuTemplate.subject_template
            ? renderTemplate(fuTemplate.subject_template, vars)
            : null;
          const body = renderTemplate(fuTemplate.body_template, vars);

          return {
            candidate_id:      initial.candidate_id,
            candidate_type:    initial.candidate_type,
            channel:           initial.channel,
            status:            "draft" as const,
            subject,
            body,
            to_email:          initial.to_email,
            to_linkedin_url:   initial.to_linkedin_url,
            candidate_name:    initial.candidate_name,
            candidate_title:   initial.candidate_title,
            candidate_company: initial.candidate_company,
            template_id:          fuTemplateId,
            follow_up_number:     fuNum,
            is_followup:          true,
            parent_message_id:    initial.id,
            gmail_thread_id:      null, // filled in at send time from parent
            follow_up_delay_days: delayDays,
          };
        });

        const { error: fuErr } = await supabase.from("outreach_messages").insert(followUpMessages);
        if (fuErr) console.warn(`[csv import] Follow-up ${fuNum} insert failed:`, fuErr.message);
      }
    }

    return {
      queued:  messages.length,
      skipped: rows.length - messages.length,
      dbSaved: savedCandidateIds.length,
    };
  });
