// Always rendered in full, regardless of what's built yet — unbuilt sections route to a
// clearly-labeled "coming in a later phase" placeholder instead of being hidden, so the
// product's whole intended shape stays visible per the PRD's navigation guidance.
export const NAV_ITEMS = [
  { label: "AI Assistant", href: "/assistant" },
  { label: "Jobs", href: "/jobs" },
  { label: "Applications", href: "/applications" },
  { label: "Networking", href: "/networking" },
  { label: "Interviews", href: "/interviews" },
  { label: "Career Profile", href: "/profile" },
  { label: "Resumes", href: "/resumes" },
  { label: "Analytics", href: "/analytics" },
  { label: "Settings", href: "/settings" },
] as const;
