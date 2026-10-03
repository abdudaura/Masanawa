"use client";

import { useEffect, useMemo, useState } from "react";

type AgentPresentation = {
  schemaVersion: 1;
  tenantId: string;
  characterId: string;
  characterVersionId: string;
  displayName: string;
  roleLabel: string;
  about: string;
  greeting: string | null;
  visibleInUserApp: boolean;
  sortOrder: number;
  revision: number;
};

type SkillOption = {
  skillVersionId: string;
  key: string;
  version: string;
  displayName: string;
  description: string;
  readiness: "ready" | "degraded" | "blocked" | "disabled" | "unknown";
  advertised: boolean;
};

type SkillAssignment = {
  schemaVersion: 1;
  tenantId: string;
  characterId: string;
  skillVersionIds: string[];
  revision: number;
};

const apiBase = process.env.NEXT_PUBLIC_OPS_API_BASE_URL ?? "";

async function requestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? "Your operator session is not authorized for this action."
        : `Request failed (${response.status}).`,
    );
  }
  return (await response.json()) as T;
}

function blankPresentation(): AgentPresentation {
  return {
    schemaVersion: 1,
    tenantId: "",
    characterId: "",
    characterVersionId: "",
    displayName: "",
    roleLabel: "",
    about: "",
    greeting: "",
    visibleInUserApp: true,
    sortOrder: 0,
    revision: 1,
  };
}

export default function OpsAgentsPage() {
  const [agents, setAgents] = useState<AgentPresentation[]>([]);
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [draft, setDraft] = useState<AgentPresentation | null>(null);
  const [assignmentRevision, setAssignmentRevision] = useState<number | null>(
    null,
  );
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [savingPresentation, setSavingPresentation] = useState(false);
  const [savingSkills, setSavingSkills] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setMessage(null);
    try {
      const [nextAgents, nextSkills] = await Promise.all([
        requestJson<AgentPresentation[]>("/v1/agents"),
        requestJson<SkillOption[]>("/v1/skills"),
      ]);
      setAgents(nextAgents);
      setSkills(nextSkills);
      if (draft) {
        const refreshed = nextAgents.find(
          (agent) => agent.characterId === draft.characterId,
        );
        if (refreshed) setDraft(refreshed);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load Ops.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function selectAgent(agent: AgentPresentation) {
    setDraft(agent);
    setMessage(null);
    try {
      const assignment = await requestJson<SkillAssignment | null>(
        `/v1/agents/${encodeURIComponent(agent.characterId)}/skills`,
      );
      setAssignmentRevision(assignment?.revision ?? null);
      setSelectedSkills(new Set(assignment?.skillVersionIds ?? []));
    } catch (error) {
      setAssignmentRevision(null);
      setSelectedSkills(new Set());
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load the agent's Skills.",
      );
    }
  }

  function startNew() {
    setDraft(blankPresentation());
    setAssignmentRevision(null);
    setSelectedSkills(new Set());
    setMessage(null);
  }

  async function savePresentation() {
    if (!draft) return;
    setSavingPresentation(true);
    setMessage(null);
    try {
      const saved = await requestJson<AgentPresentation>(
        `/v1/agents/${encodeURIComponent(draft.characterId)}/presentation`,
        {
          method: "PUT",
          body: JSON.stringify({
            schemaVersion: 1,
            characterVersionId: draft.characterVersionId,
            displayName: draft.displayName,
            roleLabel: draft.roleLabel,
            about: draft.about,
            greeting: draft.greeting?.trim() ? draft.greeting : null,
            visibleInUserApp: draft.visibleInUserApp,
            sortOrder: draft.sortOrder,
            expectedRevision:
              agents.some((agent) => agent.characterId === draft.characterId)
                ? draft.revision
                : null,
          }),
        },
      );
      setAgents((current) => {
        const without = current.filter(
          (agent) => agent.characterId !== saved.characterId,
        );
        return [...without, saved].sort(
          (left, right) =>
            left.sortOrder - right.sortOrder ||
            left.displayName.localeCompare(right.displayName),
        );
      });
      setDraft(saved);
      setMessage("Presentation saved. The mobile roster can now render it.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save presentation.",
      );
    } finally {
      setSavingPresentation(false);
    }
  }

  async function saveSkills() {
    if (!draft?.characterId) return;
    setSavingSkills(true);
    setMessage(null);
    try {
      const saved = await requestJson<SkillAssignment>(
        `/v1/agents/${encodeURIComponent(draft.characterId)}/skills`,
        {
          method: "PUT",
          body: JSON.stringify({
            schemaVersion: 1,
            skillVersionIds: [...selectedSkills].sort(),
            expectedRevision: assignmentRevision,
          }),
        },
      );
      setAssignmentRevision(saved.revision);
      setSelectedSkills(new Set(saved.skillVersionIds));
      setMessage(
        "Skill assignment saved independently from the agent presentation.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save Skill assignment.",
      );
    } finally {
      setSavingSkills(false);
    }
  }

  const selectedCount = selectedSkills.size;
  const sortedSkills = useMemo(
    () =>
      [...skills].sort(
        (left, right) =>
          Number(right.readiness === "ready") -
            Number(left.readiness === "ready") ||
          left.displayName.localeCompare(right.displayName),
      ),
    [skills],
  );

  return (
    <main className="ops-shell">
      <header className="ops-header">
        <div>
          <p className="eyebrow">Masanawa Ops</p>
          <h1>Agents</h1>
          <p className="lede">
            Configure what users see separately from what each Character can do.
          </p>
        </div>
        <button className="secondary" type="button" onClick={startNew}>
          Configure Character
        </button>
      </header>

      {message ? <div className="notice">{message}</div> : null}

      <div className="ops-grid">
        <aside className="agent-list panel">
          <div className="panel-heading">
            <div>
              <h2>Configured agents</h2>
              <span>{loading ? "Loading…" : `${agents.length} agents`}</span>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => void refresh()}
              aria-label="Refresh"
            >
              ↻
            </button>
          </div>

          <div className="agent-rows">
            {agents.map((agent) => (
              <button
                className={
                  draft?.characterId === agent.characterId
                    ? "agent-row selected"
                    : "agent-row"
                }
                key={agent.characterId}
                type="button"
                onClick={() => void selectAgent(agent)}
              >
                <span className="avatar">
                  {agent.displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="agent-copy">
                  <strong>{agent.displayName}</strong>
                  <small>{agent.roleLabel}</small>
                </span>
                <span
                  className={
                    agent.visibleInUserApp ? "visibility on" : "visibility"
                  }
                >
                  {agent.visibleInUserApp ? "Visible" : "Hidden"}
                </span>
              </button>
            ))}
            {!loading && agents.length === 0 ? (
              <div className="empty">
                No Characters are configured for the user app yet.
              </div>
            ) : null}
          </div>
        </aside>

        <section className="editor">
          {!draft ? (
            <div className="panel empty-editor">
              <h2>Select an agent</h2>
              <p>
                Choose an existing configuration, or configure a Character for
                the mobile app.
              </p>
            </div>
          ) : (
            <>
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="section-kicker">Presentation</p>
                    <h2>Name and role</h2>
                  </div>
                  <span className="revision">rev {draft.revision}</span>
                </div>

                <div className="form-grid">
                  <label>
                    Character ID
                    <input
                      value={draft.characterId}
                      disabled={agents.some(
                        (agent) => agent.characterId === draft.characterId,
                      )}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          characterId: event.target.value.trim(),
                        })
                      }
                      placeholder="character_…"
                    />
                  </label>
                  <label>
                    Character version ID
                    <input
                      value={draft.characterVersionId}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          characterVersionId: event.target.value.trim(),
                        })
                      }
                      placeholder="character-version_…"
                    />
                  </label>
                  <label>
                    Display name
                    <input
                      value={draft.displayName}
                      onChange={(event) =>
                        setDraft({ ...draft, displayName: event.target.value })
                      }
                      placeholder="Amina"
                    />
                  </label>
                  <label>
                    Role
                    <input
                      value={draft.roleLabel}
                      onChange={(event) =>
                        setDraft({ ...draft, roleLabel: event.target.value })
                      }
                      placeholder="Sales & Outreach"
                    />
                  </label>
                  <label className="wide">
                    About
                    <textarea
                      rows={3}
                      value={draft.about}
                      onChange={(event) =>
                        setDraft({ ...draft, about: event.target.value })
                      }
                      placeholder="Short description shown to users"
                    />
                  </label>
                  <label className="wide">
                    Greeting
                    <textarea
                      rows={2}
                      value={draft.greeting ?? ""}
                      onChange={(event) =>
                        setDraft({ ...draft, greeting: event.target.value })
                      }
                      placeholder="What should we work on?"
                    />
                  </label>
                  <label>
                    Order
                    <input
                      type="number"
                      min={0}
                      value={draft.sortOrder}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          sortOrder: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={draft.visibleInUserApp}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          visibleInUserApp: event.target.checked,
                        })
                      }
                    />
                    <span>Visible in user app</span>
                  </label>
                </div>

                <div className="actions">
                  <button
                    type="button"
                    onClick={() => void savePresentation()}
                    disabled={
                      savingPresentation ||
                      !draft.characterId ||
                      !draft.characterVersionId ||
                      !draft.displayName.trim() ||
                      !draft.roleLabel.trim()
                    }
                  >
                    {savingPresentation ? "Saving…" : "Save presentation"}
                  </button>
                </div>
              </div>

              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="section-kicker">Capabilities</p>
                    <h2>Assigned Skills</h2>
                    <span>
                      {selectedCount} selected · saved separately from identity
                    </span>
                  </div>
                  <span className="revision">
                    {assignmentRevision === null
                      ? "not saved"
                      : `rev ${assignmentRevision}`}
                  </span>
                </div>

                <div className="skill-list">
                  {sortedSkills.map((skill) => {
                    const checked = selectedSkills.has(skill.skillVersionId);
                    return (
                      <label className="skill-row" key={skill.skillVersionId}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!draft.characterId}
                          onChange={(event) => {
                            const next = new Set(selectedSkills);
                            if (event.target.checked) {
                              next.add(skill.skillVersionId);
                            } else {
                              next.delete(skill.skillVersionId);
                            }
                            setSelectedSkills(next);
                          }}
                        />
                        <span className="skill-copy">
                          <strong>{skill.displayName}</strong>
                          <small>
                            {skill.key} · {skill.version}
                          </small>
                          <span>{skill.description}</span>
                        </span>
                        <span className={`readiness ${skill.readiness}`}>
                          {skill.readiness}
                        </span>
                      </label>
                    );
                  })}
                  {!loading && sortedSkills.length === 0 ? (
                    <div className="empty">
                      No SkillVersions are registered in the canonical catalog.
                    </div>
                  ) : null}
                </div>

                <div className="actions">
                  <button
                    type="button"
                    onClick={() => void saveSkills()}
                    disabled={
                      savingSkills ||
                      !agents.some(
                        (agent) => agent.characterId === draft.characterId,
                      )
                    }
                  >
                    {savingSkills ? "Saving…" : "Save Skills"}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
