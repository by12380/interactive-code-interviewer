import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getPreferredTooltipWidth(targetRawRect) {
  const maxWidth = 420;
  const minWidth = 280;
  if (!targetRawRect) {
    return maxWidth;
  }
  return clamp(targetRawRect.width, minWidth, maxWidth);
}

export default function TutorialOverlay({
  isOpen,
  steps,
  stepIndex,
  onStepChange,
  onClose
}) {
  const activeStep = steps?.[stepIndex] ?? null;
  const [targetRect, setTargetRect] = useState(null);
  const tooltipRef = useRef(null);
  const closeBtnRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [tooltipStyle, setTooltipStyle] = useState(null);

  const targetSelector = activeStep?.targetSelector ?? null;

  const stepMeta = useMemo(() => {
    const total = steps?.length ?? 0;
    return {
      total,
      isFirst: stepIndex <= 0,
      isLast: total > 0 ? stepIndex >= total - 1 : true
    };
  }, [steps, stepIndex]);

  useEffect(() => {
    if (!isOpen) {
      setTargetRect(null);
      setTooltipStyle(null);
      return;
    }

    const updateRect = () => {
      if (!targetSelector) {
        setTargetRect(null);
        return;
      }

      const el = document.querySelector(targetSelector);
      if (!el) {
        setTargetRect(null);
        return;
      }

      const rect = el.getBoundingClientRect();
      const padding = activeStep?.highlightPadding ?? 10;
      setTargetRect({
        top: Math.max(rect.top - padding, 0),
        left: Math.max(rect.left - padding, 0),
        width: Math.min(rect.width + padding * 2, window.innerWidth),
        height: Math.min(rect.height + padding * 2, window.innerHeight),
        raw: rect
      });
    };

    const maybeScrollIntoView = () => {
      if (!targetSelector) {
        return;
      }
      const el = document.querySelector(targetSelector);
      if (!el) {
        return;
      }
      el.scrollIntoView({ block: "center", inline: "nearest" });
    };

    maybeScrollIntoView();
    updateRect();

    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [isOpen, targetSelector, activeStep]);

  useEffect(() => {
    if (!isOpen) {
      const prev = previousFocusRef.current;
      if (prev && typeof prev.focus === "function") {
        try {
          prev.focus();
        } catch {
          // ignore
        }
      }
      previousFocusRef.current = null;
      return;
    }

    try {
      previousFocusRef.current = document.activeElement;
    } catch {
      previousFocusRef.current = null;
    }

    const t = window.setTimeout(() => {
      const btn = closeBtnRef.current;
      if (btn && typeof btn.focus === "function") {
        try {
          btn.focus();
        } catch {
          // ignore
        }
        return;
      }
      const tip = tooltipRef.current;
      if (tip && typeof tip.focus === "function") {
        try {
          tip.focus();
        } catch {
          // ignore
        }
      }
    }, 0);

    return () => window.clearTimeout(t);
  }, [isOpen, stepIndex]);

  useLayoutEffect(() => {
    if (!isOpen || !activeStep) {
      setTooltipStyle(null);
      return;
    }

    const margin = 12;
    const raw = targetRect?.raw ?? null;
    const tooltipEl = tooltipRef.current;

    if (!tooltipEl || !raw) {
      setTooltipStyle({
        left: "50%",
        top: "20%",
        transform: "translateX(-50%)",
        maxWidth: "420px"
      });
      return;
    }

    const tooltipRect = tooltipEl.getBoundingClientRect();

    const spaceBelow = window.innerHeight - raw.bottom;
    const spaceAbove = raw.top;
    const wantsBelow = spaceBelow >= tooltipRect.height + margin * 2;
    const wantsAbove = spaceAbove >= tooltipRect.height + margin * 2;
    const placement = wantsBelow ? "bottom" : wantsAbove ? "top" : spaceBelow >= spaceAbove ? "bottom" : "top";

    const maxWidth = getPreferredTooltipWidth(raw);
    const left = clamp(raw.left, margin, window.innerWidth - maxWidth - margin);

    const desiredTop =
      placement === "bottom" ? raw.bottom + margin : raw.top - tooltipRect.height - margin;

    const top = clamp(desiredTop, margin, window.innerHeight - tooltipRect.height - margin);

    setTooltipStyle({
      left: `${left}px`,
      top: `${top}px`,
      maxWidth: `${maxWidth}px`
    });
  }, [isOpen, activeStep, targetRect, stepIndex]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        if (!stepMeta.isLast) {
          onStepChange?.(stepIndex + 1);
        } else {
          onClose?.();
        }
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (!stepMeta.isFirst) {
          onStepChange?.(stepIndex - 1);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, stepIndex, stepMeta, onStepChange, onClose]);

  if (!isOpen || !activeStep) {
    return null;
  }

  const titleId = `tutorial-title-${stepIndex}`;
  const bodyId = `tutorial-body-${stepIndex}`;

  const spotlightStyle = targetRect
    ? {
        top: `${targetRect.top}px`,
        left: `${targetRect.left}px`,
        width: `${targetRect.width}px`,
        height: `${targetRect.height}px`,
        borderRadius: `${activeStep.highlightRadius ?? 16}px`
      }
    : null;

  const tooltip = tooltipStyle ?? {
    left: "50%",
    top: "20%",
    transform: "translateX(-50%)",
    maxWidth: "420px"
  };

  return (
    <div
      className="tutorial"
      role="dialog"
      aria-modal="true"
      aria-label={!activeStep.title ? "Tutorial" : undefined}
      aria-labelledby={activeStep.title ? titleId : undefined}
      aria-describedby={activeStep.body ? bodyId : undefined}
    >
      <div className="tutorial__backdrop" aria-hidden="true" onClick={() => onClose?.()} />

      {spotlightStyle && (
        <div className="tutorial__spotlight" style={spotlightStyle} aria-hidden="true" />
      )}

      <div
        className="tutorial__tooltip"
        style={tooltip}
        ref={tooltipRef}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const root = tooltipRef.current;
          if (!root) return;
          const focusables = Array.from(
            root.querySelectorAll(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
          ).filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true");
          if (focusables.length === 0) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          const isShift = e.shiftKey;
          if (!isShift && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
          if (isShift && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        }}
      >
        <div className="tutorial__meta">
          <span className="tutorial__step" aria-live="polite">
            Step {Math.min(stepIndex + 1, stepMeta.total)} of {stepMeta.total}
          </span>
          <button
            type="button"
            className="tutorial__close"
            onClick={() => onClose?.()}
            aria-label="Close tutorial"
            ref={closeBtnRef}
          >
            ×
          </button>
        </div>

        {activeStep.title && (
          <div className="tutorial__title" id={titleId}>
            {activeStep.title}
          </div>
        )}
        {activeStep.body && (
          <div className="tutorial__body" id={bodyId}>
            {activeStep.body}
          </div>
        )}

        <div className="tutorial__actions">
          <button
            type="button"
            className="tutorial__btn tutorial__btn--ghost"
            onClick={() => onClose?.()}
          >
            Skip
          </button>
          <div className="tutorial__actions-right">
            <button
              type="button"
              className="tutorial__btn tutorial__btn--ghost"
              onClick={() => onStepChange?.(Math.max(0, stepIndex - 1))}
              disabled={stepMeta.isFirst}
            >
              Back
            </button>
            <button
              type="button"
              className="tutorial__btn tutorial__btn--primary"
              onClick={() => {
                if (!stepMeta.isLast) {
                  onStepChange?.(stepIndex + 1);
                } else {
                  onClose?.();
                }
              }}
            >
              {stepMeta.isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>

        <div className="tutorial__hint">
          Tip: press <kbd>Esc</kbd> to close, <kbd>←</kbd>/<kbd>→</kbd> to navigate.
        </div>
      </div>
    </div>
  );
}

