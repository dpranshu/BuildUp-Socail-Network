export type Post = {
  id: number;
  author: string;
  handle: string;
  title: string;
  body: string;
  tags: string[];
  likes: number;
  comments: number;
  readTime: string;
};

export const mockPosts: Post[] = [
  {
    id: 1,
    author: "Ari Bloom",
    handle: "@studentbuilder",
    title: "Building my first product",
    body:
      "I started a tiny project this week to help creators organize their ideas. I am learning that the hardest part is not the code — it is figuring out the real problem and talking to the right people. This is messy, but it feels real.",
    tags: ["#buildinpublic", "#founderjourney"],
    likes: 248,
    comments: 27,
    readTime: "3 min read",
  },
  {
    id: 2,
    author: "Mila Sato",
    handle: "@designsprints",
    title: "Looking for a dev to collab",
    body:
      "I am designing a portfolio site for a creator brand and need a developer who enjoys thoughtful UX and small but ambitious projects. If you like clean, useful design with strong product thinking, send me a message.",
    tags: ["#collab", "#design"],
    likes: 432,
    comments: 41,
    readTime: "2 min read",
  },
  {
    id: 3,
    author: "Noah Lane",
    handle: "@remoteandwild",
    title: "Remote work + travel is not the dream I imagined",
    body:
      "I thought freedom meant being anywhere and working with zero pressure. Then I realized I still need structure, deep work, and real financial systems. This week I am building a better setup for sustainable freedom.",
    tags: ["#travel", "#life"],
    likes: 315,
    comments: 22,
    readTime: "4 min read",
  },
];

export const profileData = {
  name: "Ari Bloom",
  handle: "@studentbuilder",
  role: "Product builder • UX learner • indie thinker",
  bio:
    "Building a life around curiosity, product thinking, and real work. Sharing experiments, mistakes, and momentum in public.",
  stats: {
    followers: 12800,
    following: 340,
    posts: 47,
    projects: 9,
  },
};
