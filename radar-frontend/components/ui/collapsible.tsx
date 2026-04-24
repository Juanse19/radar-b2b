'use client';

/**
 * Collapsible — lightweight custom implementation
 *
 * We do not use @radix-ui/react-collapsible here because it is not installed
 * in this project (see package.json). Installing a new dep just for the
 * sidebar is overkill; this hand-rolled version gives us:
 *   - Controlled + uncontrolled `open` state
 *   - CSS grid-rows animation for a smooth open/close without JS height math
 *   - Proper ARIA wiring between trigger and content
 *   - Keyboard support (Enter / Space) via native <button>
 *
 * Public API mimics Radix so a later swap is a drop-in replacement:
 *   <Collapsible open={...} onOpenChange={...}>
 *     <CollapsibleTrigger asChild={false}>...</CollapsibleTrigger>
 *     <CollapsibleContent>...</CollapsibleContent>
 *   </Collapsible>
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

interface CollapsibleContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  contentId: string;
  triggerId: string;
  disabled: boolean;
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(
  null,
);

function useCollapsibleContext(component: string): CollapsibleContextValue {
  const ctx = React.useContext(CollapsibleContext);
  if (!ctx) {
    throw new Error(
      `${component} must be used inside <Collapsible>. Wrap your tree with <Collapsible>.`,
    );
  }
  return ctx;
}

export interface CollapsibleProps
  extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

export const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
  function Collapsible(
    {
      open: openProp,
      defaultOpen,
      onOpenChange,
      disabled = false,
      className,
      children,
      ...rest
    },
    ref,
  ) {
    const isControlled = openProp !== undefined;
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState<boolean>(
      defaultOpen ?? false,
    );
    const open = isControlled ? (openProp as boolean) : uncontrolledOpen;

    const setOpen = React.useCallback(
      (next: boolean) => {
        if (!isControlled) setUncontrolledOpen(next);
        onOpenChange?.(next);
      },
      [isControlled, onOpenChange],
    );

    const reactId = React.useId();
    const triggerId = `${reactId}-trigger`;
    const contentId = `${reactId}-content`;

    const ctxValue = React.useMemo<CollapsibleContextValue>(
      () => ({ open, setOpen, triggerId, contentId, disabled }),
      [open, setOpen, triggerId, contentId, disabled],
    );

    return (
      <CollapsibleContext.Provider value={ctxValue}>
        <div
          ref={ref}
          data-state={open ? 'open' : 'closed'}
          className={cn(className)}
          {...rest}
        >
          {children}
        </div>
      </CollapsibleContext.Provider>
    );
  },
);

export interface CollapsibleTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

export const CollapsibleTrigger = React.forwardRef<
  HTMLButtonElement,
  CollapsibleTriggerProps
>(function CollapsibleTrigger(
  { className, onClick, children, type, ...rest },
  ref,
) {
  const ctx = useCollapsibleContext('CollapsibleTrigger');
  return (
    <button
      ref={ref}
      id={ctx.triggerId}
      type={type ?? 'button'}
      aria-expanded={ctx.open}
      aria-controls={ctx.contentId}
      data-state={ctx.open ? 'open' : 'closed'}
      disabled={ctx.disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !ctx.disabled) {
          ctx.setOpen(!ctx.open);
        }
      }}
      className={cn(className)}
      {...rest}
    >
      {children}
    </button>
  );
});

export interface CollapsibleContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  forceMount?: boolean;
  children?: React.ReactNode;
}

/**
 * Animated via CSS grid-rows trick: 0fr -> 1fr.
 * Inner div carries overflow-hidden so only the visible slice renders while
 * the outer grid animates the height. Works without measuring content height.
 */
export const CollapsibleContent = React.forwardRef<
  HTMLDivElement,
  CollapsibleContentProps
>(function CollapsibleContent(
  { className, children, forceMount, ...rest },
  ref,
) {
  const ctx = useCollapsibleContext('CollapsibleContent');
  const shouldRender = ctx.open || forceMount;

  return (
    <div
      ref={ref}
      id={ctx.contentId}
      role="region"
      aria-labelledby={ctx.triggerId}
      data-state={ctx.open ? 'open' : 'closed'}
      hidden={!ctx.open && !forceMount}
      className={cn(
        'grid transition-[grid-template-rows] duration-200 ease-out',
        ctx.open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        className,
      )}
      {...rest}
    >
      <div className="overflow-hidden">{shouldRender ? children : null}</div>
    </div>
  );
});
