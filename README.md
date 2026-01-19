# Sparrow Editor

상태 기반(State-driven)으로 동작하는 **바닐라 JavaScript 웹 에디터**입니다.
**React와 유사하게 상태(State)와 렌더링(Rendering)을 분리**하는 것을 목표로 만드는 중입니다.

---

## ✨ 특징 (Features)

* 🧠 **State 기반 에디터**

  * 상태(Model)를 단일 진실(Single Source of Truth)로 사용
  * 상태 변경 → 렌더링 흐름을 분리
  * undo / redo, 커서 복원, 히스토리 관리

* 🧩 **확장 Extension 구조**

  * text, image, video, table 등을 독립적인 extension으로 관리
  * extension 단위로 service / renderer / component 분리

* 🧱 **Line / Chunk 모델링**

  * 문서는 `Line(p)` 단위
  * 각 라인은 여러 `Chunk(text, image, video 등)`로 구성

* 🎯 **Selection & Cursor 작업중**

  * DOM Selection의 역할이 커져서 모듈화 진행예정

* ⚙️ **Framework-free (Vanilla JS)**

  * 순수 바닐라 JS로 기능 구현(라이브러리 미사용)

---

## 📁 프로젝트 구조

```
sparrow-editor
├─ core                # 핵심 엔진 (입력, 키, 셀렉션)
├─ state               # 상태 & 스토어
│  ├─ store
│  ├─ application
│  └─ service
├─ model               # Line / Chunk 모델
├─ renderers           # 상태 → DOM 렌더러
├─ extensions          # 기능 단위 확장 (text, image, video, table ...)
├─ ui                  # UI Application / View
├─ factory             # Editor 생성 팩토리
└─ editor.js           # 엔트리 포인트
```

---

## 🧠 핵심 개념

### Line / Chunk 구조
* **Line**: 하나의 문단 (`<p>`)
* **Chunk**: 라인 내부의 최소 콘텐츠 단위

---

## 🚀 사용 방법 (Getting Started)
* 서버 환경에서만 동작합니다. 테스트하려면 최소한 VSCODE -> Extentions에서 Live Server를 설치후 우측 하단의 Go Live로 실행해주시기 바랍니다.

### 1️⃣ 에디터 생성

```html
<div id="editor"></div>
<script type="module">
  import { createEditor } from './editor.js';

  const editor = createEditor('editor');
</script>
```

---

### 2️⃣ 에디터 제거

```js
editor.destroy();
```

> 이벤트 리스너, 상태, 렌더러를 모두 정리합니다.

---

## 🧩 Extension 구조 예시 (Image)

```
extensions/image
├─ service
│  └─ imageInsertService.js
├─ components
│  └─ imagePopupView.js
├─ renderer
│  └─ imageRenderer.js
└─ imageExtension.js
```

* **service**: 상태 변경 로직
* **renderer**: chunk → DOM
* **component**: UI (popup 등)

---

## ✍️ 스타일 적용 방식

* Selection 범위를 기준으로
* 기존 span 스타일을 분석 후
* 필요한 경우에만 span 분리 / 병합

---

## 🛣️ 개발 목적 / 방향성

* 리액트의 상태, 렌더링을 분리한 이유가 뭔지?
* 리액트를 사용하면 왜 편한지? 느껴보고 싶어서 개발하게 되었습니다.

---

## ⚠️ 현재 상태

* 개인 학습 & 실험 프로젝트
---

## 📌 TODO

* [ ] 복사 → 붙여넣기 : 외부 DOM을 Editor의 Line / Chunk 구조로 변환하는 로직(초안완료) 작업중
* [ ] KeyProcessor 로직이 비대해짐 -> 로직 분리(우선순위로 잡을것!!)
* [ ] selection 모듈화작업예정

---

## 🧑‍💻 Author

* GitHub: [https://github.com/veritasnow](https://github.com/veritasnow)

---