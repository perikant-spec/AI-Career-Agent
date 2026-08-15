import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-6">
      <div className="max-w-[440px] text-center">
        <div className="font-mono text-[13px] text-ink-quaternary uppercase tracking-wide mb-3">404</div>
        <h1 className="font-serif text-[30px] font-normal mb-2">Page not found</h1>
        <p className="text-[14.5px] text-ink-secondary mb-6">
          That page doesn&apos;t exist, or you don&apos;t have access to it.
        </p>
        <Link href="/assistant">
          <Button variant="primary">Back to your dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
