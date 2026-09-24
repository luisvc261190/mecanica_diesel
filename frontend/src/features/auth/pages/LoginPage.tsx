import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/features/auth/context/AuthContext";
import { getApiErrorMessage } from "@/services/api/http";
import type { TokenPair } from "@/types/domain";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().email("Ingresa un correo válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/app";

async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const pair: TokenPair = await login({ email: values.email, password: values.password });
      const hasTenant = pair.user.tenant_id !== null || pair.user.is_platform_admin;
      navigate(hasTenant ? from : "/onboarding", { replace: true });
    } catch (error) {
      form.setError("root", { message: getApiErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen">
<div className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <img
          src="/login-taller.jpg"
          alt="Taller mecánico"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="relative flex items-center gap-3 rounded-2xl border border-white/30 bg-white/10 p-4 shadow-lg backdrop-blur-md">
          <div className="flex size-10 items-center justify-center rounded-lg bg-white/20">
            <Wrench className="size-5" />
          </div>
          <div>
            <p className="text-lg font-semibold leading-tight">MultiWorkshop</p>
            <p className="text-xs text-white/90">Tecnología para talleres</p>
          </div>
        </div>
        <div className="relative space-y-4 rounded-2xl border border-white/30 bg-white/10 p-6 shadow-lg backdrop-blur-md">
          <h1 className="max-w-md text-3xl font-bold leading-tight">
            Gestiona tu taller completo, desde la cita hasta el pago.
          </h1>
          <p className="max-w-md text-sm text-white/95">
            Clientes, vehículos, órdenes de trabajo, cotizaciones, inventario y pagos en una sola plataforma
            multi-empresa.
          </p>
          <ul className="space-y-2 text-sm text-white/95">
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4" /> Sesiones seguras con tokens con rotación
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4" /> Multiusuario con permisos por rol
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4" /> Acceso instantáneo desde cualquier lugar
            </li>
          </ul>
        </div>
        <p className="relative text-xs text-white/80">© {new Date().getFullYear()} MultiWorkshop</p>
      </div>

      <div className="flex w-full flex-col items-center justify-center bg-background px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1 text-center lg:text-left">
            <h2 className="text-2xl font-bold">Iniciar sesión</h2>
            <p className="text-sm text-muted-foreground">Ingresa con tu cuenta para continuar.</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo electrónico</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input type="email" placeholder="tu@empresa.com" autoComplete="email" className="pl-9" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className={cn("pl-9 pr-9")}
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((s) => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.formState.errors.root ? (
                <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
              ) : null}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : null}
                {submitting ? "Ingresando..." : "Ingresar"}
              </Button>
            </form>
          </Form>

          <div className="flex items-center justify-center text-sm">
            <span className="text-muted-foreground">¿Aún no tienes una empresa?</span>
            <Link to="/onboarding" className="ml-1 font-medium text-primary hover:underline">
              Regístrate
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
