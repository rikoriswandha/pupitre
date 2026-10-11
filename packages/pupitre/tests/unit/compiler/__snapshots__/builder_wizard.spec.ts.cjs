exports[`Builder and Wizard schema compiler > compiles typed builder templates and a mounted wizard with deterministic spec 1`] = `{
  "elements": {
    "f.content": {
      "children": [
        "f.content.heading.item",
        "f.content.paragraph.item",
      ],
      "props": {
        "descriptor": {
          "addLabel": "Add block",
          "blockPickerColumns": 2,
          "blocks": [
            {
              "icon": "heading",
              "key": "heading",
              "label": "Heading",
              "template": "f.content.heading.item",
            },
            {
              "icon": undefined,
              "key": "paragraph",
              "label": "Paragraph",
              "template": "f.content.paragraph.item",
            },
          ],
          "cloneable": true,
          "collapsible": true,
          "maxItems": 8,
          "minItems": 1,
          "name": "content",
          "reorderable": true,
        },
        "label": "Content",
        "name": "content",
        "value": {
          "$bindState": "/data/content",
        },
      },
      "repeat": {
        "key": "_key",
        "statePath": "/data/content",
      },
      "type": "Builder",
    },
    "f.content.heading.data.title": {
      "props": {
        "label": "Title",
        "name": "content.heading.data.title",
        "required": true,
        "value": {
          "$bindItem": "data/title",
        },
      },
      "type": "Text",
    },
    "f.content.heading.item": {
      "children": [
        "f.content.heading.data.title",
      ],
      "props": {
        "block": "heading",
        "index": {
          "$index": true,
        },
      },
      "type": "BuilderItem",
    },
    "f.content.paragraph.data.body": {
      "props": {
        "label": "Body",
        "name": "content.paragraph.data.body",
        "value": {
          "$bindItem": "data/body",
        },
      },
      "type": "Textarea",
    },
    "f.content.paragraph.item": {
      "children": [
        "f.content.paragraph.data.body",
      ],
      "props": {
        "block": "paragraph",
        "index": {
          "$index": true,
        },
      },
      "type": "BuilderItem",
    },
    "f.email": {
      "props": {
        "error": {
          "$state": "/errors/email",
        },
        "label": "Email",
        "name": "email",
        "required": true,
        "type": "email",
        "value": {
          "$bindState": "/data/email",
        },
      },
      "type": "Text",
    },
    "f.name": {
      "props": {
        "error": {
          "$state": "/errors/name",
        },
        "label": "Name",
        "name": "name",
        "required": true,
        "value": {
          "$bindState": "/data/name",
        },
      },
      "type": "Text",
    },
    "l.0": {
      "children": [
        "l.1",
        "l.2",
      ],
      "props": {
        "id": "l.0",
        "skippable": false,
        "step": {
          "$bindState": "/ui/wizard/l.0/step",
        },
        "steps": [
          {
            "description": "Your details",
            "fields": [
              "email",
            ],
            "icon": "user",
            "key": "Account",
            "label": "Account",
          },
          {
            "description": undefined,
            "fields": [
              "name",
            ],
            "icon": undefined,
            "key": "Profile",
            "label": "Profile",
          },
        ],
        "submitLabel": "Finish setup",
      },
      "type": "Wizard",
    },
    "l.1": {
      "children": [
        "f.email",
      ],
      "props": {
        "description": "Your details",
        "icon": "user",
        "key": "Account",
        "label": "Account",
      },
      "type": "Step",
    },
    "l.2": {
      "children": [
        "f.name",
      ],
      "props": {
        "description": undefined,
        "icon": undefined,
        "key": "Profile",
        "label": "Profile",
      },
      "type": "Step",
    },
    "root": {
      "children": [
        "f.content",
        "l.0",
      ],
      "props": {
        "dirtyGuard": true,
        "method": "post",
        "submitLabel": "Finish setup",
        "url": "/pages",
      },
      "type": "Form",
    },
  },
  "root": "root",
  "state": {
    "data": {
      "content": [
        {
          "_key": "b0",
          "data": {
            "title": "Welcome",
          },
          "type": "heading",
        },
      ],
    },
    "errors": {},
    "meta": {
      "dirty": false,
      "record": null,
      "submitting": false,
    },
    "ui": {
      "tabs": {},
      "wizard": {
        "l.0": {
          "step": 1,
        },
      },
    },
  },
}`

