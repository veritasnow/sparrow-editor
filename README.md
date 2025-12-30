sparrow-editor
├─ constants
│  └─ styleConstants.js
├─ core
│  ├─ editorInputProcessor.js
│  ├─ editorKeyHandler.js
│  └─ editorSelectionAnalyzer.js
├─ editor.js
├─ extensions
│  ├─ image
│  │  ├─ componets
│  │  │  ├─ imagePopupView.js
│  │  │  └─ imageRenderer.js
│  │  ├─ imageExtension.js
│  │  ├─ imageFeatureBinder.js
│  │  └─ service
│  │     └─ imageInsertService.js
│  └─ video
│     ├─ componets
│     │  ├─ videoPopupView.js
│     │  └─ videoRenderer.js
│     ├─ model
│     ├─ service
│     │  └─ videoInsertService.js
│     ├─ utils
│     │  └─ videoBlockUtil.js
│     ├─ videoExtension.js
│     └─ videoFeatureBinder.js
├─ factory
│  ├─ editorContext.js
│  └─ editorFactory.js
├─ features
│  ├─ align
│  │  ├─ alignFeatureBinder.js
│  │  └─ editorAlignService.js
│  ├─ componets
│  │  └─ textRenderer.js
│  ├─ domCreateService.js
│  ├─ inline
│  │  └─ inlineServiceBase.js
│  ├─ selection
│  │  ├─ selectionFeatureBinder.js
│  │  └─ selectionUiService.js
│  ├─ service
│  │  ├─ align
│  │  ├─ inline
│  │  ├─ selection
│  │  └─ style
│  └─ style
│     ├─ editorStyleService.js
│     ├─ styleFeatureBinder.js
│     └─ styleUtils.js
├─ index.html
├─ model
│  └─ editorModel.js
├─ modules
│  ├─ input
│  │  ├─ application
│  │  │  └─ inputApplication.js
│  │  └─ service
│  │     ├─ inputBindingService.js
│  │     └─ keyBindingService.js
│  ├─ state
│  │  ├─ application
│  │  │  └─ editorApplication.js
│  │  ├─ service
│  │  │  └─ editorSnapshotService.js
│  │  └─ store
│  │     ├─ cursorHistoryStore.js
│  │     └─ historyStore.js
│  └─ ui
│     ├─ application
│     │  └─ uiApplication.js
│     └─ service
│        ├─ domParserService.js
│        ├─ renderService.js
│        └─ selectionService.js
├─ README.md
└─ utils
   ├─ editorStateUtils.js
   ├─ keyStateUtil.js
   ├─ mergeUtils.js
   └─ rangeUtils.js

```