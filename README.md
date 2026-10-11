# lemonbuilder.github.io

**NONLINEAR BY NATURE** — a map of connected life nodes.

🔗 https://lemonbuilder.github.io

A path that never moved in a straight line: across the public sector, industry, academia, and civil society, from urban planning reviews to AI research on factory floors, from protecting dolphins with drones to exploring space ventures. Instead of a résumé that lists these one after another, this page draws them as a constellation — experiences, domains, organizations, interests, and possibilities not yet reached, all connected to one another.

## What the page shows

- **The map** — The hub sits at the center. Experiences surround it, and around them are the domains, organizations, and interests they connect to. Dashed circles are possibilities: directions still open for the next step.
- **Hover** over a node to see what it connects to. The map gently reshapes itself around that node.
- **Click** a node to open its detail page, with the story told in text, images, and videos.

## How it is built

The page is meant to keep growing, not to be a finished document. Structure and stories are kept separate:

```
index.html            the page itself (header, map, detail view)
assets/
  css/style.css       styles
  js/app.js           map layout, hover and click interactions, detail pages, local editing
  vendor/             libraries (d3, marked)
data/graph.json       every node, type, and connection on the map
content/<node-id>.md  the story behind each node, written in Markdown
uploads/              images and videos used in the stories
tools/serve.py        a small local server for editing the page on a Mac
```

## Editing

Content is edited locally with `tools/serve.py`, which adds an in-page editor for nodes, connections, and stories. The published site is read-only.

## Rules in `data/graph.json`

- The hub connects to every node automatically, except possibilities.
- `orbit` marks a possibility that belongs to a single node; it is placed outside that node like a satellite.
- `edges` are pairs like `[a, b]`; `[a, b, "core"]` marks a core connection and draws it as a thicker line.
- `shift: [dx, dy]` nudges a node's position by hand.
- `hoverLabel` and `detailLabel` show a different name on hover or on the detail page.

This constellation is unfinished on purpose. A new node joins whenever something new begins.
