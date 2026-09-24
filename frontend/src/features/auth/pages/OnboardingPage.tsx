import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Loader2, Wand2, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/features/auth/context/AuthContext";
import { getApiErrorMessage } from "@/services/api/http";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

const schema = z
  .object({
    company_name: z.string().min(2, "Ingresa el nombre de la empresa"),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones"),
    owner_full_name: z.string().min(2, "Ingresa tu nombre completo"),
    owner_email: z.string().email("Ingresa un correo válido"),
    owner_phone: z.string().optional(),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden" });

type FormValues = z.infer<typeof schema>;

export function OnboardingPage() {
  const { onboarding } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { company_name: "", slug: "", owner_full_name: "", owner_email: "", owner_phone: "", password: "", confirm: "" },
  });

  const companyName = form.watch("company_name");

  const suggestSlug = () => {
    const value = companyName.trim();
    const slug = slugify(value || "mi-taller");
    form.setValue("slug", slug, { shouldValidate: true });
  };

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      await onboarding({
        company_name: values.company_name,
        slug: values.slug,
        owner_full_name: values.owner_full_name,
        owner_email: values.owner_email,
        owner_phone: values.owner_phone || undefined,
        password: values.password,
      });
      toast.success("¡Empresa creada! Bienvenido a MultiWorkshop");
      navigate("/app", { replace: true });
    } catch (error) {
      form.setError("root", { message: getApiErrorMessage(error) });
      toast.error(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-background px-4 py-10">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wrench className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Crea tu empresa</h1>
            <p className="text-sm text-muted-foreground">En menos de un minuto tendrás tu taller listo.</p>
          </div>
        </div>

        <div className="rounded-lg border bg-background p-6 shadow-sm">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="company_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la empresa</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. Laboratorio Tecnología Diesel S.A.C." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Identificador (URL)</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Input placeholder="mi-taller" {...field} />
                        <Button type="button" variant="outline" size="sm" onClick={suggestSlug} aria-label="Generar identificador">
                          <Wand2 />
                        </Button>
                      </div>
                    </FormControl>
                    <FormDescription>Se usará para tu espacio de trabajo: multiworkshop.app/{field.value}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="owner_full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tu nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Juan Pérez" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="owner_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="+51 999 999 999" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="owner_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo corporativo</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="tu@empresa.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Mínimo 8 caracteres" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Repite tu contraseña" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {form.formState.errors.root ? (
                <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
              ) : null}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : <Building2 />}
                {submitting ? "Creando empresa..." : "Crear empresa y comenzar"}
              </Button>
            </form>
          </Form>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?
          <Link to="/login" className="ml-1 font-medium text-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

export default OnboardingPage;
