# Chatkit Stream Events

## Types

数据元素类型包括：`user_message` `assistant_message` `workflow` `widget`, 这个应该属于 ChatMessage entity 里的 type。

### Event type

包括 `thread.created` `thread.item.done` 等，这个应该属于 sse 流式输出定义的 event data type。

## Events

### Question

Can you show me the example widget?

```json
{
  "type": "thread.created",
  "thread": {
    "id": "thr_29d5f214",
    "created_at": "2025-12-22T01:51:39.750733",
    "status": { "type": "active" },
    "metadata": {},
    "items": { "data": [], "has_more": false }
  }
}
```

```json
{
  "type": "thread.item.done",
  "item": {
    "id": "msg_d09ec832",
    "thread_id": "thr_29d5f214",
    "created_at": "2025-12-22T01:51:40.094149",
    "type": "user_message",
    "content": [
      { "type": "input_text", "text": "Can you show me the example widget?" }
    ],
    "attachments": [],
    "quoted_text": "",
    "inference_options": { "model": "gpt-5" }
  }
}
```

```json
{
    "type": "stream_options",
    "stream_options": {
        "allow_cancel": true
    }
}
```

```json
{
  "type": "thread.item.done",
  "item": {
    "id": "msg_e71ea762",
    "thread_id": "thr_777e0c3b",
    "created_at": "2025-12-22T02:39:57.236868",
    "type": "widget",
    "widget": {
      "key": "index.pick",
      "type": "ListView",
      "children": [
        {
          "type": "ListViewItem",
          "children": [
            {
              "type": "Image",
              "src": "https://chatkit-studio-internal.onrender.com/gmail-list-icon.png",
              "frame": true,
              "size": "60px"
            },
            {
              "children": [
                {
                  "type": "Text",
                  "value": "Email widget",
                  "color": "emphasis",
                  "weight": "medium"
                },
                {
                  "type": "Text",
                  "value": "Craft and preview an email before sending",
                  "color": "secondary"
                }
              ],
              "type": "Col"
            }
          ],
          "onClickAction": {
            "type": "sample.show_widget",
            "payload": { "widget_id": "wig_d058d14e", "widget": "email" },
            "handler": "server",
            "loadingBehavior": "container"
          },
          "gap": 3
        },
        {
          "type": "ListViewItem",
          "children": [
            {
              "type": "Image",
              "src": "https://chatkit-studio-internal.onrender.com/calendar-list-icon.png",
              "frame": true,
              "size": "60px"
            },
            {
              "children": [
                {
                  "type": "Text",
                  "value": "Calendar widget",
                  "color": "emphasis",
                  "weight": "medium"
                },
                {
                  "type": "Text",
                  "value": "Add events to your calendar",
                  "color": "secondary"
                }
              ],
              "type": "Col"
            }
          ],
          "onClickAction": {
            "type": "sample.show_widget",
            "payload": { "widget_id": "wig_d058d14e", "widget": "calendar" },
            "handler": "server",
            "loadingBehavior": "container"
          },
          "gap": 3
        },
        {
          "type": "ListViewItem",
          "children": [
            {
              "type": "Image",
              "src": "https://chatkit-studio-internal.onrender.com/linear-list-icon.png",
              "frame": true,
              "size": "60px"
            },
            {
              "children": [
                {
                  "type": "Text",
                  "value": "Tasks widget",
                  "color": "emphasis",
                  "weight": "medium"
                },
                {
                  "type": "Text",
                  "value": "Manage your tasks and to-dos",
                  "color": "secondary"
                }
              ],
              "type": "Col"
            }
          ],
          "onClickAction": {
            "type": "sample.show_widget",
            "payload": { "widget_id": "wig_d058d14e", "widget": "tasks" },
            "handler": "server",
            "loadingBehavior": "container"
          },
          "gap": 3
        }
      ],
      "status": {
        "text": "Fetched widgets",
        "favicon": "https://chatkit-studio-internal.onrender.com/favicon.svg"
      }
    },
    "copy_text": "[Sample widget with a list of emails, tasks, and calendar events]"
  }
}
```

```json
{
  "type": "thread.updated",
  "thread": {
    "title": "Widget Example Preview",
    "id": "thr_777e0c3b",
    "created_at": "2025-12-22T02:39:53.879721",
    "status": { "type": "active" },
    "metadata": {},
    "items": { "data": [], "has_more": false }
  }
}
```

### Action

request:

```json
{
  "type": "threads.custom_action",
  "params": {
    "item_id": "msg_e71ea762",
    "action": {
      "type": "sample.show_widget",
      "payload": { "widget_id": "wig_d058d14e", "widget": "tasks" }
    },
    "thread_id": "thr_777e0c3b"
  }
}
```

Response:

```json
{ "type": "stream_options", "stream_options": { "allow_cancel": true } }
```

```json
{
  "type": "thread.item.updated",
  "item_id": "msg_e71ea762",
  "update": {
    "type": "widget.root.updated",
    "widget": {
      "key": "index.tasks",
      "type": "ListView",
      "children": [
        {
          "type": "ListViewItem",
          "children": [
            {
              "type": "Button",
              "label": "",
              "onClickAction": {
                "type": "sample.show_widget",
                "payload": { "widget_id": "wig_d058d14e", "widget": "index" },
                "handler": "server",
                "loadingBehavior": "container"
              },
              "iconStart": "chevron-left",
              "iconSize": "sm",
              "color": "primary",
              "variant": "soft",
              "size": "3xs",
              "pill": true,
              "uniform": true
            },
            { "type": "Text", "value": "Back", "color": "emphasis" }
          ],
          "onClickAction": {
            "type": "sample.show_widget",
            "payload": { "widget_id": "wig_d058d14e", "widget": "index" },
            "handler": "server",
            "loadingBehavior": "container"
          },
          "gap": 3
        },
        {
          "type": "ListViewItem",
          "children": [
            {
              "type": "Image",
              "src": "https://chatkit-studio-internal.onrender.com/linear-view-icon.png",
              "frame": true,
              "size": 40
            },
            { "type": "Text", "value": "View tasks", "color": "emphasis" }
          ],
          "onClickAction": {
            "type": "sample.view_tasks",
            "payload": { "widget_id": "wig_d058d14e" },
            "handler": "server",
            "loadingBehavior": "container"
          },
          "gap": 3
        },
        {
          "type": "ListViewItem",
          "children": [
            {
              "type": "Image",
              "src": "https://chatkit-studio-internal.onrender.com/linear-create-icon.png",
              "frame": true,
              "size": 40
            },
            { "type": "Text", "value": "Create a task", "color": "emphasis" }
          ],
          "onClickAction": {
            "type": "sample.draft_task",
            "payload": { "widget_id": "wig_d058d14e" },
            "handler": "server",
            "loadingBehavior": "container"
          },
          "gap": 3
        }
      ],
      "status": {
        "text": "Fetched tasks widget",
        "favicon": "https://chatkit-studio-internal.onrender.com/linear-status-icon.png"
      }
    }
  }
}
```

```json
{
  "type": "thread.item.replaced",
  "item": {
    "id": "msg_e71ea762",
    "thread_id": "thr_777e0c3b",
    "created_at": "2025-12-22T02:39:57.236868",
    "type": "widget",
    "widget": {
      "key": "index.tasks",
      "type": "ListView",
      "children": [
        {
          "type": "ListViewItem",
          "children": [
            {
              "type": "Button",
              "label": "",
              "onClickAction": {
                "type": "sample.show_widget",
                "payload": { "widget_id": "wig_d058d14e", "widget": "index" },
                "handler": "server",
                "loadingBehavior": "container"
              },
              "iconStart": "chevron-left",
              "iconSize": "sm",
              "color": "primary",
              "variant": "soft",
              "size": "3xs",
              "pill": true,
              "uniform": true
            },
            { "type": "Text", "value": "Back", "color": "emphasis" }
          ],
          "onClickAction": {
            "type": "sample.show_widget",
            "payload": { "widget_id": "wig_d058d14e", "widget": "index" },
            "handler": "server",
            "loadingBehavior": "container"
          },
          "gap": 3
        },
        {
          "type": "ListViewItem",
          "children": [
            {
              "type": "Image",
              "src": "https://chatkit-studio-internal.onrender.com/linear-view-icon.png",
              "frame": true,
              "size": 40
            },
            { "type": "Text", "value": "View tasks", "color": "emphasis" }
          ],
          "onClickAction": {
            "type": "sample.view_tasks",
            "payload": { "widget_id": "wig_d058d14e" },
            "handler": "server",
            "loadingBehavior": "container"
          },
          "gap": 3
        },
        {
          "type": "ListViewItem",
          "children": [
            {
              "type": "Image",
              "src": "https://chatkit-studio-internal.onrender.com/linear-create-icon.png",
              "frame": true,
              "size": 40
            },
            { "type": "Text", "value": "Create a task", "color": "emphasis" }
          ],
          "onClickAction": {
            "type": "sample.draft_task",
            "payload": { "widget_id": "wig_d058d14e" },
            "handler": "server",
            "loadingBehavior": "container"
          },
          "gap": 3
        }
      ],
      "status": {
        "text": "Fetched tasks widget",
        "favicon": "https://chatkit-studio-internal.onrender.com/linear-status-icon.png"
      }
    },
    "copy_text": "[Sample widget with a list of emails, tasks, and calendar events]"
  }
}
```

## Planing

```json
{
    "title": "Calendar event planning",
    "id": "f44ccb5b-7e93-4fb7-ba0a-b3da4c589f77",
    "created_at": "2025-12-21T10:05:13.698026",
    "status": {
        "type": "active"
    },
    "metadata": {},
    "items": {
        "data": [
            {
                "id": "7f4c2796-177b-4488-850f-4f79cbf0c956",
                "thread_id": "f44ccb5b-7e93-4fb7-ba0a-b3da4c589f77",
                "created_at": "2025-12-21T10:05:13.698026",
                "type": "user_message",
                "content": [
                    {
                        "type": "input_text",
                        "text": "Schedule a Q1 roadmap review with the team."
                    }
                ],
                "attachments": [],
                "inference_options": {
                    "model": "gpt-5"
                }
            },
            {
                "id": "416830e7-a081-4ae0-be69-a3a2c4216fda",
                "thread_id": "f44ccb5b-7e93-4fb7-ba0a-b3da4c589f77",
                "created_at": "2025-12-21T10:05:13.698647",
                "type": "workflow",
                "workflow": {
                    "type": "custom",
                    "tasks": [
                        {
                            "status_indicator": "complete",
                            "type": "custom",
                            "title": "Availability confirmed"
                        },
                        {
                            "status_indicator": "complete",
                            "type": "custom",
                            "title": "Invite ready to review"
                        }
                    ],
                    "summary": {
                        "title": "Invite ready",
                        "icon": "check"
                    },
                    "expanded": false
                }
            },
            {
                "id": "2361bbbe-a6d6-447a-a932-75f50cfa74ba",
                "thread_id": "f44ccb5b-7e93-4fb7-ba0a-b3da4c589f77",
                "created_at": "2025-12-21T10:05:13.699247",
                "type": "assistant_message",
                "content": [
                    {
                        "annotations": [],
                        "text": "I found a slot on Friday, November 7 from 9:00 to 10:00 AM that works for the core team. Review the draft invite below and feel free to add it to your calendar.",
                        "type": "output_text"
                    }
                ]
            },
            {
                "id": "238e1e10-f73a-432a-8deb-73361ff5d128",
                "thread_id": "f44ccb5b-7e93-4fb7-ba0a-b3da4c589f77",
                "created_at": "2025-12-21T10:05:13.699403",
                "type": "widget",
                "widget": {
                    "key": "calendar.draft",
                    "type": "Card",
                    "children": [
                        {
                            "children": [
                                {
                                    "width": 5,
                                    "radius": "full",
                                    "background": "blue-400",
                                    "type": "Box"
                                },
                                {
                                    "children": [
                                        {
                                            "children": [
                                                {
                                                    "type": "Text",
                                                    "value": "Monday, Nov 7",
                                                    "color": "alpha-70",
                                                    "size": "sm"
                                                },
                                                {
                                                    "type": "Spacer"
                                                },
                                                {
                                                    "type": "Text",
                                                    "value": "1:00 - 2:00 PM",
                                                    "color": "blue-400",
                                                    "size": "sm"
                                                }
                                            ],
                                            "type": "Row"
                                        },
                                        {
                                            "type": "Title",
                                            "value": "Q1 roadmap review",
                                            "size": "md"
                                        }
                                    ],
                                    "flex": 1,
                                    "gap": 1,
                                    "type": "Col"
                                }
                            ],
                            "align": "stretch",
                            "gap": 3,
                            "type": "Row"
                        }
                    ],
                    "status": {
                        "text": "Created calendar event",
                        "favicon": "https://chatkit-studio-internal.onrender.com/calendar-status-icon.png"
                    }
                }
            }
        ],
        "has_more": false
    }
}
```
