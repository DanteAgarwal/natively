export type AudienceType =
  | 'technical' // Technical Interviewer / Senior Engineer / Architect
  | 'manager'   // Hiring Manager / Team Lead
  | 'hr'        // HR / Recruiter / Talent Acquisition
  | 'executive' // Director / VP / Executive
  | 'client'    // Client / Customer / Stakeholder
  | 'custom';   // Custom audience specified by user

export type ResponseStyle =
  | 'conversational' // Natural spoken first-person sentences
  | 'star'           // STAR method (Situation, Task, Action, Result)
  | 'concise'        // Crisp, punchy bullets (under 60s read)
  | 'deep_dive';     // In-depth technical architecture & trade-offs

export interface UserProfileContext {
  enabled: boolean;
  candidateName: string;
  candidateTitle: string;
  yearsOfExperience: string;
  currentCompany: string;
  keySkills: string;          // e.g. "React, TypeScript, Go, Microservices, System Design"
  resumeText: string;         // Full resume or career highlights
  targetRole: string;         // e.g. "Senior Full-Stack Engineer"
  targetCompany: string;      // e.g. "Stripe", "Google", "Fintech Startup"
  jobDescription: string;     // Full JD text or core requirements
  audienceType: AudienceType;
  audienceCustomNotes: string;// e.g. "Emphasizes latency, high concurrency, and clean code"
  responseStyle: ResponseStyle;
  keyHighlights: string;      // Projects/achievements to ALWAYS weave into answers
  avoidTopics: string;        // Things NOT to bring up (e.g. gaps, unused tools)
}

export const DEFAULT_USER_PROFILE_CONTEXT: UserProfileContext = {
  enabled: false,
  candidateName: '',
  candidateTitle: '',
  yearsOfExperience: '',
  currentCompany: '',
  keySkills: '',
  resumeText: '',
  targetRole: '',
  targetCompany: '',
  jobDescription: '',
  audienceType: 'technical',
  audienceCustomNotes: '',
  responseStyle: 'conversational',
  keyHighlights: '',
  avoidTopics: '',
};

export const SAMPLE_PROFILES: Record<string, { label: string; description: string; data: Partial<UserProfileContext> }> = {
  fullstack: {
    label: 'Senior Full-Stack Engineer',
    description: 'React, Node/TypeScript, Go, High Traffic, Latency Optimization',
    data: {
      enabled: true,
      candidateName: 'Alex Rivera',
      candidateTitle: 'Senior Full-Stack Engineer',
      yearsOfExperience: '6+ years',
      currentCompany: 'Fintech Solutions',
      keySkills: 'TypeScript, React, Next.js, Node.js, Go, PostgreSQL, Redis, Docker, Kubernetes, AWS, System Design',
      resumeText: `EXPERIENCE:
Senior Full-Stack Engineer — Fintech Solutions (2022 - Present)
- Architected high-throughput checkout orchestration engine processing $15M+ daily volume using Go microservices and React frontend.
- Decreased API p99 latency by 45% (from 420ms to 230ms) by implementing Redis write-through caching and optimized SQL execution plans.
- Mentored 4 mid-level engineers, established automated CI/CD deployment pipelines, and drove 99.98% service uptime.

Software Engineer — CloudScale Labs (2019 - 2022)
- Built interactive analytics dashboards with React, TailwindCSS, and WebSocket real-time event streaming.
- Migrated monolithic legacy service into modular Node.js/TypeScript microservices with zero downtime.`,
      targetRole: 'Senior Full-Stack Engineer',
      targetCompany: 'Stripe',
      jobDescription: `ROLE OVERVIEW:
We are looking for a Senior Full-Stack Engineer to build the next generation of global payments and financial infrastructure.
REQUIREMENTS:
- 5+ years of software engineering experience across frontend and backend.
- Deep expertise in TypeScript, React, and modern backend languages (Go, Java, or Node.js).
- Strong experience designing reliable distributed systems, API design, database modeling, and high-availability services.
- Passion for developer experience, clean maintainable code, and high operational excellence.`,
      audienceType: 'technical',
      audienceCustomNotes: 'Interviewer is a Principal Engineer. Values algorithmic trade-offs, concurrency handling, database indexing, and fault tolerance.',
      responseStyle: 'conversational',
      keyHighlights: '1. Reduced p99 latency by 45% using Go + Redis caching.\n2. Architected checkout handling $15M/day volume.\n3. Mentored 4 engineers and established CI/CD.',
      avoidTopics: 'Do not focus on basic CSS styling; emphasize system architecture, reliability, and backend scalability.',
    },
  },
  backend: {
    label: 'Staff Backend / Systems Engineer',
    description: 'Distributed Systems, High Concurrency, Kafka, Cloud Infra',
    data: {
      enabled: true,
      candidateName: 'Jordan Chen',
      candidateTitle: 'Staff Backend Systems Engineer',
      yearsOfExperience: '8+ years',
      currentCompany: 'HyperScale Data Inc.',
      keySkills: 'Go, Rust, Python, Kafka, gRPC, Cassandra, PostgreSQL, Kubernetes, Terraform, Distributed Consensus, Observability',
      resumeText: `EXPERIENCE:
Staff Backend Engineer — HyperScale Data (2021 - Present)
- Led distributed streaming ingestion pipeline on Kafka & Go processing 250k events/sec with sub-50ms end-to-end latency.
- Authored multi-region database replication strategy reducing failover recovery time from 15 mins to <20 seconds.
- Spearheaded company-wide migration to gRPC microservices, slashing network overhead by 35%.`,
      targetRole: 'Staff Infrastructure / Backend Engineer',
      targetCompany: 'Datadog',
      jobDescription: `REQUIREMENTS:
- Proven experience building planet-scale distributed telemetry systems.
- Strong proficiency in Go, Rust, or C++.
- Deep knowledge of distributed consensus, message brokers (Kafka/Pulsar), and high-throughput data pipelines.`,
      audienceType: 'technical',
      audienceCustomNotes: 'Focus on distributed failure scenarios, partition tolerance, and tail latency mitigation.',
      responseStyle: 'deep_dive',
      keyHighlights: 'Processing 250k events/sec on Kafka + Go with sub-50ms latency. Multi-region failover <20s.',
      avoidTopics: 'Avoid deep UI/frontend discussions.',
    },
  },
  manager: {
    label: 'Engineering Manager / Team Lead',
    description: 'Technical Leadership, People Management, Agile Delivery, Strategy',
    data: {
      enabled: true,
      candidateName: 'Samira Patel',
      candidateTitle: 'Engineering Manager',
      yearsOfExperience: '9+ years (4 yrs management)',
      currentCompany: 'NextGen SaaS',
      keySkills: 'Technical Leadership, People Management, System Architecture, Agile/Scrum, OKRs, Mentorship, Cross-Functional Execution',
      resumeText: `EXPERIENCE:
Engineering Manager — NextGen SaaS (2021 - Present)
- Built and led an organization of 12 engineers across 2 squads delivering core enterprise authentication and billing features.
- Reduced engineer voluntary turnover to 0% across 2 consecutive years through structured career ladders and coaching.
- Partnered with Product & Design to deliver major platform redesign 2 weeks ahead of schedule, increasing user retention by 22%.`,
      targetRole: 'Engineering Manager — Core Platform',
      targetCompany: 'Shopify',
      jobDescription: `REQUIREMENTS:
- 3+ years managing high-performing engineering teams.
- Strong technical grounding to partner with Staff Engineers on architectural decisions.
- Proven track record of hiring, growing, and retaining top engineering talent.`,
      audienceType: 'manager',
      audienceCustomNotes: 'Interviewer is VP of Engineering. Focus on strategic alignment, handling team conflicts, and delivering predictable business results.',
      responseStyle: 'star',
      keyHighlights: '0% voluntary turnover in 2 years; delivered redesign 2 weeks early with 22% retention boost.',
      avoidTopics: 'Avoid appearing detached from technology, but do not micromanage technical implementation in answers.',
    },
  },
};
