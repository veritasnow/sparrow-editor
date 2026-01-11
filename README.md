작업중...

sparrow-editor
├─ constants
│  └─ styleConstants.js
├─ core
│  ├─ chunk
│  │  └─ chunkRegistry.js
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
│  │  ├─ model
│  │  │  └─ ImageModel.js
│  │  ├─ service
│  │  │  └─ imageInsertService.js
│  │  └─ utils
│  │     └─ imageBlockUtil.js
│  ├─ table
│  │  ├─ componets
│  │  │  ├─ tablePopupView.js
│  │  │  └─ tableRenderer.js
│  │  ├─ model
│  │  │  └─ TableModel.js
│  │  ├─ service
│  │  │  └─ tableInsertService.js
│  │  ├─ tableExtension.js
│  │  ├─ tableFeatureBinder.js
│  │  └─ utils
│  │     └─ tableBlockUtil.js
│  └─ video
│     ├─ componets
│     │  ├─ videoPopupView.js
│     │  └─ videoRenderer.js
│     ├─ model
│     │  └─ videoModel.js
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
│  └─ style
│     ├─ editorStyleService.js
│     ├─ styleFeatureBinder.js
│     └─ styleUtils.js
├─ index.html
├─ model
│  ├─ editorLineModel.js
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
   ├─ rangeUtils.js
   └─ splitLineChunksUtils.js

```
