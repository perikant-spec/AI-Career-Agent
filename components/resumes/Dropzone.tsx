"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

export function Dropzone({
  onFileSelected,
  disabled,
}: {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onFileSelected(file);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`rounded-xl border-[1.5px] border-dashed p-7 text-center bg-[#FBF9F3] transition-colors ${
        dragActive ? "border-ink-quaternary" : "border-border-strong"
      }`}
    >
      <div className="text-[15px] font-semibold">Drop your resume here</div>
      <div className="text-[12.5px] text-ink-tertiary mt-1.5">
        PDF or DOCX · text-based documents only for now
      </div>
      <Button
        type="button"
        variant="primary"
        className="mt-3.5"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        Choose file
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
