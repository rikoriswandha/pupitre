exports[`catalog extensions > compiles table column and infolist entry extension descriptors 1`] = `{
  "descriptor": {
    "bulkActions": [],
    "columns": [
      {
        "component": "TestRatingColumn",
        "individuallySearchable": true,
        "label": "Score",
        "name": "score",
        "props": {
          "max": 7,
        },
        "searchable": true,
        "sortable": true,
        "toggleable": {
          "hiddenByDefault": true,
        },
        "type": "custom",
      },
    ],
    "filters": [],
    "filtersLayout": "dropdown",
    "id": "ratings",
    "layout": "table",
    "perPageOptions": [
      10,
      25,
    ],
    "searchDebounce": 300,
    "searchable": true,
    "selectable": false,
    "striped": false,
    "url": "/ratings",
  },
  "entry": {
    "elements": {
      "f.score": {
        "props": {
          "label": "Score",
          "max": 7,
          "record": {
            "score": 8,
          },
          "value": 4,
        },
        "type": "TestRatingEntry",
      },
      "root": {
        "children": [
          "f.score",
        ],
        "props": {},
        "type": "Infolist",
      },
    },
    "root": "root",
    "state": {
      "data": {
        "score": 8,
      },
      "errors": {},
      "meta": {
        "dirty": false,
        "record": {
          "score": 8,
        },
        "submitting": false,
      },
      "ui": {
        "tabs": {},
      },
    },
  },
}`

exports[`catalog extensions > compiles binding errors visibility watch and extension element types 1`] = `{
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
          "defaultItems": [
            {
              "_key": "k0",
              "score": 2,
            },
          ],
          "grid": undefined,
          "maxItems": undefined,
          "minItems": undefined,
          "name": "items",
          "reorderable": false,
        },
        "label": "Items",
        "name": "items",
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
        "f.items.score",
      ],
      "props": {
        "index": {
          "$index": true,
        },
      },
      "type": "RepeaterItem",
    },
    "f.items.score": {
      "props": {
        "label": "Score",
        "max": 5,
        "name": "items.score",
        "value": {
          "$bindItem": "score",
        },
      },
      "type": "TestRating",
    },
    "f.score": {
      "props": {
        "error": {
          "$state": "/errors/score",
        },
        "label": "Score",
        "max": 7,
        "name": "score",
        "required": true,
        "value": {
          "$bindState": "/data/score",
        },
      },
      "type": "TestRating",
      "visible": {
        "$state": "/data/enabled",
        "eq": true,
      },
      "watch": {
        "/data/score": [
          {
            "action": "setState",
            "params": {
              "statePath": "/data/mirror",
              "value": {
                "$state": "/data/score",
              },
            },
          },
        ],
      },
    },
    "root": {
      "children": [
        "f.score",
        "f.items",
      ],
      "props": {
        "dirtyGuard": true,
        "method": "post",
        "submitLabel": "Save",
        "url": "/ratings",
      },
      "type": "Form",
    },
  },
  "root": "root",
  "state": {
    "data": {
      "enabled": true,
      "items": [
        {
          "_key": "k0",
          "score": 2,
        },
      ],
      "score": 4,
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

