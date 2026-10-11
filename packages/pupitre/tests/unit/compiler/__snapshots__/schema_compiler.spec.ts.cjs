exports[`schema compiler > compiles a form, nested repeaters, defaults and snapshots its json-render spec 1`] = `{
  "elements": {
    "f.items": {
      "children": [
        "f.items.item",
      ],
      "on": {
        "add": [
          {
            "action": "pushState",
            "params": {
              "statePath": "/data/items",
              "value": {
                "_key": "$id",
                "variants": [],
              },
            },
          },
        ],
      },
      "props": {
        "descriptor": {
          "addLabel": undefined,
          "cloneable": false,
          "collapsed": undefined,
          "collapsible": true,
          "defaultItems": [
            {
              "_key": "k0",
              "sku": "A",
              "variants": [],
            },
          ],
          "grid": undefined,
          "maxItems": undefined,
          "minItems": undefined,
          "name": "items",
          "reorderable": true,
        },
        "value": {
          "$bindState": "/data/items",
        },
      },
      "repeat": {
        "key": "_key",
        "statePath": "/data/items",
      },
      "type": "Repeater",
    },
    "f.items.item": {
      "children": [
        "f.items.sku",
        "f.items.variants",
      ],
      "props": {
        "index": {
          "$index": true,
        },
      },
      "type": "RepeaterItem",
    },
    "f.items.sku": {
      "props": {
        "label": "Sku",
        "name": "items.sku",
        "required": true,
        "value": {
          "$bindItem": "sku",
        },
      },
      "type": "Text",
    },
    "f.items.variants": {
      "children": [
        "f.items.variants.item",
      ],
      "on": {
        "add": [
          {
            "action": "pushState",
            "params": {
              "statePath": {
                "$item": "variants",
              },
              "value": {
                "_key": "$id",
              },
            },
          },
        ],
      },
      "props": {
        "descriptor": {
          "addLabel": undefined,
          "cloneable": false,
          "collapsed": undefined,
          "collapsible": false,
          "defaultItems": [],
          "grid": undefined,
          "maxItems": undefined,
          "minItems": undefined,
          "name": "items.variants",
          "reorderable": false,
        },
        "value": {
          "$bindItem": "variants",
        },
      },
      "repeat": {
        "key": "_key",
        "statePath": {
          "$item": "variants",
        },
      },
      "type": "Repeater",
    },
    "f.items.variants.item": {
      "children": [
        "f.items.variants.qty",
      ],
      "props": {
        "index": {
          "$index": true,
        },
      },
      "type": "RepeaterItem",
    },
    "f.items.variants.qty": {
      "props": {
        "label": "Qty",
        "name": "items.variants.qty",
        "value": {
          "$bindItem": "qty",
        },
      },
      "type": "Number",
    },
    "f.publishedAt": {
      "props": {
        "error": {
          "$state": "/errors/publishedAt",
        },
        "label": "Published At",
        "name": "publishedAt",
        "timezone": "Asia/Jakarta",
        "value": {
          "$bindState": "/data/publishedAt",
        },
      },
      "type": "DateTime",
    },
    "f.slug": {
      "props": {
        "error": {
          "$state": "/errors/slug",
        },
        "label": "Slug",
        "name": "slug",
        "value": {
          "$bindState": "/data/slug",
        },
      },
      "type": "Text",
    },
    "f.status": {
      "props": {
        "error": {
          "$state": "/errors/status",
        },
        "label": "Status",
        "name": "status",
        "options": [
          {
            "label": "Draft",
            "value": "draft",
          },
          {
            "label": "Published",
            "value": "published",
          },
        ],
        "value": {
          "$bindState": "/data/status",
        },
      },
      "type": "Select",
    },
    "f.title": {
      "props": {
        "error": {
          "$state": "/errors/title",
        },
        "label": "Title",
        "name": "title",
        "required": true,
        "value": {
          "$bindState": "/data/title",
        },
      },
      "type": "Text",
    },
    "l.0": {
      "children": [
        "f.title",
        "f.status",
        "f.items",
      ],
      "props": {
        "columns": 2,
        "heading": "Content",
      },
      "type": "Section",
    },
    "l.1": {
      "children": [
        "l.2",
        "l.3",
      ],
      "props": {
        "active": {
          "$bindState": "/ui/tabs/l.1",
        },
        "id": "l.1",
        "tabs": [
          {
            "key": "Publishing",
            "label": "Publishing",
          },
          {
            "key": "Details",
            "label": "Details",
          },
        ],
      },
      "type": "Tabs",
    },
    "l.2": {
      "children": [
        "f.publishedAt",
      ],
      "props": {
        "key": "Publishing",
        "label": "Publishing",
      },
      "type": "Tab",
    },
    "l.3": {
      "children": [
        "f.slug",
      ],
      "props": {
        "key": "Details",
        "label": "Details",
      },
      "type": "Tab",
    },
    "root": {
      "children": [
        "l.0",
        "l.1",
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
    "data": {
      "items": [
        {
          "_key": "k0",
          "sku": "A",
          "variants": [],
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
      "tabs": {
        "l.1": "Publishing",
      },
    },
  },
}`

exports[`schema compiler > compiles options and field bindings with catalog-valid element types 1`] = `{
  "elements": {
    "f.status": {
      "props": {
        "error": {
          "$state": "/errors/status",
        },
        "label": "Status",
        "name": "status",
        "options": [
          {
            "label": "Draft",
            "value": "draft",
          },
        ],
        "value": {
          "$bindState": "/data/status",
        },
      },
      "type": "Select",
    },
    "root": {
      "children": [
        "f.status",
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

exports[`schema compiler > renders formatted infolist date entries in the requested timezone 1`] = `{
  "elements": {
    "f.publishedAt": {
      "props": {
        "dateTime": "yyyy-MM-dd HH:mm",
        "label": "Published At",
        "value": "2025-01-01 07:00",
      },
      "type": "TextEntry",
    },
    "root": {
      "children": [
        "f.publishedAt",
      ],
      "props": {},
      "type": "Infolist",
    },
  },
  "root": "root",
  "state": {
    "data": {
      "publishedAt": "2025-01-01T00:00:00Z",
    },
    "errors": {},
    "meta": {
      "dirty": false,
      "record": {
        "publishedAt": "2025-01-01T00:00:00Z",
      },
      "submitting": false,
    },
    "ui": {
      "tabs": {},
    },
  },
}`

exports[`schema compiler > snapshots every compiler-emitted catalog component and complete view entries 1`] = `{
  "elements": {
    "f.buttons": {
      "props": {
        "error": {
          "$state": "/errors/buttons",
        },
        "label": "Buttons",
        "name": "buttons",
        "options": [
          {
            "label": "One",
            "value": "one",
          },
        ],
        "value": {
          "$bindState": "/data/buttons",
        },
      },
      "type": "ToggleButtons",
    },
    "f.checkbox": {
      "props": {
        "error": {
          "$state": "/errors/checkbox",
        },
        "label": "Checkbox",
        "name": "checkbox",
        "value": {
          "$bindState": "/data/checkbox",
        },
      },
      "type": "Checkbox",
    },
    "f.checklist": {
      "props": {
        "error": {
          "$state": "/errors/checklist",
        },
        "label": "Checklist",
        "name": "checklist",
        "options": [
          {
            "label": "One",
            "value": "one",
          },
        ],
        "value": {
          "$bindState": "/data/checklist",
        },
      },
      "type": "CheckboxList",
    },
    "f.color": {
      "props": {
        "error": {
          "$state": "/errors/color",
        },
        "label": "Color",
        "name": "color",
        "value": {
          "$bindState": "/data/color",
        },
      },
      "type": "Color",
    },
    "f.date": {
      "props": {
        "error": {
          "$state": "/errors/date",
        },
        "label": "Date",
        "name": "date",
        "timezone": "Asia/Jakarta",
        "value": {
          "$bindState": "/data/date",
        },
      },
      "type": "Date",
    },
    "f.dateTime": {
      "props": {
        "error": {
          "$state": "/errors/dateTime",
        },
        "label": "Date Time",
        "name": "dateTime",
        "timezone": "Asia/Jakarta",
        "value": {
          "$bindState": "/data/dateTime",
        },
      },
      "type": "DateTime",
    },
    "f.email": {
      "props": {
        "error": {
          "$state": "/errors/email",
        },
        "label": "Email",
        "name": "email",
        "type": "email",
        "value": {
          "$bindState": "/data/email",
        },
      },
      "type": "Text",
    },
    "f.fieldsetText": {
      "props": {
        "error": {
          "$state": "/errors/fieldsetText",
        },
        "label": "Fieldset Text",
        "name": "fieldsetText",
        "value": {
          "$bindState": "/data/fieldsetText",
        },
      },
      "type": "Text",
    },
    "f.fileUpload": {
      "props": {
        "descriptor": {
          "accept": undefined,
          "deleteUrl": "/upload",
          "directory": undefined,
          "downloadable": false,
          "image": false,
          "imageEditor": false,
          "imageEditorAspectRatios": undefined,
          "maxFiles": undefined,
          "maxSize": undefined,
          "multiple": false,
          "name": "fileUpload",
          "previewable": true,
          "reorderable": false,
          "uploadUrl": "/upload",
          "visibility": undefined,
        },
        "error": {
          "$state": "/errors/fileUpload",
        },
        "label": "File Upload",
        "name": "fileUpload",
        "value": {
          "$bindState": "/data/fileUpload",
        },
      },
      "type": "FileUpload",
    },
    "f.fragmentText": {
      "props": {
        "error": {
          "$state": "/errors/fragmentText",
        },
        "label": "Fragment Text",
        "name": "fragmentText",
        "value": {
          "$bindState": "/data/fragmentText",
        },
      },
      "type": "Text",
    },
    "f.gridText": {
      "props": {
        "error": {
          "$state": "/errors/gridText",
        },
        "label": "Grid Text",
        "name": "gridText",
        "value": {
          "$bindState": "/data/gridText",
        },
      },
      "type": "Text",
    },
    "f.groupText": {
      "props": {
        "error": {
          "$state": "/errors/groupText",
        },
        "label": "Group Text",
        "name": "groupText",
        "value": {
          "$bindState": "/data/groupText",
        },
      },
      "type": "Text",
    },
    "f.hidden": {
      "props": {
        "error": {
          "$state": "/errors/hidden",
        },
        "label": "Hidden",
        "name": "hidden",
        "value": {
          "$bindState": "/data/hidden",
        },
      },
      "type": "Hidden",
    },
    "f.keyValue": {
      "props": {
        "error": {
          "$state": "/errors/keyValue",
        },
        "label": "Key Value",
        "name": "keyValue",
        "value": {
          "$bindState": "/data/keyValue",
        },
      },
      "type": "KeyValue",
    },
    "f.multi": {
      "props": {
        "error": {
          "$state": "/errors/multi",
        },
        "label": "Multi",
        "multiple": true,
        "name": "multi",
        "options": [
          {
            "label": "One",
            "value": "one",
          },
        ],
        "value": {
          "$bindState": "/data/multi",
        },
      },
      "type": "Select",
    },
    "f.number": {
      "props": {
        "error": {
          "$state": "/errors/number",
        },
        "label": "Number",
        "name": "number",
        "value": {
          "$bindState": "/data/number",
        },
      },
      "type": "Number",
    },
    "f.password": {
      "props": {
        "error": {
          "$state": "/errors/password",
        },
        "label": "Password",
        "name": "password",
        "type": "password",
        "value": {
          "$bindState": "/data/password",
        },
      },
      "type": "Text",
    },
    "f.radio": {
      "props": {
        "error": {
          "$state": "/errors/radio",
        },
        "label": "Radio",
        "name": "radio",
        "options": [
          {
            "label": "One",
            "value": "one",
          },
        ],
        "value": {
          "$bindState": "/data/radio",
        },
      },
      "type": "Radio",
    },
    "f.repeater": {
      "children": [
        "f.repeater.item",
      ],
      "on": {
        "add": [
          {
            "action": "pushState",
            "params": {
              "statePath": "/data/repeater",
              "value": {
                "_key": "$id",
              },
            },
          },
        ],
      },
      "props": {
        "descriptor": {
          "addLabel": undefined,
          "cloneable": false,
          "collapsed": undefined,
          "collapsible": false,
          "defaultItems": [],
          "grid": undefined,
          "maxItems": undefined,
          "minItems": undefined,
          "name": "repeater",
          "reorderable": false,
        },
        "value": {
          "$bindState": "/data/repeater",
        },
      },
      "repeat": {
        "key": "_key",
        "statePath": "/data/repeater",
      },
      "type": "Repeater",
    },
    "f.repeater.item": {
      "children": [
        "f.repeater.item",
      ],
      "props": {
        "index": {
          "$index": true,
        },
      },
      "type": "RepeaterItem",
    },
    "f.richEditor": {
      "props": {
        "error": {
          "$state": "/errors/richEditor",
        },
        "label": "Rich Editor",
        "name": "richEditor",
        "value": {
          "$bindState": "/data/richEditor",
        },
      },
      "type": "RichEditor",
    },
    "f.sectionText": {
      "props": {
        "error": {
          "$state": "/errors/sectionText",
        },
        "label": "Section Text",
        "name": "sectionText",
        "value": {
          "$bindState": "/data/sectionText",
        },
      },
      "type": "Text",
    },
    "f.select": {
      "props": {
        "error": {
          "$state": "/errors/select",
        },
        "label": "Select",
        "name": "select",
        "options": [
          {
            "label": "One",
            "value": "one",
          },
        ],
        "value": {
          "$bindState": "/data/select",
        },
      },
      "type": "Select",
    },
    "f.splitText": {
      "props": {
        "error": {
          "$state": "/errors/splitText",
        },
        "label": "Split Text",
        "name": "splitText",
        "value": {
          "$bindState": "/data/splitText",
        },
      },
      "type": "Text",
    },
    "f.tabText": {
      "props": {
        "error": {
          "$state": "/errors/tabText",
        },
        "label": "Tab Text",
        "name": "tabText",
        "value": {
          "$bindState": "/data/tabText",
        },
      },
      "type": "Text",
    },
    "f.tags": {
      "props": {
        "error": {
          "$state": "/errors/tags",
        },
        "label": "Tags",
        "name": "tags",
        "value": {
          "$bindState": "/data/tags",
        },
      },
      "type": "Tags",
    },
    "f.text": {
      "props": {
        "error": {
          "$state": "/errors/text",
        },
        "label": "Text",
        "name": "text",
        "value": {
          "$bindState": "/data/text",
        },
      },
      "type": "Text",
    },
    "f.textarea": {
      "props": {
        "error": {
          "$state": "/errors/textarea",
        },
        "label": "Textarea",
        "name": "textarea",
        "value": {
          "$bindState": "/data/textarea",
        },
      },
      "type": "Textarea",
    },
    "f.time": {
      "props": {
        "error": {
          "$state": "/errors/time",
        },
        "label": "Time",
        "name": "time",
        "timezone": "Asia/Jakarta",
        "value": {
          "$bindState": "/data/time",
        },
      },
      "type": "Time",
    },
    "f.toggle": {
      "props": {
        "error": {
          "$state": "/errors/toggle",
        },
        "label": "Toggle",
        "name": "toggle",
        "value": {
          "$bindState": "/data/toggle",
        },
      },
      "type": "Toggle",
    },
    "l.0": {
      "children": [
        "f.gridText",
      ],
      "props": {
        "columns": 2,
      },
      "type": "Grid",
    },
    "l.1": {
      "children": [
        "f.sectionText",
      ],
      "props": {
        "heading": "Section",
      },
      "type": "Section",
    },
    "l.10": {
      "children": [],
      "props": {
        "component": "HostWidget",
        "props": {
          "title": "Widget",
        },
      },
      "type": "View",
    },
    "l.11": {
      "children": [
        "f.fragmentText",
      ],
      "props": {},
      "type": "Fragment",
    },
    "l.2": {
      "children": [
        "f.fieldsetText",
      ],
      "props": {
        "label": "Fieldset",
      },
      "type": "Fieldset",
    },
    "l.3": {
      "children": [
        "l.4",
      ],
      "props": {
        "active": {
          "$bindState": "/ui/tabs/l.3",
        },
        "id": "l.3",
        "tabs": [
          {
            "key": "Details",
            "label": "Details",
          },
        ],
      },
      "type": "Tabs",
    },
    "l.4": {
      "children": [
        "f.tabText",
      ],
      "props": {
        "key": "Details",
        "label": "Details",
      },
      "type": "Tab",
    },
    "l.5": {
      "children": [
        "f.groupText",
      ],
      "props": {
        "name": "Group",
      },
      "type": "Group",
    },
    "l.6": {
      "children": [
        "f.splitText",
      ],
      "props": {
        "from": "md",
      },
      "type": "Split",
    },
    "l.7": {
      "children": [],
      "props": {
        "content": "Static placeholder",
        "name": "placeholder",
      },
      "type": "Placeholder",
    },
    "l.8": {
      "children": [],
      "props": {
        "content": "<strong>Safe HTML</strong>",
      },
      "type": "Html",
    },
    "l.9": {
      "children": [],
      "props": {},
      "type": "Divider",
    },
    "root": {
      "children": [
        "f.text",
        "f.email",
        "f.password",
        "f.number",
        "f.textarea",
        "f.hidden",
        "f.select",
        "f.multi",
        "f.checkbox",
        "f.checklist",
        "f.radio",
        "f.toggle",
        "f.buttons",
        "f.date",
        "f.dateTime",
        "f.time",
        "f.color",
        "f.tags",
        "f.keyValue",
        "f.richEditor",
        "f.fileUpload",
        "f.repeater",
        "l.0",
        "l.1",
        "l.2",
        "l.3",
        "l.5",
        "l.6",
        "l.7",
        "l.8",
        "l.9",
        "l.10",
        "l.11",
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
    "data": {
      "repeater": [],
    },
    "errors": {},
    "meta": {
      "dirty": false,
      "record": null,
      "submitting": false,
    },
    "ui": {
      "tabs": {
        "l.3": "Details",
      },
    },
  },
}`

exports[`schema compiler > snapshots every compiler-emitted catalog component and complete view entries 2`] = `{
  "elements": {
    "f.color": {
      "props": {
        "label": "Color",
        "value": "#123456",
      },
      "type": "ColorEntry",
    },
    "f.history": {
      "props": {
        "label": "History",
        "value": [
          {},
        ],
      },
      "type": "RepeatableEntry",
    },
    "f.icon": {
      "props": {
        "label": "Icon",
        "value": true,
      },
      "type": "IconEntry",
    },
    "f.image": {
      "props": {
        "label": "Image",
        "value": "uploads/image.png",
      },
      "type": "ImageEntry",
    },
    "f.metadata": {
      "props": {
        "label": "Metadata",
        "value": {
          "key": "value",
        },
      },
      "type": "KeyValueEntry",
    },
    "f.source": {
      "props": {
        "label": "Source",
        "value": "const x = 1",
      },
      "type": "CodeEntry",
    },
    "f.status": {
      "props": {
        "label": "Status",
        "value": "published",
      },
      "type": "BadgeEntry",
    },
    "f.text": {
      "props": {
        "label": "Text",
        "value": "Hello",
      },
      "type": "TextEntry",
    },
    "root": {
      "children": [
        "f.text",
        "f.icon",
        "f.image",
        "f.color",
        "f.metadata",
        "f.history",
        "f.source",
        "f.status",
      ],
      "props": {},
      "type": "Infolist",
    },
  },
  "root": "root",
  "state": {
    "data": {
      "color": "#123456",
      "history": [
        {
          "title": "Change",
        },
      ],
      "icon": true,
      "image": "uploads/image.png",
      "metadata": {
        "key": "value",
      },
      "source": "const x = 1",
      "status": "published",
      "text": "Hello",
    },
    "errors": {},
    "meta": {
      "dirty": false,
      "record": {
        "color": "#123456",
        "history": [
          {
            "title": "Change",
          },
        ],
        "icon": true,
        "image": "uploads/image.png",
        "metadata": {
          "key": "value",
        },
        "source": "const x = 1",
        "status": "published",
        "text": "Hello",
      },
      "submitting": false,
    },
    "ui": {
      "tabs": {},
    },
  },
}`

