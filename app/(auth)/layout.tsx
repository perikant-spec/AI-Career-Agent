export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-[26px] h-[26px] rounded-lg bg-accent-teal flex items-center justify-center font-bold text-[13px] text-accent-teal-ink">
            A
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Career Agent</span>
        </div>
        {children}
      </div>
    </div>
  );
}
