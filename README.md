# lemonbuilder.github.io

**NONLINEAR BY NATURE** — a map of the connected nodes of my life.

🔗 https://lemonbuilder.github.io

I have never moved in a straight line. I have worked across the public sector, industry, academia, and civil society, from urban planning reviews to AI research on factory floors, from protecting dolphins with drones to exploring space ventures. Instead of a résumé that lists these one after another, I built this page as a constellation: my experiences, domains, organizations, interests, and the possibilities I have not reached yet, all connected to one another.

## What you will see

- **The map** — I sit at the center as the hub. Around me are my experiences, and around them are the domains, organizations, and interests they connect to. Dashed circles are possibilities: directions I could grow into next.
- **Hover** over a node to see what it connects to. The map gently reshapes itself around that node.
- **Click** a node to open its detail page, where I describe the work with text, images, and videos.

## How I built it

I wanted a page that I could keep growing, not a finished document. So I keep the structure and the stories separate:

```
index.html            the page itself (header, map, detail view)
assets/
  css/style.css       styles
  js/app.js           map layout, hover and click interactions, detail pages, local editing
  vendor/             libraries I use (d3, marked)
data/graph.json       every node, type, and connection on the map
content/<node-id>.md  the story behind each node, written in Markdown
uploads/              images and videos used in the stories
tools/serve.py        a small local server I use to edit the page on my Mac
```

## How I keep it updated

1. I start my local editor from the repository root:

   ```
   python3 tools/serve.py
   ```

2. At http://127.0.0.1:8080/, I open any node and press **✎ Edit**. From there I can rename a node, change its type, rewrite its summary, add or remove connections, and write the story with images. Saving writes straight to `data/graph.json`, `content/`, and `uploads/`.
3. I commit the changes and push to `main`. GitHub Pages publishes them within a minute or two.

The published site has no editing server, so the Edit button stays hidden and visitors can only view.

## A few rules I follow in `data/graph.json`

- The hub connects to every node automatically, except possibilities.
- `orbit` marks a possibility that belongs to a single node; it is placed outside that node like a satellite.
- `edges` are pairs like `[a, b]`; `[a, b, "core"]` marks a core connection and draws it as a thicker line.
- `shift: [dx, dy]` lets me nudge a node's position by hand.
- `hoverLabel` and `detailLabel` let a node show a different name on hover or on its detail page.

This constellation is unfinished on purpose. I add a new node whenever I start something new.
