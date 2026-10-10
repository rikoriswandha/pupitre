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
          "itemLabel": undefined,
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
      "on": {
        "clone": [
          {
            "action": "pushState",
            "params": {
              "statePath": "/data/items",
              "value": {
                "$item": "",
                "_key": "$id",
              },
            },
          },
        ],
        "collapse": [
          {
            "action": "setState",
            "params": {
              "statePath": "/ui/repeater/items/collapsed",
              "value": {
                "$cond": {
                  "$state": "/ui/repeater/items/collapsed",
                },
                "$else": true,
                "$then": false,
              },
            },
          },
        ],
        "move": [
          {
            "action": "setState",
            "params": {
              "statePath": "/data/items",
              "value": {
                "$state": "/data/items",
              },
            },
          },
        ],
        "remove": [
          {
            "action": "removeState",
            "params": {
              "index": {
                "$index": true,
              },
              "statePath": "/data/items",
            },
          },
        ],
      },
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
          "itemLabel": undefined,
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
      "on": {
        "clone": [
          {
            "action": "pushState",
            "params": {
              "statePath": {
                "$item": "variants",
              },
              "value": {
                "$item": "",
                "_key": "$id",
              },
            },
          },
        ],
        "collapse": [
          {
            "action": "setState",
            "params": {
              "statePath": "/ui/repeater/items/variants/collapsed",
              "value": {
                "$cond": {
                  "$state": "/ui/repeater/items/variants/collapsed",
                },
                "$else": true,
                "$then": false,
              },
            },
          },
        ],
        "move": [
          {
            "action": "setState",
            "params": {
              "statePath": {
                "$item": "variants",
              },
              "value": {
                "$item": "variants",
              },
            },
          },
        ],
        "remove": [
          {
            "action": "removeState",
            "params": {
              "index": {
                "$index": true,
              },
              "statePath": {
                "$item": "variants",
              },
            },
          },
        ],
      },
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

