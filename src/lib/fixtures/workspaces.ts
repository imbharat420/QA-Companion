import type { Workspace, WorkspaceFolder, WorkspaceState } from "@/lib/api/types";

/**
 * `thumbnail` held a remote Unsplash URL in the prototype. A desktop build must
 * never reach the network to paint its own chrome, so the field now carries a
 * "gradient:<chart-token>" recipe the card resolves to a local CSS gradient.
 */
export const WORKSPACES: Workspace[] = [
  {
    id: "ws-001",
    name: "blixen-tours",
    path: "~/projects/blixen-tours",
    framework: "Next.js 15",
    branch: "main · 91ac2f",
    sessions: 14,
    tests: 384,
    lastActive: "2 min ago",
    health: 98,
    description:
      "Full-stack luxury Nordic expedition booking platform with SSR tour catalogs, Stripe payment gateway, and Playwright E2E suites.",
    devCommand: "npm run dev -- -p 3000",
    testCommand: "npx playwright test e2e/checkout.spec.ts --headed",
    gitUrl: "https://github.com/blixen/tours-web",
    category: "Web Application",
    starred: true,
    thumbnail: "gradient:chart-1",
    owner: { name: "Bharat (You)", avatar: "B" },
    folder: "Local Workspaces",
  },
  {
    id: "ws-002",
    name: "ecommerce-agent",
    path: "~/projects/ecommerce-agent",
    framework: "Remix",
    branch: "feat/cart-v2 · b21d9a",
    sessions: 32,
    tests: 511,
    lastActive: "1 day ago",
    health: 87,
    description:
      "Autonomous e-commerce cart and multi-vendor checkout orchestrator with real-time inventory checking and API contract validation.",
    devCommand: "pnpm run dev",
    testCommand: "npx playwright test e2e/cart.spec.ts",
    gitUrl: "https://github.com/agent-corp/ecommerce-agent",
    category: "E-Commerce",
    starred: false,
    thumbnail: "gradient:chart-2",
    owner: { name: "Bharat (You)", avatar: "B" },
    folder: "GitHub Repositories",
  },
  {
    id: "ws-003",
    name: "photoshop-clone",
    path: "~/projects/photoshop-clone",
    framework: "Vite + React",
    branch: "main · 8fe10c",
    sessions: 6,
    tests: 92,
    lastActive: "4 days ago",
    health: 74,
    description:
      "High-performance WebGL-accelerated canvas graphics editor for layer masks, image filtering, and visual regression testing.",
    devCommand: "vite --port 5173",
    testCommand: "npm run test:visual-regression",
    gitUrl: "https://github.com/design-lab/canvas-editor",
    category: "Design Tool",
    starred: true,
    thumbnail: "gradient:chart-3",
    owner: { name: "Bharat (You)", avatar: "B" },
    folder: "Local Workspaces",
  },
  {
    id: "ws-004",
    name: "EarthFund",
    path: "~/projects/earthfund",
    framework: "Next.js 14",
    branch: "main · e7410c",
    sessions: 19,
    tests: 245,
    lastActive: "5 hours ago",
    health: 94,
    description:
      "Decentralized climate initiative treasury and grants allocation portal with smart contract verification and accessibility audit.",
    devCommand: "npm run dev",
    testCommand: "npx playwright test tests/grants.spec.ts",
    gitUrl: "https://github.com/earthfund/dao-platform",
    category: "Web3 / Grants",
    starred: false,
    thumbnail: "gradient:chart-4",
    owner: { name: "Bharat (You)", avatar: "B" },
    folder: "Uploads",
  },
  {
    id: "ws-005",
    name: "Stack Design System",
    path: "~/projects/stack-ds",
    framework: "React 19 + Tailwind",
    branch: "main · a19d3f",
    sessions: 41,
    tests: 618,
    lastActive: "30 min ago",
    health: 99,
    description:
      "Enterprise accessible component library and cyber-tactical token system with automated Storybook visual regression testing.",
    devCommand: "pnpm storybook --port 6006",
    testCommand: "npm run test:components",
    gitUrl: "https://github.com/stack-org/design-system",
    category: "Design System",
    starred: true,
    thumbnail: "gradient:chart-5",
    owner: { name: "Design Team", avatar: "D" },
    folder: "Uploads",
  },
];

/** Counts are the real tallies of the `folder` field above. */
export const WORKSPACE_FOLDERS: WorkspaceFolder[] = [
  { id: "fold-local", name: "Local Workspaces", count: 2, colorToken: "chart-1" },
  { id: "fold-github", name: "GitHub Repositories", count: 1, colorToken: "chart-3" },
  { id: "fold-uploads", name: "Uploads", count: 2, colorToken: "chart-2" },
];

export const WORKSPACE_STATES: Record<string, WorkspaceState> = {
  "ws-001": "ready",
  "ws-002": "indexing",
  "ws-003": "ready",
  "ws-004": "uploading",
  "ws-005": "error",
};
