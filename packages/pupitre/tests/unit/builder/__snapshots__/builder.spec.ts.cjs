exports[`resource and builder DSL > serializes a realistic definition deterministically 1`] = `{
  "actions": {
    "bulk": [
      {
        "builtin": "delete",
        "confirmation": {
          "destructive": true,
        },
        "context": "bulk",
        "kind": "delete",
        "name": "delete",
      },
    ],
    "header": [
      {
        "builtin": "create",
        "context": "header",
        "kind": "create",
        "name": "create",
      },
    ],
    "row": [
      {
        "confirmation": {},
        "context": "record",
        "handle": "fn:288ce4c9",
        "kind": "action",
        "label": "Publish",
        "name": "publish",
      },
    ],
  },
  "form": [
    {
      "children": [
        {
          "kind": "text",
          "name": "title",
          "rules": {
            "maxLength": 200,
            "required": true,
          },
        },
        {
          "children": [
            {
              "children": [
                {
                  "kind": "select",
                  "name": "status",
                  "options": {
                    "draft": "Draft",
                    "published": "Published",
                  },
                },
              ],
              "kind": "tab",
              "name": "Publishing",
            },
          ],
          "kind": "tabs",
        },
        {
          "collapsible": true,
          "kind": "repeater",
          "minItems": 1,
          "name": "items",
          "reorderable": true,
          "schema": [
            {
              "kind": "text",
              "name": "sku",
              "rules": {
                "required": true,
              },
            },
            {
              "kind": "number",
              "name": "qty",
              "rules": {
                "min": 1,
              },
            },
          ],
        },
        {
          "accept": "image/*",
          "disk": "public",
          "image": true,
          "kind": "fileUpload",
          "maxSize": "2mb",
          "name": "cover",
        },
        {
          "kind": "richEditor",
          "name": "body",
          "toolbar": [
            "bold",
            "link",
          ],
        },
      ],
      "columns": 2,
      "heading": "Content",
      "kind": "section",
    },
  ],
  "handlers": {},
  "hooks": {},
  "infolist": [
    {
      "copyable": true,
      "kind": "textEntry",
      "name": "title",
    },
    {
      "kind": "textEntry",
      "name": "createdAt",
    },
    {
      "kind": "repeatableEntry",
      "name": "items",
      "schema": [
        {
          "kind": "textEntry",
          "name": "sku",
        },
      ],
    },
  ],
  "label": "Post",
  "model": "Post",
  "navigation": {
    "badge": "fn:1df9477a",
    "group": "Content",
    "sort": 2,
  },
  "pages": {
    "create": {
      "kind": "create",
      "redirectTo": "edit",
    },
    "edit": {
      "kind": "edit",
    },
    "list": {
      "kind": "list",
      "tabs": {
        "all": {
          "label": "All",
        },
        "draft": {
          "label": "Draft",
          "where": {
            "status": "draft",
          },
        },
      },
    },
    "view": {
      "kind": "view",
    },
  },
  "pluralLabel": "Posts",
  "recordTitle": "title",
  "slug": "posts",
  "table": {
    "columns": [
      {
        "kind": "text",
        "limit": 80,
        "name": "title",
        "searchable": true,
        "sortable": true,
      },
      {
        "colors": {
          "draft": "gray",
          "published": "green",
        },
        "kind": "badge",
        "name": "status",
      },
    ],
    "defaultSort": {
      "column": "createdAt",
      "direction": "desc",
    },
    "filters": [
      {
        "kind": "select",
        "name": "status",
        "options": {
          "draft": "Draft",
          "published": "Published",
        },
      },
      {
        "kind": "ternary",
        "name": "featured",
      },
    ],
    "filtersLayout": "dropdown",
    "paginated": [
      10,
      25,
      50,
    ],
    "searchDebounce": 300,
    "striped": false,
  },
}`

