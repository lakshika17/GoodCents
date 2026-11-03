export const pageHead = (title: string, description: string) => () => ({
  meta: [
    { title: `${title} · AI CFO` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} · AI CFO` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});
