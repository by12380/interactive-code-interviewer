import { memo, useEffect, useState } from "react";

function UnlockToast({ toasts = [], onDismiss }) {
  return (
    <div className="unlock-toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem 
          key={toast.id} 
          toast={toast} 
          onDismiss={() => onDismiss(toast.id)} 
        />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Auto-dismiss after 4 seconds
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onDismiss, 300); // Wait for exit animation
    }, 4000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleClick = () => {
    setIsExiting(true);
    setTimeout(onDismiss, 300);
  };

  const getToastIcon = () => {
    switch (toast.type) {
      case "achievement":
        return toast.icon || "🏆";
      case "level_up":
        return "⬆️";
      case "problem_unlock":
        return "🔓";
      case "streak":
        return "🔥";
      case "xp":
        return "✨";
      default:
        return "🎉";
    }
  };

  const getToastColor = () => {
    switch (toast.type) {
      case "achievement":
        return toast.rarity === "legendary" ? "#f59e0b" :
               toast.rarity === "rare" ? "#3b82f6" :
               toast.rarity === "uncommon" ? "#22c55e" : "#94a3b8";
      case "level_up":
        return "#8b5cf6";
      case "problem_unlock":
        return "#06b6d4";
      case "streak":
        return "#ef4444";
      case "xp":
        return "#22c55e";
      default:
        return "#4f46e5";
    }
  };

  return (
    <div 
      className={`unlock-toast ${isExiting ? "unlock-toast--exiting" : ""}`}
      onClick={handleClick}
      role="alert"
      style={{ "--toast-accent": getToastColor() }}
    >
      <div className="unlock-toast__icon">
        {getToastIcon()}
      </div>
      <div className="unlock-toast__content">
        <span className="unlock-toast__title">{toast.title}</span>
        <span className="unlock-toast__message">{toast.message}</span>
        {toast.xp && (
          <span className="unlock-toast__xp">+{toast.xp} XP</span>
        )}
      </div>
      <button 
        className="unlock-toast__close"
        onClick={(e) => {
          e.stopPropagation();
          handleClick();
        }}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}

export default memo(UnlockToast);
