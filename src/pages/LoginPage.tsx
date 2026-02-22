import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { invoke } from "../lib/tauri";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useToast } from "../hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "../components/ui/card";
import { LoginResult } from "../types";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(false);

  const navigate = useNavigate();
  const { setSession } = useAuthStore();
  const { toast } = useToast();

  useEffect(() => {
    async function checkFirstRun() {
      try {
        const firstRun = await invoke<boolean>("check_first_run");
        setIsFirstRun(firstRun);
      } catch (e) {
        console.error("Failed to check first run", e);
      }
    }
    checkFirstRun();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    try {
      const result = await invoke<LoginResult>("login", { username, password });
      setSession(result.user, result.session_token);

      toast({
        title: "Welcome back",
        description: `Logged in as ${result.user.name}`,
      });

      navigate({
        to: result.user.role === "ADMIN" ? "/inventory" : "/pos",
        replace: true,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold flex items-center justify-center gap-1 mb-2">
            <span className="text-primary">Kasir</span>
            <span className="text-accent">Pro</span>
          </CardTitle>
          <CardDescription>
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2 text-left">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 text-left">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
        {isFirstRun && (
          <CardFooter>
            <Button
              variant="outline"
              className="w-full border-primary/50 text-primary hover:bg-primary/10"
              onClick={() => navigate({ to: "/setup" })}
            >
              Create First Admin Account
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
