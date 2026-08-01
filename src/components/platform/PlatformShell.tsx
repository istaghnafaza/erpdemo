import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

export function PlatformShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-glow shrink-0">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-bold truncate">{title}</div>
              {subtitle ? (
                <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex gap-2 shrink-0">{actions}</div> : null}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8">{children}</main>
    </div>
  );
}
