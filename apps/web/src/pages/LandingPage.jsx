import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useTheme } from "../contexts/ThemeContext.jsx";
import "../styles/landing-page.css";

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, isVisible];
}

function useCountUp(target, duration = 2000, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf;
    const startTime = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return value;
}

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Modules", href: "#modules" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Testimonials", href: "#testimonials" },
  { label: "Pricing", href: "#pricing" },
  { label: "Contact", href: "#contact" },
];

const FEATURES = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    title: "Real-Time AI Interviewer",
    desc: "An AI that watches your code as you type, interrupts with hints when you're stuck, and evaluates your approach — just like a real interviewer.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 9l3 3-3 3" />
        <line x1="14" y1="15" x2="18" y2="15" />
      </svg>
    ),
    title: "Monaco Code Editor",
    desc: "Write code in a professional-grade editor with syntax highlighting, autocomplete, and multi-language support for JS, Python, Java, and C++.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="16" y1="11" x2="22" y2="11" />
      </svg>
    ),
    title: "Live Interview Hosting",
    desc: "Create sessions, share invite codes, and monitor candidates in real time. See their code, track progress, and review results after.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20V10" />
        <path d="M18 20V4" />
        <path d="M6 20v-4" />
      </svg>
    ),
    title: "Smart Scoring & Analytics",
    desc: "Get graded on time, efficiency, hints used, and test cases. Track your progress over time with detailed breakdowns and personal bests.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    title: "XP, Achievements & Streaks",
    desc: "Earn XP for every problem solved, unlock achievements, maintain daily streaks, and climb the leaderboard. Gamification keeps you motivated.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    title: "Adaptive Prep Roadmap",
    desc: "A personalized study plan that adapts to your skill level, targets weak areas, and recommends daily problems to maximize your growth.",
  },
];

const MODULES = [
  {
    title: "Practice Mode",
    desc: "Solve 100+ curated problems at your own pace with AI hints, test case validation, and instant feedback.",
    route: "/practice",
    color: "#6366f1",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 9l3 3-3 3" />
        <line x1="14" y1="15" x2="18" y2="15" />
      </svg>
    ),
  },
  {
    title: "Mock AI Interview",
    desc: "Full structured interview simulation with behavioral questions, timed coding, and detailed scoring.",
    route: "/mock-interview",
    color: "#8b5cf6",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    title: "Live Interview Hosting",
    desc: "Create sessions, assign problems, share invite codes, and monitor candidates writing code in real time.",
    route: "/interviewer",
    color: "#ec4899",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="16" y1="11" x2="22" y2="11" />
      </svg>
    ),
  },
  {
    title: "Join a Session",
    desc: "Enter a session code from your interviewer and jump into a live, monitored coding interview instantly.",
    route: "/join",
    color: "#14b8a6",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <polyline points="10 17 15 12 10 7" />
        <line x1="15" y1="12" x2="3" y2="12" />
      </svg>
    ),
  },
];

const STEPS = [
  { num: "01", title: "Sign Up Free", desc: "Create an account in seconds. No credit card required." },
  { num: "02", title: "Choose Your Path", desc: "Practice solo, take a mock interview, or host a live session." },
  { num: "03", title: "Code & Get Feedback", desc: "Write code in our editor while AI watches and guides you." },
  { num: "04", title: "Track & Improve", desc: "Review scores, earn XP, and follow your personalized roadmap." },
];

const TESTIMONIALS = [
  {
    name: "Sarah Chen",
    role: "Software Engineer @ Google",
    avatar: "SC",
    text: "The AI interviewer feels incredibly realistic. It caught issues in my approach that I would have missed, and the real-time hints helped me think through problems differently.",
    rating: 5,
  },
  {
    name: "Marcus Johnson",
    role: "Engineering Manager",
    avatar: "MJ",
    text: "We use the live hosting feature to screen candidates. The real-time monitoring and session results save us hours compared to our old process.",
    rating: 5,
  },
  {
    name: "Priya Patel",
    role: "CS Student, Stanford",
    avatar: "PP",
    text: "The gamification keeps me coming back every day. I've solved 80+ problems and my streak is at 45 days. The adaptive roadmap knows exactly what I need to work on.",
    rating: 5,
  },
];

const PRICING_PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Everything you need to start practicing",
    features: [
      "20+ practice problems",
      "AI-powered hints & feedback",
      "Join live sessions as candidate",
      "Basic progress tracking",
      "Community leaderboard",
    ],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$12",
    period: "/month",
    desc: "For serious interview preparation",
    features: [
      "100+ practice problems",
      "Unlimited AI mock interviews",
      "Advanced analytics & insights",
      "Code replay & review",
      "Personalized prep roadmap",
      "Multi-language support",
      "Priority AI responses",
    ],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    name: "Team",
    price: "$29",
    period: "/month per seat",
    desc: "For companies hiring engineers",
    features: [
      "Everything in Pro",
      "Host unlimited live sessions",
      "Custom question bank",
      "Candidate comparison dashboard",
      "Session recording & playback",
      "Team analytics",
      "SSO & admin controls",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const [contactForm, setContactForm] = useState({ name: "", email: "", message: "" });
  const [contactStatus, setContactStatus] = useState("");

  const [heroRef, heroVisible] = useInView(0.1);
  const [featRef, featVisible] = useInView();
  const [modRef, modVisible] = useInView();
  const [howRef, howVisible] = useInView();
  const [testRef, testVisible] = useInView();
  const [priceRef, priceVisible] = useInView();
  const [statsRef, statsVisible] = useInView(0.3);
  const [contactRef, contactVisible] = useInView();

  const statProblems = useCountUp(150, 2000, statsVisible);
  const statUsers = useCountUp(10000, 2500, statsVisible);
  const statSessions = useCountUp(50000, 2500, statsVisible);
  const statRating = useCountUp(49, 2000, statsVisible);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSmoothScroll = useCallback((e, href) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleContactSubmit = useCallback((e) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      setContactStatus("error");
      return;
    }
    setContactStatus("success");
    setContactForm({ name: "", email: "", message: "" });
    setTimeout(() => setContactStatus(""), 4000);
  }, [contactForm]);

  const handleGetStarted = useCallback(() => {
    if (isAuthenticated) {
      navigate("/home");
    } else {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="lp" data-theme={theme}>
      {/* ===== NAVBAR ===== */}
      <nav className={`lp-nav ${scrolled ? "lp-nav--scrolled" : ""}`}>
        <div className="lp-nav__inner">
          <a href="#" className="lp-nav__brand" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <span className="lp-nav__logo-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </span>
            <span className="lp-nav__logo-text">CodeInterview</span>
          </a>

          <div className={`lp-nav__links ${mobileMenuOpen ? "lp-nav__links--open" : ""}`}>
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="lp-nav__link"
                onClick={(e) => handleSmoothScroll(e, link.href)}
              >
                {link.label}
              </a>
            ))}
            <div className="lp-nav__link-actions">
              <button type="button" className="lp-nav__theme-btn" onClick={toggleTheme} aria-label="Toggle theme">
                {theme === "light" ? "\u{1F319}" : "\u2600\uFE0F"}
              </button>
              {isAuthenticated ? (
                <button type="button" className="lp-nav__cta" onClick={() => navigate("/home")}>
                  Dashboard
                </button>
              ) : (
                <>
                  <button type="button" className="lp-nav__signin" onClick={() => navigate("/login")}>
                    Sign In
                  </button>
                  <button type="button" className="lp-nav__cta" onClick={() => navigate("/login")}>
                    Get Started Free
                  </button>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            className={`lp-nav__hamburger ${mobileMenuOpen ? "lp-nav__hamburger--open" : ""}`}
            onClick={() => setMobileMenuOpen((p) => !p)}
            aria-label="Toggle menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className={`lp-hero ${heroVisible ? "lp-hero--visible" : ""}`} ref={heroRef}>
        <div className="lp-hero__bg">
          <div className="lp-hero__orb lp-hero__orb--1" />
          <div className="lp-hero__orb lp-hero__orb--2" />
          <div className="lp-hero__orb lp-hero__orb--3" />
          <div className="lp-hero__grid" />
        </div>
        <div className="lp-hero__content">
          <div className="lp-hero__badge">
            <span className="lp-hero__badge-dot" />
            AI-Powered Interview Platform
          </div>
          <h1 className="lp-hero__title">
            Ace Your Next
            <br />
            <span className="lp-hero__title-gradient">Coding Interview</span>
          </h1>
          <p className="lp-hero__subtitle">
            Practice with an AI that watches your code in real time, host live interviews,
            and track your progress with smart analytics. The most complete interview prep platform.
          </p>
          <div className="lp-hero__actions">
            <button type="button" className="lp-hero__btn lp-hero__btn--primary" onClick={handleGetStarted}>
              Start Practicing Free
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
            <button type="button" className="lp-hero__btn lp-hero__btn--secondary" onClick={(e) => handleSmoothScroll(e, "#features")}>
              See Features
            </button>
          </div>
          <div className="lp-hero__social-proof">
            <div className="lp-hero__avatars">
              {["A", "B", "C", "D", "E"].map((l, i) => (
                <span key={l} className="lp-hero__avatar" style={{ zIndex: 5 - i }}>
                  {l}
                </span>
              ))}
            </div>
            <span className="lp-hero__proof-text">
              Trusted by <strong>10,000+</strong> developers worldwide
            </span>
          </div>
        </div>
        <div className="lp-hero__visual">
          <div className="lp-hero__editor-mock">
            <div className="lp-hero__editor-topbar">
              <span className="lp-hero__editor-dot lp-hero__editor-dot--red" />
              <span className="lp-hero__editor-dot lp-hero__editor-dot--yellow" />
              <span className="lp-hero__editor-dot lp-hero__editor-dot--green" />
              <span className="lp-hero__editor-tab">solution.js</span>
            </div>
            <div className="lp-hero__editor-body">
              <code className="lp-hero__code">
                <span className="lp-hero__code-kw">function</span>{" "}
                <span className="lp-hero__code-fn">twoSum</span>
                <span className="lp-hero__code-paren">(</span>
                <span className="lp-hero__code-param">nums, target</span>
                <span className="lp-hero__code-paren">)</span>{" "}
                <span className="lp-hero__code-brace">{"{"}</span>
                {"\n"}
                {"  "}
                <span className="lp-hero__code-kw">const</span> map{" "}
                <span className="lp-hero__code-op">=</span>{" "}
                <span className="lp-hero__code-kw">new</span>{" "}
                <span className="lp-hero__code-fn">Map</span>
                <span className="lp-hero__code-paren">()</span>;{"\n"}
                {"  "}
                <span className="lp-hero__code-kw">for</span>{" "}
                <span className="lp-hero__code-paren">(</span>
                <span className="lp-hero__code-kw">let</span> i{" "}
                <span className="lp-hero__code-op">=</span> 0; i{" "}
                <span className="lp-hero__code-op">&lt;</span> nums.length; i
                <span className="lp-hero__code-op">++</span>
                <span className="lp-hero__code-paren">)</span>{" "}
                <span className="lp-hero__code-brace">{"{"}</span>
                {"\n"}
                {"    "}
                <span className="lp-hero__code-kw">const</span> complement{" "}
                <span className="lp-hero__code-op">=</span> target{" "}
                <span className="lp-hero__code-op">-</span> nums[i];{"\n"}
                {"    "}
                <span className="lp-hero__code-kw">if</span>{" "}
                <span className="lp-hero__code-paren">(</span>
                map.<span className="lp-hero__code-fn">has</span>(complement)
                <span className="lp-hero__code-paren">)</span>{" "}
                <span className="lp-hero__code-brace">{"{"}</span>
                {"\n"}
                {"      "}
                <span className="lp-hero__code-kw">return</span> [map.
                <span className="lp-hero__code-fn">get</span>(complement), i];{"\n"}
                {"    "}
                <span className="lp-hero__code-brace">{"}"}</span>
                {"\n"}
                {"    "}map.<span className="lp-hero__code-fn">set</span>(nums[i], i);{"\n"}
                {"  "}
                <span className="lp-hero__code-brace">{"}"}</span>
                {"\n"}
                <span className="lp-hero__code-brace">{"}"}</span>
              </code>
            </div>
            <div className="lp-hero__editor-hint">
              <span className="lp-hero__hint-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
              </span>
              Great approach! Using a hash map gives you O(n) time complexity.
            </div>
          </div>
        </div>
      </section>

      {/* ===== STATS BAR ===== */}
      <section className={`lp-stats ${statsVisible ? "lp-stats--visible" : ""}`} ref={statsRef}>
        <div className="lp-stats__inner">
          <div className="lp-stats__item">
            <span className="lp-stats__number">{statProblems}+</span>
            <span className="lp-stats__label">Practice Problems</span>
          </div>
          <div className="lp-stats__divider" />
          <div className="lp-stats__item">
            <span className="lp-stats__number">{statUsers.toLocaleString()}+</span>
            <span className="lp-stats__label">Active Users</span>
          </div>
          <div className="lp-stats__divider" />
          <div className="lp-stats__item">
            <span className="lp-stats__number">{statSessions.toLocaleString()}+</span>
            <span className="lp-stats__label">Sessions Completed</span>
          </div>
          <div className="lp-stats__divider" />
          <div className="lp-stats__item">
            <span className="lp-stats__number">{(statRating / 10).toFixed(1)}</span>
            <span className="lp-stats__label">Average Rating</span>
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className={`lp-features ${featVisible ? "lp-features--visible" : ""}`} id="features" ref={featRef}>
        <div className="lp-features__inner">
          <div className="lp-section-header">
            <span className="lp-section-tag">Features</span>
            <h2 className="lp-section-title">Everything You Need to Succeed</h2>
            <p className="lp-section-subtitle">
              From AI-powered practice to live interview hosting, we've built every tool you need to prepare for and conduct coding interviews.
            </p>
          </div>
          <div className="lp-features__grid">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="lp-feature-card"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="lp-feature-card__icon">{f.icon}</div>
                <h3 className="lp-feature-card__title">{f.title}</h3>
                <p className="lp-feature-card__desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== MODULES ===== */}
      <section className={`lp-modules ${modVisible ? "lp-modules--visible" : ""}`} id="modules" ref={modRef}>
        <div className="lp-modules__inner">
          <div className="lp-section-header">
            <span className="lp-section-tag">Modules</span>
            <h2 className="lp-section-title">One Platform, Every Mode</h2>
            <p className="lp-section-subtitle">
              Whether you're a candidate preparing for interviews or a company screening engineers, we have the right mode for you.
            </p>
          </div>
          <div className="lp-modules__grid">
            {MODULES.map((m, i) => (
              <button
                key={m.title}
                type="button"
                className="lp-module-card"
                style={{ animationDelay: `${i * 0.12}s`, "--module-color": m.color }}
                onClick={() => navigate(m.route)}
              >
                <div className="lp-module-card__icon">{m.icon}</div>
                <h3 className="lp-module-card__title">{m.title}</h3>
                <p className="lp-module-card__desc">{m.desc}</p>
                <span className="lp-module-card__cta">
                  Explore
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className={`lp-how ${howVisible ? "lp-how--visible" : ""}`} id="how-it-works" ref={howRef}>
        <div className="lp-how__inner">
          <div className="lp-section-header">
            <span className="lp-section-tag">How It Works</span>
            <h2 className="lp-section-title">Get Started in Minutes</h2>
          </div>
          <div className="lp-how__steps">
            {STEPS.map((s, i) => (
              <div key={s.num} className="lp-step" style={{ animationDelay: `${i * 0.15}s` }}>
                <div className="lp-step__number">{s.num}</div>
                <div className="lp-step__content">
                  <h3 className="lp-step__title">{s.title}</h3>
                  <p className="lp-step__desc">{s.desc}</p>
                </div>
                {i < STEPS.length - 1 && <div className="lp-step__connector" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className={`lp-testimonials ${testVisible ? "lp-testimonials--visible" : ""}`} id="testimonials" ref={testRef}>
        <div className="lp-testimonials__inner">
          <div className="lp-section-header">
            <span className="lp-section-tag">Testimonials</span>
            <h2 className="lp-section-title">Loved by Developers</h2>
            <p className="lp-section-subtitle">
              Hear from engineers and hiring managers who use CodeInterview every day.
            </p>
          </div>
          <div className="lp-testimonials__grid">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={t.name}
                className="lp-testimonial-card"
                style={{ animationDelay: `${i * 0.12}s` }}
              >
                <div className="lp-testimonial-card__stars">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <svg key={j} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ))}
                </div>
                <p className="lp-testimonial-card__text">"{t.text}"</p>
                <div className="lp-testimonial-card__author">
                  <span className="lp-testimonial-card__avatar">{t.avatar}</span>
                  <div>
                    <span className="lp-testimonial-card__name">{t.name}</span>
                    <span className="lp-testimonial-card__role">{t.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section className={`lp-pricing ${priceVisible ? "lp-pricing--visible" : ""}`} id="pricing" ref={priceRef}>
        <div className="lp-pricing__inner">
          <div className="lp-section-header">
            <span className="lp-section-tag">Pricing</span>
            <h2 className="lp-section-title">Simple, Transparent Pricing</h2>
            <p className="lp-section-subtitle">
              Start free and upgrade when you're ready. No hidden fees.
            </p>
          </div>
          <div className="lp-pricing__grid">
            {PRICING_PLANS.map((plan, i) => (
              <div
                key={plan.name}
                className={`lp-price-card ${plan.highlighted ? "lp-price-card--highlighted" : ""}`}
                style={{ animationDelay: `${i * 0.12}s` }}
              >
                {plan.highlighted && <span className="lp-price-card__badge">Most Popular</span>}
                <h3 className="lp-price-card__name">{plan.name}</h3>
                <div className="lp-price-card__price">
                  <span className="lp-price-card__amount">{plan.price}</span>
                  <span className="lp-price-card__period">{plan.period}</span>
                </div>
                <p className="lp-price-card__desc">{plan.desc}</p>
                <ul className="lp-price-card__features">
                  {plan.features.map((f) => (
                    <li key={f}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`lp-price-card__cta ${plan.highlighted ? "lp-price-card__cta--primary" : ""}`}
                  onClick={handleGetStarted}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CONTACT ===== */}
      <section className={`lp-contact ${contactVisible ? "lp-contact--visible" : ""}`} id="contact" ref={contactRef}>
        <div className="lp-contact__inner">
          <div className="lp-contact__info">
            <span className="lp-section-tag">Contact Us</span>
            <h2 className="lp-section-title lp-section-title--left">Get in Touch</h2>
            <p className="lp-contact__desc">
              Have questions, feedback, or need enterprise pricing? We'd love to hear from you.
            </p>
            <div className="lp-contact__details">
              <div className="lp-contact__detail">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <span>support@codeinterview.dev</span>
              </div>
              <div className="lp-contact__detail">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>San Francisco, CA</span>
              </div>
              <div className="lp-contact__detail">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                <span>Mon - Fri, 9am - 6pm PST</span>
              </div>
            </div>
          </div>
          <form className="lp-contact__form" onSubmit={handleContactSubmit}>
            <div className="lp-contact__field">
              <label htmlFor="contact-name">Your Name</label>
              <input
                id="contact-name"
                type="text"
                placeholder="Jane Smith"
                value={contactForm.name}
                onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="lp-contact__field">
              <label htmlFor="contact-email">Email Address</label>
              <input
                id="contact-email"
                type="email"
                placeholder="jane@example.com"
                value={contactForm.email}
                onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))}
                required
              />
            </div>
            <div className="lp-contact__field">
              <label htmlFor="contact-message">Message</label>
              <textarea
                id="contact-message"
                rows="5"
                placeholder="Tell us how we can help..."
                value={contactForm.message}
                onChange={(e) => setContactForm((p) => ({ ...p, message: e.target.value }))}
                required
              />
            </div>
            <button type="submit" className="lp-contact__submit">
              Send Message
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
            {contactStatus === "success" && (
              <p className="lp-contact__status lp-contact__status--success">
                Message sent! We'll get back to you within 24 hours.
              </p>
            )}
            {contactStatus === "error" && (
              <p className="lp-contact__status lp-contact__status--error">
                Please fill in all fields.
              </p>
            )}
          </form>
        </div>
      </section>

      {/* ===== CTA BANNER ===== */}
      <section className="lp-cta-banner">
        <div className="lp-cta-banner__inner">
          <h2 className="lp-cta-banner__title">Ready to Ace Your Next Interview?</h2>
          <p className="lp-cta-banner__subtitle">
            Join thousands of developers who are already preparing smarter, not harder.
          </p>
          <button type="button" className="lp-cta-banner__btn" onClick={handleGetStarted}>
            Get Started Free
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="lp-footer">
        <div className="lp-footer__inner">
          <div className="lp-footer__brand">
            <div className="lp-footer__logo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              <span>CodeInterview</span>
            </div>
            <p className="lp-footer__tagline">
              The most complete AI-powered coding interview platform.
            </p>
          </div>
          <div className="lp-footer__columns">
            <div className="lp-footer__column">
              <h4>Product</h4>
              <a href="#features" onClick={(e) => handleSmoothScroll(e, "#features")}>Features</a>
              <a href="#modules" onClick={(e) => handleSmoothScroll(e, "#modules")}>Modules</a>
              <a href="#pricing" onClick={(e) => handleSmoothScroll(e, "#pricing")}>Pricing</a>
              <a href="#how-it-works" onClick={(e) => handleSmoothScroll(e, "#how-it-works")}>How It Works</a>
            </div>
            <div className="lp-footer__column">
              <h4>Company</h4>
              <a href="#contact" onClick={(e) => handleSmoothScroll(e, "#contact")}>Contact</a>
              <a href="#">About Us</a>
              <a href="#">Careers</a>
              <a href="#">Blog</a>
            </div>
            <div className="lp-footer__column">
              <h4>Legal</h4>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
              <a href="#">Cookie Policy</a>
            </div>
          </div>
        </div>
        <div className="lp-footer__bottom">
          <p>&copy; {new Date().getFullYear()} CodeInterview. All rights reserved.</p>
          <div className="lp-footer__socials">
            <a href="#" aria-label="Twitter">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="#" aria-label="GitHub">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            </a>
            <a href="#" aria-label="LinkedIn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
