"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api/api-client";

type Session = {
  id: string;
  createdAt: string;
  expiresAt: string;
};

export function ActiveSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      setSessions(await apiGet<Session[]>("/auth/sessions"));
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Could not load sessions.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function revoke(id: string) {
    await apiPost(`/auth/sessions/${id}/revoke`, {});
    await load();
  }

  return (
    <section className="border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold tracking-[-0.015em]">Active sessions</h2>
      <p className="mt-1 text-sm text-muted-foreground">Revoke browser sessions you no longer recognize.</p>
      {error ? <p className="mt-4 text-sm text-destructive" role="alert">{error}</p> : null}
      <div className="mt-4 divide-y divide-border border border-border">
        {sessions.length ? sessions.map((session) => (
          <div key={session.id} className="flex flex-col justify-between gap-3 p-3 text-sm md:flex-row md:items-center">
            <div><div className="font-medium">Created {new Date(session.createdAt).toLocaleString()}</div><div className="text-muted-foreground">Expires {new Date(session.expiresAt).toLocaleString()}</div></div>
            <Button type="button" variant="outline" onClick={() => void revoke(session.id)}>Revoke</Button>
          </div>
        )) : <p className="p-3 text-sm text-muted-foreground">No active sessions found.</p>}
      </div>
    </section>
  );
}
