import { Sparkles } from "lucide-react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold leading-none">Agent Platform</span>
            <span className="text-xs text-muted-foreground">Console admin</span>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
