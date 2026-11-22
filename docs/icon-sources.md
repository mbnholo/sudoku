# Interface icon sources

The game bundles SVG assets locally so icons and flags render consistently on iPhone, Android, and desktop, including offline. The files were obtained from these open source projects on 22 November 2026:

| Assets | Source | License |
| --- | --- | --- |
| `src/assets/ui/undo.svg`, `erase.svg`, `notes.svg`, `hint.svg`, `help.svg` | [Lucide icons](https://github.com/lucide-icons/lucide/tree/main/icons): `undo-2.svg`, `delete.svg`, `pencil.svg`, `lightbulb.svg`, `info.svg` | ISC; `info.svg` also includes a Feather-derived MIT notice in Lucide's license |
| `src/assets/flags/en.svg`, `fr.svg`, `es.svg`, `it.svg`, `pt.svg` | [flag-icons](https://github.com/lipis/flag-icons/tree/main/flags/4x3): `gb.svg`, `fr.svg`, `es.svg`, `it.svg`, `pt.svg` | MIT |

The Lucide SVGs use the game's fixed green stroke color. The original license texts are included in [`src/assets/licenses/lucide-LICENSE`](../src/assets/licenses/lucide-LICENSE) and [`src/assets/licenses/flag-icons-LICENSE`](../src/assets/licenses/flag-icons-LICENSE). The project's own code remains under the repository's [MIT license](../LICENSE).
