exports[`table compiler > compiles and validates the Post table descriptor 1`] = `{
  "bulkActions": [
    {
      "enabled": true,
      "kind": "confirm",
      "label": "Delete",
      "name": "delete",
      "url": "/admin/posts/actions/delete",
    },
  ],
  "columns": [
    {
      "label": "Title",
      "name": "title",
      "props": {
        "hasDescription": true,
        "limit": 20,
      },
      "searchable": true,
      "sortable": true,
      "type": "text",
    },
    {
      "label": "Author name",
      "name": "author.name",
      "props": {},
      "searchable": false,
      "sortable": false,
      "type": "text",
    },
    {
      "label": "Status",
      "name": "status",
      "props": {
        "colors": {
          "draft": "gray",
          "published": "green",
        },
      },
      "searchable": false,
      "sortable": false,
      "type": "badge",
    },
    {
      "label": "Views Count",
      "name": "viewsCount",
      "props": {
        "numeric": true,
      },
      "searchable": false,
      "sortable": false,
      "type": "text",
    },
    {
      "label": "Price",
      "name": "price",
      "props": {
        "money": "USD",
      },
      "searchable": false,
      "sortable": false,
      "type": "text",
    },
    {
      "label": "Published At",
      "name": "publishedAt",
      "props": {
        "dateTime": true,
      },
      "searchable": false,
      "sortable": false,
      "type": "text",
    },
    {
      "label": "Published Since",
      "name": "publishedSince",
      "props": {
        "since": true,
      },
      "searchable": false,
      "sortable": false,
      "type": "text",
    },
    {
      "label": "Cover",
      "name": "cover",
      "props": {
        "circular": true,
        "stacked": true,
      },
      "searchable": false,
      "sortable": false,
      "type": "image",
    },
  ],
  "defaultSort": {
    "column": "title",
    "direction": "asc",
  },
  "filters": [
    {
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
      "type": "select",
    },
    {
      "label": "Is Featured",
      "name": "isFeatured",
      "type": "ternary",
    },
    {
      "label": "Published At",
      "name": "publishedAt",
      "type": "dateRange",
    },
    {
      "label": "Author",
      "name": "author",
      "type": "custom",
    },
  ],
  "filtersLayout": "slideover",
  "id": "posts",
  "layout": "table",
  "perPageOptions": [
    10,
    25,
    "all",
  ],
  "searchDebounce": 250,
  "searchable": true,
  "selectable": true,
  "striped": true,
  "tabs": [
    {
      "key": "all",
      "label": "All posts",
    },
    {
      "key": "draft",
      "label": "Draft",
    },
  ],
  "url": "/admin/posts",
}`

exports[`table compiler > wraps custom filter sub-specs in $raw without changing catalog output 1`] = `{
  "form": {
    "spec": {
      "$raw": {
        "elements": {
          "search": {
            "props": {
              "value": {
                "$bindState": "/data/term",
              },
            },
            "type": "Text",
          },
        },
        "root": "search",
      },
    },
  },
  "label": "Author",
  "name": "author",
  "type": "custom",
}`

