## What this run builds, and what it reuses

`js` schedules **15 build tasks**: **1 rebuilt** because it changed, and **14 expected from cache** — pulled in by `dependsOn: ["^build"]` because a consumer needs their `dist`, not because anything about them moved.

This is the whole of why an incremental push costs minutes rather than tens of minutes,
and it is the one thing the job graph above cannot show.

```mermaid
flowchart BT
  subgraph g_frontend_apispec_view["apispec-view"]
    p_apispec_view_json_schema_viewer["apispec-view-json-schema-viewer"]:::changed
    p_apispec_view_root["apispec-view-root"]:::cached
  end
  p_apispec_view_root --> p_apispec_view_json_schema_viewer
  classDef changed fill:#bb800933,stroke:#bf8700,stroke-width:2px
  classDef cached fill:#818b9826,stroke:#818b98,stroke-width:1px
  classDef component fill:#818b980d,stroke:#818b98,stroke-width:1px,stroke-dasharray:4 3
  class g_frontend_apispec_view component
```

Amber is work this run will actually do; grey is a cache restore — the same amber and
grey the Actions job graph uses for running and skipped. Arrows run dependency →
consumer, which is the order the tasks execute in.
Dashed boxes group the projects of one component directory; they are not tasks.

Nodes are the changed projects and their **direct** dependencies. The other
**13** in the closure are reached through these and are cache restores
for the same reason.

| | Selected | Not run |
|---|---|---|
| screenshot suites | _none_ | **1,888 screenshot tests**, ~20 min of container time |
| go modules | _none_ | the `go` job is skipped — not passed with nothing to do |
| images | `ui-portal` | built if the content hash is new, else retagged in ~1s |
