import { memo, useCallback, useEffect, useState } from "react";

const TUTORIAL_STEPS = [
  {
    target: ".time-card",
    title: "Interview Timer",
    content:
      "This timer counts down from 30 minutes. You can pause the interview if you need a break, or stop it early when you're done. The time you take affects your final score!",
    position: "bottom"
  },
  {
    target: ".difficulty-card",
    title: "Difficulty Level",
    content:
      "Choose your challenge level before starting. Easy problems focus on fundamentals, Medium tests common patterns, and Hard covers advanced algorithms.",
    position: "bottom"
  },
  {
    target: ".panel--editor",
    title: "Code Editor",
    content:
      "Write your solution here! The editor supports JavaScript with syntax highlighting, undo/redo, and auto-formatting. Your code is automatically shared with the AI coach as you type.",
    position: "right"
  },
  {
    target: ".panel--chat",
    title: "AI Interview Coach",
    content:
      "Your personal coding mentor! Ask questions, explain your approach, or request hints. The AI watches your code and provides proactive suggestions. Tip: Asking for 'hints' will be tracked in your score.",
    position: "left"
  },
  {
    target: ".panel--metrics",
    title: "Session Metrics",
    content:
      "Track your progress in real-time. Check code efficiency, run test cases, and see how many hints you've used. Click 'Complete Interview' when you're ready for your final score report!",
    position: "left"
  }
];

function Tutorial({ isVisible, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const step = TUTORIAL_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  const updateTargetRect = useCallback(() => {
    if (!step?.target) {
      return;
    }

    const element = document.querySelector(step.target);
    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect({
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16
      });
    }
  }, [step?.target]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    setIsAnimating(true);
    updateTargetRect();

    const timeout = setTimeout(() => {
      setIsAnimating(false);
    }, 300);

    const handleResize = () => updateTargetRect();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [isVisible, currentStep, updateTargetRect]);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      onClose();
      setCurrentStep(0);
      return;
    }
    setCurrentStep((prev) => prev + 1);
  }, [isLastStep, onClose]);

  const handlePrev = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [isFirstStep]);

  const handleSkip = useCallback(() => {
    onClose();
    setCurrentStep(0);
  }, [onClose]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Escape") {
        handleSkip();
      } else if (event.key === "ArrowRight" || event.key === "Enter") {
        handleNext();
      } else if (event.key === "ArrowLeft") {
        handlePrev();
      }
    },
    [handleNext, handlePrev, handleSkip]
  );

  useEffect(() => {
    if (isVisible) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isVisible, handleKeyDown]);

  if (!isVisible || !targetRect) {
    return null;
  }

  const getTooltipStyle = () => {
    const padding = 16;
    const tooltipWidth = 340;
    const tooltipHeight = 200;

    switch (step.position) {
      case "bottom":
        return {
          top: targetRect.top + targetRect.height + padding,
          left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2
        };
      case "top":
        return {
          top: targetRect.top - tooltipHeight - padding,
          left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2
        };
      case "left":
        return {
          top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
          left: targetRect.left - tooltipWidth - padding
        };
      case "right":
        return {
          top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
          left: targetRect.left + targetRect.width + padding
        };
      default:
        return {
          top: targetRect.top + targetRect.height + padding,
          left: targetRect.left
        };
    }
  };

  return (
    <div className="tutorial" role="dialog" aria-modal="true">
      <div className="tutorial__overlay" onClick={handleSkip} />

      <div
        className={`tutorial__spotlight ${isAnimating ? "tutorial__spotlight--animating" : ""}`}
        style={{
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height
        }}
      />

      <div
        className={`tutorial__tooltip tutorial__tooltip--${step.position}`}
        style={getTooltipStyle()}
      >
        <div className="tutorial__progress">
          {TUTORIAL_STEPS.map((_, index) => (
            <span
              key={index}
              className={`tutorial__dot ${index === currentStep ? "tutorial__dot--active" : ""} ${index < currentStep ? "tutorial__dot--completed" : ""}`}
            />
          ))}
        </div>

        <h3 className="tutorial__title">{step.title}</h3>
        <p className="tutorial__content">{step.content}</p>

        <div className="tutorial__actions">
          <button
            type="button"
            className="tutorial__button tutorial__button--skip"
            onClick={handleSkip}
          >
            Skip tutorial
          </button>
          <div className="tutorial__nav">
            {!isFirstStep && (
              <button
                type="button"
                className="tutorial__button tutorial__button--prev"
                onClick={handlePrev}
              >
                Previous
              </button>
            )}
            <button
              type="button"
              className="tutorial__button tutorial__button--next"
              onClick={handleNext}
            >
              {isLastStep ? "Finish" : "Next"}
            </button>
          </div>
        </div>

        <div className="tutorial__hint">
          Use arrow keys to navigate, Esc to close
        </div>
      </div>
    </div>
  );
}

export default memo(Tutorial);
