import { memo, useCallback, useEffect, useState } from "react";

const ONBOARDING_STEPS = [
  {
    id: "welcome",
    type: "modal",
    title: "Welcome to Live AI Coding Interviewer! 🎉",
    content: `
      <p>Get ready to practice coding interviews with your personal AI interviewer.</p>
      <ul>
        <li><strong>Real-time feedback</strong> as you code</li>
        <li><strong>Proactive hints</strong> when you're stuck</li>
        <li><strong>Performance scoring</strong> to track progress</li>
        <li><strong>Multiple problem types</strong> to master</li>
      </ul>
      <p>Let's take a quick tour!</p>
    `,
    position: "center",
  },
  {
    id: "problem-selector",
    type: "highlight",
    target: ".problem-selector",
    title: "Choose Your Challenge",
    content: "Select from various coding problems sorted by difficulty and category. Start with easier ones to build confidence!",
    position: "bottom",
  },
  {
    id: "problem-panel",
    type: "highlight",
    target: ".problem-panel",
    title: "Problem Description",
    content: "Read the problem carefully here. Check the examples, constraints, and test cases before you start coding.",
    position: "right",
  },
  {
    id: "editor",
    type: "highlight",
    target: ".panel--editor",
    title: "Code Editor",
    content: "Write your solution here! Use Ctrl/⌘+Enter to run your code. The AI watches your progress and offers help when needed.",
    position: "left",
  },
  {
    id: "console",
    type: "highlight",
    target: ".panel--console",
    title: "Console Output",
    content: "See your code's output here. Use console.log() to debug and verify your solution.",
    position: "top",
  },
  {
    id: "chat",
    type: "highlight",
    target: ".panel--chat",
    title: "AI Interviewer",
    content: "Chat with your AI interviewer! Explain your approach, ask for clarification, or request hints. The more you communicate, the better!",
    position: "left",
  },
  {
    id: "metrics",
    type: "highlight",
    target: ".panel--metrics",
    title: "Track Your Progress",
    content: "Monitor your efficiency, test results, and hints used. Click 'Complete Interview' when ready for your final score!",
    position: "left",
  },
  {
    id: "timer",
    type: "highlight",
    target: ".time-card",
    title: "Time Management",
    content: "Keep an eye on the timer! You can pause if needed, but faster solutions earn better scores.",
    position: "bottom",
  },
  {
    id: "settings",
    type: "highlight",
    target: ".settings-trigger",
    title: "Customize Your Experience",
    content: "Adjust themes, colors, font size, and accessibility options to make the interface comfortable for you.",
    position: "bottom",
  },
  {
    id: "complete",
    type: "modal",
    title: "You're All Set! 🚀",
    content: `
      <p>You've completed the tour! Here are some tips to succeed:</p>
      <ul>
        <li><strong>Think out loud</strong> - Explain your approach to the AI</li>
        <li><strong>Start simple</strong> - Get a working solution first, then optimize</li>
        <li><strong>Test often</strong> - Run your code frequently to catch bugs early</li>
        <li><strong>Ask for help</strong> - The AI is here to guide you, not judge you</li>
      </ul>
      <p>Good luck with your interview practice!</p>
    `,
    position: "center",
  },
];

function OnboardingTour({ isVisible, onClose, onNeverShow }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const step = ONBOARDING_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  const isModalStep = step?.type === "modal";

  // Update target rect for highlight steps
  const updateTargetRect = useCallback(() => {
    if (!step?.target) {
      setTargetRect(null);
      return;
    }

    const element = document.querySelector(step.target);
    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect({
        top: rect.top - 12,
        left: rect.left - 12,
        width: rect.width + 24,
        height: rect.height + 24,
      });

      // Scroll element into view if needed
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      setTargetRect(null);
    }
  }, [step?.target]);

  useEffect(() => {
    if (!isVisible) return;

    setIsAnimating(true);
    updateTargetRect();

    const timeout = setTimeout(() => setIsAnimating(false), 300);

    const handleResize = () => updateTargetRect();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [isVisible, currentStep, updateTargetRect]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleSkip();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, currentStep]);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      handleComplete();
      return;
    }
    setCurrentStep((prev) => prev + 1);
  }, [isLastStep]);

  const handlePrev = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [isFirstStep]);

  const handleSkip = useCallback(() => {
    onClose();
    setCurrentStep(0);
  }, [onClose]);

  const handleComplete = useCallback(() => {
    onClose();
    setCurrentStep(0);
    // Mark onboarding as complete
    localStorage.setItem("onboardingComplete", "true");
  }, [onClose]);

  const handleNeverShow = useCallback(() => {
    localStorage.setItem("onboardingComplete", "true");
    localStorage.setItem("onboardingNeverShow", "true");
    onNeverShow?.();
    onClose();
    setCurrentStep(0);
  }, [onClose, onNeverShow]);

  const getTooltipPosition = () => {
    if (isModalStep || !targetRect) {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const padding = 20;
    const tooltipWidth = 380;
    const tooltipHeight = 240;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top, left;

    switch (step.position) {
      case "bottom":
        top = targetRect.top + targetRect.height + padding;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case "top":
        top = targetRect.top - tooltipHeight - padding;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case "left":
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.left - tooltipWidth - padding;
        break;
      case "right":
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.left + targetRect.width + padding;
        break;
      default:
        top = targetRect.top + targetRect.height + padding;
        left = targetRect.left;
    }

    // Keep tooltip within viewport
    left = Math.max(padding, Math.min(left, viewportWidth - tooltipWidth - padding));
    top = Math.max(padding, Math.min(top, viewportHeight - tooltipHeight - padding));

    return { position: "fixed", top, left };
  };

  if (!isVisible) return null;

  return (
    <div
      className="onboarding-tour"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      {/* Overlay */}
      <div
        className={`onboarding-tour__overlay ${isModalStep ? "onboarding-tour__overlay--solid" : ""}`}
        onClick={handleSkip}
      />

      {/* Spotlight for highlight steps */}
      {!isModalStep && targetRect && (
        <div
          className={`onboarding-tour__spotlight ${isAnimating ? "onboarding-tour__spotlight--animating" : ""}`}
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
          }}
        />
      )}

      {/* Tooltip/Modal */}
      <div
        className={`onboarding-tour__tooltip ${isModalStep ? "onboarding-tour__tooltip--modal" : ""} onboarding-tour__tooltip--${step.position || "center"}`}
        style={getTooltipPosition()}
      >
        {/* Progress dots */}
        <div className="onboarding-tour__progress" role="progressbar" aria-valuenow={currentStep + 1} aria-valuemin={1} aria-valuemax={ONBOARDING_STEPS.length}>
          {ONBOARDING_STEPS.map((_, index) => (
            <button
              key={index}
              type="button"
              className={`onboarding-tour__dot ${
                index === currentStep
                  ? "onboarding-tour__dot--active"
                  : index < currentStep
                  ? "onboarding-tour__dot--completed"
                  : ""
              }`}
              onClick={() => setCurrentStep(index)}
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>

        {/* Step indicator */}
        <span className="onboarding-tour__step-count">
          {currentStep + 1} of {ONBOARDING_STEPS.length}
        </span>

        {/* Content */}
        <h3 id="onboarding-title" className="onboarding-tour__title">
          {step.title}
        </h3>
        <div
          className="onboarding-tour__content"
          dangerouslySetInnerHTML={{ __html: step.content }}
        />

        {/* Actions */}
        <div className="onboarding-tour__actions">
          <div className="onboarding-tour__skip-actions">
            <button
              type="button"
              className="onboarding-tour__button onboarding-tour__button--skip"
              onClick={handleSkip}
            >
              Skip tour
            </button>
            {isFirstStep && (
              <button
                type="button"
                className="onboarding-tour__button onboarding-tour__button--never"
                onClick={handleNeverShow}
              >
                Don't show again
              </button>
            )}
          </div>
          <div className="onboarding-tour__nav">
            {!isFirstStep && (
              <button
                type="button"
                className="onboarding-tour__button onboarding-tour__button--prev"
                onClick={handlePrev}
                aria-label="Previous step"
              >
                ← Back
              </button>
            )}
            <button
              type="button"
              className="onboarding-tour__button onboarding-tour__button--next"
              onClick={handleNext}
              aria-label={isLastStep ? "Complete tour" : "Next step"}
            >
              {isLastStep ? "Get Started! 🎯" : "Next →"}
            </button>
          </div>
        </div>

        {/* Keyboard hint */}
        <div className="onboarding-tour__hint">
          <kbd>←</kbd> <kbd>→</kbd> to navigate, <kbd>Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}

export default memo(OnboardingTour);
