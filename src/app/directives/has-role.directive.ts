import { Directive, Input, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { RbacService } from '../auth/rbac.service';
import { AppRole } from '../auth/auth.models';

@Directive({ selector: '[hasRole]', standalone: true })
export class HasRoleDirective {
  private tpl  = inject(TemplateRef<unknown>);
  private vc   = inject(ViewContainerRef);
  private rbac = inject(RbacService);

  @Input() set hasRole(roles: AppRole | AppRole[]) {
    const list = Array.isArray(roles) ? roles : [roles];
    this.vc.clear();
    if (this.rbac.hasAnyRole(list)) this.vc.createEmbeddedView(this.tpl);
  }
}
