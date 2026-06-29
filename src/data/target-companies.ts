// ---------------------------------------------------------------------------
// Curated target companies for FlytBase Talent Radar
// Tags: deeptech | startup | drone | high-agency | global-clientele |
//       aerospace | defense-adjacent | robotics | autonomous-vehicles |
//       embedded-systems | industrial-automation | b2b-enterprise |
//       india-origin-global | fast-growth | mission-critical |
//       large | mid-size
// ---------------------------------------------------------------------------

export interface TargetCompanySeed {
  name: string;
  linkedin_url: string;
  industry: string;
  why_similar: string; // short description
  tags: string[];
}

export const CURATED_COMPANIES: TargetCompanySeed[] = [

  // ── Drone / UAV Domain ────────────────────────────────────────────────────

  {
    name: "ideaForge Technology",
    linkedin_url: "https://www.linkedin.com/company/ideaforgetechnology/",
    industry: "Drone Technology",
    why_similar: "India's leading listed drone manufacturer; engineers have hands-on UAV hardware + software + defense deployment experience.",
    tags: ["drone", "deeptech", "defense-adjacent", "mission-critical", "mid-size"],
  },
  {
    name: "Garuda Aerospace",
    linkedin_url: "https://www.linkedin.com/company/garuda-aerospace/",
    industry: "Drone Technology",
    why_similar: "Sequoia-backed drone startup operating large commercial fleets across India; strong drone ops and engineering talent.",
    tags: ["drone", "startup", "fast-growth"],
  },
  {
    name: "Aarav Unmanned Systems",
    linkedin_url: "https://www.linkedin.com/company/aarav-unmanned-systems/",
    industry: "Drone Technology",
    why_similar: "VTOL drone startup with enterprise deployments; engineers understand full-stack drone autonomy.",
    tags: ["drone", "deeptech", "startup"],
  },
  {
    name: "Asteria Aerospace",
    linkedin_url: "https://www.linkedin.com/company/asteria-aerospace/",
    industry: "Drone Technology",
    why_similar: "Enterprise drone solutions, surveillance and mapping use cases; Bengaluru-based with defense clients.",
    tags: ["drone", "startup", "defense-adjacent"],
  },
  {
    name: "Skylark Drones",
    linkedin_url: "https://www.linkedin.com/company/skylark-drones/",
    industry: "Drone Technology",
    why_similar: "Drone services + analytics SaaS platform; combines field drone ops with data analytics product.",
    tags: ["drone", "startup", "industrial-automation"],
  },
  {
    name: "AERON Systems",
    linkedin_url: "https://www.linkedin.com/company/aeron-systems/",
    industry: "Drone Technology",
    why_similar: "Builds flight control systems and autopilots for UAVs; deep embedded + control systems expertise.",
    tags: ["drone", "deeptech", "embedded-systems", "startup"],
  },
  {
    name: "TechEagle",
    linkedin_url: "https://www.linkedin.com/company/techeagle/",
    industry: "Drone Technology",
    why_similar: "Drone delivery startup covering tier-2/3 India; strong execution culture on real-world drone ops.",
    tags: ["drone", "startup"],
  },
  {
    name: "Throttle Aerospace",
    linkedin_url: "https://www.linkedin.com/company/throttle-aerospace-systems/",
    industry: "Drone Technology",
    why_similar: "Drone propulsion and powertrain systems; niche deeptech embedded engineering talent.",
    tags: ["drone", "deeptech", "embedded-systems", "startup"],
  },

  // ── Engineering Services — Global Clients (Quest Global profile) ──────────

  {
    name: "Quest Global",
    linkedin_url: "https://www.linkedin.com/company/quest-global/",
    industry: "Engineering Services",
    why_similar: "Aerospace, defense, and energy engineering services from India HQ; engineers have deep domain knowledge and global client exposure.",
    tags: ["aerospace", "defense-adjacent", "embedded-systems", "global-clientele", "b2b-enterprise", "large"],
  },
  {
    name: "L&T Technology Services",
    linkedin_url: "https://www.linkedin.com/company/l-t-technology-services/",
    industry: "Engineering Services",
    why_similar: "Industrial, aerospace, and embedded engineering services with Fortune 500 global clients; strong systems engineering culture.",
    tags: ["aerospace", "industrial-automation", "embedded-systems", "global-clientele", "b2b-enterprise", "large"],
  },
  {
    name: "Cyient",
    linkedin_url: "https://www.linkedin.com/company/cyient/",
    industry: "Engineering Services",
    why_similar: "Aerospace, defense, and utilities engineering for global OEMs; engineers work on safety-critical systems for international clients.",
    tags: ["aerospace", "defense-adjacent", "embedded-systems", "global-clientele", "b2b-enterprise", "large"],
  },
  {
    name: "KPIT Technologies",
    linkedin_url: "https://www.linkedin.com/company/kpit/",
    industry: "Engineering Services",
    why_similar: "Automotive and autonomous systems engineering; strong ROS/embedded stack and global client exposure.",
    tags: ["autonomous-vehicles", "embedded-systems", "global-clientele", "b2b-enterprise", "mid-size"],
  },
  {
    name: "Tata Elxsi",
    linkedin_url: "https://www.linkedin.com/company/tata-elxsi/",
    industry: "Engineering Services",
    why_similar: "Embedded systems, automotive, aerospace, and media tech; combines design + engineering for global clients.",
    tags: ["embedded-systems", "aerospace", "global-clientele", "b2b-enterprise", "mid-size"],
  },
  {
    name: "Sasken Technologies",
    linkedin_url: "https://www.linkedin.com/company/sasken-technologies/",
    industry: "Engineering Services",
    why_similar: "Embedded and IoT engineering services for global semiconductor and device companies.",
    tags: ["embedded-systems", "industrial-automation", "global-clientele", "mid-size"],
  },
  {
    name: "Tata Technologies",
    linkedin_url: "https://www.linkedin.com/company/tata-technologies/",
    industry: "Engineering Services",
    why_similar: "Engineering services for automotive and industrial OEMs globally; strong CAD/embedded/systems engineering bench.",
    tags: ["embedded-systems", "global-clientele", "b2b-enterprise", "large"],
  },
  {
    name: "MTAR Technologies",
    linkedin_url: "https://www.linkedin.com/company/mtar-technologies/",
    industry: "Aerospace & Defense",
    why_similar: "Precision manufacturing for aerospace and defense with global clients; mission-critical engineering culture.",
    tags: ["aerospace", "defense-adjacent", "mission-critical", "global-clientele", "mid-size"],
  },

  // ── Autonomous Vehicles & Robotics ───────────────────────────────────────

  {
    name: "Ati Motors",
    linkedin_url: "https://www.linkedin.com/company/ati-motors/",
    industry: "Robotics",
    why_similar: "AMR/AGV startup for warehouses and factories; engineers work on full-stack autonomous navigation (similar tech to drone autonomy).",
    tags: ["robotics", "deeptech", "startup", "high-agency"],
  },
  {
    name: "Addverb Technologies",
    linkedin_url: "https://www.linkedin.com/company/addverb-technologies/",
    industry: "Robotics",
    why_similar: "Warehouse robotics and automation; strong robotics software + hardware integration team.",
    tags: ["robotics", "deeptech", "startup", "industrial-automation"],
  },
  {
    name: "GreyOrange",
    linkedin_url: "https://www.linkedin.com/company/greyorange/",
    industry: "Robotics",
    why_similar: "India-origin enterprise warehouse robotics platform deployed globally; engineers have autonomy + enterprise software experience.",
    tags: ["robotics", "deeptech", "india-origin-global", "global-clientele", "mission-critical", "fast-growth", "mid-size"],
  },
  {
    name: "Minus Zero",
    linkedin_url: "https://www.linkedin.com/company/minus-zero/",
    industry: "Autonomous Vehicles",
    why_similar: "Full-stack autonomous vehicle startup (Bengaluru); top-tier autonomy engineers, high-agency culture similar to FlytBase.",
    tags: ["autonomous-vehicles", "deeptech", "startup", "high-agency"],
  },
  {
    name: "Hi-Tech Robotic Systemz",
    linkedin_url: "https://www.linkedin.com/company/hi-tech-robotic-systemz/",
    industry: "Autonomous Vehicles",
    why_similar: "Autonomous last-mile and campus mobility vehicles; ROS-based autonomy stack.",
    tags: ["autonomous-vehicles", "robotics", "startup"],
  },
  {
    name: "Swaayatt Robots",
    linkedin_url: "https://www.linkedin.com/company/swaayatt-robots/",
    industry: "Autonomous Vehicles",
    why_similar: "Autonomous driving startup (Bhopal); deep research + applied autonomy engineering.",
    tags: ["autonomous-vehicles", "deeptech", "startup"],
  },
  {
    name: "CRON Systems",
    linkedin_url: "https://www.linkedin.com/company/cron-systems/",
    industry: "Security Technology",
    why_similar: "Perimeter security robotics for critical infrastructure; combines robotics + defense + enterprise sales.",
    tags: ["robotics", "deeptech", "startup", "defense-adjacent", "mission-critical"],
  },
  {
    name: "Omnipresent Robot Technologies",
    linkedin_url: "https://www.linkedin.com/company/omnipresent-robot-technologies/",
    industry: "Robotics",
    why_similar: "Ground robots for surveillance and industrial inspection; overlaps with drone use-cases.",
    tags: ["robotics", "startup", "defense-adjacent"],
  },

  // ── Defense & Security Tech ───────────────────────────────────────────────

  {
    name: "Tonbo Imaging",
    linkedin_url: "https://www.linkedin.com/company/tonbo-imaging/",
    industry: "Defense Technology",
    why_similar: "Defense-grade imaging and sensor systems sold globally; engineers have deep embedded vision and international enterprise client experience.",
    tags: ["deeptech", "defense-adjacent", "global-clientele", "embedded-systems", "startup"],
  },
  {
    name: "Tata Advanced Systems",
    linkedin_url: "https://www.linkedin.com/company/tata-advanced-systems/",
    industry: "Aerospace & Defense",
    why_similar: "Defense and aerospace manufacturing and integration with global partnerships (Lockheed, Boeing, Airbus).",
    tags: ["aerospace", "defense-adjacent", "global-clientele", "large"],
  },
  {
    name: "Data Patterns India",
    linkedin_url: "https://www.linkedin.com/company/data-patterns-india/",
    industry: "Defense Technology",
    why_similar: "Defense electronics for radar, avionics, and missiles; engineers have safety-critical embedded systems experience.",
    tags: ["embedded-systems", "deeptech", "defense-adjacent", "mid-size"],
  },
  {
    name: "Videonetics",
    linkedin_url: "https://www.linkedin.com/company/videonetics/",
    industry: "AI Security Technology",
    why_similar: "AI-powered video surveillance platform deployed across infrastructure globally; enterprise B2B with global clientele.",
    tags: ["deeptech", "defense-adjacent", "b2b-enterprise", "global-clientele", "startup"],
  },
  {
    name: "Alpha Design Technologies",
    linkedin_url: "https://www.linkedin.com/company/alpha-design-technologies/",
    industry: "Defense Technology",
    why_similar: "Defense and space electronics (EW systems, satellite subsystems); niche embedded engineering talent pool.",
    tags: ["defense-adjacent", "embedded-systems", "aerospace", "mid-size"],
  },

  // ── Industrial IoT & Deep Tech ────────────────────────────────────────────

  {
    name: "Detect Technologies",
    linkedin_url: "https://www.linkedin.com/company/detect-technologies/",
    industry: "Industrial AI",
    why_similar: "AI + drone-based industrial inspection for oil & gas globally; directly adjacent use-case to FlytBase, global enterprise clients.",
    tags: ["deeptech", "startup", "industrial-automation", "global-clientele", "mission-critical", "drone"],
  },
  {
    name: "Flutura Decision Sciences",
    linkedin_url: "https://www.linkedin.com/company/flutura-business-solutions-and-analytics/",
    industry: "Industrial IoT",
    why_similar: "Industrial IoT analytics for oil, gas, and manufacturing clients globally; B2B enterprise sales + data engineering talent.",
    tags: ["deeptech", "industrial-automation", "global-clientele", "b2b-enterprise", "startup"],
  },
  {
    name: "Prescinto Technologies",
    linkedin_url: "https://www.linkedin.com/company/prescinto/",
    industry: "Renewable Energy Tech",
    why_similar: "Solar and renewable energy IoT analytics platform; mission-critical monitoring for global energy clients.",
    tags: ["deeptech", "startup", "industrial-automation", "mission-critical"],
  },
  {
    name: "Atomberg Technologies",
    linkedin_url: "https://www.linkedin.com/company/atomberg-technologies/",
    industry: "Smart Hardware",
    why_similar: "IoT-enabled smart energy products; strong embedded + product engineering culture, fast-growth startup.",
    tags: ["deeptech", "startup", "fast-growth", "embedded-systems"],
  },
  {
    name: "Intangles Lab",
    linkedin_url: "https://www.linkedin.com/company/intangles/",
    industry: "Vehicle IoT",
    why_similar: "Vehicle IoT and telematics platform with global fleet clients; embedded + cloud data engineering.",
    tags: ["deeptech", "startup", "global-clientele", "embedded-systems"],
  },
  {
    name: "E-con Systems",
    linkedin_url: "https://www.linkedin.com/company/e-consystems/",
    industry: "Embedded Vision",
    why_similar: "Embedded camera and vision system company (used in drones/robotics globally); strong embedded engineering talent.",
    tags: ["embedded-systems", "global-clientele", "mid-size"],
  },

  // ── Space Tech ────────────────────────────────────────────────────────────

  {
    name: "Pixxel",
    linkedin_url: "https://www.linkedin.com/company/pixxel/",
    industry: "Space Technology",
    why_similar: "Earth observation satellite startup; high-agency engineering culture, global data clients, overlapping sensor + analytics domain.",
    tags: ["aerospace", "deeptech", "startup", "high-agency", "global-clientele"],
  },
  {
    name: "SkyRoot Aerospace",
    linkedin_url: "https://www.linkedin.com/company/skyroot-aerospace/",
    industry: "Space Technology",
    why_similar: "India's first private orbital rocket company; mission-critical engineering, top-tier propulsion and avionics engineers.",
    tags: ["aerospace", "deeptech", "startup", "high-agency", "mission-critical"],
  },
  {
    name: "Agnikul Cosmos",
    linkedin_url: "https://www.linkedin.com/company/agnikul/",
    industry: "Space Technology",
    why_similar: "Additive-manufactured rockets; pioneering deeptech with strong avionics and embedded systems talent.",
    tags: ["aerospace", "deeptech", "startup", "high-agency"],
  },

  // ── B2B SaaS — India Origin, Global Revenue ───────────────────────────────
  // For sales, marketing, BD, HR, PM, and software engineering talent

  {
    name: "Freshworks",
    linkedin_url: "https://www.linkedin.com/company/freshworks-inc/",
    industry: "B2B SaaS",
    why_similar: "India's largest public SaaS company with a global GTM motion; people with enterprise B2B sales and marketing experience selling to international clients.",
    tags: ["b2b-enterprise", "india-origin-global", "global-clientele", "fast-growth", "high-agency", "large"],
  },
  {
    name: "Zoho",
    linkedin_url: "https://www.linkedin.com/company/zoho/",
    industry: "B2B SaaS",
    why_similar: "Bootstrapped SaaS empire with deep global sales and product culture; ownership-first mindset matches FlytBase values.",
    tags: ["b2b-enterprise", "india-origin-global", "global-clientele", "large"],
  },
  {
    name: "Chargebee",
    linkedin_url: "https://www.linkedin.com/company/chargebee/",
    industry: "B2B SaaS",
    why_similar: "Subscription management SaaS, Series G, strong global sales team (US/Europe/APAC); high-agency culture.",
    tags: ["b2b-enterprise", "india-origin-global", "global-clientele", "fast-growth", "high-agency", "mid-size"],
  },
  {
    name: "BrowserStack",
    linkedin_url: "https://www.linkedin.com/company/browserstack/",
    industry: "B2B SaaS",
    why_similar: "$4B valuation, India-founded dev-tools SaaS; global sales + engineering teams with strong ownership culture.",
    tags: ["b2b-enterprise", "india-origin-global", "global-clientele", "fast-growth", "high-agency", "mid-size"],
  },
  {
    name: "Icertis",
    linkedin_url: "https://www.linkedin.com/company/icertis/",
    industry: "Enterprise SaaS",
    why_similar: "Contract intelligence platform for Fortune 500 clients globally; India-founded, Pune + Seattle HQ, deep enterprise sales experience.",
    tags: ["b2b-enterprise", "india-origin-global", "global-clientele", "mission-critical", "fast-growth", "mid-size"],
  },
  {
    name: "Druva",
    linkedin_url: "https://www.linkedin.com/company/druva-inc/",
    industry: "Enterprise SaaS",
    why_similar: "Data protection cloud, India-founded, global enterprise clients; mission-critical sales and engineering talent.",
    tags: ["b2b-enterprise", "india-origin-global", "global-clientele", "mission-critical", "fast-growth", "mid-size"],
  },
  {
    name: "Postman",
    linkedin_url: "https://www.linkedin.com/company/postman-platform/",
    industry: "Developer Tools SaaS",
    why_similar: "API platform used by 30M developers globally; India-origin, SF HQ, high-agency engineering + product culture.",
    tags: ["b2b-enterprise", "india-origin-global", "global-clientele", "fast-growth", "high-agency", "mid-size"],
  },
  {
    name: "Whatfix",
    linkedin_url: "https://www.linkedin.com/company/whatfix/",
    industry: "B2B SaaS",
    why_similar: "Digital adoption SaaS with global enterprise clients; India-founded, strong US sales motion.",
    tags: ["b2b-enterprise", "india-origin-global", "global-clientele", "fast-growth", "mid-size"],
  },
  {
    name: "Mindtickle",
    linkedin_url: "https://www.linkedin.com/company/mindtickle/",
    industry: "Sales Enablement SaaS",
    why_similar: "Sales enablement platform, India-founded, $100M+ ARR; sales professionals here have sold globally in enterprise B2B.",
    tags: ["b2b-enterprise", "india-origin-global", "global-clientele", "fast-growth", "mid-size"],
  },
  {
    name: "Darwinbox",
    linkedin_url: "https://www.linkedin.com/company/darwinbox/",
    industry: "HR Tech SaaS",
    why_similar: "HR SaaS expanding across Asia, Middle East, and global markets; strong enterprise sales + people & culture talent.",
    tags: ["b2b-enterprise", "india-origin-global", "global-clientele", "fast-growth", "mid-size"],
  },
  {
    name: "Innovaccer",
    linkedin_url: "https://www.linkedin.com/company/innovaccer/",
    industry: "Healthcare Data SaaS",
    why_similar: "Healthcare data cloud with US enterprise clients; mission-critical B2B with a strong India engineering + sales team.",
    tags: ["deeptech", "b2b-enterprise", "global-clientele", "mission-critical", "fast-growth", "mid-size"],
  },
  {
    name: "Highradius",
    linkedin_url: "https://www.linkedin.com/company/highradius/",
    industry: "Fintech SaaS",
    why_similar: "AI-powered fintech SaaS for Fortune 500 AR/treasury; India-founded unicorn with strong global enterprise sales.",
    tags: ["b2b-enterprise", "india-origin-global", "global-clientele", "fast-growth", "large"],
  },
  {
    name: "Zenoti",
    linkedin_url: "https://www.linkedin.com/company/zenoti/",
    industry: "B2B SaaS",
    why_similar: "Wellness and salon SaaS, Hyderabad-founded, dominant in US/ANZ markets; strong enterprise account management culture.",
    tags: ["b2b-enterprise", "india-origin-global", "global-clientele", "fast-growth", "mid-size"],
  },
  {
    name: "Uniphore",
    linkedin_url: "https://www.linkedin.com/company/uniphore/",
    industry: "Conversational AI",
    why_similar: "Conversational AI for enterprise, global clients across US/Europe/APAC; deeptech + B2B enterprise culture.",
    tags: ["deeptech", "b2b-enterprise", "global-clientele", "fast-growth", "mid-size"],
  },
  {
    name: "Kore.ai",
    linkedin_url: "https://www.linkedin.com/company/kore-ai/",
    industry: "Enterprise AI",
    why_similar: "Enterprise conversational AI platform (Fortune 500 clients); strong India engineering + global enterprise sales.",
    tags: ["deeptech", "b2b-enterprise", "global-clientele", "fast-growth", "mid-size"],
  },
  {
    name: "Yellow.ai",
    linkedin_url: "https://www.linkedin.com/company/yellowai/",
    industry: "Conversational AI",
    why_similar: "Conversational AI SaaS, 1000+ global enterprise clients; India-founded with aggressive global expansion.",
    tags: ["deeptech", "b2b-enterprise", "india-origin-global", "global-clientele", "fast-growth", "mid-size"],
  },
  {
    name: "MoEngage",
    linkedin_url: "https://www.linkedin.com/company/moengage/",
    industry: "Marketing Tech SaaS",
    why_similar: "Customer engagement SaaS with global clients; India-founded, strong marketing and product talent.",
    tags: ["b2b-enterprise", "india-origin-global", "global-clientele", "fast-growth", "mid-size"],
  },
  {
    name: "CleverTap",
    linkedin_url: "https://www.linkedin.com/company/clevertap/",
    industry: "Marketing Tech SaaS",
    why_similar: "Mobile marketing SaaS deployed globally; India-founded unicorn, global sales and marketing talent.",
    tags: ["b2b-enterprise", "india-origin-global", "global-clientele", "fast-growth", "mid-size"],
  },
  {
    name: "Leadsquared",
    linkedin_url: "https://www.linkedin.com/company/leadsquared/",
    industry: "CRM SaaS",
    why_similar: "Sales CRM built for high-velocity B2B sales teams; India-origin, global clients, strong sales ops culture.",
    tags: ["b2b-enterprise", "india-origin-global", "global-clientele", "fast-growth", "mid-size"],
  },
  {
    name: "Capillary Technologies",
    linkedin_url: "https://www.linkedin.com/company/capillary-technologies/",
    industry: "Retail Tech SaaS",
    why_similar: "Retail loyalty SaaS across Asia, Middle East, and global markets; enterprise sales + customer success talent.",
    tags: ["b2b-enterprise", "india-origin-global", "global-clientele", "mid-size"],
  },
  {
    name: "Observe.AI",
    linkedin_url: "https://www.linkedin.com/company/observeai/",
    industry: "Contact Center AI",
    why_similar: "AI for enterprise contact centers; US enterprise clients, India engineering + sales, high-growth deeptech.",
    tags: ["deeptech", "b2b-enterprise", "global-clientele", "fast-growth", "mid-size"],
  },
  {
    name: "Vymo",
    linkedin_url: "https://www.linkedin.com/company/getvymo/",
    industry: "Sales Performance SaaS",
    why_similar: "AI-powered sales performance platform for financial services globally; enterprise sales + analytics.",
    tags: ["b2b-enterprise", "global-clientele", "startup"],
  },
  {
    name: "Exotel",
    linkedin_url: "https://www.linkedin.com/company/exotel/",
    industry: "Cloud Communications SaaS",
    why_similar: "Cloud communications SaaS across India, SEA, and ME; India-origin with international enterprise client base.",
    tags: ["b2b-enterprise", "india-origin-global", "global-clientele", "fast-growth", "mid-size"],
  },

  // ── Geospatial & Mapping ──────────────────────────────────────────────────

  {
    name: "MapmyIndia (CE Info Systems)",
    linkedin_url: "https://www.linkedin.com/company/mapmyindia/",
    industry: "Geospatial Technology",
    why_similar: "India's mapping platform expanding globally; combines SaaS + geospatial data, adjacent to drone mapping use-cases.",
    tags: ["deeptech", "india-origin-global", "b2b-enterprise", "global-clientele", "mid-size"],
  },
  {
    name: "Genesys International",
    linkedin_url: "https://www.linkedin.com/company/genesys-international-corporation/",
    industry: "Geospatial Services",
    why_similar: "Geospatial data collection and mapping services for global clients; field-tech + data engineering experience.",
    tags: ["global-clientele", "industrial-automation", "mid-size"],
  },

  // ── High-Agency Startups (culture fit across functions) ───────────────────

  {
    name: "Sarvam AI",
    linkedin_url: "https://www.linkedin.com/company/sarvam-ai/",
    industry: "AI Research & Products",
    why_similar: "Indian AI startup (language models + products); top-tier engineers with high-agency, mission-driven culture matching FlytBase.",
    tags: ["deeptech", "startup", "high-agency"],
  },
  {
    name: "Zetwerk",
    linkedin_url: "https://www.linkedin.com/company/zetwerk/",
    industry: "Manufacturing B2B",
    why_similar: "B2B manufacturing marketplace (unicorn); global supply chain clients, strong enterprise sales + ops culture.",
    tags: ["b2b-enterprise", "fast-growth", "india-origin-global", "global-clientele", "industrial-automation"],
  },
  {
    name: "Niramai Health Analytix",
    linkedin_url: "https://www.linkedin.com/company/niramai/",
    industry: "AI Health Tech",
    why_similar: "AI + thermal imaging for early cancer screening; deeptech startup with hardware-software integration and global partnerships.",
    tags: ["deeptech", "startup", "global-clientele", "embedded-systems"],
  },

];

export const ALL_TAGS = [
  "deeptech",
  "startup",
  "drone",
  "high-agency",
  "global-clientele",
  "aerospace",
  "defense-adjacent",
  "robotics",
  "autonomous-vehicles",
  "embedded-systems",
  "industrial-automation",
  "b2b-enterprise",
  "india-origin-global",
  "fast-growth",
  "mission-critical",
  "large",
  "mid-size",
] as const;

export type CompanyTag = (typeof ALL_TAGS)[number];
