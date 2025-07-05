// for page navigation & to sort on leftbar

export type EachRoute = {
  title: string;
  href: string;
  noLink?: true; // noLink will create a route segment (section) but cannot be navigated
  items?: EachRoute[];
  tag?: string;
};

export const ROUTES: EachRoute[] = [
  {
    title: "Overview",
    href: "/overview",
    noLink: true,
    items: [
      { title: "Introduction", href: "/introduction" },
      { title: "Why Ideavo", href: "/why-ideavo" },
    ],
  },
  {
    title: "Build with Ideavo",
    href: "/build-with-ideavo",
    noLink: true,
    items: [
      { title: "Get Started", href: "/get-started" },
      { title: "AI Assistant", href: "/ai-assistant" },
      { title: "Workbench", href: "/workbench" },
      { title: "GitHub", href: "/github" },
      { title: "Deployment", href: "/deployment" },
    ],
  },
  {
    title: "Validate with Ideavo",
    href: "/validate-with-ideavo",
    noLink: true,
    items: [
      { title: "Get Started", href: "/get-started" },
      { title: "Understanding Scores", href: "/understanding-scores" },
    ],
  },
  {
    title: "Pricing",
    href: "/pricing",
    noLink: true,
    items: [
      { title: "Plans", href: "/plans" },
      { title: "Agent+", href: "/agent-plus" },
    ],
  },
];

type Page = { title: string; href: string };

function getRecurrsiveAllLinks(node: EachRoute) {
  const ans: Page[] = [];
  if (!node.noLink) {
    ans.push({ title: node.title, href: node.href });
  }
  node.items?.forEach((subNode) => {
    const temp = { ...subNode, href: `${node.href}${subNode.href}` };
    ans.push(...getRecurrsiveAllLinks(temp));
  });
  return ans;
}

export const page_routes = ROUTES.map((it) => getRecurrsiveAllLinks(it)).flat();
