import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PORTAL_DEMO_LOGINS } from "@/lib/mock-customer-portal";

interface PortalAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogin: (email: string, password: string) => { ok: boolean; error?: string };
  onRegister: (
    name: string,
    email: string,
    phone: string,
    password: string,
  ) => { ok: boolean; error?: string };
}

export function PortalAuthDialog({
  open,
  onOpenChange,
  onLogin,
  onRegister,
}: PortalAuthDialogProps) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!open) return;
    setError(null);
    setEmail("");
    setPassword("");
    setName("");
    setPhone("");
    setTab("login");
  }, [open]);

  const handleLogin = () => {
    const r = onLogin(email, password);
    if (!r.ok) {
      setError(r.error ?? "Login gagal");
      return;
    }
    onOpenChange(false);
  };

  const handleRegister = () => {
    const r = onRegister(name, email, phone, password);
    if (!r.ok) {
      setError(r.error ?? "Daftar gagal");
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Akun Pelanggan</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "register")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Daftar</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-email">Email</Label>
              <Input id="p-email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-pass">Password</Label>
              <Input
                id="p-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="rounded-lg bg-muted/60 p-2.5 text-[11px] text-muted-foreground space-y-1">
              <div className="font-medium text-foreground">Demo login:</div>
              {PORTAL_DEMO_LOGINS.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  className="block w-full text-left hover:text-primary"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(d.password);
                  }}
                >
                  {d.email} — {d.label}
                </button>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="register" className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Nama</Label>
              <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-phone">Telepon / WA</Label>
              <Input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-remail">Email</Label>
              <Input id="p-remail" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-rpass">Password</Label>
              <Input
                id="p-rpass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </TabsContent>
        </Tabs>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={tab === "login" ? handleLogin : handleRegister}
            className="bg-gradient-primary"
          >
            {tab === "login" ? "Masuk" : "Daftar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
