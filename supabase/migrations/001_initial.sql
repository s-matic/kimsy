create extension if not exists pgcrypto;

create type public.assessment_operating_model as enum ('FIRST_LINE_LED', 'COMPLIANCE_LED');
create type public.member_role as enum ('FRAMEWORK_ADMIN', 'BUSINESS_CONTRIBUTOR', 'COMPLIANCE_OFFICER', 'MANAGEMENT_VIEWER');
create type public.framework_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');
create type public.assessment_status as enum ('FACT_GATHERING', 'AI_DRAFT_READY', 'IN_REVIEW', 'FINALIZED');
create type public.review_status as enum ('OPEN', 'RESOLVED');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  operating_model public.assessment_operating_model not null default 'FIRST_LINE_LED',
  data_region text not null default 'European Union',
  review_cadence text not null default 'Annual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_organization_id and user_id = auth.uid()
  );
$$;

create or replace function public.has_organization_role(target_organization_id uuid, allowed_roles public.member_role[])
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_organization_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

create table public.framework_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version text not null,
  name text not null,
  status public.framework_status not null default 'DRAFT',
  published_at timestamptz,
  published_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, version)
);

create unique index one_published_framework_per_org
on public.framework_versions (organization_id)
where status = 'PUBLISHED';

create table public.framework_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  framework_version_id uuid not null references public.framework_versions(id) on delete cascade,
  file_name text not null,
  media_type text not null,
  storage_path text not null,
  size_bytes bigint not null check (size_bytes between 1 and 26214400),
  extraction_status text not null default 'PENDING',
  content_hash text not null,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.risk_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  framework_version_id uuid not null references public.framework_versions(id) on delete cascade,
  code text not null,
  title text not null,
  category text not null,
  definition text not null,
  inherent_rating text not null,
  appetite_rating text not null,
  controls jsonb not null default '[]',
  evidence_required jsonb not null default '[]',
  source_citations jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (framework_version_id, code)
);

create table public.business_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.assessment_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_unit_id uuid not null references public.business_units(id),
  framework_version_id uuid not null references public.framework_versions(id),
  reference text not null,
  period text not null,
  due_date date not null,
  operating_model_snapshot public.assessment_operating_model not null,
  status public.assessment_status not null default 'FACT_GATHERING',
  owner_user_id uuid references auth.users(id),
  finalized_at timestamptz,
  finalized_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference)
);

create table public.business_facts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assessment_cycle_id uuid not null references public.assessment_cycles(id) on delete cascade,
  question_id text not null,
  section text not null,
  question text not null,
  answer text not null default '',
  answered_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (assessment_cycle_id, question_id)
);

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assessment_cycle_id uuid references public.assessment_cycles(id) on delete cascade,
  purpose text not null,
  provider text not null,
  model text not null,
  prompt_version text not null,
  input_hash text not null,
  structured_output jsonb,
  status text not null default 'PENDING',
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.scenario_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assessment_cycle_id uuid not null references public.assessment_cycles(id) on delete cascade,
  risk_scenario_id uuid not null references public.risk_scenarios(id),
  ai_run_id uuid references public.ai_runs(id),
  relevant boolean not null,
  proposed_rating text not null,
  accepted_rating text,
  rationale text not null,
  confidence integer not null check (confidence between 0 and 100),
  control_effectiveness text not null,
  within_appetite boolean not null,
  citations jsonb not null default '[]',
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (assessment_cycle_id, risk_scenario_id)
);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assessment_cycle_id uuid not null references public.assessment_cycles(id) on delete cascade,
  risk_scenario_id uuid references public.risk_scenarios(id),
  evidence_type text not null check (evidence_type in ('FILE', 'LINK', 'ATTESTATION')),
  name text not null,
  storage_path text,
  external_url text,
  attestation text,
  review_status text not null default 'PENDING',
  added_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.review_exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scenario_assessment_id uuid not null references public.scenario_assessments(id) on delete cascade,
  kind text not null,
  severity text not null,
  title text not null,
  detail text not null,
  status public.review_status not null default 'OPEN',
  resolution text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.change_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_unit_id uuid not null references public.business_units(id),
  title text not null,
  detail text not null,
  impact_status text not null default 'PENDING',
  recorded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assessment_cycle_id uuid references public.assessment_cycles(id) on delete cascade,
  assignee_user_id uuid not null references auth.users(id),
  title text not null,
  context text not null,
  due_date date,
  priority text not null default 'MEDIUM',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_type text not null,
  payload jsonb not null default '{}',
  status text not null default 'PENDING',
  attempts integer not null default 0,
  idempotency_key text not null unique,
  run_after timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  actor_label text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index assessment_cycles_org_status_idx on public.assessment_cycles (organization_id, status);
create index exceptions_org_status_idx on public.review_exceptions (organization_id, status, severity);
create index tasks_assignee_idx on public.tasks (assignee_user_id, completed_at, due_date);
create index audit_org_created_idx on public.audit_events (organization_id, created_at desc);
create index jobs_ready_idx on public.background_jobs (status, run_after) where status in ('PENDING', 'RETRY');

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.framework_versions enable row level security;
alter table public.framework_sources enable row level security;
alter table public.risk_scenarios enable row level security;
alter table public.business_units enable row level security;
alter table public.assessment_cycles enable row level security;
alter table public.business_facts enable row level security;
alter table public.ai_runs enable row level security;
alter table public.scenario_assessments enable row level security;
alter table public.evidence enable row level security;
alter table public.review_exceptions enable row level security;
alter table public.change_events enable row level security;
alter table public.tasks enable row level security;
alter table public.background_jobs enable row level security;
alter table public.audit_events enable row level security;

create policy organizations_read on public.organizations for select using (public.is_organization_member(id));
create policy organizations_admin_update on public.organizations for update using (public.has_organization_role(id, array['FRAMEWORK_ADMIN']::public.member_role[]));
create policy members_read on public.organization_members for select using (public.is_organization_member(organization_id));

create policy frameworks_read on public.framework_versions for select using (public.is_organization_member(organization_id));
create policy frameworks_admin_write on public.framework_versions for all using (public.has_organization_role(organization_id, array['FRAMEWORK_ADMIN']::public.member_role[])) with check (public.has_organization_role(organization_id, array['FRAMEWORK_ADMIN']::public.member_role[]));
create policy sources_read on public.framework_sources for select using (public.is_organization_member(organization_id));
create policy sources_admin_write on public.framework_sources for all using (public.has_organization_role(organization_id, array['FRAMEWORK_ADMIN']::public.member_role[])) with check (public.has_organization_role(organization_id, array['FRAMEWORK_ADMIN']::public.member_role[]));
create policy scenarios_read on public.risk_scenarios for select using (public.is_organization_member(organization_id));
create policy scenarios_admin_write on public.risk_scenarios for all using (public.has_organization_role(organization_id, array['FRAMEWORK_ADMIN']::public.member_role[])) with check (public.has_organization_role(organization_id, array['FRAMEWORK_ADMIN']::public.member_role[]));

create policy units_read on public.business_units for select using (public.is_organization_member(organization_id));
create policy units_officer_write on public.business_units for all using (public.has_organization_role(organization_id, array['FRAMEWORK_ADMIN','COMPLIANCE_OFFICER']::public.member_role[])) with check (public.has_organization_role(organization_id, array['FRAMEWORK_ADMIN','COMPLIANCE_OFFICER']::public.member_role[]));
create policy assessments_read on public.assessment_cycles for select using (public.is_organization_member(organization_id));
create policy assessments_officer_write on public.assessment_cycles for all using (public.has_organization_role(organization_id, array['FRAMEWORK_ADMIN','COMPLIANCE_OFFICER']::public.member_role[])) with check (public.has_organization_role(organization_id, array['FRAMEWORK_ADMIN','COMPLIANCE_OFFICER']::public.member_role[]));

create policy facts_read on public.business_facts for select using (public.is_organization_member(organization_id));
create policy facts_contributor_write on public.business_facts for all using (public.has_organization_role(organization_id, array['BUSINESS_CONTRIBUTOR','COMPLIANCE_OFFICER']::public.member_role[])) with check (public.has_organization_role(organization_id, array['BUSINESS_CONTRIBUTOR','COMPLIANCE_OFFICER']::public.member_role[]));
create policy ai_runs_read on public.ai_runs for select using (public.has_organization_role(organization_id, array['FRAMEWORK_ADMIN','COMPLIANCE_OFFICER']::public.member_role[]));
create policy scenario_assessments_read on public.scenario_assessments for select using (public.is_organization_member(organization_id));
create policy scenario_assessments_officer_write on public.scenario_assessments for all using (public.has_organization_role(organization_id, array['COMPLIANCE_OFFICER']::public.member_role[])) with check (public.has_organization_role(organization_id, array['COMPLIANCE_OFFICER']::public.member_role[]));
create policy evidence_read on public.evidence for select using (public.is_organization_member(organization_id));
create policy evidence_contributor_insert on public.evidence for insert with check (public.has_organization_role(organization_id, array['BUSINESS_CONTRIBUTOR','COMPLIANCE_OFFICER']::public.member_role[]));
create policy evidence_officer_update on public.evidence for update using (public.has_organization_role(organization_id, array['COMPLIANCE_OFFICER']::public.member_role[]));
create policy exceptions_read on public.review_exceptions for select using (public.is_organization_member(organization_id));
create policy exceptions_officer_write on public.review_exceptions for all using (public.has_organization_role(organization_id, array['COMPLIANCE_OFFICER']::public.member_role[])) with check (public.has_organization_role(organization_id, array['COMPLIANCE_OFFICER']::public.member_role[]));
create policy changes_read on public.change_events for select using (public.is_organization_member(organization_id));
create policy changes_write on public.change_events for insert with check (public.has_organization_role(organization_id, array['BUSINESS_CONTRIBUTOR','COMPLIANCE_OFFICER']::public.member_role[]));
create policy tasks_own_read on public.tasks for select using (assignee_user_id = auth.uid() or public.has_organization_role(organization_id, array['COMPLIANCE_OFFICER']::public.member_role[]));
create policy tasks_officer_write on public.tasks for all using (public.has_organization_role(organization_id, array['COMPLIANCE_OFFICER']::public.member_role[])) with check (public.has_organization_role(organization_id, array['COMPLIANCE_OFFICER']::public.member_role[]));
create policy audit_read on public.audit_events for select using (public.is_organization_member(organization_id));
create policy audit_insert on public.audit_events for insert with check (public.is_organization_member(organization_id));

-- No UPDATE or DELETE policy is intentionally defined for audit_events.
revoke update, delete on public.audit_events from authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence',
  'evidence',
  false,
  26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ]
)
on conflict (id) do nothing;

-- Storage paths must be organization-id/user-id/file-name.
create policy evidence_objects_read on storage.objects for select to authenticated
using (bucket_id = 'evidence' and public.is_organization_member((storage.foldername(name))[1]::uuid));
create policy evidence_objects_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'evidence'
  and auth.uid()::text = (storage.foldername(name))[2]
  and public.has_organization_role((storage.foldername(name))[1]::uuid, array['BUSINESS_CONTRIBUTOR','COMPLIANCE_OFFICER']::public.member_role[])
);

comment on column public.assessment_cycles.operating_model_snapshot is
'Immutable workflow ownership model captured when the assessment cycle is created.';
comment on table public.audit_events is
'Append-only audit history. Application users receive no UPDATE or DELETE policy.';
