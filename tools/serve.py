# 로컬 미리보기 + 편집 서버 (내 Mac 전용)
# 실행 (저장소 루트에서): python3 tools/serve.py  →  http://127.0.0.1:8080/
#
# - 캐시를 꺼서 파일을 고치면 새로고침만으로 바로 반영된다.
# - 상세 페이지의 ✎ Edit 저장:
#     노드 이름·타입·연결 → data/graph.json
#     본문(Story)        → content/<노드id>.md
#     그림               → uploads/
# - 127.0.0.1 에만 열려서 같은 와이파이의 다른 기기에서도 접근할 수 없다.
# - 게시할 때는 이 파일 없이 나머지 파일만 올리면 된다 (편집 버튼은 자동으로 숨겨진다).
import functools
import http.server
import json
import pathlib
import re
import threading
import time
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent   # 저장소 루트
GRAPH = ROOT / "data" / "graph.json"
CONTENT = ROOT / "content"
UPLOADS = ROOT / "uploads"
NODE_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"}
MAX_UPLOAD = 25 * 1024 * 1024
PORT = 8080
lock = threading.Lock()


def dump_graph(g):
    """사람이 읽고 고치기 쉽게: 타입·노드·연결을 한 줄에 하나씩."""
    j = lambda v: json.dumps(v, ensure_ascii=False)
    out = ["{"]
    for k in [k for k in g if k not in ("types", "nodes", "edges")]:
        out.append(f"  {j(k)}: {j(g[k])},")
    out.append('  "types": {')
    items = list(g["types"].items())
    out += [f"    {j(k)}: {j(v)}{',' if i < len(items) - 1 else ''}" for i, (k, v) in enumerate(items)]
    out.append("  },")
    out.append('  "nodes": [')
    out += [f"    {j(n)}{',' if i < len(g['nodes']) - 1 else ''}" for i, n in enumerate(g["nodes"])]
    out.append("  ],")
    out.append('  "edges": [')
    out += [f"    {j(e)}{',' if i < len(g['edges']) - 1 else ''}" for i, e in enumerate(g["edges"])]
    out.append("  ]")
    out.append("}")
    return "\n".join(out) + "\n"


def update_node(node_id, payload):
    """노드 하나의 이름·타입·연결을 바꾼다. 허브 연결과 이 노드의 위성은 자동이라 건드리지 않는다."""
    g = json.loads(GRAPH.read_text(encoding="utf-8"))
    types = g["types"]
    nodes = {n["id"]: n for n in g["nodes"]}
    n = nodes.get(node_id)
    if not n:
        return 404, {"error": "no such node"}

    label = str(payload.get("label", "")).strip()
    if label:
        n["label"] = label[:80]
    for key in ("hoverLabel", "detailLabel"):   # 호버 이름 · 상세 페이지 제목 (비우면 삭제)
        if key in payload:
            value = str(payload[key]).strip()[:120]
            if value:
                n[key] = value
            else:
                n.pop(key, None)
    if "summary" in payload:
        summary = str(payload["summary"]).strip()[:500]
        if summary:
            n["summary"] = summary
        else:
            n.pop("summary", None)
    if payload.get("type") in types:
        n["type"] = payload["type"]

    is_hub = lambda x: bool(types[x["type"]].get("hub"))
    is_poss = lambda x: bool(types[x["type"]].get("hollow"))

    links = []
    for t in payload.get("links", []):
        m = nodes.get(t)
        if not m or t == node_id or t in links or is_hub(m) or is_hub(n):
            continue  # 허브 연결은 자동
        if m.get("orbit") == node_id:
            continue  # 이 노드의 위성은 자동
        links.append(t)

    # 이 노드의 명시 연결을 새 목록으로 교체
    core = {(e[0] if e[1] == node_id else e[1]) for e in g["edges"] if node_id in e[:2] and e[2:] == ["core"]}
    # "layout"(배치에만 쓰는 숨은 연결)은 편집과 무관하게 유지하되, 같은 쌍을 다시 실제로 이으면 지운다
    g["edges"] = [e for e in g["edges"]
                  if node_id not in e[:2] or (e[2:] == ["layout"] and (e[1] if e[0] == node_id else e[0]) not in links)]
    n.pop("orbit", None)
    if is_poss(n) and len(links) == 1:
        n["orbit"] = links[0]  # 연결이 하나뿐인 가능성 = 그 노드의 위성
    else:
        g["edges"] += [[node_id, t] + (["core"] if t in core else []) for t in links]

    # 남의 위성에 연결을 더하면 그 위성은 '다리' 가능성으로 바뀐다
    for t in links:
        m = nodes[t]
        if m.get("orbit") and m["orbit"] != node_id:
            g["edges"].append([t, m.pop("orbit")])

    # 가능성이 아니게 된 노드에 남은 위성 표시 정리
    for m in g["nodes"]:
        if m.get("orbit") and not is_poss(m):
            g["edges"].append([m["id"], m.pop("orbit")])

    GRAPH.write_text(dump_graph(g), encoding="utf-8")
    return 200, {"saved": "data/graph.json"}


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def reply(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/ping":
            return self.reply(200, {"edit": True})
        super().do_GET()

    def do_POST(self):
        # 다른 사이트가 브라우저를 통해 몰래 저장하지 못하도록 같은 출처 요청만 받는다
        origin = self.headers.get("Origin", "")
        if origin and origin not in (f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}"):
            return self.reply(403, {"error": "forbidden origin"})

        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_UPLOAD:
            return self.reply(413, {"error": "too large"})
        data = self.rfile.read(length)

        m = re.fullmatch(r"/api/(content|node)/([^/]+)", self.path)
        if m:
            kind, node_id = m.groups()
            if not NODE_ID.match(node_id):
                return self.reply(400, {"error": "bad id"})
            if kind == "content":
                CONTENT.mkdir(exist_ok=True)
                (CONTENT / f"{node_id}.md").write_bytes(data)
                return self.reply(200, {"saved": f"content/{node_id}.md"})
            try:
                payload = json.loads(data or b"{}")
            except ValueError:
                return self.reply(400, {"error": "bad json"})
            with lock:
                return self.reply(*update_node(node_id, payload))

        if self.path == "/api/upload":
            name = pathlib.Path(urllib.parse.unquote(self.headers.get("X-Filename", "image.png"))).name
            ext = pathlib.Path(name).suffix.lower()
            if ext not in IMAGE_EXT:
                return self.reply(400, {"error": "images only"})
            stem = re.sub(r"[^A-Za-z0-9_-]+", "-", pathlib.Path(name).stem).strip("-")[:40] or "image"
            UPLOADS.mkdir(exist_ok=True)
            out = UPLOADS / f"{time.strftime('%y%m%d-%H%M%S')}-{stem}{ext}"
            n = 1
            while out.exists():
                out = out.with_name(f"{out.stem}-{n}{ext}")
                n += 1
            out.write_bytes(data)
            return self.reply(200, {"path": f"uploads/{out.name}"})

        self.reply(404, {"error": "not found"})


if __name__ == "__main__":
    handler = functools.partial(Handler, directory=str(ROOT))
    print(f"http://127.0.0.1:{PORT}/")
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler).serve_forever()
