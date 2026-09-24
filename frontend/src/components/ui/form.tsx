import * as React from "react";
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldContextValue<TFieldValues extends FieldValues> = {
  name: FieldPath<TFieldValues>;
};

const FormFieldContext = React.createContext<FormFieldContextValue<FieldValues> | null>(null);

function useFormField() {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  if (!fieldContext) {
    throw new Error("useFormField debe usarse dentro de <FormField>");
  }

  const fieldState = getFieldState(fieldContext.name, formState);
  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
}

function FormField<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>(
  props: ControllerProps<TFieldValues, TName>,
) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

type FormItemContextValue = { id: string };
const FormItemContext = React.createContext<FormItemContextValue>({ id: "form-item" });

function FormItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const id = React.useId();
  return <FormItemContext.Provider value={{ id }}><div className={cn("space-y-1.5", className)} {...props} /></FormItemContext.Provider>;
}

function FormLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  const { formItemId, error } = useFormField();
  return <Label className={cn(error && "text-destructive", className)} htmlFor={formItemId} {...props} />;
}

function FormControl({ children }: { children: React.ReactNode }) {
  const { formItemId, formDescriptionId, formMessageId, error } = useFormField();
  return (
    <div
      className="w-full"
      id={formItemId}
      aria-describedby={error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId}
    >
      {children}
    </div>
  );
}

function FormDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const { formDescriptionId } = useFormField();
  return <p id={formDescriptionId} className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function FormMessage({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const { formMessageId, error } = useFormField();
  if (!error) return null;
  return (
    <p id={formMessageId} className={cn("text-xs font-medium text-destructive", className)} {...props}>
      {String(error.message)}
    </p>
  );
}

type FormProps<TFormValues extends FieldValues = FieldValues> = Partial<UseFormReturn<TFormValues>> & {
  children: React.ReactNode;
};

function Form<TFormValues extends FieldValues>({ children, ...form }: FormProps<TFormValues>) {
  return <FormProvider {...(form as UseFormReturn<TFormValues>)}>{children}</FormProvider>;
}

export { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, useFormField };
export type { FormProps };