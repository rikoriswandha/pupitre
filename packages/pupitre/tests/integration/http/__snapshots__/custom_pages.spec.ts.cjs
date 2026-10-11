exports[`custom pages > renders page state, saves through VineJS, and runs header actions 1`] = `{
  "elements": {
    "f.label": {
      "props": {
        "error": {
          "$state": "/errors/label",
        },
        "label": "Label",
        "name": "label",
        "required": true,
        "value": {
          "$bindState": "/data/label",
        },
      },
      "type": "Text",
    },
    "root": {
      "children": [
        "f.label",
      ],
      "props": {
        "dirtyGuard": true,
        "method": "post",
        "submitLabel": "Save",
        "url": "/admin/settings",
      },
      "type": "Form",
    },
  },
  "root": "root",
  "state": {
    "data": {
      "label": "Initial",
    },
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

