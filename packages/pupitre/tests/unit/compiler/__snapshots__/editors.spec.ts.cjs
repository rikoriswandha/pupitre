exports[`editor parity > compiles markdown/code editors and the image crop descriptor 1`] = `{
  "elements": {
    "f.cover": {
      "props": {
        "descriptor": {
          "accept": undefined,
          "deleteUrl": "/_pupitre/upload",
          "directory": undefined,
          "downloadable": false,
          "image": true,
          "imageEditor": true,
          "imageEditorAspectRatios": [
            "16:9",
            "4:3",
            "1:1",
            null,
          ],
          "maxFiles": undefined,
          "maxSize": undefined,
          "multiple": false,
          "name": "cover",
          "previewable": true,
          "reorderable": false,
          "uploadUrl": "/_pupitre/upload",
          "visibility": undefined,
        },
        "error": {
          "$state": "/errors/cover",
        },
        "label": "Cover",
        "name": "cover",
        "value": {
          "$bindState": "/data/cover",
        },
      },
      "type": "FileUpload",
    },
    "f.snippet": {
      "props": {
        "error": {
          "$state": "/errors/snippet",
        },
        "label": "Snippet",
        "language": "typescript",
        "lineNumbers": true,
        "minHeight": 240,
        "name": "snippet",
        "value": {
          "$bindState": "/data/snippet",
        },
      },
      "type": "CodeEditor",
    },
    "f.summary": {
      "props": {
        "error": {
          "$state": "/errors/summary",
        },
        "label": "Summary",
        "name": "summary",
        "toolbar": [
          "bold",
          "italic",
        ],
        "uploadUrl": "/_pupitre/upload",
        "value": {
          "$bindState": "/data/summary",
        },
      },
      "type": "MarkdownEditor",
    },
    "root": {
      "children": [
        "f.summary",
        "f.snippet",
        "f.cover",
      ],
      "props": {
        "dirtyGuard": true,
        "method": "post",
        "submitLabel": "Create",
        "url": "/posts",
      },
      "type": "Form",
    },
  },
  "root": "root",
  "state": {
    "data": {},
    "errors": {},
    "meta": {
      "dirty": false,
      "record": null,
      "submitting": false,
    },
    "ui": {
      "tabs": {},
    },
  },
}`

