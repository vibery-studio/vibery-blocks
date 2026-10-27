=== Vibery Blocks ===
Contributors: viberystudio
Tags: blocks, layout, full-width, section, grid
Requires at least: 6.3
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Layout blocks for pages built with Vibery: full-bleed sections, fluid grids, cells and a countdown. Free, no account, no licence.

== Description ==

* **Band** (`kit/band`) — a true full-width section, even inside a theme with side padding.
* **Split** (`kit/split`) — a fluid n-column CSS grid that stacks at a breakpoint. Never `core/columns`.
* **Cell** (`kit/cell`) — a split child (padding, vertical alignment, cover image).
* **Countdown** (`kit/countdown`) — server-rendered, ticks on the front end only.

Rendering never depends on a subscription or a remote service: there is no licence check and no network call in any render path.

**Eject.** Pages built with these blocks can be made independent of this plugin: layout is baked into core blocks plus the theme's Additional CSS, and the change can be reverted byte-for-byte. Administrators with Site Manager (or the REST API) can run it per page.

The block names stay `kit/*` so pages already built keep working.

== Installation ==

Upload the zip under Plugins → Add New → Upload Plugin and activate. If the older "Kit Blocks" plugin is active, deactivate it: Vibery Blocks steps aside until you do, and your pages are unchanged.

== Changelog ==

= 1.0.0 =
First release: the Kit Blocks runtime as a free GPL plugin — apiVersion 3, deprecation path for the original static-save blocks, per-page compiled CSS, scoped KSES, eject.
