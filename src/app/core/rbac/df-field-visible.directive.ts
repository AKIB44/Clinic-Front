import { Directive, ElementRef, Input, effect, inject } from '@angular/core';
import { PermissionService } from './permission.service';
import { AbacResource } from '../../auth/auth.models';

/**
 * Attribute directive: hides the host element when the role's field
 * visibility profile excludes the named resource (or specific field).
 *
 *   <span [dfFieldVisible]="'service_performed:final_charge'">
 *     ₹{{ svc.final_charge }}
 *   </span>
 */
@Directive({ selector: '[dfFieldVisible]', standalone: true })
export class DfFieldVisibleDirective {
  private readonly ps = inject(PermissionService);
  private readonly el = inject(ElementRef<HTMLElement>);
  private spec: string | null = null;

  @Input() set dfFieldVisible(spec: string) {
    this.spec = spec;
    this.update();
  }

  constructor() {
    effect(() => {
      this.ps.fieldVisibility();   // tracked
      this.update();
    });
  }

  private update(): void {
    if (!this.spec) return;
    const [resource, field] = this.spec.split(':') as [AbacResource, string?];
    const visible = this.ps.fieldVisible(resource, field);
    this.el.nativeElement.style.display = visible ? '' : 'none';
  }
}
