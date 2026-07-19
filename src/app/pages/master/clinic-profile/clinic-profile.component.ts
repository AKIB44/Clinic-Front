import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ToastService } from '../../../services/toast.service';
import { ClinicsService } from '../../../services/clinics.service';
import { Clinic } from '../../../models/clinic.model';
import { clinicEmailValidators, clinicPhoneValidators, normalizeIndianMobile } from '../../../utils/form-validators';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

@Component({
  selector: 'app-clinic-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './clinic-profile.component.html',
  styleUrls: ['./clinic-profile.component.scss'],
})
export class ClinicProfileComponent implements OnInit {
  private svc   = inject(ClinicsService);
  private toast = inject(ToastService);

  loading      = signal(true);
  saving       = signal(false);
  logoUploading = signal(false);
  logoRemoving  = signal(false);
  logoUrl       = signal<string | null>(null);
  logoError     = signal<string | null>(null);

  form = new FormGroup({
    name:    new FormControl('', [Validators.required]),
    phone:   new FormControl('', clinicPhoneValidators),
    email:   new FormControl('', clinicEmailValidators),
    address: new FormControl('', [Validators.required]),
    city:    new FormControl('', [Validators.required]),
    state:   new FormControl(''),
  });

  ngOnInit() {
    this.svc.get().subscribe({
      next: (r) => {
        this.form.patchValue({
          ...r.clinic,
          phone: normalizeIndianMobile(r.clinic.phone),
        });
        this.logoUrl.set(r.clinic.logo_url ?? null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    this.svc.updateActive(this.form.value as Partial<Clinic>).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Clinic profile updated');
      },
      error: () => { this.saving.set(false); this.toast.error('Save failed. Please try again.'); },
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      this.logoError.set('Only JPEG, PNG, or WebP images are accepted.');
      return;
    }
    if (file.size > MAX_BYTES) {
      this.logoError.set('Image must be under 2 MB.');
      return;
    }

    this.logoError.set(null);
    this.logoUploading.set(true);
    this.svc.uploadLogo(file).subscribe({
      next: (r) => {
        this.logoUrl.set(r.logo_url);
        this.logoUploading.set(false);
        this.toast.success('Logo uploaded');
      },
      error: (e) => {
        const msg = e?.error?.error ?? 'Upload failed. Please try again.';
        this.logoError.set(msg);
        this.toast.error(msg);
        this.logoUploading.set(false);
      },
    });
  }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = normalizeIndianMobile(input.value);
    if (input.value !== digits) {
      this.form.get('phone')!.setValue(digits, { emitEvent: false });
      input.value = digits;
    }
  }

  removeLogo() {
    this.logoRemoving.set(true);
    this.svc.removeLogo().subscribe({
      next: () => {
        this.logoUrl.set(null);
        this.logoRemoving.set(false);
        this.toast.success('Logo removed');
      },
      error: () => this.logoRemoving.set(false),
    });
  }
}
