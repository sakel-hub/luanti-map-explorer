import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KeyboardShortcutsService, ShortcutDefinition } from '../../core/services/keyboard-shortcuts.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LucideKeyboard, LucideX } from '@lucide/angular';

@Component({
  selector: 'app-shortcuts-dialog',
  standalone: true,
  imports: [CommonModule, TranslatePipe, LucideKeyboard, LucideX],
  template: `
    @if (shortcutsService.isShortcutsModalOpen()) {
      <div
        (click)="onBackdropClick($event)"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-dialog-title"
        class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div
          class="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
          (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60 flex-shrink-0">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <svg lucideKeyboard class="w-4 h-4"></svg>
              </div>
              <div>
                <h2 id="shortcuts-dialog-title" class="text-base font-semibold text-slate-100 flex items-center gap-2">
                  {{ 'shortcuts.title' | translate }}
                  <span class="text-[11px] font-normal px-2 py-0.5 rounded-full bg-slate-800 text-sky-400 border border-slate-700">
                    {{ shortcutsService.isMac ? 'macOS (⌘)' : 'Windows / Linux' }}
                  </span>
                </h2>
                <p class="text-xs text-slate-400">{{ 'shortcuts.subtitle' | translate }}</p>
              </div>
            </div>

            <button
              (click)="shortcutsService.closeShortcutsModal()"
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
              title="Close (Esc)"
              aria-label="Close dialog">
              <svg lucideX class="w-5 h-5"></svg>
            </button>
          </div>

          <!-- Scrollable Content -->
          <div class="p-5 overflow-y-auto space-y-6 flex-1 text-sm">
            @for (cat of categories; track cat) {
              <div class="space-y-2">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span class="w-1.5 h-1.5 rounded-full" [ngClass]="getCategoryColor(cat)"></span>
                  {{ getCategoryTranslationKey(cat) | translate }}
                </h3>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                  @for (item of getShortcutsByCategory(cat); track item.id) {
                    <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 border border-slate-800/80 hover:border-slate-700/80 transition">
                      <div class="pr-2 min-w-0">
                        <div class="font-medium text-slate-200 text-xs truncate">{{ item.name }}</div>
                        <div class="text-[11px] text-slate-400 truncate">{{ item.description }}</div>
                      </div>

                      <kbd class="flex-shrink-0 px-2 py-1 text-xs font-semibold bg-slate-800 text-sky-300 border border-slate-700/80 rounded shadow-sm font-mono">
                        {{ shortcutsService.isMac ? item.macKey : item.winKey }}
                      </kbd>
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Footer -->
          <div class="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400 flex-shrink-0">
            <span>Tip: Press <kbd class="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px]">?</kbd> to open anytime.</span>
            <button
              (click)="shortcutsService.closeShortcutsModal()"
              class="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition">
              {{ 'common.close' | translate }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ShortcutsDialogComponent {
  public shortcutsService = inject(KeyboardShortcutsService);

  public readonly categories: Array<'Map & Camera' | 'Modes & Layers' | 'World & Seed' | 'General'> = [
    'Map & Camera',
    'Modes & Layers',
    'World & Seed',
    'General'
  ];

  public getShortcutsByCategory(category: string): ShortcutDefinition[] {
    return this.shortcutsService.shortcuts.filter(s => s.category === category);
  }

  public getCategoryTranslationKey(category: string): string {
    switch (category) {
      case 'Map & Camera':
        return 'shortcuts.catMapCamera';
      case 'Modes & Layers':
        return 'shortcuts.catModesLayers';
      case 'World & Seed':
        return 'shortcuts.catWorldSeed';
      default:
        return 'shortcuts.catGeneral';
    }
  }

  public getCategoryColor(category: string): string {
    switch (category) {
      case 'Map & Camera':
        return 'bg-sky-500';
      case 'Modes & Layers':
        return 'bg-emerald-500';
      case 'World & Seed':
        return 'bg-amber-500';
      default:
        return 'bg-purple-500';
    }
  }

  public onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.shortcutsService.closeShortcutsModal();
    }
  }
}
