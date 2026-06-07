import { Directive, Input, TemplateRef, ViewContainerRef, effect, inject, untracked } from '@angular/core';
import { PermissionService } from './permission.service';
import { AbacAction, AbacResource } from '../../auth/auth.models';

/**
 * Structural directive: render only when the policy engine would PERMIT
 * the given (action, resource) for the current subject.
 *
 *   <ng-container *dfIfPermitted="{ action: 'read', resource: 'charge_line' }">
 *     <df-charge-summary />
 *   </ng-container>
 */
@Directive({ selector: '[dfIfPermitted]', standalone: true })
export class DfIfPermittedDirective {
  private readonly ps   = inject(PermissionService);
  private readonly tpl  = inject(TemplateRef<unknown>);
  private readonly vc   = inject(ViewContainerRef);
  private check: { action: AbacAction; resource: AbacResource } | null = null;

  @Input() set dfIfPermitted(value: { action: AbacAction; resource: AbacResource }) {
    this.check = value;
    untracked(() => this.update());
  }

  constructor() {
    effect(() => {
      this.ps.actions();  // tracked
      this.update();
    });
  }

  private update(): void {
    this.vc.clear();
    if (!this.check) return;
    // Permissive when the manifest hasn't loaded yet so the UI isn't blank
    // while the first /me/permissions call is in flight.
    if (!this.ps.loaded()) {
      this.vc.createEmbeddedView(this.tpl);
      return;
    }
    if (this.ps.can(this.check.action, this.check.resource)) {
      this.vc.createEmbeddedView(this.tpl);
    }
  }
}
