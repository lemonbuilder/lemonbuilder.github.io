# lemonbuilder.github.io

**NONLINEAR BY NATURE** — 삶의 노드를 연결한 지도.
경험·분야·조직·취향·가능성을 하나의 관계도로 엮은 개인 홈페이지입니다.

🔗 https://lemonbuilder.github.io

## 폴더 구조

```
index.html            페이지 뼈대 (헤더 · 관계도 · 상세 페이지)
assets/
  css/style.css       화면 스타일
  js/app.js           관계도 그리기, 호버·클릭, 상세 페이지, 로컬 편집 기능
  vendor/             외부 라이브러리 (d3, marked)
data/graph.json       노드 · 타입 · 연결 데이터
content/<노드id>.md    노드별 상세 페이지 본문 (마크다운)
uploads/              본문에 쓰인 이미지 · 영상
tools/serve.py        내 Mac 전용 로컬 미리보기 + 편집 서버 (게시 사이트에서는 쓰이지 않음)
```

## 수정하는 방법

1. 저장소 루트에서 로컬 서버 실행

   ```
   python3 tools/serve.py
   ```

2. http://127.0.0.1:8080/ 에서 노드를 눌러 상세 페이지로 들어간 뒤 **✎ Edit**
   - 이름 · 타입 · Summary · 연결 · 본문(글 · 그림)을 고치고 저장하면
     `data/graph.json`, `content/`, `uploads/`에 바로 반영됩니다.
3. 바뀐 파일을 커밋하고 `main`에 push하면 1–2분 뒤 https://lemonbuilder.github.io 에 반영됩니다.

게시된 사이트에는 편집 서버가 없어서 ✎ Edit 버튼이 자동으로 숨겨지고, 보기만 가능합니다.

## 데이터 규칙 (data/graph.json)

- 허브(가운데 노드)는 가능성(점선) 노드를 뺀 모든 노드와 자동으로 연결됩니다.
- `orbit`: 한 노드에만 붙은 위성 가능성 노드의 부모 id
- `edges`: `[a, b]` 연결, `[a, b, "core"]`는 핵심 연결(굵은 선)
- `shift`: `[dx, dy]` 노드 배치 미세 조정
- `hoverLabel` / `detailLabel`: 호버할 때 · 상세 페이지 제목으로 대신 보일 이름
