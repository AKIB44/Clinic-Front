import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { BrandingComponent } from './branding.component';
import { NgIf } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [BrandingComponent, NgIf, TablerIconsModule, MaterialModule],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit {
  constructor() {}
  @Input() showToggle = true;
  /** Desktop only — the lock has no meaning for the mobile/tablet overlay nav. */
  @Input() showLock = false;
  /** True when the sidebar is pinned open (hover expansion disabled). */
  @Input() locked = false;
  @Output() toggleMobileNav = new EventEmitter<void>();
  @Output() toggleCollapsed = new EventEmitter<void>();
  @Output() toggleLock = new EventEmitter<void>();

  ngOnInit(): void {}
}