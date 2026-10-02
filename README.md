# jellzz portfolio

Static website hosted on GitHub Pages at `https://about.jellz.me`.

## Page URLs

| URL | Content file |
| --- | --- |
| `/` | `index.html` |
| `/projects` | `projects/index.html` |
| `/hardware` | `hardware/index.html` |

GitHub Pages serves each section from its directory's `index.html`, so direct
visits and refreshes work. It may redirect `/projects` to `/projects/` when
serving the directory; `js/app.js` normalizes the displayed URL to `/projects`
after the page loads. It also normalizes `/index.html` to `/` and section
`/index.html` URLs to the clean section URL, preserving queries and fragments.

The old pages under `html/sections/projects.html` and
`html/sections/hardware.html` redirect to the clean URLs. Edit the content files
listed above rather than those redirect pages. The `*temp.html` files are old
placeholder pages and are not used by the navigation.

To add a section, create `<section>/index.html` and link to `/<section>`. Keep
asset URLs and `data-include` paths root-relative (starting with `/`) so they
work from every section. No extra routing configuration or build step is needed.

Preview using an HTTP server with the repository root as its document root;
opening HTML files directly does not support the fetched header and footer.
