"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StaticPill } from "@/components/ui/Pill";

interface ResumeRow {
  id: string;
  fileName: string;
  extractionStatus: string;
  isMaster: boolean;
  fileSizeBytes: number;
  createdAt: string;
}

export default function ResumesPage() {
  const [resumes, setResumes] = useState<ResumeRow[] | null>(null);

  async function load() {
    const res = await fetch("/api/resumes");
    if (!res.ok) return;
    const body = await res.json();
    setResumes(body.resumes ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    await fetch(`/api/resumes/${id}`, { method: "DELETE" });
    load();
  }

  async function handleSetMaster(id: string) {
    await fetch(`/api/resumes/${id}/set-master`, { method: "POST" });
    load();
  }

  return (
    <div className="px-10 py-11 max-w-[900px]">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <SectionHeader title="Resumes" description="Your uploaded resumes. The master resume is what job-specific tailoring will draw from in a later phase." />
        <Link href="/resumes/upload">
          <Button variant="primary">Upload resume</Button>
        </Link>
      </div>

      <div className="flex flex-col gap-2.5 mt-7">
        {resumes === null ? (
          <div className="text-[13.5px] text-ink-tertiary">Loading…</div>
        ) : resumes.length === 0 ? (
          <Card className="p-6 text-[13.5px] text-ink-tertiary">
            No resumes yet.{" "}
            <Link href="/resumes/upload" className="text-accent-link">
              Upload your first one
            </Link>
            .
          </Card>
        ) : (
          resumes.map((r) => (
            <Card key={r.id} className="p-4 flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-[#EFEBE0] flex items-center justify-center text-[10px] font-mono flex-none">
                {r.fileName.split(".").pop()?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13.5px] font-semibold truncate">{r.fileName}</span>
                  {r.isMaster ? <StaticPill tone="success">Master</StaticPill> : null}
                  {r.extractionStatus !== "SUCCESS" ? (
                    <StaticPill tone="risk">{r.extractionStatus}</StaticPill>
                  ) : null}
                </div>
                <div className="text-[11.5px] text-ink-tertiary mt-0.5">
                  {(r.fileSizeBytes / 1024).toFixed(0)} KB ·{" "}
                  {new Date(r.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-2">
                {!r.isMaster ? (
                  <Button variant="secondary" onClick={() => handleSetMaster(r.id)}>
                    Set as master
                  </Button>
                ) : null}
                <Button variant="destructive" onClick={() => handleDelete(r.id)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
