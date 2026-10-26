import { Component, EventEmitter, HostListener, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MapStore } from '../../core/state/map.store';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import {
  LucideShare2,
  LucideX,
  LucideCopy,
  LucideCheck,
  LucideMessageSquare,
  LucideGlobe,
  LucideExternalLink
} from '@lucide/angular';

@Component({
  selector: 'app-share-dialog',
  standalone: true,
  imports: [
    CommonModule,
    TranslatePipe,
    TooltipDirective,
    LucideShare2,
    LucideX,
    LucideCopy,
    LucideCheck,
    LucideMessageSquare,
    LucideGlobe,
    LucideExternalLink
  ],
  template: `
    <div
      class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-dialog-title"
      (click)="onBackdropClick($event)">
      <div
        class="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <svg lucideShare2 class="w-5 h-5"></svg>
            </div>
            <div>
              <h2 id="share-dialog-title" class="text-base font-bold text-slate-100">
                {{ 'share.title' | translate }}
              </h2>
              <p class="text-xs text-slate-400">{{ 'share.subtitle' | translate }}</p>
            </div>
          </div>
          <button
            type="button"
            (click)="close.emit()"
            class="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition"
            aria-label="Close dialog">
            <svg lucideX class="w-5 h-5"></svg>
          </button>
        </div>

        <div class="p-5 space-y-4">
          <!-- Stateful Summary Badge -->
          <div class="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-2">
              <span class="text-slate-400">Seed:</span>
              <span class="font-mono font-bold text-sky-400">{{ mapStore.worldConfig().seed }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-slate-400">Mapgen:</span>
              <span class="font-mono uppercase text-emerald-400">{{ mapStore.worldConfig().mapgen }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-slate-400">Cursor:</span>
              <span class="font-mono text-amber-300">({{ mapStore.cursorPos().x }}, {{ mapStore.cursorPos().z }})</span>
            </div>
          </div>

          <!-- Copy Link Bar -->
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Deep-Link URL (Includes Seed &amp; Coordinates)</label>
            <div class="flex items-center gap-2">
              <input
                type="text"
                readonly
                [value]="shareUrl()"
                class="flex-1 bg-slate-950 border border-slate-700/80 text-slate-200 text-xs rounded-lg px-3 py-2 font-mono select-all focus:outline-none focus:border-sky-500" />
              <button
                type="button"
                (click)="copyLink()"
                class="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition">
                @if (copied()) {
                  <svg lucideCheck class="w-4 h-4 text-emerald-300"></svg>
                  <span>{{ 'share.linkCopied' | translate }}</span>
                } @else {
                  <svg lucideCopy class="w-4 h-4"></svg>
                  <span>{{ 'share.copyLink' | translate }}</span>
                }
              </button>
            </div>
          </div>

          <!-- Native Device Share (if available) -->
          @if (canNativeShare) {
            <button
              type="button"
              (click)="shareNative()"
              class="w-full py-2.5 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 transition">
              <svg lucideShare2 class="w-4 h-4"></svg>
              <span>{{ 'share.shareViaDevice' | translate }}</span>
            </button>
          }

          <!-- Social Share Grid -->
          <div>
            <span class="block text-xs font-semibold text-slate-300 mb-2">Share on Social Platforms</span>
            <div class="grid grid-cols-2 gap-2.5">
              <!-- X / Twitter -->
              <a
                [href]="twitterShareUrl()"
                target="_blank"
                rel="noopener noreferrer"
                class="p-2.5 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/50 rounded-xl flex items-center gap-2.5 text-xs text-slate-200 transition group">
                <span class="text-base">𝕏</span>
                <span class="font-medium group-hover:text-sky-400 transition">{{ 'share.shareOnX' | translate }}</span>
              </a>

              <!-- Reddit -->
              <a
                [href]="redditShareUrl()"
                target="_blank"
                rel="noopener noreferrer"
                class="p-2.5 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-orange-500/50 rounded-xl flex items-center gap-2.5 text-xs text-slate-200 transition group">
                <svg lucideGlobe class="w-4 h-4 text-orange-400"></svg>
                <span class="font-medium group-hover:text-orange-400 transition">{{ 'share.shareOnReddit' | translate }}</span>
              </a>

              <!-- WhatsApp -->
              <a
                [href]="whatsAppShareUrl()"
                target="_blank"
                rel="noopener noreferrer"
                class="p-2.5 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-xl flex items-center gap-2.5 text-xs text-slate-200 transition group">
                <svg lucideMessageSquare class="w-4 h-4 text-emerald-400"></svg>
                <span class="font-medium group-hover:text-emerald-400 transition">{{ 'share.shareOnWhatsApp' | translate }}</span>
              </a>

              <!-- Facebook -->
              <a
                [href]="facebookShareUrl()"
                target="_blank"
                rel="noopener noreferrer"
                class="p-2.5 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/50 rounded-xl flex items-center gap-2.5 text-xs text-slate-200 transition group">
                <svg lucideShare2 class="w-4 h-4 text-blue-400"></svg>
                <span class="font-medium group-hover:text-blue-400 transition">{{ 'share.shareOnFacebook' | translate }}</span>
              </a>
            </div>
          </div>

          <!-- Discord / Markdown copy -->
          <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <button
              type="button"
              (click)="copyDiscordMarkdown()"
              class="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1.5 transition">
              <svg lucideCopy class="w-4 h-4"></svg>
              <span>{{ 'share.shareOnDiscord' | translate }}</span>
            </button>

            <a
              href="https://github.com/sakel-hub/luanti-map-explorer"
              target="_blank"
              rel="noopener noreferrer"
              [appTooltip]="'View Luanti Map Explorer source code on GitHub'"
              class="text-xs text-slate-400 hover:text-slate-200 font-medium flex items-center gap-1.5 transition">
              <svg lucideExternalLink class="w-4 h-4"></svg>
              <span>{{ 'share.viewGitHub' | translate }}</span>
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-5 py-3 bg-slate-950/80 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            (click)="close.emit()"
            class="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition">
            {{ 'common.close' | translate }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class ShareDialogComponent {
  @Output() close = new EventEmitter<void>();

  public readonly mapStore = inject(MapStore);
  public readonly copied = signal<boolean>(false);

  public readonly shareUrl = computed(() => {
    const base =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`
        : 'https://sakel-hub.github.io/luanti-map-explorer/';
    const cfg = this.mapStore.worldConfig();
    const pos = this.mapStore.cursorPos();
    const cam = this.mapStore.cameraState();
    const params = new URLSearchParams({
      seed: String(cfg.seed),
      mg: cfg.mapgen,
      mode: this.mapStore.viewMode(),
      x: String(pos.x),
      z: String(pos.z),
      zoom: cam.zoom.toFixed(1)
    });
    return `${base}?${params.toString()}`;
  });

  public readonly shareTitle = computed(() => {
    const cfg = this.mapStore.worldConfig();
    const sample = this.mapStore.cursorSample();
    return `Luanti Map & Biome Explorer — Seed ${cfg.seed} (${cfg.mapgen.toUpperCase()}) at (${sample.x}, ${sample.z}) [${sample.biome.name}]`;
  });

  public readonly shareText =
    'Explore Luanti / Minetest seeds, interactive Heat/Humidity Voronoi biome diagrams, 3D terrain relief, and SQLite world maps in your browser!';

  get canNativeShare(): boolean {
    return typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function';
  }

  public readonly twitterShareUrl = computed(
    () =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(this.shareTitle())}&url=${encodeURIComponent(this.shareUrl())}`
  );

  public readonly redditShareUrl = computed(
    () =>
      `https://www.reddit.com/submit?url=${encodeURIComponent(this.shareUrl())}&title=${encodeURIComponent(this.shareTitle())}`
  );

  public readonly whatsAppShareUrl = computed(
    () => `https://api.whatsapp.com/send?text=${encodeURIComponent(this.shareTitle() + ' ' + this.shareUrl())}`
  );

  public readonly facebookShareUrl = computed(
    () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.shareUrl())}`
  );

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }

  async copyLink(): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(this.shareUrl());
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      }
    } catch {
      // Ignore clipboard error
    }
  }

  async copyDiscordMarkdown(): Promise<void> {
    const text = `**${this.shareTitle()}**\n${this.shareText}\n${this.shareUrl()}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      }
    } catch {
      // Ignore clipboard error
    }
  }

  async shareNative(): Promise<void> {
    try {
      if (this.canNativeShare) {
        await (navigator as any).share({
          title: this.shareTitle(),
          text: this.shareText,
          url: this.shareUrl()
        });
      }
    } catch {
      // User cancelled share
    }
  }
}
