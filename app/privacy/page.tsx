import { LegalDocPage } from "@/components/legal/LegalDocPage";
import { LEGAL_DOCUMENTS } from "@/lib/legal/documents";

export default function PrivacyPage() {
  return <LegalDocPage doc={LEGAL_DOCUMENTS.privacy} />;
}
