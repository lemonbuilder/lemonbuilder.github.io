## DVA Project
**해양 생태계 보호를 위한 AI 기반 거리 추정**
2023.7 – 2025.3 · Tech for Impact · DVA LAB

제주 바다의 남방큰돌고래(Indo-Pacific Bottlenose Dolphin)는 무리하게 다가오는 관광 선박 때문에 충돌사고, 섭식장애, 번식 저하의 위협을 받고 있습니다. 법은 돌고래 반경 50m 이내로 선박이 접근하는 것을 금지하지만, 넓은 바다 위에서 '몇 m였는지'를 입증하기 어려워 실제 처벌로는 이어지지 못했습니다.

DVA는 이 간극을 기술로 메우는 프로젝트입니다. 드론으로 찍은 영상에서 돌고래와 선박을 찾아내고, 둘 사이의 거리를 자동으로 측정해 위법 여부를 객관적인 근거로 남깁니다.

### Collaboration
해양동물생태보전연구소(MARC), 카카오임팩트·브라이언임팩트, AI 연구·교육 커뮤니티 모두의연구소가 함께한 테크포임팩트 프로젝트입니다. 1기(2023.7 – 2024.1)와 2기(2024.4 – 2025.3)에 걸쳐 약 2년간 진행했습니다.

### What we built
- **Object Detection** — YOLOv8 기반으로 돌고래와 선박을 탐지하고, 공동 작업을 위한 라벨링 정책을 세웠습니다.
- **Anomaly Detection** — EfficientAD로 '돌고래가 없는 바다'를 학습해, 탐지 모델이 놓치는 작은 개체까지 잡아냈습니다.
- **Segmentation** — 바다 영역을 분할해 육지의 차량·건물이나 해안 암석을 선박·돌고래로 잘못 잡는 오검출을 걸러냈습니다.
- **Slicing & Tracking** — SAHI로 작은 객체의 탐지 성능을 높이고, BoT-SORT로 프레임 사이 개체를 이어서 추적했습니다.
- **Orthophoto & Distance** — 드론 로그(높이·자세)를 영상과 동기화해 위에서 내려다본 정사영상으로 바꾸고, 실제 거리를 계산했습니다.

![돌고래 탐지 결과](uploads/261011-135741-dva-detection.jpg)

![DVA 파이프라인: 드론 영상과 로그에서 출력 프레임까지](uploads/261011-135741-dva-pipeline.jpg)

### From demo to service
1기에서는 돌고래와 가장 가까운 선박의 거리, 선박 속도, 300m 이내 선박 수를 영상 위에 표시하는 데모를 만들었습니다. 2기에서는 드론 영상을 올리면 AI가 50m·300m 기준으로 위법 여부를 분석해 주는 웹 서비스 MVP로 발전시켰습니다.

![1기 데모: 선박과 돌고래 사이 거리 표시](uploads/261011-135741-dva-demo.jpg)

![2기 MVP: AI 위법 분석 결과 화면](uploads/261011-135741-dva-mvp.jpg)

### Publication
이 작업은 IEEE CAI 2024 Workshop AI4E에 포스터로 발표되었습니다.
[Deep Learning for Overseeing Indo-Pacific Bottlenose Dolphin Tourism Law Enforcement](https://openreview.net/forum?id=bnduW0yJrV)
기술 문서 · [techforimpact-io.gitbook.io/diva](https://techforimpact-io.gitbook.io/diva)

### Why it matters
- **현실 문제에 대한 새로운 접근** — 사람의 눈과 인력만으로는 풀기 어려운 현장 문제에 새로운 관점을 제시하고, 촬영각과 원근에서 오는 오차를 줄였습니다.
- **과학적 해법으로 공신력 확보** — 자동화된 분석과 전 과정의 로그 기록으로 결과의 신뢰도를 높였습니다.
- **오픈소스 기반의 확장성** — 개발 코드를 공유하고 문서화해, 다른 바다와 다른 생물로도 넓혀 갈 수 있습니다.

참고 영상 · [낚시어선에 쫓기는 제주 돌고래, 남방큰돌고래 (돌핀맨)](https://youtu.be/ecNUGGgCuHw)
