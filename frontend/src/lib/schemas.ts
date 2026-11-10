import { z } from "zod"

export const CaptionSegmentSchema = z.object({
  text: z.string(),
  start_ms: z.number(),
  end_ms: z.number(),
})

export const QuizCardSchema = z.object({
  id: z.string(),
  scene_id: z.string().optional(),
  question: z.string(),
  options: z.array(z.string()),
  hint: z.string().optional().nullable(),
  explanation: z.string().optional().nullable(),
  correct_index: z.number().optional(),
  difficulty: z.string().default("medium"),
  trigger_at_ms: z.number().optional().nullable(),
})

export const SceneSchema = z.object({
  id: z.string(),
  scene_index: z.number(),
  title: z.string().optional().nullable(),
  narration_text: z.string().optional().nullable(),
  caption_segments: z.array(CaptionSegmentSchema).optional().nullable(),
  svg_url: z.string().optional().nullable(),
  audio_url: z.string().optional().nullable(),
  duration_ms: z.number().optional().nullable(),
  dialogue_mode: z.boolean().default(false),
  visual_style: z.string().default("concept_diagram"),
})

export const LuminarSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  title: z.string(),
  prompt: z.string(),
  description: z.string().optional().nullable(),
  source_type: z.enum(["none", "pdf", "txt", "ppt", "docx", "blog", "website", "youtube"]).default("none"),
  source_url: z.string().optional().nullable(),
  duration_minutes: z.number(),
  dialogue_mode: z.boolean().default(false),
  voice_style: z.string().default("alloy"),
  status: z.enum([
    "pending",
    "script_generating",
    "script_ready",
    "assets_generating",
    "ready",
    "failed",
  ]),
  published: z.boolean().default(false),
  full_script: z.array(z.record(z.string(), z.unknown())).optional().nullable(),
  key_concepts: z.array(z.string()).optional().nullable(),
  suggested_next_topics: z.array(z.string()).optional().nullable(),
  difficulty_hint: z.enum(["easy", "medium", "hard"]).default("medium"),
  created_at: z.string(),
  updated_at: z.string(),
})

export const ProfileSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  avatar_url: z.string().nullable().optional(),
  total_luminars: z.number().default(0),
  ready_luminars: z.number().default(0),
  recent_luminars: z.array(z.object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
    duration_minutes: z.number(),
    created_at: z.string(),
  })).default([]),
})

export const ConceptStatSchema = z.object({
  luminar_id: z.string(),
  luminar_title: z.string().nullable().optional(),
  total_attempts: z.number(),
  correct: z.number(),
  accuracy_pct: z.number(),
  hint_uses: z.number(),
})

export const PortfolioSchema = z.object({
  total_attempts: z.number(),
  total_correct: z.number(),
  overall_accuracy_pct: z.number(),
  by_luminar: z.array(ConceptStatSchema),
})

export const DiscoverItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional().nullable(),
  prompt: z.string(),
  duration_minutes: z.number(),
  author_id: z.string(),
  author_name: z.string(),
  author_avatar_url: z.string().optional().nullable(),
  created_at: z.string(),
})

export type Luminar = z.infer<typeof LuminarSchema>
export type DiscoverItem = z.infer<typeof DiscoverItemSchema>
export type Scene = z.infer<typeof SceneSchema>
export type QuizCard = z.infer<typeof QuizCardSchema>
export type CaptionSegment = z.infer<typeof CaptionSegmentSchema>
export type Profile = z.infer<typeof ProfileSchema>
export type Portfolio = z.infer<typeof PortfolioSchema>
export type ConceptStat = z.infer<typeof ConceptStatSchema>

// ---------------------------------------------------------------------------
// Assessments (teacher-authored question sheets on a video)
// ---------------------------------------------------------------------------

export const AssessmentSourceTypeSchema = z.enum(["youtube", "luminar"])

/** Editable question (builder). Owner-side, so it carries the answer. */
export const DraftQuestionSchema = z.object({
  id: z.string().optional().nullable(),
  question: z.string(),
  options: z.array(z.string()).length(4),
  correct_index: z.number(),
  hint: z.string().optional().nullable(),
  explanation: z.string().optional().nullable(),
  time_s: z.number().optional().nullable(),
})

export const AssessmentQuestionSchema = z.object({
  id: z.string(),
  position: z.number(),
  time_s: z.number().optional().nullable(),
  question: z.string(),
  options: z.array(z.string()),
  // Present only for the owner.
  correct_index: z.number().optional(),
  hint: z.string().optional().nullable(),
  explanation: z.string().optional().nullable(),
})

export const AssessmentSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  title: z.string(),
  objective: z.string().optional().nullable(),
  source_type: AssessmentSourceTypeSchema,
  youtube_url: z.string().optional().nullable(),
  luminar_id: z.string().optional().nullable(),
  published: z.boolean(),
  is_owner: z.boolean(),
  author_name: z.string().optional().nullable(),
  submission_count: z.number().default(0),
  created_at: z.string(),
  updated_at: z.string(),
  questions: z.array(AssessmentQuestionSchema),
})

export const AssessmentSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  objective: z.string().optional().nullable(),
  source_type: AssessmentSourceTypeSchema,
  published: z.boolean(),
  question_count: z.number(),
  submission_count: z.number(),
  created_at: z.string(),
})

export const AnswerStateSchema = z.object({
  question_id: z.string(),
  attempts: z.number(),
  solved: z.boolean(),
  hints_used: z.number(),
})

export const AnswerResultSchema = z.object({
  is_correct: z.boolean(),
  attempts: z.number(),
  solved: z.boolean(),
  hint: z.string().optional().nullable(),
  explanation: z.string().optional().nullable(),
  recorded: z.boolean().default(true),
})

export const AssessmentResponsesSchema = z.object({
  total_questions: z.number(),
  learners: z.array(z.object({
    user_id: z.string(),
    name: z.string(),
    email: z.string(),
    avatar_url: z.string().optional().nullable(),
    answered: z.number(),
    solved: z.number(),
    first_try_correct: z.number(),
    hints_used: z.number(),
    total_questions: z.number(),
    last_activity: z.string(),
  })),
  questions: z.array(z.object({
    question_id: z.string(),
    position: z.number(),
    question: z.string(),
    answered: z.number(),
    solved: z.number(),
    first_try_correct: z.number(),
    avg_attempts: z.number(),
  })),
})

export type AssessmentSourceType = z.infer<typeof AssessmentSourceTypeSchema>
export type DraftQuestion = z.infer<typeof DraftQuestionSchema>
export type AssessmentQuestion = z.infer<typeof AssessmentQuestionSchema>
export type Assessment = z.infer<typeof AssessmentSchema>
export type AssessmentSummary = z.infer<typeof AssessmentSummarySchema>
export type AnswerState = z.infer<typeof AnswerStateSchema>
export type AnswerResult = z.infer<typeof AnswerResultSchema>
export type AssessmentResponses = z.infer<typeof AssessmentResponsesSchema>
