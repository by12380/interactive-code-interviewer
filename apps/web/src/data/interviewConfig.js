// Interview Simulation Configuration
// Contains behavioral questions, system design problems, and interview settings

// ============ BEHAVIORAL QUESTIONS ============
// Asked between coding problems to simulate real interviews

export const BEHAVIORAL_QUESTIONS = [
  // Self-Introduction & Background
  {
    id: "intro-1",
    category: "Introduction",
    question: "Tell me about yourself and your background in software engineering.",
    followUps: [
      "What attracted you to software engineering?",
      "What's the most interesting project you've worked on?"
    ],
    tips: "Keep it concise (2-3 minutes). Focus on relevant experience and what excites you about the role."
  },
  {
    id: "intro-2",
    category: "Introduction",
    question: "Walk me through a project you're particularly proud of.",
    followUps: [
      "What was your specific contribution?",
      "What would you do differently if you could start over?"
    ],
    tips: "Use the STAR method: Situation, Task, Action, Result."
  },

  // Problem Solving & Technical Challenges
  {
    id: "problem-1",
    category: "Problem Solving",
    question: "Tell me about a time you faced a difficult technical challenge. How did you approach it?",
    followUps: [
      "What resources did you use to solve it?",
      "How did you validate your solution?"
    ],
    tips: "Focus on your problem-solving process, not just the outcome."
  },
  {
    id: "problem-2",
    category: "Problem Solving",
    question: "Describe a bug that took you a long time to find. What was your debugging process?",
    followUps: [
      "What tools did you use?",
      "How did you prevent similar bugs in the future?"
    ],
    tips: "Demonstrate systematic thinking and learning from the experience."
  },
  {
    id: "problem-3",
    category: "Problem Solving",
    question: "How do you approach learning a new technology or framework?",
    followUps: [
      "Can you give a specific example?",
      "How do you decide when to use a new technology vs. stick with what you know?"
    ],
    tips: "Show intellectual curiosity and practical learning strategies."
  },

  // Teamwork & Collaboration
  {
    id: "team-1",
    category: "Teamwork",
    question: "Tell me about a time you disagreed with a teammate on a technical decision. How did you handle it?",
    followUps: [
      "What was the outcome?",
      "Would you handle it differently now?"
    ],
    tips: "Show respect for others' opinions while standing up for your technical judgment."
  },
  {
    id: "team-2",
    category: "Teamwork",
    question: "Describe your experience working with cross-functional teams (designers, PMs, etc.).",
    followUps: [
      "How do you handle conflicting priorities?",
      "How do you explain technical concepts to non-technical stakeholders?"
    ],
    tips: "Emphasize communication skills and understanding of different perspectives."
  },
  {
    id: "team-3",
    category: "Teamwork",
    question: "How do you handle code reviews? Both giving and receiving feedback?",
    followUps: [
      "What's the most valuable feedback you've received?",
      "How do you give critical feedback constructively?"
    ],
    tips: "Show that you value feedback as a growth opportunity."
  },

  // Leadership & Initiative
  {
    id: "lead-1",
    category: "Leadership",
    question: "Tell me about a time you took initiative on a project or improvement.",
    followUps: [
      "How did you convince others to support your idea?",
      "What was the impact?"
    ],
    tips: "Demonstrate proactivity and ability to drive change."
  },
  {
    id: "lead-2",
    category: "Leadership",
    question: "Have you ever mentored another developer? What was that experience like?",
    followUps: [
      "What's your approach to teaching complex concepts?",
      "What did you learn from the experience?"
    ],
    tips: "Show patience and investment in others' growth."
  },

  // Failure & Growth
  {
    id: "fail-1",
    category: "Growth",
    question: "Tell me about a time you made a mistake at work. What happened and what did you learn?",
    followUps: [
      "How did you communicate about the mistake?",
      "What safeguards did you put in place to prevent it from happening again?"
    ],
    tips: "Be honest and focus on the learning and growth."
  },
  {
    id: "fail-2",
    category: "Growth",
    question: "Describe a project that didn't go as planned. What would you do differently?",
    followUps: [
      "What were the early warning signs?",
      "How did the team adapt?"
    ],
    tips: "Show self-awareness and ability to reflect critically."
  },

  // Work Style & Preferences
  {
    id: "style-1",
    category: "Work Style",
    question: "How do you prioritize your work when you have multiple deadlines?",
    followUps: [
      "How do you handle interruptions?",
      "What tools do you use to stay organized?"
    ],
    tips: "Demonstrate organization and decision-making skills."
  },
  {
    id: "style-2",
    category: "Work Style",
    question: "Do you prefer working independently or as part of a team? Why?",
    followUps: [
      "How do you stay productive in your preferred environment?",
      "How do you adapt to the other style when needed?"
    ],
    tips: "Show flexibility while being honest about preferences."
  },

  // Career Goals
  {
    id: "goals-1",
    category: "Career",
    question: "Where do you see yourself in 5 years?",
    followUps: [
      "What skills are you working on developing?",
      "What type of projects excite you most?"
    ],
    tips: "Show ambition while being realistic. Connect to the role/company."
  },
  {
    id: "goals-2",
    category: "Career",
    question: "Why are you interested in this role/company?",
    followUps: [
      "What do you hope to learn here?",
      "What would make this role successful for you?"
    ],
    tips: "Show you've done research and have genuine interest."
  }
];

// ============ SYSTEM DESIGN PROBLEMS ============
// For mock system design interviews

export const SYSTEM_DESIGN_PROBLEMS = [
  {
    id: "sd-url-shortener",
    title: "Design a URL Shortener",
    difficulty: "Easy",
    timeLimit: 35 * 60, // 35 minutes
    description: `Design a URL shortening service like bit.ly or TinyURL.

**Requirements:**
- Given a long URL, generate a shorter unique URL
- When users access the short URL, redirect to the original URL
- URLs should expire after a configurable time period
- Track click analytics (count, referrer, location)

**Scale:**
- 100M new URLs per month
- 10:1 read to write ratio
- URLs stored for 5 years by default`,
    keyTopics: [
      "URL encoding/hashing strategy",
      "Database schema design",
      "Caching layer",
      "Load balancing",
      "Analytics pipeline"
    ],
    hints: [
      "Consider base62 encoding for short URLs",
      "Think about collision handling for hashes",
      "How would you handle hot URLs that get millions of clicks?",
      "Consider eventual consistency for analytics"
    ],
    sampleAnswer: `**High-Level Design:**

1. **API Design:**
   - POST /shorten: Create short URL
   - GET /:shortCode: Redirect to original URL

2. **Short URL Generation:**
   - Use base62 encoding (a-z, A-Z, 0-9)
   - 7 characters = 62^7 = 3.5 trillion combinations
   - Options: Counter-based, Hash-based, or Pre-generated

3. **Database:**
   - Key-Value store for URL mappings (Redis/DynamoDB)
   - Relational DB for analytics
   - Schema: shortCode, originalUrl, userId, createdAt, expiresAt

4. **Caching:**
   - Cache hot URLs in Redis
   - Use LRU eviction policy
   - 80/20 rule: 20% of URLs generate 80% of traffic

5. **Scaling:**
   - Horizontal scaling of app servers
   - Database sharding by shortCode
   - CDN for geographic distribution

6. **Analytics:**
   - Async write to analytics DB via message queue
   - Batch processing for aggregations`
  },
  {
    id: "sd-chat-system",
    title: "Design a Real-time Chat System",
    difficulty: "Medium",
    timeLimit: 45 * 60, // 45 minutes
    description: `Design a real-time messaging system like Slack or WhatsApp.

**Requirements:**
- One-on-one messaging
- Group chats (up to 500 members)
- Message delivery status (sent, delivered, read)
- Online/offline presence indicators
- Message history and search

**Scale:**
- 500M daily active users
- Average user sends 50 messages per day
- 99.9% message delivery within 1 second`,
    keyTopics: [
      "WebSocket vs Long Polling",
      "Message queue architecture",
      "Presence system design",
      "Database partitioning strategy",
      "Message delivery guarantees"
    ],
    hints: [
      "How do you handle users on different servers?",
      "Consider message ordering in group chats",
      "How do you handle offline users?",
      "Think about fan-out strategies for group messages"
    ],
    sampleAnswer: `**High-Level Design:**

1. **Connection Layer:**
   - WebSocket servers for real-time communication
   - Connection Gateway to manage user sessions
   - Heartbeat mechanism for connection health

2. **Message Flow:**
   - User sends message → WebSocket → Message Service
   - Message Service validates and stores
   - Push to recipients via their WebSocket connections

3. **Presence System:**
   - Redis pub/sub for online status
   - Heartbeat every 30 seconds
   - Grace period before marking offline

4. **Database:**
   - Messages: Cassandra/ScyllaDB (partition by conversationId)
   - Users/Groups: PostgreSQL
   - Presence: Redis

5. **Group Chat Fan-out:**
   - Small groups: Write-time fan-out
   - Large groups: Read-time fan-out
   - Hybrid approach based on group size

6. **Delivery Guarantees:**
   - At-least-once delivery with deduplication
   - Message IDs for ordering
   - Retry queue for failed deliveries`
  },
  {
    id: "sd-rate-limiter",
    title: "Design a Rate Limiter",
    difficulty: "Easy",
    timeLimit: 30 * 60, // 30 minutes
    description: `Design a rate limiting service for an API.

**Requirements:**
- Limit requests per user/IP/API key
- Support multiple rate limiting rules (requests per second, minute, hour)
- Distributed system support
- Low latency (< 1ms overhead)
- Return appropriate headers (X-RateLimit-Remaining, etc.)

**Scale:**
- 1M requests per second
- Multiple data centers`,
    keyTopics: [
      "Token Bucket vs Sliding Window algorithms",
      "Distributed rate limiting",
      "Redis data structures",
      "Race condition handling"
    ],
    hints: [
      "Compare Token Bucket, Leaky Bucket, Fixed Window, and Sliding Window algorithms",
      "How do you handle distributed counting?",
      "Consider the trade-off between accuracy and performance"
    ],
    sampleAnswer: `**High-Level Design:**

1. **Algorithm Choice:**
   - Token Bucket: Good for bursty traffic
   - Sliding Window Log: Most accurate but memory-intensive
   - Sliding Window Counter: Good balance

2. **Implementation with Redis:**
   - Key: "rate_limit:{user_id}:{window}"
   - Use INCR with EXPIRE for fixed windows
   - Use sorted sets for sliding window log

3. **Distributed Considerations:**
   - Centralized Redis cluster
   - Race conditions: Use Lua scripts for atomicity
   - Eventual consistency acceptable for rate limiting

4. **Multiple Rules:**
   - Check all applicable rules
   - Use rule hierarchy (global → per-user → per-endpoint)

5. **Response Headers:**
   - X-RateLimit-Limit: Max requests allowed
   - X-RateLimit-Remaining: Requests left
   - X-RateLimit-Reset: When the window resets

6. **High Availability:**
   - Redis Cluster for partitioning
   - Local rate limiting as fallback
   - Graceful degradation`
  },
  {
    id: "sd-newsfeed",
    title: "Design a Social Media News Feed",
    difficulty: "Hard",
    timeLimit: 50 * 60, // 50 minutes
    description: `Design the news feed system for a social media platform like Facebook or Twitter.

**Requirements:**
- Display posts from friends/followed accounts
- Ranked feed (not just chronological)
- Support for different content types (text, images, videos, links)
- Real-time updates for new posts
- Infinite scroll pagination

**Scale:**
- 1B daily active users
- Average user has 500 friends
- Average user checks feed 10 times per day`,
    keyTopics: [
      "Fan-out on write vs Fan-out on read",
      "Feed ranking algorithms",
      "Caching strategies",
      "Real-time updates",
      "Content delivery"
    ],
    hints: [
      "How do you handle celebrities with millions of followers?",
      "Consider hybrid fan-out approaches",
      "Think about feed pre-generation vs on-demand",
      "How do you incorporate ML ranking?"
    ],
    sampleAnswer: `**High-Level Design:**

1. **Feed Generation Strategy:**
   - Hybrid approach:
   - Fan-out on write for regular users (push)
   - Fan-out on read for celebrities (pull)
   - Threshold: 10K followers

2. **Data Model:**
   - Posts table: postId, userId, content, mediaUrls, timestamp
   - Feed table: userId, postId, score (for pre-computed feeds)
   - Social graph: follower/following relationships

3. **Feed Ranking:**
   - Features: recency, engagement, affinity, content type
   - ML model for personalization
   - Re-rank at read time with latest signals

4. **Caching:**
   - Pre-computed feeds in Redis (top 500 posts per user)
   - Post content in CDN and cache
   - Social graph edges in Redis

5. **Real-time Updates:**
   - Long polling or WebSocket for active users
   - Badge notification for new posts
   - Merge real-time with cached feed

6. **Media Handling:**
   - CDN for images/videos
   - Multiple resolutions for different devices
   - Lazy loading for infinite scroll`
  },
  {
    id: "sd-parking-lot",
    title: "Design a Parking Lot System",
    difficulty: "Easy",
    timeLimit: 30 * 60, // 30 minutes
    description: `Design an object-oriented parking lot system.

**Requirements:**
- Multiple floors with different spot sizes (compact, regular, large)
- Different vehicle types (motorcycle, car, bus)
- Track available spots in real-time
- Calculate parking fees based on duration
- Support for monthly passes and reservations

**Focus Areas:**
- Object-oriented design
- Class relationships
- Design patterns`,
    keyTopics: [
      "Class hierarchy design",
      "Design patterns (Factory, Strategy, Observer)",
      "Concurrency handling",
      "Database schema"
    ],
    hints: [
      "Start with core entities: ParkingLot, Floor, Spot, Vehicle",
      "Use inheritance for vehicle and spot types",
      "Consider the Strategy pattern for pricing",
      "How do you handle concurrent spot assignments?"
    ],
    sampleAnswer: `**Object-Oriented Design:**

1. **Core Classes:**
   \`\`\`
   ParkingLot
   ├── floors: Floor[]
   ├── entryPanels: EntryPanel[]
   ├── exitPanels: ExitPanel[]
   └── displayBoards: DisplayBoard[]

   Floor
   ├── floorNumber: int
   ├── spots: ParkingSpot[]
   └── getAvailableSpots(type): ParkingSpot[]

   ParkingSpot (abstract)
   ├── spotNumber: string
   ├── isAvailable: boolean
   └── vehicle: Vehicle
   
   CompactSpot, RegularSpot, LargeSpot extend ParkingSpot

   Vehicle (abstract)
   ├── licensePlate: string
   ├── type: VehicleType
   
   Motorcycle, Car, Bus extend Vehicle
   \`\`\`

2. **Ticket System:**
   \`\`\`
   ParkingTicket
   ├── ticketId: string
   ├── vehicle: Vehicle
   ├── spot: ParkingSpot
   ├── entryTime: DateTime
   ├── exitTime: DateTime
   └── calculateFee(): Money
   \`\`\`

3. **Design Patterns:**
   - **Factory**: Create appropriate spot for vehicle type
   - **Strategy**: Different pricing strategies
   - **Observer**: Update display boards when spots change
   - **Singleton**: ParkingLot instance

4. **Concurrency:**
   - Lock spot during assignment
   - Optimistic locking for updates
   - Atomic operations for availability count`
  }
];

// ============ INTERVIEW CONFIGURATION ============

export const INTERVIEW_CONFIG = {
  // Standard interview modes
  modes: {
    quick: {
      name: "Quick Practice",
      description: "One problem, 30 minutes",
      totalTime: 30 * 60, // 30 minutes
      codingProblems: 1,
      behavioralQuestions: 0,
      systemDesign: false,
      difficultyProgression: false
    },
    standard: {
      name: "Standard Interview",
      description: "2 coding problems with behavioral questions",
      totalTime: 60 * 60, // 60 minutes
      codingProblems: 2,
      behavioralQuestions: 2,
      systemDesign: false,
      difficultyProgression: true // Easy → Medium
    },
    full: {
      name: "Full Interview Loop",
      description: "Complete interview simulation",
      totalTime: 90 * 60, // 90 minutes
      codingProblems: 3,
      behavioralQuestions: 3,
      systemDesign: false,
      difficultyProgression: true // Easy → Medium → Hard
    },
    systemDesign: {
      name: "System Design Focus",
      description: "System design with behavioral",
      totalTime: 60 * 60, // 60 minutes
      codingProblems: 0,
      behavioralQuestions: 2,
      systemDesign: true,
      difficultyProgression: false
    },
    comprehensive: {
      name: "Comprehensive Loop",
      description: "Coding + System Design + Behavioral",
      totalTime: 120 * 60, // 2 hours
      codingProblems: 2,
      behavioralQuestions: 3,
      systemDesign: true,
      difficultyProgression: true
    }
  },

  // Difficulty progression mapping
  difficultyProgression: {
    1: ["Easy"],
    2: ["Easy", "Medium"],
    3: ["Easy", "Medium", "Hard"],
    4: ["Easy", "Medium", "Medium", "Hard"]
  },

  // Timing allocations (in seconds)
  timing: {
    behavioralQuestion: 5 * 60, // 5 minutes per behavioral
    systemDesignIntro: 5 * 60, // 5 minutes for requirements clarification
    transitionBuffer: 1 * 60 // 1 minute between sections
  },

  // Scoring weights for final interview score
  scoring: {
    codingWeight: 0.5,
    behavioralWeight: 0.25,
    systemDesignWeight: 0.25,
    communicationBonus: 0.1 // Up to 10% bonus for good communication
  }
};

// ============ INTERVIEWER PERSONAS ============
// Different interviewer styles for variety

export const INTERVIEWER_PERSONAS = [
  {
    id: "friendly",
    name: "Alex",
    style: "Friendly & Encouraging",
    description: "Supportive interviewer who gives helpful hints",
    promptModifier: "Be warm, encouraging, and provide gentle guidance when the candidate is stuck."
  },
  {
    id: "neutral",
    name: "Jordan",
    style: "Professional & Neutral",
    description: "Standard professional interviewer",
    promptModifier: "Maintain a professional, neutral tone. Ask clarifying questions without giving away solutions."
  },
  {
    id: "challenging",
    name: "Morgan",
    style: "Challenging & Thorough",
    description: "Pushes candidates to think deeper",
    promptModifier: "Be more challenging. Ask follow-up questions, probe edge cases, and push the candidate to justify their choices."
  },
  {
    id: "senior",
    name: "Casey",
    style: "Senior Engineer Perspective",
    description: "Focuses on practical, production-ready code",
    promptModifier: "Evaluate like a senior engineer would. Focus on code quality, maintainability, and production considerations."
  }
];

// ============ FEEDBACK TEMPLATES ============

export const FEEDBACK_CATEGORIES = {
  problemSolving: {
    name: "Problem Solving",
    criteria: [
      "Understood the problem before coding",
      "Asked clarifying questions",
      "Considered edge cases",
      "Broke down the problem effectively"
    ]
  },
  coding: {
    name: "Coding Skills",
    criteria: [
      "Code correctness",
      "Code readability",
      "Appropriate data structures",
      "Efficient algorithm choice"
    ]
  },
  communication: {
    name: "Communication",
    criteria: [
      "Explained thought process clearly",
      "Responded well to feedback",
      "Asked good questions",
      "Managed time effectively"
    ]
  },
  behavioral: {
    name: "Behavioral",
    criteria: [
      "Clear and structured responses",
      "Relevant examples provided",
      "Showed self-awareness",
      "Demonstrated growth mindset"
    ]
  },
  systemDesign: {
    name: "System Design",
    criteria: [
      "Clarified requirements",
      "High-level design sensible",
      "Considered scalability",
      "Addressed trade-offs"
    ]
  }
};

// Helper functions
export const getRandomBehavioralQuestions = (count, excludeIds = []) => {
  const available = BEHAVIORAL_QUESTIONS.filter(q => !excludeIds.includes(q.id));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

export const getRandomSystemDesignProblem = (difficulty = null) => {
  let problems = SYSTEM_DESIGN_PROBLEMS;
  if (difficulty) {
    problems = problems.filter(p => p.difficulty === difficulty);
  }
  return problems[Math.floor(Math.random() * problems.length)];
};

export const getBehavioralsByCategory = (category) => {
  return BEHAVIORAL_QUESTIONS.filter(q => q.category === category);
};

export const getSystemDesignByDifficulty = (difficulty) => {
  return SYSTEM_DESIGN_PROBLEMS.filter(p => p.difficulty === difficulty);
};

export default {
  BEHAVIORAL_QUESTIONS,
  SYSTEM_DESIGN_PROBLEMS,
  INTERVIEW_CONFIG,
  INTERVIEWER_PERSONAS,
  FEEDBACK_CATEGORIES,
  getRandomBehavioralQuestions,
  getRandomSystemDesignProblem,
  getBehavioralsByCategory,
  getSystemDesignByDifficulty
};
