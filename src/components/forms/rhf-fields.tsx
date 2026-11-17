'use client';

import type { ComponentProps, ReactNode } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface FieldBase<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  description?: string;
  required?: boolean;
  className?: string;
}

interface InputFieldProps<TFieldValues extends FieldValues>
  extends FieldBase<TFieldValues>, Omit<ComponentProps<typeof Input>, 'name' | 'defaultValue'> {
  leadingIcon?: ReactNode;
}

export function RHFInput<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  className,
  leadingIcon,
  ...inputProps
}: InputFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className="text-xs font-bold text-foreground/80">
            {label}{required && <span className="ml-1 text-destructive">*</span>}
          </FormLabel>
          <div className="relative">
            {leadingIcon && <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground">{leadingIcon}</span>}
            <FormControl>
              <Input {...field} {...inputProps} value={field.value ?? ''} className={cn('h-11 rounded-xl bg-background px-3', leadingIcon && 'pl-9')} />
            </FormControl>
          </div>
          {description && <FormDescription className="text-[11px] leading-4">{description}</FormDescription>}
          <FormMessage className="text-[11px]" />
        </FormItem>
      )}
    />
  );
}

interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface SelectFieldProps<TFieldValues extends FieldValues> extends FieldBase<TFieldValues> {
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}

export function RHFSelect<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  className,
  options,
  placeholder = 'Select an option',
  disabled,
}: SelectFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className="text-xs font-bold text-foreground/80">
            {label}{required && <span className="ml-1 text-destructive">*</span>}
          </FormLabel>
          <Select value={field.value ?? ''} onValueChange={field.onChange} disabled={disabled}>
            <FormControl>
              <SelectTrigger className="h-11 rounded-xl bg-background px-3">
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => <SelectItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {description && <FormDescription className="text-[11px] leading-4">{description}</FormDescription>}
          <FormMessage className="text-[11px]" />
        </FormItem>
      )}
    />
  );
}

interface CheckboxFieldProps<TFieldValues extends FieldValues> extends FieldBase<TFieldValues> {
  checkboxLabel: string;
  disabled?: boolean;
}

export function RHFCheckbox<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  checkboxLabel,
  description,
  className,
  disabled,
}: CheckboxFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn('rounded-xl border border-border/80 bg-muted/25 p-4', className)}>
          <div className="flex items-start gap-3">
            <FormControl>
              <Checkbox checked={Boolean(field.value)} onCheckedChange={field.onChange} disabled={disabled} className="mt-0.5" />
            </FormControl>
            <div className="space-y-1">
              <FormLabel className="cursor-pointer text-xs font-bold">{label}</FormLabel>
              <p className="text-xs leading-5 text-muted-foreground">{checkboxLabel}</p>
              {description && <FormDescription className="text-[11px] leading-4">{description}</FormDescription>}
            </div>
          </div>
          <FormMessage className="text-[11px]" />
        </FormItem>
      )}
    />
  );
}

interface TextareaFieldProps<TFieldValues extends FieldValues>
  extends FieldBase<TFieldValues>, Omit<ComponentProps<typeof Textarea>, 'name' | 'defaultValue'> {}

export function RHFTextarea<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  className,
  ...textareaProps
}: TextareaFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className="text-xs font-bold text-foreground/80">
            {label}{required && <span className="ml-1 text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <Textarea {...field} {...textareaProps} value={field.value ?? ''} className="min-h-28 resize-y rounded-xl bg-background p-3" />
          </FormControl>
          {description && <FormDescription className="text-[11px] leading-4">{description}</FormDescription>}
          <FormMessage className="text-[11px]" />
        </FormItem>
      )}
    />
  );
}
