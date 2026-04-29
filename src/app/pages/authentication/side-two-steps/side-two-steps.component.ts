import { Component, ElementRef, QueryList, ViewChildren, inject } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import { FormsModule, ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-side-two-steps',
  standalone: true,
  imports: [RouterModule, MaterialModule, FormsModule, ReactiveFormsModule, CommonModule],
  templateUrl: './side-two-steps.component.html',
})
export class AppSideTwoStepsComponent {
  options = this.settings.getOptions();

  // 6 individual digit controls
  form = new FormGroup({
    d1: new FormControl('', [Validators.required, Validators.pattern(/^\d$/)]),
    d2: new FormControl('', [Validators.required, Validators.pattern(/^\d$/)]),
    d3: new FormControl('', [Validators.required, Validators.pattern(/^\d$/)]),
    d4: new FormControl('', [Validators.required, Validators.pattern(/^\d$/)]),
    d5: new FormControl('', [Validators.required, Validators.pattern(/^\d$/)]),
    d6: new FormControl('', [Validators.required, Validators.pattern(/^\d$/)]),
  });

  isSubmitting = false;
  error = '';

  @ViewChildren('digitInput') digitInputs!: QueryList<ElementRef<HTMLInputElement>>;

  constructor(private settings: CoreService, private router: Router) {}

  onDigitInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '').slice(-1);
    input.value = value;

    const controls = Object.keys(this.form.controls) as (keyof typeof this.form.controls)[];
    (this.form.controls[controls[index]] as FormControl).setValue(value);

    if (value && index < 5) {
      const next = this.digitInputs.get(index + 1);
      next?.nativeElement.focus();
    }
  }

  onKeydown(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace') {
      const controls = Object.keys(this.form.controls) as (keyof typeof this.form.controls)[];
      const ctrl = this.form.controls[controls[index]] as FormControl;
      if (!ctrl.value && index > 0) {
        const prev = this.digitInputs.get(index - 1);
        prev?.nativeElement.focus();
      }
    }
  }

  get otp(): string {
    return Object.values(this.form.controls)
      .map((c) => (c as FormControl).value ?? '')
      .join('');
  }

  submit() {
    if (this.otp.length < 6) return;
    // OTP verification endpoint not yet available on backend.
    // Navigate to dashboard as placeholder.
    this.router.navigate(['/dashboards/dashboard1']);
  }
}
