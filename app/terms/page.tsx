import { LegalDocPage } from "@/components/legal/LegalDocPage";
import { LEGAL_DOCUMENTS } from "@/lib/legal/documents";

export default function TermsPage() {
  return <LegalDocPage doc={LEGAL_DOCUMENTS.terms} />;
}
