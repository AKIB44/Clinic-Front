import { Directive, Input, TemplateRef, ViewContainerRef, inject, effect, untracked } from '@angular/core';
import { PermissionService } from './permission.service';

@Directive({ selector: '[hasPermission]', standalone: true })
export class HasPermissionDirective {
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vc  = inject(ViewContainerRef);
  private readonly ps  = inject(PermissionService);

  private codes: string[] = [];

  @Input() set hasPermission(value: string | string[]) {
    this.codes = Array.isArray(value) ? value : [value];
    untracked(() => this.update());
  }

  constructor() {
    // Re-evaluate whenever the permission set changes (after login / clinic switch).
    effect(() => {
      this.ps.perms(); // tracked — reruns whenever perms signal changes
      this.update();
    });
  }

  private update(): void {
    this.vc.clear();

    // If the backend hasn't returned any permissions yet (RBAC migrations not
    // run, or permissions still loading), show the element unconditionally so
    // the UI isn't silently broken during migration.
    const permsReady = this.ps.loaded() && Object.keys(this.ps.perms()).length > 0;
    const allowed    = !permsReady || this.codes.some(c => this.ps.has(c));

    if (allowed) {
      this.vc.createEmbeddedView(this.tpl);
    }
  }
}
