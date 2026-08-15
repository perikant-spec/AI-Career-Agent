import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Card className="p-7 text-[13.5px] text-ink-tertiary">Loading…</Card>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
