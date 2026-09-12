import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const variants = cva('button', {variants:{variant:{default:'button-primary',outline:'button-outline',ghost:'button-ghost'},size:{default:'',sm:'button-sm',icon:'button-icon'}},defaultVariants:{variant:'default',size:'default'}});
export function Button({className,variant,size,asChild=false,...props}: React.ComponentProps<'button'> & VariantProps<typeof variants> & {asChild?:boolean}) {const Comp=asChild?Slot:'button';return <Comp className={cn(variants({variant,size,className}))} {...props}/>;}
